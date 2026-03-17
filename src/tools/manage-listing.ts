import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { Meilisearch } from 'meilisearch';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AuthInfo } from '../lib/auth.js';
import type { ListingStatus } from '../generated/prisma/client.js';
import { requireAuth, resolveActor } from '../lib/auth.js';
import { getPrisma } from '../db/client.js';
import { getMeiliClient } from '../search/client.js';
import { assertOwnership, updateListingStatus } from '../db/queries/listings.js';
import { validateTransition } from '../lib/transitions.js';
import { syncListing } from '../search/sync.js';
import { removeListing } from '../search/sync.js';
import type { ListingDocument } from '../search/client.js';

const ACTION_TO_STATUS: Record<string, ListingStatus> = {
  reserve: 'reserved',
  sell: 'sold',
  delete: 'deleted',
  relist: 'active',
};

export const manageListingSchema = z.object({
  idempotency_key: z.string(),
  listing_id: z.string(),
  action: z.enum(['reserve', 'sell', 'delete', 'relist']),
});

export type ManageListingArgs = z.infer<typeof manageListingSchema>;

export interface ManageListingDeps {
  prisma?: PrismaClient;
  meili?: Meilisearch;
  authInfo?: AuthInfo;
  searchIndexName?: string;
}

export async function handleManageListing(
  args: ManageListingArgs,
  deps: ManageListingDeps,
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

  const targetStatus = ACTION_TO_STATUS[args.action];
  if (!targetStatus) {
    return { content: [{ type: 'text', text: 'INVALID_ACTION' }], isError: true };
  }

  const transitionCheck = validateTransition(ownerCheck.value.status, targetStatus);
  if (!transitionCheck.ok) {
    return { content: [{ type: 'text', text: transitionCheck.error }], isError: true };
  }

  const result = await updateListingStatus(
    prisma,
    args.listing_id,
    ownerCheck.value.status as ListingStatus,
    targetStatus,
    actorResult.value.userId,
  );

  if (!result.ok) {
    return { content: [{ type: 'text', text: result.error }], isError: true };
  }

  if (targetStatus === 'deleted') {
    await removeListing(meili, result.value.id, deps.searchIndexName);
  } else {
    const doc: ListingDocument = {
      id: result.value.id,
      title: result.value.title,
      description: result.value.description,
      price: result.value.price,
      is_negotiable: result.value.isNegotiable,
      status: result.value.status,
      location_name: (ownerCheck.value.location as { name?: string } | null)?.name ?? null,
      created_at: result.value.createdAt.getTime(),
    };
    await syncListing(meili, doc, deps.searchIndexName);
  }

  return { content: [{ type: 'text', text: JSON.stringify(result.value) }] };
}
