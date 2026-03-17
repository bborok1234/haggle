# PR-005: 쓰기 도구 (register_item, update_listing, manage_listing)

## 목표

인증 필요한 쓰기 도구 3개. 매물 등록/수정/상태변경 + Meilisearch 동기화 + 멱등성 + 소유자 확인.

## 기술 결정사항

### 1. 멱등성: 별도 `idempotency_records` 테이블 (범용)

offers, watches에도 동일 패턴 재사용. 각 테이블에 컬럼 추가 방식은 중복 패턴이라 탈락.

```prisma
model IdempotencyRecord {
  key        String   @id
  resource   String
  resourceId String   @map("resource_id")
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz
  @@map("idempotency_records")
}
```

기존 `createListing`의 title+desc+price 기반 중복체크 → idempotency_key 기반으로 전환.

### 2. Meilisearch 동기화: 핸들러에서 명시적 호출

DB 쿼리 함수 안에서 sync하면 db→search 의존성 방향 위반. 핸들러가 DB 저장 후 `syncListing` 호출을 조율.

### 3. 소유자 확인: `assertOwnership` 헬퍼 함수

핸들러마다 같은 조회+비교 코드 반복 방지. NOT_FOUND vs FORBIDDEN 구분 가능.
DB WHERE 조건에 sellerId 포함하는 방식은 에러 원인 구분이 안 돼서 탈락.

### 4. 상태 전이: 허용 맵 하드코딩

```typescript
const TRANSITIONS: Record<string, string[]> = {
  active: ['reserved', 'sold', 'deleted'],
  reserved: ['active', 'sold', 'deleted'],
};
```

DB CHECK 제약은 Prisma 마이그레이션 관리 어렵고 에러 메시지 불친절해서 탈락.

## 도구별 로직

### register_item

1. requireAuth → resolveActor
2. idempotency_key 체크 → 이미 있으면 기존 listing 반환
3. DB: listing INSERT + listing_event INSERT (트랜잭션)
4. Meilisearch: syncListing (핸들러에서 호출)
5. IdempotencyRecord INSERT

### update_listing

1. requireAuth → resolveActor
2. assertOwnership(listing, actor) → FORBIDDEN or ok
3. DB: listing UPDATE + listing_event INSERT
4. Meilisearch: syncListing (핸들러에서 호출)

### manage_listing

1. requireAuth → resolveActor
2. assertOwnership(listing, actor) → FORBIDDEN or ok
3. TRANSITIONS 맵으로 전이 유효성 검증 → INVALID_TRANSITION or ok
4. DB: conditional update (WHERE status = currentStatus) + event (트랜잭션)
5. Meilisearch: syncListing (deleted면 removeListing)

## 상태 전이 규칙

```
active → reserved, sold, deleted
reserved → active (relist), sold, deleted
sold → (없음)
deleted → (없음)
```

## TDD 플로우

### RED: 테스트 먼저

```
# register_item
Given 인증된 유저 + 유효한 입력
When register_item 호출
Then listing 생성 + isError=false

Given 동일 idempotency_key로 2회 호출
When 두 번째 호출
Then 새 listing 생성 없이 기존 반환

Given 인증 없이 호출
When register_item 호출
Then isError=true (AUTH_REQUIRED)

# update_listing
Given 소유자가 가격 변경
When update_listing 호출
Then 가격 업데이트됨

Given 소유자가 아닌 유저가 수정 시도
When update_listing 호출
Then isError=true (FORBIDDEN)

# manage_listing
Given active 매물 → reserve
When manage_listing(action="reserve") 호출
Then status=reserved + listing_event 기록

Given sold 매물 → reserve (invalid)
When manage_listing(action="reserve") 호출
Then isError=true (INVALID_TRANSITION)
```

## 산출물

```
prisma/schema.prisma          IdempotencyRecord 추가
prisma/migrations/            마이그레이션

src/db/queries/listings.ts    updateListing, assertOwnership 추가 (수정)
src/db/queries/idempotency.ts 멱등성 체크/저장 헬퍼
src/lib/transitions.ts        상태 전이 맵 + 검증 함수

src/tools/register-item.ts
src/tools/update-listing.ts
src/tools/manage-listing.ts
src/server/index.ts           도구 등록 추가 (수정)

tests/tools/register-item.test.ts
tests/tools/update-listing.test.ts
tests/tools/manage-listing.test.ts
```

## 자동 검증

- pnpm build (tsc)
- pnpm test (vitest)
- pnpm lint

## 수동 검증

- [ ] pnpm test 전체 통과
- [ ] prisma studio에서 IdempotencyRecord 테이블 확인
