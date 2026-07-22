import { HuggingFaceService } from './huggingface';
import { embedMany, embed } from 'ai';
import { google } from '@ai-sdk/google';

export type AIProvider = 'huggingface' | 'gemini';

export interface IngestionEmbeddingsResult {
  embeddings: number[][];
  provider: AIProvider;
}

export class AIRouter {
  /**
   * Used during repo ingestion.
   * Prioritizes Hugging Face, falls back to Gemini if rate limited or out of credits.
   */
  static async generateIngestionEmbeddings(texts: string[]): Promise<IngestionEmbeddingsResult> {
    try {
      // 1. Try Primary Provider (Hugging Face)
      const embeddings = await HuggingFaceService.generateEmbeddings(texts);
      return {
        embeddings,
        provider: 'huggingface',
      };
    } catch (error: any) {
      const msg = error?.message || '';
      // Check for common quota/rate-limit errors
      if (msg.includes('402') || msg.includes('429') || msg.includes('Payment Required')) {
        console.warn(`[AI Router] Primary embedding provider (Hugging Face) failed (${msg}). Initiating fallback to Google Gemini...`);
        
        // 2. Fallback to Secondary Provider (Gemini)
        // Gemini's gemini-embedding-001 outputs 3072 dimensions
        const { embeddings } = await embedMany({
          model: google.textEmbeddingModel('gemini-embedding-001'),
          values: texts,
        });

        return {
          embeddings,
          provider: 'gemini',
        };
      }
      
      // If it's not a known failover condition, rethrow
      throw error;
    }
  }

  /**
   * Used during chat querying.
   * MUST strictly use the provider that was used to ingest the repo.
   */
  static async generateQueryEmbedding(text: string, provider: AIProvider): Promise<number[]> {
    if (provider === 'huggingface') {
      try {
        return await HuggingFaceService.generateEmbedding(text);
      } catch (error: any) {
        console.error(`[AI Router] HF Embedding failed during query for HF-bound repo:`, error.message);
        throw new Error('PROVIDER_DOWN'); // Custom error code to trigger graceful failure in chat route
      }
    } else if (provider === 'gemini') {
      try {
        const { embedding } = await embed({
          model: google.textEmbeddingModel('gemini-embedding-001'),
          value: text,
        });
        return embedding;
      } catch (error: any) {
        console.error(`[AI Router] Gemini Embedding failed during query for Gemini-bound repo:`, error.message);
        throw new Error('PROVIDER_DOWN');
      }
    }

    throw new Error(`Unknown provider: ${provider}`);
  }
}
