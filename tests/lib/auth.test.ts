import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { verifyToken, resolveActor, requireAuth, type AuthInfo } from '../../src/lib/auth.js';
import { getTestPrisma, cleanupTestDb, disconnectTestDb } from '../db/helpers.js';

const prisma = getTestPrisma();

const TEST_SECRET = new TextEncoder().encode('test-secret-key-at-least-32-chars!');

async function signTestJwt(
  claims: Record<string, unknown> = {},
  options: { expiresIn?: string; secret?: Uint8Array } = {},
): Promise<string> {
  const builder = new SignJWT({ sub: 'user-123', provider: 'chatgpt', ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt();

  if (options.expiresIn !== 'none') {
    builder.setExpirationTime(options.expiresIn ?? '1h');
  }

  return builder.sign(options.secret ?? TEST_SECRET);
}

beforeAll(async () => {
  await cleanupTestDb();
});

beforeEach(async () => {
  await cleanupTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('verifyToken', () => {
  // Given 유효한 JWT (sub="user-123")
  // When verifyToken 호출
  // Then AuthInfo 반환 (extra.sub = "user-123")
  it('returns AuthInfo for valid JWT', async () => {
    const token = await signTestJwt();
    const authInfo = await verifyToken(token);

    expect(authInfo.extra?.['sub']).toBe('user-123');
    expect(authInfo.token).toBe(token);
  });

  // Given 만료된 JWT
  // When verifyToken 호출
  // Then 에러 throw
  it('throws on expired JWT', async () => {
    const token = await signTestJwt({}, { expiresIn: '-1h' });
    await expect(verifyToken(token)).rejects.toThrow();
  });

  // Given 잘못된 서명 JWT
  // When verifyToken 호출
  // Then 에러 throw
  it('throws on invalid signature', async () => {
    const wrongSecret = new TextEncoder().encode('wrong-secret-key-at-least-32-ch!');
    const token = await signTestJwt({}, { secret: wrongSecret });
    await expect(verifyToken(token)).rejects.toThrow();
  });
});

describe('resolveActor', () => {
  // Given JWT sub가 DB에 없는 새 유저
  // When resolveActor 호출
  // Then 새 User 생성 + 반환
  it('creates new user for unknown sub', async () => {
    const authInfo: AuthInfo = {
      token: 'test',
      clientId: '',
      scopes: [],
      extra: { sub: 'new-user-sub', provider: 'chatgpt' },
    };

    const result = await resolveActor(prisma, authInfo);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.subject).toBe('new-user-sub');
    expect(result.value.provider).toBe('chatgpt');

    const userCount = await prisma.user.count();
    expect(userCount).toBe(1);
  });

  // Given JWT sub가 DB에 있는 기존 유저
  // When resolveActor 호출
  // Then 기존 User 반환
  it('returns existing user for known sub', async () => {
    const authInfo: AuthInfo = {
      token: 'test',
      clientId: '',
      scopes: [],
      extra: { sub: 'existing-sub', provider: 'claude' },
    };

    const first = await resolveActor(prisma, authInfo);
    const second = await resolveActor(prisma, authInfo);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.userId).toBe(second.value.userId);

    const userCount = await prisma.user.count();
    expect(userCount).toBe(1);
  });
});

describe('requireAuth', () => {
  // Given authInfo가 있는 extra
  // When requireAuth 호출
  // Then ok(authInfo) 반환
  it('returns ok when authInfo is present', () => {
    const authInfo: AuthInfo = {
      token: 'test',
      clientId: '',
      scopes: [],
      extra: { sub: 'user-1' },
    };

    const result = requireAuth(authInfo);
    expect(result.ok).toBe(true);
  });

  // Given authInfo가 없는 extra
  // When requireAuth 호출
  // Then err('AUTH_REQUIRED') 반환
  it('returns err when authInfo is undefined', () => {
    const result = requireAuth(undefined);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('AUTH_REQUIRED');
  });
});
