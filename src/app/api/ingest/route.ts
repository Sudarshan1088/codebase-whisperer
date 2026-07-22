import { NextRequest } from 'next/server';
import { GithubService } from '@/lib/services/github';
import { ChunkingService, Chunk } from '@/lib/services/chunking';
import { AIRouter, AIProvider } from '@/lib/services/ai-router';
import { connectToDatabase, CODE_CHUNKS_COLLECTION, CodeChunk } from '@/lib/services/db';
import { generateChunkHash } from '@/lib/utils/hash';
import pLimit from 'p-limit';

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

/** How many files are chunked + embedded concurrently. */
const FILE_CONCURRENCY = 8;

/** How many MongoDB bulk-insert operations run concurrently. */
const DB_WRITE_CONCURRENCY = 4;

export async function POST(req: NextRequest) {
  let repo_id = '';

  // ── Parse + validate the request body ────────────────────────────
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
      /** Enqueue one SSE frame. */
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        // ─── 1. Parse URL ──────────────────────────────────────────
        const { owner, repo } = GithubService.parseUrl(url);
        repo_id = `${owner}/${repo}`;

        // ─── 2. Download + extract repo as zipball (single HTTP request) ─
        send('phase', { message: `Downloading zipball for ${repo_id}…` });
        const files = await GithubService.fetchRepoAsZip(owner, repo);

        send('phase', {
          message: `Extracted ${files.length} source files from archive`,
          totalFiles: files.length,
        });

        // ─── 4. Prepare DB ─────────────────────────────────────────
        send('phase', { message: 'Preparing database connection…' });
        const { db } = await connectToDatabase();
        const collection = db.collection<CodeChunk>(CODE_CHUNKS_COLLECTION);
        // We do NOT delete existing chunks here. We wait until all embeddings are generated.

        // ─── 5. Concurrent file processing ─────────────────────────
        send('phase', {
          message: `Embedding ${files.length} files (concurrency: ${FILE_CONCURRENCY})…`,
          totalFiles: files.length,
        });

        let totalChunksInserted = 0;
        let filesProcessed = 0;
        const allDocs: CodeChunk[] = [];

        // Concurrency limiters
        const embedLimit = pLimit(FILE_CONCURRENCY);
        const dbLimit = pLimit(DB_WRITE_CONCURRENCY); // Left for future use if needed

        /**
         * Process a single file:
         *   1. AST-chunk it
         *   2. Hash chunks and check cache (Bucket A)
         *   3. Batch-embed new chunks (Bucket B)
         *   4. Assemble and store in memory
         *   5. Emit SSE progress event
         *
         * Errors are isolated per-file so one failure doesn't kill the stream.
         */
        const processFile = async (file: { path: string; content: string }) => {
          if (!file.content || file.content.trim() === '') {
            return;
          }

          try {
            // ── Chunk ──
            const chunks: Chunk[] = await ChunkingService.chunkFile(file.path, file.content);

            if (chunks.length === 0) return;

            // ── Build enriched texts for the embedding API ──
            const enrichedTexts = chunks.map(
              (c) => `File: ${file.path}\nType: ${c.node_type}\nDependencies: []\nCode:\n${c.code_content}`,
            );

            // ── Hash & Lookup ──
            const chunkHashes = enrichedTexts.map(text => generateChunkHash(text));
            const uniqueHashes = [...new Set(chunkHashes)];
            
            const existingDocs = await collection.find(
              { chunk_hash: { $in: uniqueHashes } },
              { projection: { chunk_hash: 1, embedding_hf: 1, embedding_gemini: 1, provider: 1 } }
            ).toArray();
            
            const existingDocsMap = new Map(existingDocs.map(doc => [doc.chunk_hash, doc]));
            
            // ── Conditional Embedding (Buckets) ──
            const bucketB: { index: number, text: string, hash: string }[] = [];
            
            for (let i = 0; i < chunkHashes.length; i++) {
              if (!existingDocsMap.has(chunkHashes[i])) {
                bucketB.push({ index: i, text: enrichedTexts[i], hash: chunkHashes[i] });
              }
            }
            
            let newEmbeddings: number[][] = [];
            let newProvider: AIProvider = 'huggingface';
            
            if (bucketB.length > 0) {
              const { embeddings, provider } = await AIRouter.generateIngestionEmbeddings(bucketB.map(b => b.text));
              newEmbeddings = embeddings;
              newProvider = provider;
            } else if (existingDocs.length > 0) {
              newProvider = existingDocs[0].provider;
            }

            // ── Assemble documents ──
            const docs: CodeChunk[] = [];
            for (let i = 0; i < chunks.length; i++) {
              const hash = chunkHashes[i];
              const existingDoc = existingDocsMap.get(hash);
              
              if (existingDoc) {
                // Bucket A (Cached)
                docs.push({
                  repo_id,
                  file_path: file.path,
                  node_type: chunks[i].node_type,
                  node_name: chunks[i].node_name,
                  code_content: chunks[i].code_content,
                  chunk_hash: hash,
                  provider: existingDoc.provider,
                  ...(existingDoc.embedding_hf ? { embedding_hf: existingDoc.embedding_hf } : {}),
                  ...(existingDoc.embedding_gemini ? { embedding_gemini: existingDoc.embedding_gemini } : {}),
                  metadata: {
                    dependencies: [],
                    start_line: chunks[i].start_line,
                    end_line: chunks[i].end_line,
                  },
                });
              } else {
                // Bucket B (New)
                const bIndex = bucketB.findIndex(b => b.index === i);
                if (bIndex !== -1 && newEmbeddings[bIndex]) {
                  docs.push({
                    repo_id,
                    file_path: file.path,
                    node_type: chunks[i].node_type,
                    node_name: chunks[i].node_name,
                    code_content: chunks[i].code_content,
                    chunk_hash: hash,
                    provider: newProvider,
                    ...(newProvider === 'huggingface' ? { embedding_hf: newEmbeddings[bIndex] } : { embedding_gemini: newEmbeddings[bIndex] }),
                    metadata: {
                      dependencies: [],
                      start_line: chunks[i].start_line,
                      end_line: chunks[i].end_line,
                    },
                  });
                }
              }
            }

            // Store in memory instead of inserting right away
            allDocs.push(...docs);

            filesProcessed++;

            // ── SSE per-file progress ──
            send('file', {
              file: file.path,
              status: 'embedded',
              chunks: docs.length,
              filesProcessed,
              totalFiles: files.length,
            });
          } catch (fileError: any) {
            // Isolate error to this file — don't abort the whole pipeline
            console.error(`[Ingest] Failed to process ${file.path}:`, fileError.message || fileError);

            filesProcessed++;

            send('file', {
              file: file.path,
              status: 'failed',
              error: fileError.message || 'Unknown error',
              chunks: 0,
              filesProcessed,
              totalFiles: files.length,
            });
          }
        };

        // ── Launch all file tasks through the concurrency limiter ──
        await Promise.all(
          files.map((file) => embedLimit(() => processFile(file))),
        );

        // ─── 6. Database Write Lifecycle ───────────────────────────
        send('phase', { message: 'Writing database updates…' });
        
        // Only delete old state AFTER we successfully secured all new embeddings
        await collection.deleteMany({ repo_id });

        // Insert new assembled state in batches
        const BATCH_SIZE = 1000;
        for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
          const batch = allDocs.slice(i, i + BATCH_SIZE);
          await collection.insertMany(batch, { ordered: false });
        }
        totalChunksInserted = allDocs.length;

        // ─── 7. Done ───────────────────────────────────────────────
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
      'X-Accel-Buffering': 'no',
    },
  });
}
