import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { handleSearchListings } from '../../src/tools/search-listings.js';
import { parseToolResult } from './helpers.js';
import {
  getTestMeili,
  getTestIndexName,
  setupTestIndex,
  cleanupTestIndex,
  makeTestListing,
} from '../search/helpers.js';
import { syncListing } from '../../src/search/sync.js';

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

describe('search_listings tool', () => {
  // Given Meilisearch에 매물 3개 인덱싱
  // When search_listings 핸들러 호출 (query="카메라")
  // Then content에 매물 목록 + total_count 반환
  it('returns matching listings for keyword search', async () => {
    await seedListings(
      { id: 'cam1', title: '소니 카메라 A7M4', price: 2200000 },
      { id: 'cam2', title: '소니 카메라 A7C', price: 1500000 },
      { id: 'lens1', title: '캐논 렌즈 50mm', price: 350000 },
    );

    const result = await handleSearchListings({ query: '카메라' }, { meili: client, indexName });
    const { data, isError } = parseToolResult(result);

    expect(isError).toBe(false);
    const parsed = data as { hits: Array<{ id: string }>; total_count: number };
    expect(parsed.hits.length).toBeGreaterThanOrEqual(2);
    expect(parsed.total_count).toBeGreaterThanOrEqual(2);
  });

  // Given 빈 파라미터
  // When search_listings 핸들러 호출 ({})
  // Then 전체 active 매물 반환
  it('returns all active listings when no query given', async () => {
    await seedListings(
      { id: 'a1', title: '매물 1', price: 100000 },
      { id: 'a2', title: '매물 2', price: 200000 },
    );

    const result = await handleSearchListings({}, { meili: client, indexName });
    const { data, isError } = parseToolResult(result);

    expect(isError).toBe(false);
    const parsed = data as { hits: Array<{ id: string }>; total_count: number };
    expect(parsed.hits.length).toBeGreaterThanOrEqual(2);
  });
});
