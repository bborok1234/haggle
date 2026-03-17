# PR-001: DB 스키마 + Prisma 셋업

## 목표

Prisma 스키마 정의 (8개 테이블 전체), 마이그레이션, PrismaClient 싱글턴, 핵심 쿼리 함수.

## 접근법

옵션 A 선택: 전체 스키마 한번에 + 핵심 쿼리.
FK 관계를 한번에 검증하고, 테스트가 비즈니스 로직을 표현한다.

## TDD 플로우

### RED: 테스트 먼저

```
# listings
Given 유효한 매물 데이터
When createListing 호출
Then listings 테이블에 저장되고 listing 객체 반환

Given 동일 idempotency_key로 createListing 2회 호출
When 두 번째 호출
Then 새 매물 생성 없이 기존 매물 반환

Given 존재하는 매물 ID
When findListingById 호출
Then 매물 + 판매자 정보 반환

Given 존재하지 않는 매물 ID
When findListingById 호출
Then err('NOT_FOUND') 반환

Given active 상태 매물
When updateListingStatus('reserved') 호출
Then status가 reserved로 변경되고 listing_events에 기록

Given 이미 sold 상태 매물
When updateListingStatus('reserved') 호출
Then err('CONFLICT') 반환 (conditional update)

# users
Given 신규 provider + subject
When findOrCreateUser 호출
Then 새 user + user_identity 생성

Given 기존 provider + subject
When findOrCreateUser 호출
Then 기존 user 반환 (중복 생성 없음)

Given 유저가 ChatGPT + Claude 두 identity 보유
When findUserByIdentity('chatgpt', sub1) 호출
Then 같은 user 반환
```

### GREEN: 구현

1. Prisma 설치 + prisma/schema.prisma 작성 (8 테이블)
2. prisma migrate dev로 마이그레이션 생성
3. src/db/client.ts — PrismaClient 싱글턴
4. src/db/queries/listings.ts — createListing, findListingById, updateListingStatus
5. src/db/queries/users.ts — findOrCreateUser, findUserByIdentity

### 테스트 환경

- Vitest + 테스트용 PostgreSQL (Docker 또는 로컬)
- 각 테스트 전 DB 초기화 (트랜잭션 롤백 또는 truncate)
- BDD 스타일: describe/it 블록에 Given/When/Then 주석

## 산출물

```
prisma/
  schema.prisma          8개 테이블 전체
  migrations/            초기 마이그레이션

src/db/
  client.ts              PrismaClient 싱글턴
  queries/
    listings.ts          매물 CRUD + 상태 전이 + 멱등성
    users.ts             유저 생성/조회 + identity 연결

tests/db/
  listings.test.ts       매물 쿼리 BDD 테스트
  users.test.ts          유저 쿼리 BDD 테스트
  helpers.ts             테스트 DB 셋업/정리 유틸

.env.test                테스트 DB 접속 정보
```

## 자동 검증

- pnpm build (tsc)
- pnpm test (vitest)
- pnpm lint

## 수동 검증

- [ ] prisma studio로 테이블 구조 확인
- [ ] 마이그레이션 SQL 리뷰 (prisma/migrations/ 내용)
