import 'dotenv/config';
import app from './app';
import { prisma, reconnectPrisma } from './lib/prisma';

const PORT = Number(process.env.PORT) || 3001;

async function wakeDatabase(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[DB] Connected and ready');
  } catch (err) {
    console.warn('[DB] Initial connection failed, retrying in 2s...');
    await new Promise(r => setTimeout(r, 2000));
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('[DB] Connected on retry');
    } catch (e) {
      console.error('[DB] Could not connect after retry:', (e as Error).message);
    }
  }
}

// Keep DB alive — Neon free tier kills idle connections after ~5min
async function keepAlive(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    console.log('[DB] Reconnecting after idle timeout...');
    await reconnectPrisma();
    await prisma.$queryRaw`SELECT 1`;
    console.log('[DB] Reconnected');
  }
}

const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, async () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  await wakeDatabase();
  setInterval(keepAlive, 180_000);
});

// Graceful shutdown — drain in-flight requests before exiting.
// Vercel sends SIGTERM before replacing the function instance.
async function shutdown(signal: string): Promise<void> {
  console.log(`[Server] ${signal} received — shutting down gracefully`);
  server.close(async () => {
    try { await prisma.$disconnect(); } catch {}
    process.exit(0);
  });
  // Force exit after 25 s so a stuck handler never blocks a new deploy
  setTimeout(() => {
    console.error('[Server] Forced exit after timeout');
    process.exit(1);
  }, 25_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));
