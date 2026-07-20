import { NextRequest } from 'next/server';
import { streamText, convertToModelMessages } from 'ai';
import { createHuggingFace } from '@ai-sdk/huggingface';
import { connectToDatabase, CODE_CHUNKS_COLLECTION } from '@/lib/services/db';
import { HuggingFaceService } from '@/lib/services/huggingface';

export const runtime = 'nodejs';

// Use the dedicated Hugging Face provider — routes to the correct
// HF Responses API endpoint and handles model routing automatically.
const hf = createHuggingFace({
  apiKey: process.env.HF_TOKEN,
});

export async function POST(req: NextRequest) {
  try {
    const { messages, repo_id } = await req.json();

    if (!repo_id) {
      return new Response(JSON.stringify({ error: 'repo_id is required' }), { status: 400 });
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages are required' }), { status: 400 });
    }

    // Convert UI messages to model messages
    const modelMessages = await convertToModelMessages(messages);

    // Extract the latest user message to query the vector database
    const lastMessage = modelMessages[modelMessages.length - 1];
    if (lastMessage.role !== 'user') {
      return new Response(JSON.stringify({ error: 'Last message must be from user' }), { status: 400 });
    }
    const userQuery = typeof lastMessage.content === 'string' 
      ? lastMessage.content 
      : (lastMessage.content as any[]).filter(c => c.type === 'text').map(c => c.text).join(' ');

    console.log(`[Chat] Querying repo ${repo_id}: "${userQuery}"`);

    let queryEmbedding: number[];
    try {
      queryEmbedding = await HuggingFaceService.generateEmbedding(userQuery);
    } catch (err) {
      console.error('[Chat] Failed to generate query embedding:', err);
      return new Response(JSON.stringify({ error: 'Failed to process query context' }), { status: 500 });
    }

    // 2. Perform MongoDB Vector Search with Pre-filtering
    const { db } = await connectToDatabase();
    const collection = db.collection(CODE_CHUNKS_COLLECTION);

    const pipeline = [
      {
        $vectorSearch: {
          index: "default", 
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: 100, 
          limit: 5,           
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

    const results = await collection.aggregate(pipeline).toArray();

    // 3. Assemble and Truncate Context
    const MAX_CONTEXT_LENGTH = 20000; // Character limit for context chunks (leaving room for system prompt, chat history, and generation)
    let currentContextLength = 0;
    const contextChunks: string[] = [];
    const sourceFiles: Set<string> = new Set();

    for (const res of results) {
      const chunkString = `File: ${res.file_path}\n\`\`\`\n${res.code_content}\n\`\`\`\n\n`;
      if (currentContextLength + chunkString.length > MAX_CONTEXT_LENGTH) {
        // If adding the whole chunk exceeds the limit, we can either skip it or truncate the string.
        // For simplicity, we'll slice it to fit the remaining budget and append an indicator.
        const remainingSpace = MAX_CONTEXT_LENGTH - currentContextLength;
        if (remainingSpace > 100) { // Only append if we have meaningful space left
           contextChunks.push(chunkString.slice(0, remainingSpace) + '\n...[TRUNCATED]\n\`\`\`\n\n');
           sourceFiles.add(res.file_path);
        }
        break; // Stop adding more chunks
      } else {
        contextChunks.push(chunkString);
        currentContextLength += chunkString.length;
        sourceFiles.add(res.file_path);
      }
    }

    const assembledContext = contextChunks.join('');

    // 4. Construct System Prompt
    const systemPrompt = `You are a Senior Engineer Agent answering questions about a specific codebase. 
You are provided with semantic code chunks retrieved from the repository to use as context.

CONTEXT:
${assembledContext}

INSTRUCTIONS:
1. Answer the user's question accurately based ONLY on the provided context.
2. When referencing code, explicitly cite the file path.
3. If the answer is not present in the provided context, output exactly: 'I cannot find the answer to this in the provided codebase context.'
4. Do not guess or hallucinate information outside the provided context.`;

    // 5. Stream the Response using Vercel AI SDK
    const result = await streamText({
      model: hf('Qwen/Qwen2.5-Coder-32B-Instruct'),
      system: systemPrompt,
      messages: modelMessages,
    });

    // Return a UIMessageStream response — this is the format that
    // DefaultChatTransport / useChat expects in ai SDK v6.x.
    // It produces Server-Sent Events with structured UIMessageChunk JSON,
    // which the frontend transport parses into messages + parts.
    const responseHeaders = new Headers();
    responseHeaders.set('x-source-files', Array.from(sourceFiles).join(','));

    return result.toUIMessageStreamResponse({ headers: responseHeaders });

  } catch (error: any) {
    console.error('[Chat] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
  }
}
