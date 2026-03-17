import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { handleMyDashboard } from '../../src/tools/my-dashboard.js';
import { parseToolResult } from './helpers.js';
import { getTestPrisma, cleanupTestDb, disconnectTestDb, createTestUser } from '../db/helpers.js';
import { verifyToken } from '../../src/lib/auth.js';

const prisma = getTestPrisma();
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
});

beforeEach(async () => {
  await cleanupTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('my_dashboard tool', () => {
  // Given 유저가 매물 2개 + 받은 제안 1개 + 보낸 제안 1개
  // When my_dashboard() 호출
  // Then 4개 섹션 반환
  it('returns all sections', async () => {
    const seller = await createTestUser(prisma, { provider: 'chatgpt', subject: 'dash-user' });
    const other = await createTestUser(prisma, { provider: 'chatgpt', subject: 'dash-other' });

    await prisma.listing.createMany({
      data: [
        { sellerId: seller.id, title: 'Item 1', description: 'Desc', price: 100000 },
        { sellerId: seller.id, title: 'Item 2', description: 'Desc', price: 200000 },
      ],
    });
    const listing = await prisma.listing.findFirst({ where: { sellerId: seller.id } });
    const otherListing = await prisma.listing.create({
      data: { sellerId: other.id, title: 'Other Item', description: 'Desc', price: 300000 },
    });

    await prisma.offer.create({
      data: {
        listingId: listing?.id ?? '',
        buyerId: other.id,
        offeredPrice: 90000,
        buyerContact: '010-0000',
      },
    });
    await prisma.offer.create({
      data: {
        listingId: otherListing.id,
        buyerId: seller.id,
        offeredPrice: 250000,
        buyerContact: '010-1111',
      },
    });

    const authInfo = await makeAuthInfo('dash-user');
    const result = await handleMyDashboard({}, { prisma, authInfo });
    const { data, isError } = parseToolResult(result);

    expect(isError).toBe(false);
    const parsed = data as {
      my_listings: unknown[];
      offers_received: unknown[];
      offers_sent: unknown[];
      my_watches: unknown[];
    };
    expect(parsed.my_listings).toHaveLength(2);
    expect(parsed.offers_received).toHaveLength(1);
    expect(parsed.offers_sent).toHaveLength(1);
    expect(parsed.my_watches).toHaveLength(0);
  });

  // Given section="listings"
  // When my_dashboard(section="listings")
  // Then 내 매물만 반환
  it('returns only requested section', async () => {
    const seller = await createTestUser(prisma, { provider: 'chatgpt', subject: 'dash-section' });
    await prisma.listing.create({
      data: { sellerId: seller.id, title: 'My Item', description: 'D', price: 100000 },
    });

    const authInfo = await makeAuthInfo('dash-section');
    const result = await handleMyDashboard({ section: 'listings' }, { prisma, authInfo });
    const { data, isError } = parseToolResult(result);

    expect(isError).toBe(false);
    const parsed = data as Record<string, unknown>;
    expect(parsed['my_listings']).toBeDefined();
    expect(parsed['offers_received']).toBeUndefined();
    expect(parsed['offers_sent']).toBeUndefined();
    expect(parsed['my_watches']).toBeUndefined();
  });
});
