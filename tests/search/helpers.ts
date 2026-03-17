import { Meilisearch } from 'meilisearch';
import { initListingsIndex, type ListingDocument } from '../../src/search/client.js';

const TEST_INDEX = 'listings_test';

let testClient: Meilisearch | null = null;

export function getTestMeili(): Meilisearch {
  if (testClient) return testClient;

  const host = process.env['MEILISEARCH_HOST'] ?? 'http://localhost:7700';
  const apiKey = process.env['MEILISEARCH_API_KEY'] ?? 'haggle-dev-key';

  testClient = new Meilisearch({ host, apiKey });
  return testClient;
}

export function getTestIndexName(): string {
  return TEST_INDEX;
}

export async function setupTestIndex(): Promise<void> {
  const client = getTestMeili();
  const index = client.index(TEST_INDEX);

  try {
    await index.deleteAllDocuments().waitTask();
  } catch {
    await client.createIndex(TEST_INDEX, { primaryKey: 'id' }).waitTask();
  }

  await initListingsIndex(client, TEST_INDEX);
}

export async function cleanupTestIndex(): Promise<void> {
  const client = getTestMeili();
  try {
    await client.deleteIndex(TEST_INDEX).waitTask();
  } catch {
    /* index may not exist */
  }
}

export function makeTestListing(overrides: Partial<ListingDocument> = {}): ListingDocument {
  return {
    id: overrides.id ?? `listing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: overrides.title ?? '테스트 매물',
    description: overrides.description ?? '테스트 설명',
    price: overrides.price ?? 100000,
    is_negotiable: overrides.is_negotiable ?? false,
    status: overrides.status ?? 'active',
    location_name: overrides.location_name ?? null,
    created_at: overrides.created_at ?? Date.now(),
  };
}
