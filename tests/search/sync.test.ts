import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  getTestMeili,
  getTestIndexName,
  setupTestIndex,
  cleanupTestIndex,
  makeTestListing,
} from './helpers.js';
import { syncListing, removeListing } from '../../src/search/sync.js';

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

describe('syncListing', () => {
  // Given 새 매물 데이터
  // When syncListing 호출
  // Then Meilisearch 인덱스에 문서 추가되고 검색 가능
  it('adds a new listing to the index', async () => {
    const doc = makeTestListing({ title: 'Sony A7M4 풀박스', price: 2200000 });

    await syncListing(client, doc, indexName);

    const index = client.index(indexName);
    const result = await index.search('Sony', { locales: ['kor'] });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.id).toBe(doc.id);
  });

  // Given 매물 가격 변경
  // When syncListing 호출 (같은 id, 다른 price)
  // Then 인덱스의 해당 문서 가격이 업데이트
  it('updates an existing listing in the index', async () => {
    const doc = makeTestListing({ id: 'update-test', title: 'Nikon Z6', price: 1500000 });
    await syncListing(client, doc, indexName);

    const updated = { ...doc, price: 1200000 };
    await syncListing(client, updated, indexName);

    const index = client.index(indexName);
    const stored = await index.getDocument('update-test');
    expect(stored.price).toBe(1200000);
  });
});

describe('removeListing', () => {
  // Given 매물 삭제
  // When removeListing(id) 호출
  // Then 인덱스에서 해당 문서 제거되고 검색 불가
  it('removes a listing from the index', async () => {
    const doc = makeTestListing({ id: 'remove-test', title: 'Fuji X-T5' });
    await syncListing(client, doc, indexName);

    await removeListing(client, 'remove-test', indexName);

    const index = client.index(indexName);
    const result = await index.search('Fuji', { locales: ['kor'] });
    expect(result.hits).toHaveLength(0);
  });
});
