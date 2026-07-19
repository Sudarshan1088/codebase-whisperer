import { setServers } from 'node:dns/promises';

// Force Node.js to use Google and Cloudflare DNS to resolve the MongoDB SRV record
setServers(['8.8.8.8', '1.1.1.1']);

import { MongoClient, Db } from 'mongodb';
// Ensure the MongoDB URI is provided
const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

// Database and Collection names
export const DB_NAME = 'codebase_whisperer';
export const CODE_CHUNKS_COLLECTION = 'code_chunks';

/**
 * Interface representing the schema for the code_chunks collection in MongoDB
 */
export interface CodeChunk {
  repo_id: string; // Format: "owner/repo"
  file_path: string;
  node_type: string; // e.g., "function", "class", "file"
  node_name: string;
  code_content: string;
  embedding: number[]; // MUST be exactly 1024 dimensions
  metadata: {
    dependencies: string[];
    start_line: number;
    end_line: number;
  };
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  // If the database connection is cached, use it instead of creating a new connection
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // Create a new MongoClient
  const client = new MongoClient(uri as string);

  // Connect to the MongoDB cluster with error handling
  try {
    await client.connect();
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw new Error('Database connection failed. Please check your MONGODB_URI or network connection.');
  }

  // Select the specific database
  const db = client.db(DB_NAME);

  // Cache the client and db for future use
  cachedClient = client;
  cachedDb = db;

  return { client, db };
}
