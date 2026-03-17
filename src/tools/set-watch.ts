import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { Meilisearch } from 'meilisearch';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AuthInfo } from '../lib/auth.js';
import { requireAuth, resolveActor } from '../lib/auth.js';
import { getPrisma } from '../db/client.js';
import { getMeiliClient } from '../search/client.js';
import { createWatch } from '../db/queries/watches.js';
import { searchListings } from '../search/query.js';
import { checkIdempotency, saveIdempotency } from '../db/queries/idempotency.js';

export const setWatchSchema = z.object({
  idempotency_key: z.string(),
  query: z.string().min(1).describe('검색 키워드'),
  max_price: z.number().optional().describe('최대 가격'),
  max_distance_km: z.number().optional().describe('최대 거리 (km)'),
  location: z.object({ name: z.string(), lat: z.number(), lng: z.number() }).optional(),
  notify_method: z.string().optional().describe('알림 방법 (기본: kakao)'),
});

export type SetWatchArgs = z.infer<typeof setWatchSchema>;

export interface SetWatchDeps {
  prisma?: PrismaClient;
  meili?: Meilisearch;
  authInfo?: AuthInfo;
  searchIndexName?: string;
}

export async function handleSetWatch(
  args: SetWatchArgs,
  deps: SetWatchDeps,
): Promise<CallToolResult> {
  const authResult = requireAuth(deps.authInfo);
  if (!authResult.ok) {
    return { content: [{ type: 'text', text: authResult.error }], isError: true };
  }

  const prisma = deps.prisma ?? getPrisma();
  const meili = deps.meili ?? getMeiliClient();

  const actorResult = await resolveActor(prisma, authResult.value);
  if (!actorResult.ok) {
    return { content: [{ type: 'text', text: actorResult.error }], isError: true };
  }

  const idemCheck = await checkIdempotency(prisma, args.idempotency_key);
  if (idemCheck.ok && idemCheck.value) {
    const existing = await prisma.watch.findUnique({ where: { id: idemCheck.value } });
    if (existing) {
      const matches = await searchListings(
        meili,
        { query: existing.queryText, max_price: existing.maxPrice ?? undefined },
        deps.searchIndexName,
      );
      return { content: [{ type: 'text', text: JSON.stringify({ watch: existing, matches }) }] };
    }
  }

  const watchResult = await createWatch(prisma, {
    userId: actorResult.value.userId,
    queryText: args.query,
    maxPrice: args.max_price,
    maxDistanceKm: args.max_distance_km,
    location: args.location,
    notifyMethod: args.notify_method,
  });

  if (!watchResult.ok) {
    return { content: [{ type: 'text', text: watchResult.error }], isError: true };
  }

  await saveIdempotency(prisma, args.idempotency_key, 'watch', watchResult.value.id);

  const matches = await searchListings(
    meili,
    { query: args.query, max_price: args.max_price },
    deps.searchIndexName,
  );

  return {
    content: [{ type: 'text', text: JSON.stringify({ watch: watchResult.value, matches }) }],
  };
}
