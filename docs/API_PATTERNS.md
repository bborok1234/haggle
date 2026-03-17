# API Patterns

## 함수 스타일

클래스를 쓰지 않는다. 순수 함수 + 타입으로 작성.

```typescript
// 올바름
export function createListing(input: CreateListingInput): Promise<Result<Listing>> { ... }

// 금지
export class ListingService {
  create(input: CreateListingInput) { ... }
}
```

## Result 타입

에러는 throw하지 않는다. 모든 실패 가능한 함수는 Result<T, E>를 반환한다.

```typescript
import { ok, err, type Result } from '../lib/result.js';

export function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return err('Division by zero');
  return ok(a / b);
}
```

MCP 도구에서는 Result를 MCP 에러 코드로 변환한다.

## 입력 검증

Zod로 런타임 검증. any 타입 금지. 입력 길이 상한 필수.

```typescript
import { z } from 'zod';

const CreateListingInput = z.object({
  idempotency_key: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  price: z.number().int().nonnegative(),
  photos: z.array(z.string().url()).max(10).optional(),
});

type CreateListingInput = z.infer<typeof CreateListingInput>;
```

## 로깅

console.log 금지. 구조화된 로거 사용.

```typescript
import { logger } from '../lib/logger.js';

logger.info('Listing created', { listingId: listing.id, sellerId: input.sellerId });
logger.error('Search failed', { error: result.error });
```

## 환경 변수

process.env 직접 접근 금지. config 모듈 경유.

```typescript
import { getConfig } from '../lib/config.js';

const config = getConfig();
const meiliHost = config.MEILISEARCH_HOST;
```

## DB 쿼리

tools에서 직접 Prisma Client 호출 금지. src/db/queries/ 함수만 호출.

```typescript
// src/tools/search-listings.ts — 올바름
import { findListings } from '../db/queries/listings.js';

// src/tools/search-listings.ts — 금지
import { prisma } from '../db/client.js';
const results = await prisma.listing.findMany({ where: { ... } });
```

## 검색 쿼리

tools에서 직접 Meilisearch 클라이언트 호출 금지. src/search/ 함수만 호출.

```typescript
// src/tools/search-listings.ts — 올바름
import { searchListings } from '../search/query.js';

// src/tools/search-listings.ts — 금지
import { MeiliSearch } from 'meilisearch';
const client = new MeiliSearch({ host: '...' });
```

## Meilisearch 동기화

매물 CUD(Create, Update, Delete) 시 Meilisearch 인덱스 동기화 필수.

```typescript
import { syncListing, removeListing } from '../search/sync.js';

// 생성/수정 후
await syncListing(listing);

// 삭제 후
await removeListing(listing.id);
```

동기화 실패 시 DB 트랜잭션은 롤백하지 않는다. 로그 남기고 재시도 큐에 넣는다.

## 인증 / Actor 컨텍스트

인증 필요 도구는 입력으로 user_id를 받지 않는다. 서버가 JWT에서 추출한 actor 컨텍스트를 사용한다.

```typescript
// 올바름 — actor에서 추출
export function myDashboard(actor: Actor): Promise<Result<Dashboard>> {
  const listings = await findListingsBySeller(actor.userId);
  ...
}

// 금지 — 입력으로 user_id를 받음
export function myDashboard(input: { user_id: string }): Promise<Result<Dashboard>> { ... }
```

## 멱등성

mutating 도구는 idempotency_key를 받는다. 동일 키로 재호출 시 기존 결과를 반환한다.

```typescript
const existing = await findByIdempotencyKey(input.idempotency_key);
if (existing) return ok(existing);
```

## 상태 전이

상태 변경은 conditional update로 레이스 컨디션을 방지한다.

```typescript
// WHERE status = 'active'를 조건으로 UPDATE
const updated = await prisma.listing.updateMany({
  where: { id, status: 'active' },
  data: { status: 'reserved' },
});

if (updated.count === 0) return err('CONFLICT: status already changed');
```

## 파일 = 도구

src/tools/ 안에서 파일 하나 = MCP 도구 하나. 도구 간 import 금지.

## 임포트 순서

1. Node.js 내장 모듈
2. 외부 패키지
3. 프로젝트 내부 모듈 (상대 경로)

## 에러 코드

MCP 표준 에러 코드를 사용한다. 커스텀 에러 코드 금지.
