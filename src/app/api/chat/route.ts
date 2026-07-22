import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { createHuggingFace } from '@ai-sdk/huggingface';
import { google } from '@ai-sdk/google';
import { connectToDatabase, CODE_CHUNKS_COLLECTION, CodeChunk, CHATS_COLLECTION, ChatThread, ChatMessage } from '@/lib/services/db';
import { AIRouter, AIProvider } from '@/lib/services/ai-router';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

// Primary Provider
const hf = createHuggingFace({
  apiKey: process.env.HF_TOKEN,
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    const { messages, repo_id, chatId } = await req.json();

    if (!repo_id) {
      return new Response(JSON.stringify({ error: 'repo_id is required' }), { status: 400 });
    }

    if (!chatId) {
      return new Response(JSON.stringify({ error: 'chatId is required' }), { status: 400 });
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages are required' }), { status: 400 });
    }

    console.log('[Chat Route] Incoming messages:', JSON.stringify(messages, null, 2));

    // Convert UI messages to core messages manually to avoid SDK bugs
    const modelMessages = messages.map((m: any) => {
      let textContent = '';
      if (m.parts && Array.isArray(m.parts)) {
        textContent = m.parts.map((p: any) => p.type === 'text' ? p.text : '').join('');
      } else {
        textContent = m.content || m.text || '';
      }
      return {
        role: m.role,
        content: textContent
      };
    });

    // Extract the latest user message to query the vector database
    const lastMessage = modelMessages[modelMessages.length - 1];
    if (lastMessage.role !== 'user') {
      return new Response(JSON.stringify({ error: 'Last message must be from user' }), { status: 400 });
    }
    const userQuery = typeof lastMessage.content === 'string' 
      ? lastMessage.content 
      : (lastMessage.content as any[]).filter(c => c.type === 'text').map(c => c.text).join(' ');

    console.log(`[Chat] Querying repo ${repo_id}: "${userQuery}"`);

    const { db } = await connectToDatabase();
    const collection = db.collection<CodeChunk>(CODE_CHUNKS_COLLECTION);

    // 1. Determine which provider was used for this repository
    const sampleDoc = await collection.findOne({ repo_id });
    const provider: AIProvider = sampleDoc?.provider || 'huggingface'; // Default to huggingface for older docs

    // 2. Generate Query Embedding using Strict Provider Matching
    let queryEmbedding: number[] | null = null;
    let fallbackContextMessage = '';
    
    try {
      queryEmbedding = await AIRouter.generateQueryEmbedding(userQuery, provider);
    } catch (err: any) {
      if (err.message === 'PROVIDER_DOWN') {
        // Graceful Query Failure
        console.warn(`[Chat] Strict provider embedding failed for ${provider}. Bypassing vector search.`);
        fallbackContextMessage = "";
      } else {
        console.error('[Chat] Failed to generate query embedding:', err);
        return new Response(JSON.stringify({ error: 'Failed to process query context' }), { status: 500 });
      }
    }

    let results: any[] = [];
    if (queryEmbedding) {
      // 3. Perform MongoDB Vector Search with Pre-filtering
      const embeddingField = provider === 'huggingface' ? 'embedding_hf' : 'embedding_gemini';
      
      const pipeline = [
        {
          $vectorSearch: {
            index: "default", // NOTE: Ensure Atlas Search Index supports the chosen path!
            path: embeddingField,
            queryVector: queryEmbedding,
            numCandidates: 500, 
            limit: 50,           
            filter: {
              repo_id: repo_id  
            }
          }
        },
        {
          $project: {
            _id: 0,
            file_path: 1,
            code_content: 1,
            score: { $meta: "vectorSearchScore" }
          }
        }
      ];

      results = await collection.aggregate(pipeline).toArray();
      console.log('[Chat Route] Retrieved chunks count:', results.length);
    }

    // 4. Assemble and Truncate Context
    const MAX_CONTEXT_LENGTH = 60000;
    let currentContextLength = fallbackContextMessage.length;
    const contextChunks: string[] = [fallbackContextMessage];
    const sourceFiles: Set<string> = new Set();

    for (const res of results) {
      const chunkString = `File: ${res.file_path}\n\`\`\`\n${res.code_content}\n\`\`\`\n\n`;
      if (currentContextLength + chunkString.length > MAX_CONTEXT_LENGTH) {
        const remainingSpace = MAX_CONTEXT_LENGTH - currentContextLength;
        if (remainingSpace > 100) {
           contextChunks.push(chunkString.slice(0, remainingSpace) + '\n...[TRUNCATED]\n\`\`\`\n\n');
           sourceFiles.add(res.file_path);
        }
        break;
      } else {
        contextChunks.push(chunkString);
        currentContextLength += chunkString.length;
        sourceFiles.add(res.file_path);
      }
    }

    const assembledContext = contextChunks.join('');

    // 5. Construct System Prompt
    const systemPrompt = queryEmbedding 
      ? `You are a Senior Software Engineer acting as a codebase assistant. 
You are provided with semantic code chunks retrieved from the repository to use as context.

CONTEXT:
${assembledContext}

INSTRUCTIONS:
1. Answer the user's question accurately based on the provided codebase context.
2. When referencing code, explicitly cite the file path.
3. If the provided context does not explicitly contain a direct answer (e.g., for high-level architectural questions), analyze the provided code chunks to infer the architecture, patterns, and logic to the best of your ability.
4. You may supplement your answer with your general knowledge of programming, frameworks, and this specific repository (if public), but clearly state when you are making assumptions outside of the provided context.`
      : `You are a Senior Engineer Agent.
[SYSTEM ALERT: Vector search is temporarily unavailable due to embedding API rate limits, so you do not have direct access to the codebase chunks.]

INSTRUCTIONS:
1. Answer the user's question based on your general knowledge of the repository (if it is a well-known public library).
2. IMPORTANT: You MUST start your response by politely informing the user that codebase search is temporarily unavailable due to rate limits, and that you are answering from general knowledge.`;

    const saveChatThread = async (completionText: string) => {
      if (!userId) return; // Guest Mode: do not persist to DB

      try {
        const { db } = await connectToDatabase();
        const collection = db.collection<ChatThread>(CHATS_COLLECTION);
        
        const now = new Date();
        const userMsg: ChatMessage = {
          id: messages[messages.length - 1].id || crypto.randomUUID(),
          role: 'user',
          content: userQuery,
          createdAt: now,
        };
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: completionText,
          createdAt: now,
        };

        const existingThread = await collection.findOne({ _id: chatId as any, userId });

        if (!existingThread) {
          const title = userQuery.slice(0, 40) + (userQuery.length > 40 ? '...' : '');
          await collection.insertOne({
            _id: chatId as any,
            userId,
            repoId: repo_id,
            title,
            messages: [userMsg, assistantMsg],
            createdAt: now,
            updatedAt: now,
          });
        } else {
          await collection.updateOne(
            { _id: chatId as any, userId },
            {
              $push: { messages: { $each: [userMsg, assistantMsg] } },
              $set: { updatedAt: now },
            }
          );
        }
      } catch (err) {
        console.error('[Chat] Failed to save chat thread:', err);
      }
    };

    // 6. Stream the Response using Vercel AI SDK with LLM Failover
    let result;
    try {
      // Primary: Hugging Face (Qwen 7B)
      result = await streamText({
        model: hf('Qwen/Qwen2.5-Coder-7B-Instruct'),
        system: systemPrompt,
        messages: modelMessages,
        onFinish: async (event) => {
          console.log('[Chat Stream Finished]', {
            finishReason: event.finishReason,
            textLength: event.text.length,
            usage: event.usage,
          });
          await saveChatThread(event.text);
        },
      });
    } catch (llmError: any) {
      const msg = llmError?.message || 'Unknown error';
      console.warn(`[AI Router] Hugging Face stream failed (${msg}), failing over to Google Gemini`);
      
      try {
        // Secondary: Google Gemini
        result = await streamText({
          model: google('gemini-2.5-flash'),
          system: systemPrompt,
          messages: modelMessages,
          onFinish: async (event) => {
            console.log('[Chat Stream Finished (Gemini)]', {
              finishReason: event.finishReason,
              textLength: event.text.length,
              usage: event.usage,
            });
            await saveChatThread(event.text);
          },
        });
      } catch (geminiError: any) {
        console.error('[Chat Route] Error generating gemini text:', geminiError);
        throw geminiError;
      }
    }

    const responseHeaders = new Headers();
    responseHeaders.set('x-source-files', Array.from(sourceFiles).join(','));

    return result.toUIMessageStreamResponse({ headers: responseHeaders });

  } catch (error: any) {
    console.error('[Chat Route] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
  }
}
