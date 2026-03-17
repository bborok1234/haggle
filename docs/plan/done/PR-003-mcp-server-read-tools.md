# PR-003: MCP 서버 스켈레톤 + 읽기 도구

## 목표

MCP 서버 셋업 (stdio + Streamable HTTP), 읽기 전용 도구 3개 구현. 인증 불필요 도구만.

## 기술 결정

- SDK: `@modelcontextprotocol/sdk` v1.27.1
- 서버: `McpServer` + factory 패턴 (HTTP 세션별 인스턴스)
- 도구 등록: `server.registerTool(name, metadata, handler)` + Zod 입력 스키마
- 에러: `isError: true` in `CallToolResult` (throw 금지, Result 패턴과 일관)
- 전송: `--stdio` 플래그로 stdio, 없으면 Streamable HTTP (express)
- stdout은 MCP 와이어이므로 logger는 stderr 전용

## 도구 목록 (읽기 전용, 인증 불필요)

| 도구            | 설명      | 의존                            |
| --------------- | --------- | ------------------------------- |
| search_listings | 매물 검색 | src/search/query.ts             |
| get_listing     | 매물 상세 | src/db/queries/listings.ts      |
| market_price    | 시세 조회 | src/search/query.ts + 가격 집계 |

## TDD 플로우

### RED: 테스트 먼저

도구 핸들러 함수를 직접 테스트. MCP 프로토콜 레이어는 SDK가 담당.

```
# search_listings
Given Meilisearch에 매물 3개 인덱싱 + DB에 매물 3개
When search_listings 핸들러 호출 (query="카메라")
Then content에 매물 목록 JSON + isError=false

Given 빈 파라미터
When search_listings 핸들러 호출 ({})
Then 전체 active 매물 반환

# get_listing
Given DB에 매물 + 판매자 존재
When get_listing 핸들러 호출 (listing_id=X)
Then content에 매물 상세 + 판매자 정보 JSON

Given 존재하지 않는 ID
When get_listing 핸들러 호출 (listing_id="없는ID")
Then isError=true + "NOT_FOUND" 메시지

# market_price
Given 매물 5개 (다양한 가격) 인덱싱
When market_price 핸들러 호출 (query="카메라")
Then content에 price_stats (min, max, avg, median) + similar_items
```

### GREEN: 구현

1. `@modelcontextprotocol/sdk` + `express` 설치
2. src/tools/search-listings.ts — Zod 스키마 + 핸들러
3. src/tools/get-listing.ts — Zod 스키마 + 핸들러
4. src/tools/market-price.ts — Zod 스키마 + 핸들러
5. src/server/index.ts — McpServer + factory + 도구 등록 + 전송 분기

### 도구 파일 구조

```typescript
// src/tools/search-listings.ts
export const schema = z.object({ ... });
export const metadata = { title: '...', description: '...', annotations: { readOnlyHint: true } };
export async function handler(args, ctx): Promise<CallToolResult> { ... }
```

## 산출물

```
src/server/
  index.ts          MCP 서버 (stdio + HTTP)

src/tools/
  search-listings.ts
  get-listing.ts
  market-price.ts

tests/tools/
  search-listings.test.ts
  get-listing.test.ts
  market-price.test.ts
```

## 자동 검증

- pnpm build (tsc)
- pnpm test (vitest)
- pnpm lint

## 수동 검증

- [ ] `pnpm dev -- --stdio` 로 stdio 서버 기동 확인
- [ ] MCP Inspector 또는 Claude Desktop에서 도구 목록 확인
- [ ] search_listings 호출해서 응답 확인
