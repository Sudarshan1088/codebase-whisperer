import { embed } from 'ai';
import { google } from '@ai-sdk/google';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
});

async function main() {
  try {
    const { embedding } = await embed({
      model: google.textEmbeddingModel('gemini-embedding-001'),
      value: 'Hello world'
    });
    console.log('Success gemini-embedding-001:', embedding.length);
  } catch (err: any) {
    console.error('Error with gemini-embedding-001:', err.message);
  }
}
main();
