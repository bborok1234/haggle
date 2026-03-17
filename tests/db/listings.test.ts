import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestPrisma, cleanupTestDb, disconnectTestDb, createTestUser } from './helpers.js';
import {
  createListing,
  findListingById,
  updateListingStatus,
} from '../../src/db/queries/listings.js';

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

describe('createListing', () => {
  // Given 유효한 매물 데이터
  // When createListing 호출
  // Then listings 테이블에 저장되고 listing 객체 반환
  it('creates a listing and returns it', async () => {
    const seller = await createTestUser(prisma);

    const result = await createListing(prisma, {
      idempotencyKey: 'idem-create-1',
      sellerId: seller.id,
      title: 'Sony A7M4 풀박스',
      description: '6개월 사용. 셔터카운트 3000.',
      price: 2200000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.title).toBe('Sony A7M4 풀박스');
    expect(result.value.price).toBe(2200000);
    expect(result.value.status).toBe('active');
    expect(result.value.sellerId).toBe(seller.id);

    const inDb = await prisma.listing.findUnique({ where: { id: result.value.id } });
    expect(inDb).not.toBeNull();
  });

  // Given 동일 idempotency_key로 createListing 2회 호출
  // When 두 번째 호출
  // Then 새 매물 생성 없이 기존 매물 반환
  it('returns existing listing on duplicate idempotency key', async () => {
    const seller = await createTestUser(prisma);
    const input = {
      idempotencyKey: 'idem-dup-1',
      sellerId: seller.id,
      title: 'Canon EF 50mm f/1.4',
      description: '인물 렌즈.',
      price: 350000,
    };

    const first = await createListing(prisma, input);
    const second = await createListing(prisma, input);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.value.id).toBe(second.value.id);

    const count = await prisma.listing.count();
    expect(count).toBe(1);
  });
});

describe('findListingById', () => {
  // Given 존재하는 매물 ID
  // When findListingById 호출
  // Then 매물 + 판매자 정보 반환
  it('returns listing with seller info', async () => {
    const seller = await createTestUser(prisma, { displayName: '카메라사랑' });
    const listing = await prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: 'Nikon Z6 III',
        description: '미개봉 새상품.',
        price: 2800000,
      },
    });

    const result = await findListingById(prisma, listing.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.title).toBe('Nikon Z6 III');
    expect(result.value.seller.displayName).toBe('카메라사랑');
  });

  // Given 존재하지 않는 매물 ID
  // When findListingById 호출
  // Then err('NOT_FOUND') 반환
  it('returns NOT_FOUND for nonexistent id', async () => {
    const result = await findListingById(prisma, '00000000-0000-0000-0000-000000000000');

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toBe('NOT_FOUND');
  });
});

describe('updateListingStatus', () => {
  // Given active 상태 매물
  // When updateListingStatus('reserved') 호출
  // Then status가 reserved로 변경되고 listing_events에 기록
  it('transitions active to reserved and records event', async () => {
    const seller = await createTestUser(prisma);
    const listing = await prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: 'Fuji X-T5',
        description: '상태 좋음.',
        price: 1800000,
      },
    });

    const result = await updateListingStatus(prisma, listing.id, 'active', 'reserved', seller.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.status).toBe('reserved');

    const events = await prisma.listingEvent.findMany({
      where: { listingId: listing.id },
    });
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event).toBeDefined();
    expect(event?.eventType).toBe('reserved');
    expect(event?.oldStatus).toBe('active');
    expect(event?.newStatus).toBe('reserved');
  });

  // Given 이미 sold 상태 매물
  // When updateListingStatus('reserved') 호출
  // Then err('CONFLICT') 반환
  it('returns CONFLICT when current status does not match', async () => {
    const seller = await createTestUser(prisma);
    const listing = await prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: 'Leica Q3',
        description: '판매 완료된 매물.',
        price: 6500000,
        status: 'sold',
      },
    });

    const result = await updateListingStatus(prisma, listing.id, 'active', 'reserved', seller.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toBe('CONFLICT');
  });
});
