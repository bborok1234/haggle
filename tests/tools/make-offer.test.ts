import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { handleMakeOffer } from '../../src/tools/make-offer.js';
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

beforeAll(async () => {
  await cleanupTestDb();
});

beforeEach(async () => {
  await cleanupTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('make_offer tool', () => {
  // Given 인증된 바이어 + active 매물
  // When make_offer 호출
  // Then offer 생성 + buyer_contact 응답에 미포함
  it('creates offer and hides buyer_contact', async () => {
    const seller = await createTestUser(prisma, { provider: 'chatgpt', subject: 'seller-offer' });
    const listing = await prisma.listing.create({
      data: { sellerId: seller.id, title: 'Camera', description: 'Good', price: 1000000 },
    });
    const buyerAuth = await makeAuthInfo('buyer-offer');

    const result = await handleMakeOffer(
      {
        idempotency_key: 'offer-1',
        listing_id: listing.id,
        offered_price: 900000,
        buyer_contact: '010-1234-5678',
      },
      { prisma, authInfo: buyerAuth },
    );

    const { data, isError } = parseToolResult(result);
    expect(isError).toBe(false);

    const parsed = data as Record<string, unknown>;
    expect(parsed['offeredPrice']).toBe(900000);
    expect(parsed['buyerContact']).toBeUndefined();
  });

  // Given 자기 매물에 제안
  // When make_offer 호출
  // Then isError=true (SELF_OFFER)
  it('rejects self-offer', async () => {
    const seller = await createTestUser(prisma, { provider: 'chatgpt', subject: 'self-seller' });
    const listing = await prisma.listing.create({
      data: { sellerId: seller.id, title: 'My Item', description: 'Mine', price: 500000 },
    });
    const sellerAuth = await makeAuthInfo('self-seller');

    const result = await handleMakeOffer(
      {
        idempotency_key: 'offer-self',
        listing_id: listing.id,
        offered_price: 400000,
        buyer_contact: '010-0000-0000',
      },
      { prisma, authInfo: sellerAuth },
    );

    expect(result.isError).toBe(true);
    const { data } = parseToolResult(result);
    expect(data).toContain('SELF_OFFER');
  });

  // Given 동일 idempotency_key로 2회 호출
  // When 두 번째 호출
  // Then 기존 offer 반환
  it('returns existing offer on duplicate idempotency key', async () => {
    const seller = await createTestUser(prisma, { provider: 'chatgpt', subject: 'seller-idem' });
    const listing = await prisma.listing.create({
      data: { sellerId: seller.id, title: 'Lens', description: 'Nice', price: 300000 },
    });
    const buyerAuth = await makeAuthInfo('buyer-idem');
    const args = {
      idempotency_key: 'offer-idem',
      listing_id: listing.id,
      offered_price: 250000,
      buyer_contact: '010-1111-1111',
    };
    const deps = { prisma, authInfo: buyerAuth };

    const first = await handleMakeOffer(args, deps);
    const second = await handleMakeOffer(args, deps);

    const firstData = parseToolResult(first).data as { id: string };
    const secondData = parseToolResult(second).data as { id: string };
    expect(firstData.id).toBe(secondData.id);

    const count = await prisma.offer.count();
    expect(count).toBe(1);
  });
});
