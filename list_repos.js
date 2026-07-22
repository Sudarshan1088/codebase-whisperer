const { MongoClient } = require('mongodb');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
});

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('codebase_whisperer');
  const chunks = db.collection('code_chunks');
  const repos = await chunks.distinct('repo_id');
  console.log('Repos in DB:', repos);
  await client.close();
}
run();
