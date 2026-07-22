import axios from 'axios';

// HF_TOKEN will be read dynamically to prevent module-level caching issues during hot-reloads
// The model to use for embeddings (as per architecture directives)
const EMBEDDING_URL = 'https://router.huggingface.co/hf-inference/models/BAAI/bge-large-en-v1.5/pipeline/feature-extraction';

/** Max texts per HF API call. The model accepts arrays, but we cap batch
 *  size to avoid 413 / timeout errors on long aggregate payloads. */
const EMBEDDING_BATCH_SIZE = 64;

/**
 * Exponential-backoff retry wrapper for HF Inference API calls.
 * Handles 503 (model cold-start) and 429 (rate-limit) transparently.
 */
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  let delayMs = 2_000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLast = attempt === maxRetries;

      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        const errorData = error.response.data || {};

        if (status === 503 && errorData.estimated_time) {
          console.warn(`[HF] Model loading – waiting ${errorData.estimated_time}s (attempt ${attempt}/${maxRetries})`);
          await sleep(Math.max(delayMs, errorData.estimated_time * 1000));
          continue;
        }

        if (status === 429) {
          console.warn(`[HF] Rate-limited – backing off ${delayMs}ms (attempt ${attempt}/${maxRetries})`);
          await sleep(delayMs);
          delayMs *= 2;
          continue;
        }

        if (isLast) {
          throw new Error(
            `Hugging Face API error: ${status} ${error.response.statusText} – ${JSON.stringify(errorData)}`,
          );
        }
      }

      if (isLast) throw error;

      console.error(`[HF] Network error, retrying (${attempt}/${maxRetries})…`, error.message || error);
      await sleep(delayMs);
    }
  }

  throw new Error('Failed after max retries (unreachable).');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalise the wild variety of shapes the HF feature-extraction endpoint
 * can return into a flat `number[][]` (one embedding per input text).
 *
 * Observed shapes:
 *   Single text  → number[]   OR  number[][]  (token-level → needs mean-pool)
 *   Batch texts  → number[][] OR  number[][][] (token-level per input)
 *
 * For sentence-transformers models with a pooling head (like bge-large)
 * the API normally returns `number[]` for 1 input, `number[][]` for N inputs.
 */
function normaliseEmbeddings(raw: any, expectedCount: number): number[][] {
  // Batch: outer array length matches expectedCount → [[…], […], …]
  if (
    Array.isArray(raw) &&
    raw.length === expectedCount &&
    Array.isArray(raw[0]) &&
    typeof raw[0][0] === 'number'
  ) {
    return raw;
  }

  // Single input wrapped: [[numbers]]
  if (
    Array.isArray(raw) &&
    raw.length === 1 &&
    Array.isArray(raw[0]) &&
    typeof raw[0][0] === 'number' &&
    expectedCount === 1
  ) {
    return [raw[0]];
  }

  // Flat single embedding: [numbers]
  if (Array.isArray(raw) && typeof raw[0] === 'number' && expectedCount === 1) {
    return [raw];
  }

  // Token-level output (3D): mean-pool along token axis
  if (
    Array.isArray(raw) &&
    raw.length === expectedCount &&
    Array.isArray(raw[0]) &&
    Array.isArray(raw[0][0])
  ) {
    return raw.map((tokenEmbeddings: number[][]) => {
      const dim = tokenEmbeddings[0].length;
      const mean = new Array(dim).fill(0);
      for (const tok of tokenEmbeddings) {
        for (let d = 0; d < dim; d++) mean[d] += tok[d];
      }
      for (let d = 0; d < dim; d++) mean[d] /= tokenEmbeddings.length;
      return mean;
    });
  }

  throw new Error(
    `Unexpected embedding response shape – expected ${expectedCount} embeddings, got: ${JSON.stringify(raw).slice(0, 200)}`,
  );
}

export class HuggingFaceService {
  // ─── Single-text embedding (kept for backward compat with chat route) ───
  /**
   * Generate a 1024-dimensional embedding for a single text string.
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    const [embedding] = await this.generateEmbeddings([text]);
    return embedding;
  }

  // ─── Batch embedding (core workhorse) ───────────────────────────────────
  /**
   * Generate 1024-dimensional embeddings for an array of texts in one
   * (or a few) API calls. The HF feature-extraction endpoint accepts
   * `{ inputs: string[] }` natively — this avoids per-chunk round-trips.
   *
   * Internally splits into sub-batches of EMBEDDING_BATCH_SIZE to stay
   * within payload limits.
   *
   * @returns Parallel array of embeddings matching the input order.
   */
  static async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const HF_TOKEN = process.env.HF_TOKEN;
    if (!HF_TOKEN) {
      throw new Error('HF_TOKEN is not defined in environment variables.');
    }

    if (texts.length === 0) return [];

    const allEmbeddings: number[][] = new Array(texts.length);

    // Process in sub-batches
    for (let offset = 0; offset < texts.length; offset += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(offset, offset + EMBEDDING_BATCH_SIZE);

      const result = await callWithRetry(async () => {
        const response = await axios.post(
          EMBEDDING_URL,
          { inputs: batch },
          {
            headers: {
              Authorization: `Bearer ${HF_TOKEN}`,
              'Content-Type': 'application/json',
            },
            // Larger batches need more time
            timeout: 120_000,
          },
        );
        return response.data;
      });

      const embeddings = normaliseEmbeddings(result, batch.length);

      for (let i = 0; i < embeddings.length; i++) {
        allEmbeddings[offset + i] = embeddings[i];
      }
    }

    return allEmbeddings;
  }
}
