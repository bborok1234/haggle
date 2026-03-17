import { jwtVerify } from 'jose';
import type { PrismaClient, User } from '../generated/prisma/client.js';
import type { Result } from './result.js';
import { ok, err } from './result.js';
import { findOrCreateUser } from '../db/queries/users.js';

export interface Actor {
  userId: string;
  user: User;
  provider: string;
  subject: string;
}

export interface AuthInfo {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt?: number;
  extra?: Record<string, unknown>;
}

let _secret: Uint8Array | null = null;

function getJwtSecret(): Uint8Array {
  if (_secret) return _secret;
  const raw = process.env['JWT_SECRET'];
  if (!raw) throw new Error('JWT_SECRET is required');
  _secret = new TextEncoder().encode(raw);
  return _secret;
}

export async function verifyToken(token: string): Promise<AuthInfo> {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    algorithms: ['HS256'],
  });

  return {
    token,
    clientId: (payload['client_id'] as string) ?? '',
    scopes: ((payload['scope'] as string) ?? '').split(' ').filter(Boolean),
    expiresAt: payload.exp,
    extra: {
      sub: payload.sub,
      provider: (payload['provider'] as string) ?? 'unknown',
    },
  };
}

export async function resolveActor(
  prisma: PrismaClient,
  authInfo: AuthInfo,
): Promise<Result<Actor, string>> {
  const sub = authInfo.extra?.['sub'] as string | undefined;
  const provider = (authInfo.extra?.['provider'] as string) ?? 'unknown';

  if (!sub) return err('MISSING_SUB');

  const userResult = await findOrCreateUser(prisma, provider, sub, sub);
  if (!userResult.ok) return err(userResult.error);

  return ok({
    userId: userResult.value.id,
    user: userResult.value,
    provider,
    subject: sub,
  });
}

export function requireAuth(authInfo: AuthInfo | undefined): Result<AuthInfo, string> {
  if (!authInfo) return err('AUTH_REQUIRED');
  return ok(authInfo);
}
