import type { Meilisearch } from 'meilisearch';
import type { ListingDocument } from './client.js';

const DEFAULT_INDEX = 'listings';

export async function syncListing(
  client: Meilisearch,
  doc: ListingDocument,
  indexName = DEFAULT_INDEX,
): Promise<void> {
  const index = client.index<ListingDocument>(indexName);
  await index.addDocuments([doc]).waitTask();
}

export async function removeListing(
  client: Meilisearch,
  id: string,
  indexName = DEFAULT_INDEX,
): Promise<void> {
  const index = client.index<ListingDocument>(indexName);
  await index.deleteDocument(id).waitTask();
}
