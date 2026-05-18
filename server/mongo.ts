

import { MongoClient, type Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

function getMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();

  if (uri) return uri;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI is required in production. Add your MongoDB Atlas connection string to the deployment environment variables.');
  }

  return 'mongodb://127.0.0.1:27017';
}

export async function getDb() {
  if (db) return db;

  const uri = getMongoUri();
  const dbName = process.env.MONGODB_DB_NAME?.trim() || 'csi_main';

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
  });
  await client.connect();
  db = client.db(dbName);

  return db;
}

export async function closeDb() {
  if (!client) return;

  await client.close();
  client = null;
  db = null;
}
