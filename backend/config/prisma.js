import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
let prismaClient;
/** Return one lazily initialized Prisma client for the whole backend process. */
export function getPrismaClient() {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
        throw new Error('DATABASE_URL is not configured');
    }
    if (!prismaClient) {
        const adapter = new PrismaPg({ connectionString });
        prismaClient = new PrismaClient({ adapter });
    }
    return prismaClient;
}
