import express from 'express';
import { createServer as createViteServer } from 'vite';
import type { Document } from 'mongodb';
import path from 'path';
import dotenv from 'dotenv';
import { getDb } from './server/mongo.ts';
import { metroSeed } from './server/metroSeed.ts';

dotenv.config({ path: '.env.local' });
dotenv.config();

const DATA_COLLECTION = 'appData';
const METRO_DATA_ID = 'metro-data';
const DEFAULT_PORT = 3000;
const DEFAULT_HMR_PORT = 24679;

type AppDataDocument = Document & { _id: string };

async function getMetroDocument() {
  const db = await getDb();
  const collection = db.collection<AppDataDocument>(DATA_COLLECTION);

  await collection.updateOne(
    { _id: METRO_DATA_ID },
    { $setOnInsert: metroSeed },
    { upsert: true }
  );

  return collection.findOne({ _id: METRO_DATA_ID }, { projection: { _id: 0 } });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT ?? DEFAULT_PORT);
  const HMR_PORT = Number(process.env.VITE_HMR_PORT ?? DEFAULT_HMR_PORT);

  app.get('/api/metro-data', async (_req, res) => {
    try {
      const data = await getMetroDocument();
      res.json(data);
    } catch (error) {
      console.error('Failed to load metro data from MongoDB:', error);
      res.status(500).json({ error: 'Failed to load metro data from MongoDB' });
    }
  });

  app.get('/api/health/db', async (_req, res) => {
    try {
      const db = await getDb();
      await db.command({ ping: 1 });
      res.json({
        ok: true,
        database: db.databaseName,
      });
    } catch (error) {
      console.error('MongoDB health check failed:', error);
      res.status(500).json({
        ok: false,
        error: 'MongoDB connection failed',
      });
    }
  });

  app.get('/api/timings', async (_req, res) => {
    try {
      const data = await getMetroDocument();
      res.json(data?.timings ?? []);
    } catch (error) {
      console.error('Failed to load timings from MongoDB:', error);
      res.status(500).json({ error: 'Failed to load timings from MongoDB' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { port: HMR_PORT },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the existing server or run with PORT=${PORT + 1}.`);
      process.exit(1);
    }

    throw error;
  });
}

startServer();
