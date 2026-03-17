import { z } from 'zod';
import type { Meilisearch } from 'meilisearch';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getMeiliClient } from '../search/client.js';
import { searchListings } from '../search/query.js';

export const marketPriceSchema = z.object({
  query: z.string().describe('상품 키워드'),
});

export type MarketPriceArgs = z.infer<typeof marketPriceSchema>;

export interface MarketPriceDeps {
  meili?: Meilisearch;
  indexName?: string;
}

function computePriceStats(prices: number[]) {
  if (prices.length === 0) return { min: 0, max: 0, avg: 0, median: 0, sample_count: 0 };

  const sorted = [...prices].sort((a, b) => a - b);
  const min = sorted.at(0) ?? 0;
  const max = sorted.at(-1) ?? 0;
  const avg = Math.round(sorted.reduce((sum, p) => sum + p, 0) / sorted.length);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
      : (sorted[mid] ?? 0);

  return { min, max, avg, median, sample_count: sorted.length };
}

export async function handleMarketPrice(
  args: MarketPriceArgs,
  deps: MarketPriceDeps = {},
): Promise<CallToolResult> {
  const client = deps.meili ?? getMeiliClient();
  const result = await searchListings(client, { query: args.query, limit: 50 }, deps.indexName);

  const prices = result.hits.map((h) => h.price);
  const price_stats = computePriceStats(prices);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ similar_items: result.hits, price_stats }),
      },
    ],
  };
}
