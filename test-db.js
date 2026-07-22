const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || "mongodb+srv://sudarshanjanardhandandgawal_db_user:WClm7oU1D6UmZXa3@cluster0.m23bsth.mongodb.net/?appName=Cluster0";
async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('test'); // Wait, what is the DB name? Let's check src/lib/services/db.ts
  const chats = await db.collection('chats').find({}).toArray();
  console.log(JSON.stringify(chats, null, 2));
  await client.close();
}
run();
