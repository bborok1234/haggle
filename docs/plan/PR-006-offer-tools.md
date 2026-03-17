# PR-006: 제안 도구 (make_offer, respond_offer)

## 목표

매물 제안 넣기 + 제안 수락/거절. 인증 필수. 제안-매물 간 상태 연동.

## 기술 결정사항

1. **트랜잭션 범위**: offer accept + listing reserved를 하나의 트랜잭션으로. 상태 불일치 불가.
2. **buyer_contact 반환**: 핸들러에서 직렬화 시 조건부 포함. DB 쿼리는 항상 전체 조회.
3. **알림**: logger.info로 스텁. PR-008에서 카카오톡 전송으로 교체.

## TDD 플로우

### RED

```
# make_offer
Given 인증된 바이어 + active 매물
When make_offer 호출
Then offer 생성 + buyer_contact 응답에 미포함

Given 자기 매물에 제안
When make_offer 호출
Then isError=true (SELF_OFFER)

Given 동일 idempotency_key로 2회 호출
When 두 번째 호출
Then 기존 offer 반환

# respond_offer
Given 판매자가 pending offer에 accept
When respond_offer(action="accept") 호출
Then offer=accepted + listing=reserved + buyer_contact 포함

Given 판매자가 pending offer에 decline
When respond_offer(action="decline") 호출
Then offer=declined + listing 상태 변경 없음

Given 판매자가 아닌 유저가 응답
When respond_offer 호출
Then isError=true (FORBIDDEN)
```

## 산출물

```
src/db/queries/offers.ts
src/tools/make-offer.ts
src/tools/respond-offer.ts
src/server/index.ts          도구 등록 추가

tests/tools/make-offer.test.ts
tests/tools/respond-offer.test.ts
```
