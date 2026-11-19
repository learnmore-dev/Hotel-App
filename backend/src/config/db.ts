import { getPrismaClient } from './prisma.js';

export async function connectDB(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is not configured');
  }

  try {
    const prisma = getPrismaClient();
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.info('[database] PostgreSQL connection established');
  } catch (error) {
    console.error('[database] PostgreSQL connection failed:', error instanceof Error ? error.name : 'Unknown error');
    throw new Error('PostgreSQL connection failed', { cause: error });
  }
}

export async function checkDB(): Promise<boolean> {
  try {
    await getPrismaClient().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function disconnectDB(): Promise<void> {
  await getPrismaClient().$disconnect();
}
