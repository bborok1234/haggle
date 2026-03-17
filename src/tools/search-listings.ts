import { z } from 'zod';
import type { Meilisearch } from 'meilisearch';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getMeiliClient } from '../search/client.js';
import { searchListings } from '../search/query.js';

export const searchListingsSchema = z.object({
  query: z.string().optional().describe('검색 키워드'),
  min_price: z.number().optional().describe('최소 가격 (원)'),
  max_price: z.number().optional().describe('최대 가격 (원)'),
  location: z.string().optional().describe('지역명'),
  sort_by: z
    .enum(['relevance', 'price_asc', 'price_desc', 'newest'])
    .optional()
    .describe('정렬 기준'),
  offset: z.number().optional().describe('페이지네이션 오프셋'),
  limit: z.number().optional().describe('결과 수 (기본 10, 최대 50)'),
});

export type SearchListingsArgs = z.infer<typeof searchListingsSchema>;

export interface SearchListingsDeps {
  meili?: Meilisearch;
  indexName?: string;
}

export async function handleSearchListings(
  args: SearchListingsArgs,
  deps: SearchListingsDeps = {},
): Promise<CallToolResult> {
  const client = deps.meili ?? getMeiliClient();
  const result = await searchListings(client, args, deps.indexName);

  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
  };
}
