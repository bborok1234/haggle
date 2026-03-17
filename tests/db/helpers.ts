import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

let testPrisma: PrismaClient | null = null;
let pool: pg.Pool | null = null;

export function getTestPrisma(): PrismaClient {
  if (testPrisma) return testPrisma;

  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is required for tests');

  pool = new pg.Pool({ connectionString: url, max: 1 });
  const adapter = new PrismaPg(pool);
  testPrisma = new PrismaClient({ adapter });
  return testPrisma;
}

export async function cleanupTestDb(): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE idempotency_records, offer_events, listing_events, interests, watches, offers, listings, user_identities, users CASCADE',
  );
}

export async function disconnectTestDb(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = null;
  }
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function createTestUser(
  prisma: PrismaClient,
  overrides: Partial<{ displayName: string; provider: string; subject: string }> = {},
) {
  const displayName = overrides.displayName ?? 'Test User';
  const provider = overrides.provider ?? 'test';
  const subject = overrides.subject ?? `test-subject-${Date.now()}`;

  return prisma.user.create({
    data: {
      displayName,
      identities: {
        create: { provider, subject },
      },
    },
    include: { identities: true },
  });
}
