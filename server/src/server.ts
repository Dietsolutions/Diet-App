import app from './app';
import { prisma } from './lib/prisma';

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

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await wakeDatabase();
});
