import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export function parseToolResult(result: CallToolResult): { data: unknown; isError: boolean } {
  const text = result.content.find((c) => c.type === 'text');
  const raw = text && 'text' in text ? text.text : '';
  try {
    return { data: JSON.parse(raw), isError: result.isError ?? false };
  } catch {
    return { data: raw, isError: result.isError ?? false };
  }
}
