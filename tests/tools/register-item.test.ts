import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { handleRegisterItem } from '../../src/tools/register-item.js';
import { parseToolResult } from './helpers.js';
import { getTestPrisma, cleanupTestDb, disconnectTestDb } from '../db/helpers.js';
import {
  getTestMeili,
  getTestIndexName,
  setupTestIndex,
  cleanupTestIndex,
} from '../search/helpers.js';
import { verifyToken } from '../../src/lib/auth.js';

const prisma = getTestPrisma();
const meili = getTestMeili();
const indexName = getTestIndexName();
const TEST_SECRET = new TextEncoder().encode('test-secret-key-at-least-32-chars!');

async function makeAuthInfo(sub: string, provider = 'chatgpt') {
  const token = await new SignJWT({ sub, provider })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .setIssuedAt()
    .sign(TEST_SECRET);
  return verifyToken(token);
}

beforeAll(async () => {
  await cleanupTestDb();
  await setupTestIndex();
});

beforeEach(async () => {
  await cleanupTestDb();
  const index = meili.index(indexName);
  await index.deleteAllDocuments().waitTask();
});

afterAll(async () => {
  await cleanupTestIndex();
  await disconnectTestDb();
});

describe('register_item tool', () => {
  // Given 인증된 유저 + 유효한 입력
  // When register_item 호출
  // Then listing 생성 + isError=false
  it('creates a listing for authenticated user', async () => {
    const authInfo = await makeAuthInfo('seller-1');

    const result = await handleRegisterItem(
      {
        idempotency_key: 'reg-1',
        title: 'Sony A7M4 풀박스',
        description: '6개월 사용. 셔터카운트 3000.',
        price: 2200000,
      },
      { prisma, meili, authInfo, searchIndexName: indexName },
    );

    const { data, isError } = parseToolResult(result);
    expect(isError).toBe(false);

    const parsed = data as { id: string; title: string; price: number };
    expect(parsed.title).toBe('Sony A7M4 풀박스');
    expect(parsed.price).toBe(2200000);

    const inDb = await prisma.listing.count();
    expect(inDb).toBe(1);
  });

  // Given 동일 idempotency_key로 2회 호출
  // When 두 번째 호출
  // Then 새 listing 생성 없이 기존 반환
  it('returns existing listing on duplicate idempotency key', async () => {
    const authInfo = await makeAuthInfo('seller-2');
    const args = {
      idempotency_key: 'reg-dup',
      title: 'Canon EF 50mm',
      description: '인물 렌즈',
      price: 350000,
    };
    const deps = { prisma, meili, authInfo, searchIndexName: indexName };

    const first = await handleRegisterItem(args, deps);
    const second = await handleRegisterItem(args, deps);

    const firstData = parseToolResult(first).data as { id: string };
    const secondData = parseToolResult(second).data as { id: string };
    expect(firstData.id).toBe(secondData.id);

    const count = await prisma.listing.count();
    expect(count).toBe(1);
  });

  // Given 인증 없이 호출
  // When register_item 호출
  // Then isError=true (AUTH_REQUIRED)
  it('returns error when not authenticated', async () => {
    const result = await handleRegisterItem(
      {
        idempotency_key: 'reg-noauth',
        title: 'Test',
        description: 'Test',
        price: 100000,
      },
      { prisma, meili, searchIndexName: indexName },
    );

    expect(result.isError).toBe(true);
    const { data } = parseToolResult(result);
    expect(data).toContain('AUTH_REQUIRED');
  });
});
