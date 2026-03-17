import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AuthInfo } from '../lib/auth.js';
import { requireAuth, resolveActor } from '../lib/auth.js';
import { getPrisma } from '../db/client.js';
import { findOfferWithListing, acceptOffer, declineOffer } from '../db/queries/offers.js';

export const respondOfferSchema = z.object({
  idempotency_key: z.string(),
  offer_id: z.string(),
  action: z.enum(['accept', 'decline']),
});

export type RespondOfferArgs = z.infer<typeof respondOfferSchema>;

export interface RespondOfferDeps {
  prisma?: PrismaClient;
  authInfo?: AuthInfo;
}

export async function handleRespondOffer(
  args: RespondOfferArgs,
  deps: RespondOfferDeps,
): Promise<CallToolResult> {
  const authResult = requireAuth(deps.authInfo);
  if (!authResult.ok) {
    return { content: [{ type: 'text', text: authResult.error }], isError: true };
  }

  const prisma = deps.prisma ?? getPrisma();

  const actorResult = await resolveActor(prisma, authResult.value);
  if (!actorResult.ok) {
    return { content: [{ type: 'text', text: actorResult.error }], isError: true };
  }

  const offerResult = await findOfferWithListing(prisma, args.offer_id);
  if (!offerResult.ok) {
    return { content: [{ type: 'text', text: offerResult.error }], isError: true };
  }

  if (offerResult.value.listing.sellerId !== actorResult.value.userId) {
    return { content: [{ type: 'text', text: 'FORBIDDEN' }], isError: true };
  }

  if (args.action === 'accept') {
    const result = await acceptOffer(prisma, args.offer_id, actorResult.value.userId);
    if (!result.ok) {
      return { content: [{ type: 'text', text: result.error }], isError: true };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result.value) }],
    };
  }

  const result = await declineOffer(prisma, args.offer_id, actorResult.value.userId);
  if (!result.ok) {
    return { content: [{ type: 'text', text: result.error }], isError: true };
  }

  const { buyerContact: _, ...withoutContact } = result.value as unknown as Record<string, unknown>;
  return {
    content: [{ type: 'text', text: JSON.stringify(withoutContact) }],
  };
}
