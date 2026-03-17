import type { Meilisearch } from 'meilisearch';
import type { ListingDocument } from './client.js';

const DEFAULT_INDEX = 'listings';

export interface SearchListingsInput {
  query?: string;
  min_price?: number;
  max_price?: number;
  location?: string;
  sort_by?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
  offset?: number;
  limit?: number;
}

export interface SearchListingsResult {
  hits: ListingDocument[];
  total_count: number;
  offset: number;
  limit: number;
}

const SORT_MAP: Record<string, string[]> = {
  price_asc: ['price:asc'],
  price_desc: ['price:desc'],
  newest: ['created_at:desc'],
};

export async function searchListings(
  client: Meilisearch,
  input: SearchListingsInput,
  indexName = DEFAULT_INDEX,
): Promise<SearchListingsResult> {
  const index = client.index<ListingDocument>(indexName);

  const filters: string[] = ['status = "active"'];
  if (input.min_price != null) filters.push(`price >= ${input.min_price}`);
  if (input.max_price != null) filters.push(`price <= ${input.max_price}`);
  if (input.location) filters.push(`location_name = "${input.location}"`);

  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  const sort = input.sort_by && input.sort_by !== 'relevance' ? SORT_MAP[input.sort_by] : undefined;

  const result = await index.search(input.query ?? '', {
    locales: ['kor'],
    filter: filters.join(' AND '),
    sort,
    hitsPerPage: limit,
    page: Math.floor(offset / limit) + 1,
  });

  return {
    hits: result.hits as ListingDocument[],
    total_count: result.totalHits ?? 0,
    offset,
    limit,
  };
}
