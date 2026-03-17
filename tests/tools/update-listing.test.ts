import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { handleUpdateListing } from '../../src/tools/update-listing.js';
import { parseToolResult } from './helpers.js';
import { getTestPrisma, cleanupTestDb, disconnectTestDb, createTestUser } from '../db/helpers.js';
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
});

afterAll(async () => {
  await cleanupTestIndex();
  await disconnectTestDb();
});

describe('update_listing tool', () => {
  // Given 소유자가 가격 변경
  // When update_listing 호출
  // Then 가격 업데이트됨
  it('updates listing when called by owner', async () => {
    const seller = await createTestUser(prisma, { provider: 'chatgpt', subject: 'owner-1' });
    const listing = await prisma.listing.create({
      data: { sellerId: seller.id, title: 'Nikon Z6', description: '좋은 상태', price: 1500000 },
    });
    const authInfo = await makeAuthInfo('owner-1');

    const result = await handleUpdateListing(
      { idempotency_key: 'upd-1', listing_id: listing.id, price: 1200000 },
      { prisma, meili, authInfo, searchIndexName: indexName },
    );

    const { data, isError } = parseToolResult(result);
    expect(isError).toBe(false);

    const parsed = data as { price: number };
    expect(parsed.price).toBe(1200000);
  });

  // Given 소유자가 아닌 유저가 수정 시도
  // When update_listing 호출
  // Then isError=true (FORBIDDEN)
  it('returns FORBIDDEN when called by non-owner', async () => {
    const seller = await createTestUser(prisma, { provider: 'chatgpt', subject: 'real-owner' });
    const listing = await prisma.listing.create({
      data: { sellerId: seller.id, title: 'Fuji X-T5', description: '판매중', price: 1800000 },
    });
    const otherAuth = await makeAuthInfo('not-the-owner');

    const result = await handleUpdateListing(
      { idempotency_key: 'upd-forbidden', listing_id: listing.id, price: 1000000 },
      { prisma, meili, authInfo: otherAuth, searchIndexName: indexName },
    );

    expect(result.isError).toBe(true);
    const { data } = parseToolResult(result);
    expect(data).toContain('FORBIDDEN');
  });
});
