import axios from 'axios';

const HF_TOKEN = process.env.HF_TOKEN;

// The model to use for embeddings (as per architecture directives)
const EMBEDDING_URL = 'https://router.huggingface.co/hf-inference/models/BAAI/bge-large-en-v1.5/pipeline/feature-extraction';

export class HuggingFaceService {
  /**
   * Generate 1024-dimensional embeddings for a given text using Hugging Face Inference API
   * @param text The enriched chunk text
   * @returns An array of numbers (1024 dimensions)
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    if (!HF_TOKEN) {
      throw new Error('HF_TOKEN is not defined in environment variables.');
    }

    // Implementing basic retry logic for 503 (Model Loading/Cold Starts)
    let retries = 3;
    let delayMs = 2000; // start with 2 seconds

    while (retries > 0) {
      try {
        const response = await axios.post(
          EMBEDDING_URL,
          { inputs: text },
          {
            headers: {
              Authorization: `Bearer ${HF_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const result = response.data;
        
        let embedding: number[];
        if (Array.isArray(result) && Array.isArray(result[0])) {
           embedding = Array.isArray(result[0][0]) ? result[0][0] : result[0];
        } else {
           embedding = result;
        }
        
        if (!embedding || embedding.length === 0 || typeof embedding[0] !== 'number') {
           if (Array.isArray(embedding) && typeof embedding[0] === 'number') {
              return embedding;
           }
           throw new Error('Invalid embedding format returned from Hugging Face API');
        }

        return embedding;

      } catch (error: any) {
        if (axios.isAxiosError(error) && error.response) {
          const status = error.response.status;
          const errorData = error.response.data || {};

          if (status === 503 && errorData.estimated_time) {
            console.warn(`Model is loading. Waiting ${errorData.estimated_time} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, Math.max(delayMs, errorData.estimated_time * 1000)));
            retries--;
            continue;
          }

          if (status === 429) {
             console.warn('Rate limited by Hugging Face API. Retrying...');
             await new Promise((resolve) => setTimeout(resolve, delayMs));
             delayMs *= 2;
             retries--;
             continue;
          }

          if (retries === 1) {
            throw new Error(`Hugging Face API error: ${status} ${error.response.statusText} - ${JSON.stringify(errorData)}`);
          }
        }

        if (retries === 1) {
           throw error;
        }

        console.error('Network error reaching Hugging Face API, retrying...', error.message || error);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        retries--;
      }
    }

    throw new Error('Failed to generate embedding after multiple retries.');
  }
}

