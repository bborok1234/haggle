import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { Meilisearch } from 'meilisearch';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AuthInfo } from '../lib/auth.js';
import { requireAuth, resolveActor } from '../lib/auth.js';
import { getPrisma } from '../db/client.js';
import { getMeiliClient } from '../search/client.js';
import { assertOwnership, updateListing } from '../db/queries/listings.js';
import { syncListing } from '../search/sync.js';
import type { ListingDocument } from '../search/client.js';

export const updateListingSchema = z.object({
  idempotency_key: z.string(),
  listing_id: z.string(),
  title: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  price: z.number().int().nonnegative().optional(),
  is_negotiable: z.boolean().optional(),
  photos: z.array(z.string()).max(10).optional(),
  location: z.object({ name: z.string(), lat: z.number(), lng: z.number() }).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateListingArgs = z.infer<typeof updateListingSchema>;

export interface UpdateListingDeps {
  prisma?: PrismaClient;
  meili?: Meilisearch;
  authInfo?: AuthInfo;
  searchIndexName?: string;
}

export async function handleUpdateListing(
  args: UpdateListingArgs,
  deps: UpdateListingDeps,
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

  const ownerCheck = await assertOwnership(prisma, args.listing_id, actorResult.value.userId);
  if (!ownerCheck.ok) {
    return { content: [{ type: 'text', text: ownerCheck.error }], isError: true };
  }

  const result = await updateListing(prisma, args.listing_id, actorResult.value.userId, {
    title: args.title,
    description: args.description,
    price: args.price,
    isNegotiable: args.is_negotiable,
    photos: args.photos,
    location: args.location,
    attributes: args.attributes as Record<string, unknown> | undefined,
  });

  if (!result.ok) {
    return { content: [{ type: 'text', text: result.error }], isError: true };
  }

  const doc: ListingDocument = {
    id: result.value.id,
    title: result.value.title,
    description: result.value.description,
    price: result.value.price,
    is_negotiable: result.value.isNegotiable,
    status: result.value.status,
    location_name:
      args.location?.name ?? (ownerCheck.value.location as { name?: string } | null)?.name ?? null,
    created_at: result.value.createdAt.getTime(),
  };
  await syncListing(meili, doc, deps.searchIndexName);

  return { content: [{ type: 'text', text: JSON.stringify(result.value) }] };
}
