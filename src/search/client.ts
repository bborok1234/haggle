import { Meilisearch } from 'meilisearch';

export interface ListingDocument {
  id: string;
  title: string;
  description: string;
  price: number;
  is_negotiable: boolean;
  status: string;
  location_name: string | null;
  created_at: number;
}

let _client: Meilisearch | null = null;

export function getMeiliClient(host?: string, apiKey?: string): Meilisearch {
  if (_client) return _client;

  const h = host ?? process.env['MEILISEARCH_HOST'];
  const k = apiKey ?? process.env['MEILISEARCH_API_KEY'];
  if (!h) throw new Error('MEILISEARCH_HOST is required');
  if (!k) throw new Error('MEILISEARCH_API_KEY is required');

  _client = new Meilisearch({ host: h, apiKey: k });
  return _client;
}

export function resetMeiliClient(): void {
  _client = null;
}

export async function initListingsIndex(
  client: Meilisearch,
  indexName = 'listings',
): Promise<void> {
  const index = client.index(indexName);

  await index
    .updateSettings({
      searchableAttributes: ['title', 'description'],
      filterableAttributes: ['price', 'is_negotiable', 'status', 'location_name'],
      sortableAttributes: ['price', 'created_at'],
    })
    .waitTask();

  await index
    .updateLocalizedAttributes([{ attributePatterns: ['title', 'description'], locales: ['kor'] }])
    .waitTask();
}
