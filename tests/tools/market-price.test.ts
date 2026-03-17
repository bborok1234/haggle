import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { handleMarketPrice } from '../../src/tools/market-price.js';
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

describe('market_price tool', () => {
  // Given 매물 5개 (다양한 가격) 인덱싱
  // When market_price 핸들러 호출 (query="카메라")
  // Then price_stats (min, max, avg, median) + similar_items 반환
  it('returns price statistics for matching listings', async () => {
    await seedListings(
      { id: 'mp1', title: '카메라 A', price: 100000 },
      { id: 'mp2', title: '카메라 B', price: 200000 },
      { id: 'mp3', title: '카메라 C', price: 300000 },
      { id: 'mp4', title: '카메라 D', price: 400000 },
      { id: 'mp5', title: '카메라 E', price: 500000 },
    );

    const result = await handleMarketPrice({ query: '카메라' }, { meili: client, indexName });
    const { data, isError } = parseToolResult(result);

    expect(isError).toBe(false);
    const parsed = data as {
      similar_items: Array<{ id: string; price: number }>;
      price_stats: { min: number; max: number; avg: number; median: number; sample_count: number };
    };

    expect(parsed.price_stats.min).toBe(100000);
    expect(parsed.price_stats.max).toBe(500000);
    expect(parsed.price_stats.avg).toBe(300000);
    expect(parsed.price_stats.median).toBe(300000);
    expect(parsed.price_stats.sample_count).toBe(5);
    expect(parsed.similar_items).toHaveLength(5);
  });
});
