import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { handleGetListing } from '../../src/tools/get-listing.js';
import { parseToolResult } from './helpers.js';
import { getTestPrisma, cleanupTestDb, disconnectTestDb, createTestUser } from '../db/helpers.js';

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

describe('get_listing tool', () => {
  // Given DB에 매물 + 판매자 존재
  // When get_listing 핸들러 호출 (listing_id=X)
  // Then content에 매물 상세 + 판매자 정보
  it('returns listing detail with seller info', async () => {
    const seller = await createTestUser(prisma, { displayName: '카메라사랑' });
    const listing = await prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: 'Sony A7M4',
        description: '상태 최상',
        price: 2200000,
      },
    });

    const result = await handleGetListing({ listing_id: listing.id }, { prisma });
    const { data, isError } = parseToolResult(result);

    expect(isError).toBe(false);
    const parsed = data as { title: string; seller: { displayName: string } };
    expect(parsed.title).toBe('Sony A7M4');
    expect(parsed.seller.displayName).toBe('카메라사랑');
  });

  // Given 존재하지 않는 ID
  // When get_listing 핸들러 호출
  // Then isError=true
  it('returns error for nonexistent listing', async () => {
    const result = await handleGetListing(
      { listing_id: '00000000-0000-0000-0000-000000000000' },
      { prisma },
    );

    expect(result.isError).toBe(true);
  });
});
