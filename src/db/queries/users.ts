import type { PrismaClient, User } from '../../generated/prisma/client.js';
import type { Result } from '../../lib/result.js';
import { ok, err } from '../../lib/result.js';

export async function findOrCreateUser(
  prisma: PrismaClient,
  provider: string,
  subject: string,
  displayName: string,
): Promise<Result<User, string>> {
  const existing = await prisma.userIdentity.findUnique({
    where: { provider_subject: { provider, subject } },
    include: { user: true },
  });

  if (existing) return ok(existing.user);

  const user = await prisma.user.create({
    data: {
      displayName,
      identities: {
        create: { provider, subject },
      },
    },
  });

  return ok(user);
}

export async function findUserByIdentity(
  prisma: PrismaClient,
  provider: string,
  subject: string,
): Promise<Result<User, string>> {
  const identity = await prisma.userIdentity.findUnique({
    where: { provider_subject: { provider, subject } },
    include: { user: true },
  });

  if (!identity) return err('NOT_FOUND');
  return ok(identity.user);
}
