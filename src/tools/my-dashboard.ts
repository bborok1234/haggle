import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AuthInfo } from '../lib/auth.js';
import { requireAuth, resolveActor } from '../lib/auth.js';
import { getPrisma } from '../db/client.js';
import { getDashboard, type DashboardSection } from '../db/queries/dashboard.js';

export const myDashboardSchema = z.object({
  section: z
    .enum(['all', 'listings', 'offers_received', 'offers_sent', 'watches'])
    .optional()
    .describe('조회할 섹션 (기본: all)'),
  limit: z.number().optional().describe('섹션별 결과 수 (기본 10)'),
});

export type MyDashboardArgs = z.infer<typeof myDashboardSchema>;

export interface MyDashboardDeps {
  prisma?: PrismaClient;
  authInfo?: AuthInfo;
}

export async function handleMyDashboard(
  args: MyDashboardArgs,
  deps: MyDashboardDeps,
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

  const section: DashboardSection = args.section ?? 'all';
  const result = await getDashboard(prisma, actorResult.value.userId, section, args.limit ?? 10);

  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
}
