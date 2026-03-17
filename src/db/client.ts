import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

let _prisma: PrismaClient | null = null;

export function getPrisma(connectionString?: string): PrismaClient {
  if (_prisma) return _prisma;

  const url = connectionString ?? process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is required');

  const adapter = new PrismaPg({ connectionString: url });
  _prisma = new PrismaClient({ adapter });
  return _prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}
