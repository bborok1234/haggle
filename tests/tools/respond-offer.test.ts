import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { handleRespondOffer } from '../../src/tools/respond-offer.js';
import { parseToolResult } from './helpers.js';
import { getTestPrisma, cleanupTestDb, disconnectTestDb, createTestUser } from '../db/helpers.js';
import { verifyToken } from '../../src/lib/auth.js';

const prisma = getTestPrisma();
const TEST_SECRET = new TextEncoder().encode('test-secret-key-at-least-32-chars!');

async function makeAuthInfo(sub: string, provider = 'chatgpt') {
  const token = await new SignJWT({ sub, provider })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .setIssuedAt()
    .sign(TEST_SECRET);
  return verifyToken(token);
}

async function seedOfferScenario() {
  const seller = await createTestUser(prisma, { provider: 'chatgpt', subject: 'resp-seller' });
  const buyer = await createTestUser(prisma, { provider: 'chatgpt', subject: 'resp-buyer' });
  const listing = await prisma.listing.create({
    data: { sellerId: seller.id, title: 'Sony A7M4', description: 'Great', price: 2200000 },
  });
  const offer = await prisma.offer.create({
    data: {
      listingId: listing.id,
      buyerId: buyer.id,
      offeredPrice: 2000000,
      buyerContact: '010-9999-8888',
    },
  });
  return { seller, buyer, listing, offer };
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

describe('respond_offer tool', () => {
  // Given 판매자가 pending offer에 accept
  // When respond_offer(action="accept") 호출
  // Then offer=accepted + listing=reserved + buyer_contact 포함
  it('accepts offer, reserves listing, reveals buyer_contact', async () => {
    const { offer } = await seedOfferScenario();
    const sellerAuth = await makeAuthInfo('resp-seller');

    const result = await handleRespondOffer(
      { idempotency_key: 'resp-accept', offer_id: offer.id, action: 'accept' },
      { prisma, authInfo: sellerAuth },
    );

    const { data, isError } = parseToolResult(result);
    expect(isError).toBe(false);

    const parsed = data as { status: string; buyerContact?: string };
    expect(parsed.status).toBe('accepted');
    expect(parsed.buyerContact).toBe('010-9999-8888');

    const listing = await prisma.listing.findFirst();
    expect(listing?.status).toBe('reserved');
  });

  // Given 판매자가 pending offer에 decline
  // When respond_offer(action="decline") 호출
  // Then offer=declined + listing 상태 변경 없음
  it('declines offer without changing listing status', async () => {
    const { offer } = await seedOfferScenario();
    const sellerAuth = await makeAuthInfo('resp-seller');

    const result = await handleRespondOffer(
      { idempotency_key: 'resp-decline', offer_id: offer.id, action: 'decline' },
      { prisma, authInfo: sellerAuth },
    );

    const { data, isError } = parseToolResult(result);
    expect(isError).toBe(false);

    const parsed = data as { status: string; buyerContact?: string };
    expect(parsed.status).toBe('declined');
    expect(parsed.buyerContact).toBeUndefined();

    const listing = await prisma.listing.findFirst();
    expect(listing?.status).toBe('active');
  });

  // Given 판매자가 아닌 유저가 응답
  // When respond_offer 호출
  // Then isError=true (FORBIDDEN)
  it('rejects non-seller response', async () => {
    const { offer } = await seedOfferScenario();
    const otherAuth = await makeAuthInfo('random-user');

    const result = await handleRespondOffer(
      { idempotency_key: 'resp-forbidden', offer_id: offer.id, action: 'accept' },
      { prisma, authInfo: otherAuth },
    );

    expect(result.isError).toBe(true);
    const { data } = parseToolResult(result);
    expect(data).toContain('FORBIDDEN');
  });
});
