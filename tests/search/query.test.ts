import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  getTestMeili,
  getTestIndexName,
  setupTestIndex,
  cleanupTestIndex,
  makeTestListing,
} from './helpers.js';
import { syncListing } from '../../src/search/sync.js';
import { searchListings } from '../../src/search/query.js';

const client = getTestMeili();
const indexName = getTestIndexName();

beforeAll(async () => {
  await setupTestIndex();
});

beforeEach(async () => {
  const index = client.index(indexName);
  await index.deleteAllDocuments().waitTask();
});

afterAll(async () => {
  await cleanupTestIndex();
});

async function seedListings(...docs: Parameters<typeof makeTestListing>[0][]) {
  for (const overrides of docs) {
    await syncListing(client, makeTestListing(overrides), indexName);
  }
}

describe('searchListings', () => {
  // Given "소니 카메라" 매물 2개 + "캐논 렌즈" 매물 1개 인덱싱
  // When searchListings(query="카메라") 호출
  // Then 소니 카메라 매물 반환
  it('finds listings by keyword', async () => {
    await seedListings(
      { id: 's1', title: '소니 카메라 A7M4', price: 2200000 },
      { id: 's2', title: '소니 카메라 A7C', price: 1500000 },
      { id: 'c1', title: '캐논 렌즈 EF 50mm', price: 350000 },
    );

    const result = await searchListings(client, { query: '카메라' }, indexName);

    expect(result.hits.length).toBeGreaterThanOrEqual(2);
    const ids = result.hits.map((h) => h.id);
    expect(ids).toContain('s1');
    expect(ids).toContain('s2');
  });

  // Given 매물 3개 (10만, 30만, 50만)
  // When searchListings(max_price=350000) 호출
  // Then 10만 + 30만 매물만 반환
  it('filters by max price', async () => {
    await seedListings(
      { id: 'p1', title: '저렴한 렌즈', price: 100000 },
      { id: 'p2', title: '중간 렌즈', price: 300000 },
      { id: 'p3', title: '비싼 렌즈', price: 500000 },
    );

    const result = await searchListings(client, { max_price: 350000 }, indexName);

    expect(result.hits).toHaveLength(2);
    const ids = result.hits.map((h) => h.id);
    expect(ids).toContain('p1');
    expect(ids).toContain('p2');
  });

  // Given 매물 3개
  // When searchListings(sort_by="price_asc") 호출
  // Then 가격 오름차순 정렬
  it('sorts by price ascending', async () => {
    await seedListings(
      { id: 'sa', title: '매물 A', price: 500000 },
      { id: 'sb', title: '매물 B', price: 100000 },
      { id: 'sc', title: '매물 C', price: 300000 },
    );

    const result = await searchListings(client, { sort_by: 'price_asc' }, indexName);

    expect(result.hits[0]?.id).toBe('sb');
    expect(result.hits[1]?.id).toBe('sc');
    expect(result.hits[2]?.id).toBe('sa');
  });

  // Given 매물 5개
  // When searchListings(limit=2) 호출
  // Then 2개 반환 + total_count >= 5
  it('paginates with limit and offset', async () => {
    await seedListings(
      { id: 'pg1', title: '매물 1', price: 100000 },
      { id: 'pg2', title: '매물 2', price: 200000 },
      { id: 'pg3', title: '매물 3', price: 300000 },
      { id: 'pg4', title: '매물 4', price: 400000 },
      { id: 'pg5', title: '매물 5', price: 500000 },
    );

    const result = await searchListings(client, { limit: 2, sort_by: 'price_asc' }, indexName);

    expect(result.hits).toHaveLength(2);
    expect(result.total_count).toBeGreaterThanOrEqual(5);
    expect(result.limit).toBe(2);
    expect(result.offset).toBe(0);
  });

  // Given query 없이 필터만
  // When searchListings(max_price=500000) 호출
  // Then 50만 이하 전체 매물 반환
  it('filters without query', async () => {
    await seedListings(
      { id: 'f1', title: '싼 카메라', price: 200000 },
      { id: 'f2', title: '비싼 카메라', price: 800000 },
    );

    const result = await searchListings(client, { max_price: 500000 }, indexName);

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.id).toBe('f1');
  });
});
