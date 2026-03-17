import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { handleManageListing } from '../../src/tools/manage-listing.js';
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

describe('manage_listing tool', () => {
  // Given active 매물 → reserve
  // When manage_listing(action="reserve") 호출
  // Then status=reserved + listing_event 기록
  it('transitions active listing to reserved', async () => {
    const seller = await createTestUser(prisma, { provider: 'chatgpt', subject: 'mgr-owner' });
    const listing = await prisma.listing.create({
      data: { sellerId: seller.id, title: 'Leica Q3', description: '예약 테스트', price: 6500000 },
    });
    const authInfo = await makeAuthInfo('mgr-owner');

    const result = await handleManageListing(
      { idempotency_key: 'mgr-1', listing_id: listing.id, action: 'reserve' },
      { prisma, meili, authInfo, searchIndexName: indexName },
    );

    const { data, isError } = parseToolResult(result);
    expect(isError).toBe(false);

    const parsed = data as { status: string };
    expect(parsed.status).toBe('reserved');

    const events = await prisma.listingEvent.findMany({ where: { listingId: listing.id } });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  // Given sold 매물 → reserve (invalid)
  // When manage_listing(action="reserve") 호출
  // Then isError=true (INVALID_TRANSITION)
  it('returns INVALID_TRANSITION for sold to reserve', async () => {
    const seller = await createTestUser(prisma, { provider: 'chatgpt', subject: 'mgr-sold' });
    const listing = await prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: 'Sold Camera',
        description: '판매 완료',
        price: 1000000,
        status: 'sold',
      },
    });
    const authInfo = await makeAuthInfo('mgr-sold');

    const result = await handleManageListing(
      { idempotency_key: 'mgr-invalid', listing_id: listing.id, action: 'reserve' },
      { prisma, meili, authInfo, searchIndexName: indexName },
    );

    expect(result.isError).toBe(true);
    const { data } = parseToolResult(result);
    expect(data).toContain('INVALID_TRANSITION');
  });
});
