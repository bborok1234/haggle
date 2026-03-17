import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { handleSetWatch } from '../../src/tools/set-watch.js';
import { parseToolResult } from './helpers.js';
import { getTestPrisma, cleanupTestDb, disconnectTestDb } from '../db/helpers.js';
import {
  getTestMeili,
  getTestIndexName,
  setupTestIndex,
  cleanupTestIndex,
  makeTestListing,
} from '../search/helpers.js';
import { syncListing } from '../../src/search/sync.js';
import { verifyToken } from '../../src/lib/auth.js';

const prisma = getTestPrisma();
const meili = getTestMeili();
const indexName = getTestIndexName();
const TEST_SECRET = new TextEncoder().encode('test-secret-key-at-least-32-chars!');

async function makeAuthInfo(sub: string) {
  const token = await new SignJWT({ sub, provider: 'chatgpt' })
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

describe('set_watch tool', () => {
  // Given 인증된 유저 + 검색 조건 + 매칭 매물 존재
  // When set_watch 호출
  // Then watch 저장 + 즉시 매칭 결과 반환
  it('creates watch and returns matching listings', async () => {
    await syncListing(
      meili,
      makeTestListing({ id: 'w1', title: '소니 카메라', price: 500000 }),
      indexName,
    );
    await syncListing(
      meili,
      makeTestListing({ id: 'w2', title: '캐논 렌즈', price: 200000 }),
      indexName,
    );

    const authInfo = await makeAuthInfo('watch-user');

    const result = await handleSetWatch(
      { idempotency_key: 'watch-1', query: '카메라', max_price: 600000 },
      { prisma, meili, authInfo, searchIndexName: indexName },
    );

    const { data, isError } = parseToolResult(result);
    expect(isError).toBe(false);

    const parsed = data as { watch: { id: string }; matches: { hits: unknown[] } };
    expect(parsed.watch.id).toBeDefined();
    expect(parsed.matches.hits.length).toBeGreaterThanOrEqual(1);

    const watchCount = await prisma.watch.count();
    expect(watchCount).toBe(1);
  });

  // Given 동일 idempotency_key
  // When 2회 호출
  // Then 기존 watch 반환
  it('returns existing watch on duplicate idempotency key', async () => {
    const authInfo = await makeAuthInfo('watch-idem');
    const args = { idempotency_key: 'watch-dup', query: '렌즈' };
    const deps = { prisma, meili, authInfo, searchIndexName: indexName };

    const first = await handleSetWatch(args, deps);
    const second = await handleSetWatch(args, deps);

    const firstData = parseToolResult(first).data as { watch: { id: string } };
    const secondData = parseToolResult(second).data as { watch: { id: string } };
    expect(firstData.watch.id).toBe(secondData.watch.id);

    const watchCount = await prisma.watch.count();
    expect(watchCount).toBe(1);
  });
});
