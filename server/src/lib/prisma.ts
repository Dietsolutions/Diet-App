import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;

export async function reconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch {}
  try {
    await prisma.$connect();
  } catch {}
}

export { prisma };
export default prisma;
