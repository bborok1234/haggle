import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AuthInfo } from '../lib/auth.js';
import { requireAuth, resolveActor } from '../lib/auth.js';
import { getPrisma } from '../db/client.js';
import { createOffer } from '../db/queries/offers.js';
import { checkIdempotency, saveIdempotency } from '../db/queries/idempotency.js';

export const makeOfferSchema = z.object({
  idempotency_key: z.string(),
  listing_id: z.string(),
  offered_price: z.number().int().positive(),
  message: z.string().max(1000).optional(),
  buyer_contact: z.string().min(1),
});

export type MakeOfferArgs = z.infer<typeof makeOfferSchema>;

export interface MakeOfferDeps {
  prisma?: PrismaClient;
  authInfo?: AuthInfo;
}

function stripBuyerContact(offer: Record<string, unknown>): Record<string, unknown> {
  const { buyerContact: _, ...rest } = offer;
  return rest;
}

export async function handleMakeOffer(
  args: MakeOfferArgs,
  deps: MakeOfferDeps,
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

  const idemCheck = await checkIdempotency(prisma, args.idempotency_key);
  if (idemCheck.ok && idemCheck.value) {
    const existing = await prisma.offer.findUnique({ where: { id: idemCheck.value } });
    if (existing) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(stripBuyerContact(existing as unknown as Record<string, unknown>)),
          },
        ],
      };
    }
  }

  const result = await createOffer(prisma, {
    listingId: args.listing_id,
    buyerId: actorResult.value.userId,
    offeredPrice: args.offered_price,
    message: args.message,
    buyerContact: args.buyer_contact,
  });

  if (!result.ok) {
    return { content: [{ type: 'text', text: result.error }], isError: true };
  }

  await saveIdempotency(prisma, args.idempotency_key, 'offer', result.value.id);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(stripBuyerContact(result.value as unknown as Record<string, unknown>)),
      },
    ],
  };
}
