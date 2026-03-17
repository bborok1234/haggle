# PR-002: Meilisearch 검색 레이어

## 목표

Meilisearch 클라이언트 셋업, 인덱스 설정(한국어 형태소 분석, 필터/정렬), 매물 동기화 함수, 검색 쿼리 함수.

## 접근법

옵션 A 선택: 전체 검색 레이어 (client + sync + query).
PR-003(MCP 도구)이 바로 사용할 수 있는 완전한 검색 인터페이스.

## 기술 결정

- SDK: `meilisearch` npm (v0.56.0)
- 한국어: `localizedAttributes` 설정 + 쿼리 `locales: ['kor']`
- 페이지네이션: offset/limit (Meilisearch에 cursor 없음)
- 동기화: `addDocuments` (full document replace) + `.waitTask()`
- 필터: `price >= X AND price <= Y AND status = "active"` 문자열
- 정렬: `price:asc`, `created_at:desc`

## 인덱스 설정

```
인덱스명: listings
searchableAttributes: [title, description]
filterableAttributes: [price, is_negotiable, status, location.name]
sortableAttributes: [price, created_at]
localizedAttributes: [{ attributePatterns: [title, description], locales: [kor] }]
```

## TDD 플로우

### RED: 테스트 먼저

```
# sync
Given 새 매물 데이터
When syncListing 호출
Then Meilisearch 인덱스에 문서 추가되고 검색 가능

Given 매물 가격 변경
When syncListing 호출 (같은 id, 다른 price)
Then 인덱스의 해당 문서 가격이 업데이트

Given 매물 삭제
When removeListing(id) 호출
Then 인덱스에서 해당 문서 제거되고 검색 불가

# query
Given "소니 카메라" 매물 2개 + "캐논 렌즈" 매물 1개 인덱싱
When searchListings(query="카메라") 호출
Then 소니 카메라 매물 반환

Given 매물 3개 (10만, 30만, 50만)
When searchListings(max_price=350000) 호출
Then 10만 + 30만 매물만 반환

Given 매물 3개
When searchListings(sort_by="price_asc") 호출
Then 가격 오름차순 정렬

Given 매물 5개
When searchListings(limit=2) 호출
Then 2개 반환 + total_count >= 5

Given query 없이 필터만
When searchListings(max_price=500000) 호출
Then 50만 이하 전체 매물 반환
```

### GREEN: 구현

1. meilisearch SDK 설치
2. src/search/client.ts — 연결 + 인덱스 초기화 (설정 적용)
3. src/search/sync.ts — syncListing, removeListing
4. src/search/query.ts — searchListings
5. 테스트 통과시키기

### 테스트 환경

- docker-compose의 Meilisearch (port 7700, key: haggle-dev-key)
- 테스트 전용 인덱스 (listings_test) 사용
- 각 테스트 전 인덱스 초기화

## 산출물

```
src/search/
  client.ts       Meilisearch 연결 + 인덱스 초기화
  sync.ts         syncListing, removeListing
  query.ts        searchListings

tests/search/
  sync.test.ts    동기화 BDD 테스트
  query.test.ts   검색 쿼리 BDD 테스트
  helpers.ts      테스트 인덱스 셋업/정리
```

## 자동 검증

- pnpm build (tsc)
- pnpm test (vitest)
- pnpm lint

## 수동 검증

- [ ] Meilisearch 대시보드 (http://localhost:7700) 에서 listings 인덱스 확인
- [ ] 한국어 검색 결과 확인 ("카메라", "렌즈" 등)
