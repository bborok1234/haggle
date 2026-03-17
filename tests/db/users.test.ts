import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPrisma, cleanupTestDb, disconnectTestDb } from './helpers.js';
import { findOrCreateUser, findUserByIdentity } from '../../src/db/queries/users.js';

const prisma = getTestPrisma();

beforeAll(async () => {
  await cleanupTestDb();
});

beforeEach(async () => {
  await cleanupTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('findOrCreateUser', () => {
  // Given 신규 provider + subject
  // When findOrCreateUser 호출
  // Then 새 user + user_identity 생성
  it('creates new user with identity for new provider+subject', async () => {
    const result = await findOrCreateUser(prisma, 'chatgpt', 'user-abc-123', '카메라매니아');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.displayName).toBe('카메라매니아');

    const identity = await prisma.userIdentity.findUnique({
      where: { provider_subject: { provider: 'chatgpt', subject: 'user-abc-123' } },
    });
    expect(identity).toBeDefined();
    expect(identity?.userId).toBe(result.value.id);
  });

  // Given 기존 provider + subject
  // When findOrCreateUser 호출
  // Then 기존 user 반환 (중복 생성 없음)
  it('returns existing user for known provider+subject', async () => {
    const first = await findOrCreateUser(prisma, 'chatgpt', 'user-existing', '기존유저');
    const second = await findOrCreateUser(prisma, 'chatgpt', 'user-existing', '이름바뀜');

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.value.id).toBe(second.value.id);

    const userCount = await prisma.user.count();
    expect(userCount).toBe(1);
  });
});

describe('findUserByIdentity', () => {
  // Given 유저가 ChatGPT + Claude 두 identity 보유
  // When findUserByIdentity('chatgpt', sub1) 호출
  // Then 같은 user 반환
  it('finds user by any linked identity', async () => {
    const user = await prisma.user.create({
      data: {
        displayName: '멀티클라이언트',
        identities: {
          create: [
            { provider: 'chatgpt', subject: 'multi-chatgpt' },
            { provider: 'claude', subject: 'multi-claude' },
          ],
        },
      },
    });

    const byChatgpt = await findUserByIdentity(prisma, 'chatgpt', 'multi-chatgpt');
    const byClaude = await findUserByIdentity(prisma, 'claude', 'multi-claude');

    expect(byChatgpt.ok).toBe(true);
    expect(byClaude.ok).toBe(true);
    if (!byChatgpt.ok || !byClaude.ok) return;

    expect(byChatgpt.value.id).toBe(user.id);
    expect(byClaude.value.id).toBe(user.id);
  });

  // Given 존재하지 않는 identity
  // When findUserByIdentity 호출
  // Then err('NOT_FOUND') 반환
  it('returns NOT_FOUND for unknown identity', async () => {
    const result = await findUserByIdentity(prisma, 'unknown', 'nonexistent');

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toBe('NOT_FOUND');
  });
});
