import { NextRequest } from 'next/server';
import { GithubService } from '@/lib/services/github';
import { ChunkingService } from '@/lib/services/chunking';
import { HuggingFaceService } from '@/lib/services/huggingface';
import { connectToDatabase, CODE_CHUNKS_COLLECTION, CodeChunk } from '@/lib/services/db';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * SSE event types emitted to the client:
 *
 *   phase    – high-level progress ("Fetching repository tree…")
 *   file     – a single file was chunked + embedded successfully
 *   complete – the entire repo finished ingesting
 *   error    – something went wrong; includes a message
 */

export async function POST(req: NextRequest) {
  let repo_id = '';

  // ── Parse + validate the request body synchronously ──────────────
  let url: string;
  try {
    const body = await req.json();
    url = body.url;
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'GitHub URL is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── Create the SSE stream ────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      /** Helper: enqueue one SSE frame. */
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        // 1. Parse the URL
        const { owner, repo } = GithubService.parseUrl(url);
        repo_id = `${owner}/${repo}`;

        // 2. Fetch repo tree
        send('phase', { message: `Fetching repository tree for ${repo_id}…` });
        const branch = await GithubService.getDefaultBranch(owner, repo);
        const filePaths = await GithubService.getRepositoryTree(owner, repo, branch);
        const limitedFilePaths = filePaths.slice(0, 500);

        // 3. Fetch raw file contents
        send('phase', {
          message: `Fetching ${limitedFilePaths.length} files from ${branch}…`,
          totalFiles: limitedFilePaths.length,
        });
        const files = await GithubService.fetchRawFiles(owner, repo, branch, limitedFilePaths);

        // 4. Prepare DB
        send('phase', { message: 'Preparing database…' });
        const { db } = await connectToDatabase();
        const collection = db.collection<CodeChunk>(CODE_CHUNKS_COLLECTION);
        await collection.deleteMany({ repo_id });

        // 5. Process each file — stream per-file progress
        let totalChunksInserted = 0;
        let filesProcessed = 0;

        for (const file of files) {
          if (!file.content || file.content.trim() === '') continue;

          const chunks = await ChunkingService.chunkFile(file.path, file.content);
          const docsToInsert: CodeChunk[] = [];

          for (const chunk of chunks) {
            const enriched_text = `File: ${file.path}\nType: ${chunk.node_type}\nDependencies: []\nCode:\n${chunk.code_content}`;

            try {
              const embedding = await HuggingFaceService.generateEmbedding(enriched_text);
              docsToInsert.push({
                repo_id,
                file_path: file.path,
                node_type: chunk.node_type,
                node_name: chunk.node_name,
                code_content: chunk.code_content,
                embedding,
                metadata: {
                  dependencies: [],
                  start_line: chunk.start_line,
                  end_line: chunk.end_line,
                },
              });
            } catch (embedError) {
              console.error(`[Ingest] Failed to embed chunk in ${file.path}:`, embedError);
            }
          }

          if (docsToInsert.length > 0) {
            await collection.insertMany(docsToInsert);
            totalChunksInserted += docsToInsert.length;
          }

          filesProcessed++;

          // ── Emit per-file progress ──
          send('file', {
            file: file.path,
            status: 'embedded',
            chunks: docsToInsert.length,
            filesProcessed,
            totalFiles: files.length,
          });
        }

        // 6. Done
        console.log(`[Ingest] Success! Inserted ${totalChunksInserted} chunks for ${repo_id}.`);
        send('complete', {
          repo_id,
          filesProcessed,
          chunksInserted: totalChunksInserted,
        });
      } catch (error: any) {
        console.error('[Ingest] Error:', error);

        // Rollback partial data
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

        send('error', { message: error.message || 'Internal Server Error' });
      } finally {
        controller.close();
      }
    },
  });

  // ── Return the SSE response ──────────────────────────────────────
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering if proxied
    },
  });
}
