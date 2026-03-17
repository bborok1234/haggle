import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getPrisma } from '../db/client.js';
import { findListingById } from '../db/queries/listings.js';

export const getListingSchema = z.object({
  listing_id: z.string().describe('매물 ID'),
});

export type GetListingArgs = z.infer<typeof getListingSchema>;

export interface GetListingDeps {
  prisma?: PrismaClient;
}

export async function handleGetListing(
  args: GetListingArgs,
  deps: GetListingDeps = {},
): Promise<CallToolResult> {
  const prisma = deps.prisma ?? getPrisma();
  const result = await findListingById(prisma, args.listing_id);

  if (!result.ok) {
    return {
      content: [{ type: 'text', text: result.error }],
      isError: true,
    };
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(result.value) }],
  };
}
