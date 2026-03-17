# PR-007: my_dashboard + set_watch

## 목표

유저 현황 조회 + 감시 등록. 인증 필수.

## 기술 결정사항

1. **대시보드 쿼리**: Promise.all 병렬 4쿼리. section 파라미터로 필요한 것만 실행.
2. **set_watch 즉시 매칭**: Meilisearch searchListings 재사용.
3. **section 필터**: 서버에서 필요한 쿼리만 실행.

## TDD

```
# my_dashboard
Given 유저가 매물 2개 + 받은 제안 1개 + 보낸 제안 1개
When my_dashboard() 호출
Then 4개 섹션 반환

Given section="listings"
When my_dashboard(section="listings")
Then 내 매물만 반환

# set_watch
Given 인증된 유저 + 검색 조건 + 매칭 매물 존재
When set_watch 호출
Then watch 저장 + 즉시 매칭 결과 반환

Given 동일 idempotency_key
When 2회 호출
Then 기존 watch 반환
```

## 산출물

```
src/db/queries/dashboard.ts
src/db/queries/watches.ts
src/tools/my-dashboard.ts
src/tools/set-watch.ts
tests/tools/my-dashboard.test.ts
tests/tools/set-watch.test.ts
```
