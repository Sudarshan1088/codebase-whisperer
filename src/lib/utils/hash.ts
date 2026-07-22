import crypto from 'crypto';

/**
 * Generates a SHA-256 hash for a given text string.
 * @param text The text to hash
 * @returns A hex string representing the SHA-256 hash
 */
export function generateChunkHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}
