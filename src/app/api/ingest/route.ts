import { NextRequest, NextResponse } from 'next/server';
import { GithubService } from '@/lib/services/github';
import { ChunkingService } from '@/lib/services/chunking';
import { HuggingFaceService } from '@/lib/services/huggingface';
import { connectToDatabase, CODE_CHUNKS_COLLECTION, CodeChunk } from '@/lib/services/db';

export const runtime = 'nodejs';
// Increase timeout for this route if deployed to Vercel (Pro plan needed for >60s, but we'll try to keep it under 60s or stream)
export const maxDuration = 300; 

export async function POST(req: NextRequest) {
  let repo_id = '';
  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'GitHub URL is required' }, { status: 400 });
    }

    const { owner, repo } = GithubService.parseUrl(url);
    repo_id = `${owner}/${repo}`;

    // 1. Fetch Repository Info
    console.log(`[Ingest] Fetching repo info for ${repo_id}...`);
    const branch = await GithubService.getDefaultBranch(owner, repo);
    const filePaths = await GithubService.getRepositoryTree(owner, repo, branch);
    
    // For MVP, we might want to hard limit to 500 files to avoid timeouts/OOM
    const limitedFilePaths = filePaths.slice(0, 500);

    // 2. Fetch Raw Files
    console.log(`[Ingest] Fetching ${limitedFilePaths.length} files...`);
    const files = await GithubService.fetchRawFiles(owner, repo, branch, limitedFilePaths);

    // Connect to DB and clear existing chunks for this repo
    const { db } = await connectToDatabase();
    const collection = db.collection<CodeChunk>(CODE_CHUNKS_COLLECTION);
    await collection.deleteMany({ repo_id });

    // 3. Process each file (Chunking & Embedding)
    console.log(`[Ingest] Chunking and embedding ${files.length} files...`);
    
    let totalChunksInserted = 0;

    for (const file of files) {
      if (!file.content || file.content.trim() === '') continue;

      const chunks = await ChunkingService.chunkFile(file.path, file.content);

      const docsToInsert: CodeChunk[] = [];

      for (const chunk of chunks) {
        // Prepare enriched text
        const enriched_text = `File: ${file.path}
Type: ${chunk.node_type}
Dependencies: []
Code:
${chunk.code_content}`;

        try {
          // Generate embedding
          const embedding = await HuggingFaceService.generateEmbedding(enriched_text);

          // Create document
          docsToInsert.push({
            repo_id,
            file_path: file.path,
            node_type: chunk.node_type,
            node_name: chunk.node_name,
            code_content: chunk.code_content,
            embedding, // 1024-dimensional
            metadata: {
              dependencies: [],
              start_line: chunk.start_line,
              end_line: chunk.end_line,
            },
          });
        } catch (embedError) {
          console.error(`[Ingest] Failed to embed chunk in ${file.path}:`, embedError);
          // Skip this chunk if embedding fails
        }
      }

      // Insert into MongoDB in batches per file
      if (docsToInsert.length > 0) {
        await collection.insertMany(docsToInsert);
        totalChunksInserted += docsToInsert.length;
      }
    }

    console.log(`[Ingest] Success! Inserted ${totalChunksInserted} chunks for ${repo_id}.`);

    return NextResponse.json({
      success: true,
      message: `Successfully ingested repository`,
      repo_id,
      filesProcessed: files.length,
      chunksInserted: totalChunksInserted,
    });

  } catch (error: any) {
    console.error('[Ingest] Error:', error);

    // Rollback: Attempt to clean up partially ingested chunks
    try {
      if (repo_id) {
        const { db } = await connectToDatabase();
        const collection = db.collection<CodeChunk>(CODE_CHUNKS_COLLECTION);
        await collection.deleteMany({ repo_id });
        console.log(`[Ingest Rollback] Cleaned up partial data for ${repo_id}`);
      }
    } catch (cleanupError) {
      console.error('[Ingest Rollback] Failed to clean up partial data:', cleanupError);
    }

    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
