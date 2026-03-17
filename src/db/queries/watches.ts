import type { PrismaClient, Watch } from '../../generated/prisma/client.js';
import type { Result } from '../../lib/result.js';
import { ok } from '../../lib/result.js';

export interface CreateWatchInput {
  userId: string;
  queryText: string;
  maxPrice?: number;
  maxDistanceKm?: number;
  location?: { lat: number; lng: number; name: string };
  notifyMethod?: string;
}

export async function createWatch(
  prisma: PrismaClient,
  input: CreateWatchInput,
): Promise<Result<Watch, string>> {
  const watch = await prisma.watch.create({
    data: {
      userId: input.userId,
      queryText: input.queryText,
      maxPrice: input.maxPrice,
      maxDistanceKm: input.maxDistanceKm,
      location: input.location ?? undefined,
      notifyMethod: input.notifyMethod ?? 'kakao',
    },
  });
  return ok(watch);
}
