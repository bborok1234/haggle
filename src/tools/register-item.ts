import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { Meilisearch } from 'meilisearch';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AuthInfo } from '../lib/auth.js';
import { requireAuth, resolveActor } from '../lib/auth.js';
import { getPrisma } from '../db/client.js';
import { getMeiliClient } from '../search/client.js';
import { createListing } from '../db/queries/listings.js';
import { checkIdempotency, saveIdempotency } from '../db/queries/idempotency.js';
import { syncListing } from '../search/sync.js';
import type { ListingDocument } from '../search/client.js';

export const registerItemSchema = z.object({
  idempotency_key: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  price: z.number().int().nonnegative(),
  is_negotiable: z.boolean().optional(),
  photos: z.array(z.string()).max(10).optional(),
  location: z.object({ name: z.string(), lat: z.number(), lng: z.number() }).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export type RegisterItemArgs = z.infer<typeof registerItemSchema>;

export interface RegisterItemDeps {
  prisma?: PrismaClient;
  meili?: Meilisearch;
  authInfo?: AuthInfo;
  searchIndexName?: string;
}

export async function handleRegisterItem(
  args: RegisterItemArgs,
  deps: RegisterItemDeps,
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
    const existing = await prisma.listing.findUnique({ where: { id: idemCheck.value } });
    if (existing) return { content: [{ type: 'text', text: JSON.stringify(existing) }] };
  }

  const result = await createListing(prisma, {
    idempotencyKey: args.idempotency_key,
    sellerId: actorResult.value.userId,
    title: args.title,
    description: args.description,
    price: args.price,
    isNegotiable: args.is_negotiable,
    location: args.location,
    photos: args.photos,
    attributes: args.attributes as Record<string, unknown> | undefined,
  });

  if (!result.ok) {
    return { content: [{ type: 'text', text: result.error }], isError: true };
  }

  await saveIdempotency(prisma, args.idempotency_key, 'listing', result.value.id);

  const doc: ListingDocument = {
    id: result.value.id,
    title: result.value.title,
    description: result.value.description,
    price: result.value.price,
    is_negotiable: result.value.isNegotiable,
    status: result.value.status,
    location_name: args.location?.name ?? null,
    created_at: result.value.createdAt.getTime(),
  };
  await syncListing(meili, doc, deps.searchIndexName);

  return { content: [{ type: 'text', text: JSON.stringify(result.value) }] };
}
