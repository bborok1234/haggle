import type { PrismaClient } from '../../generated/prisma/client.js';
import type { Result } from '../../lib/result.js';
import { ok } from '../../lib/result.js';

export async function checkIdempotency(
  prisma: PrismaClient,
  key: string,
): Promise<Result<string | null, string>> {
  const record = await prisma.idempotencyRecord.findUnique({ where: { key } });
  return ok(record?.resourceId ?? null);
}

export async function saveIdempotency(
  prisma: PrismaClient,
  key: string,
  resource: string,
  resourceId: string,
): Promise<void> {
  await prisma.idempotencyRecord.create({
    data: { key, resource, resourceId },
  });
}
