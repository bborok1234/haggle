# MCP Tools

에이전트가 시맨틱 레이어(의도 파싱, 결과 해석)를 담당한다.
도구는 빠른 구조화 검색과 데이터 CRUD를 제공한다.

## 도구 목록 (10개)

| 도구            | 설명      | 인증   | 멱등성 키 |
| --------------- | --------- | ------ | --------- |
| search_listings | 매물 검색 | 불필요 | -         |
| get_listing     | 매물 상세 | 불필요 | -         |
| register_item   | 매물 등록 | 필수   | 필수      |
| update_listing  | 매물 수정 | 필수   | 필수      |
| manage_listing  | 상태 변경 | 필수   | 필수      |
| make_offer      | 제안 넣기 | 필수   | 필수      |
| respond_offer   | 제안 응답 | 필수   | 필수      |
| my_dashboard    | 전체 현황 | 필수   | -         |
| set_watch       | 감시 등록 | 필수   | 필수      |
| market_price    | 시세 조회 | 불필요 | -         |

---

## search_listings

매물 검색. 에이전트가 구조화된 필터를 전달하고, Meilisearch가 한국어 형태소 분석으로 매칭.

**입력:**

- query: string (선택) --- 검색 키워드
- min_price: number (선택) --- 최소 가격
- max_price: number (선택) --- 최대 가격
- location: string (선택) --- 지역명
- sort_by: enum (선택) --- relevance, price_asc, price_desc, newest
- exclude_ids: string[] (선택) --- 이미 본 매물 제외 (멀티턴)
- limit: number (선택, 기본 10, 최대 50)
- cursor: string (선택) --- 페이지네이션

**처리:**

1. Meilisearch 쿼리 (키워드 + 필터)
2. 결과 반환

**출력:**

```
{
  listings: [{ id, title, price, is_negotiable, location, status, created_at }],
  applied_filters: { query, min_price, max_price, ... },
  total_count: number,
  next_cursor: string | null
}
```

applied_filters로 에이전트가 서버의 해석을 확인하고 다음 호출에서 보정한다.

---

## get_listing

매물 상세. 판매자 정보, 제안 현황 포함.

**입력:**

- listing_id: string (필수)

**처리:**

1. listing + seller 조인 조회
2. 해당 listing의 offer 통계 (개수, 최고 제안가)
3. view_count 증가

**출력:** listing 전체 필드 + seller 요약 + offer 통계

---

## register_item

매물 등록. DB 저장 → Meilisearch 인덱스 동기화.

**입력:**

- idempotency_key: string (필수)
- title: string (필수, max 200)
- description: string (필수, max 5000)
- price: number (필수) --- 0 = 무료 나눔
- is_negotiable: boolean (선택, 기본 false)
- photos: string[] (선택, max 10) --- presigned upload으로 받은 서버 URL
- location: { name: string, lat: number, lng: number } (선택)
- attributes: Record<string, unknown> (선택)

**처리:**

1. 입력 Zod 검증
2. idempotency_key 중복 확인
3. listings INSERT
4. Meilisearch 인덱스 동기화
5. listing_events INSERT (event_type: created)

**출력:** 생성된 listing 객체

---

## update_listing

매물 수정. 가격/설명 변경. 소유자만 가능.

**입력:**

- idempotency_key: string (필수)
- listing_id: string (필수)
- title: string (선택, max 200)
- description: string (선택, max 5000)
- price: number (선택)
- is_negotiable: boolean (선택)
- photos: string[] (선택)
- location: { name: string, lat: number, lng: number } (선택)
- attributes: Record<string, unknown> (선택)

**처리:**

1. 소유자 확인 (actor.user_id === listing.seller_id)
2. 변경 필드 UPDATE
3. Meilisearch 인덱스 동기화
4. listing_events INSERT (event_type: updated)

**출력:** 수정된 listing 객체

---

## manage_listing

매물 상태 변경. sold, reserved, deleted, relist.

**입력:**

- idempotency_key: string (필수)
- listing_id: string (필수)
- action: enum (필수) --- reserve, sell, delete, relist

**처리:**

1. 소유자 확인
2. 상태 전이 유효성 검증 (active→reserved, reserved→sold, active→deleted 등)
3. 트랜잭션으로 상태 UPDATE (conditional: WHERE status = 현재상태)
4. Meilisearch 인덱스 동기화 (deleted → 인덱스에서 제거)
5. listing_events INSERT

**출력:** 변경된 listing 객체

---

## make_offer

제안 넣기. 판매자에게 알림.

**입력:**

- idempotency_key: string (필수)
- listing_id: string (필수)
- offered_price: number (필수)
- message: string (선택, max 1000)
- buyer_contact: string (필수) --- 수락 시에만 판매자에게 공개

**처리:**

1. listing 존재 및 active 상태 확인
2. 자기 매물에 제안 불가 확인
3. offers INSERT
4. offer_events INSERT (event_type: created)
5. 판매자에게 카카오톡 알림 (연락처는 포함하지 않음)

**출력:** 생성된 offer 객체 (buyer_contact 제외)

---

## respond_offer

제안 수락/거절. 판매자만 가능.

**입력:**

- idempotency_key: string (필수)
- offer_id: string (필수)
- action: enum (필수) --- accept, decline

**처리:**

1. offer의 listing 소유자 확인
2. offer가 pending 상태인지 확인
3. 트랜잭션으로 offer 상태 UPDATE (conditional: WHERE status = pending)
4. accept 시: buyer_contact를 판매자에게 공개, listing 상태를 reserved로
5. offer_events INSERT
6. 바이어에게 카카오톡 알림

**출력:** 변경된 offer 객체 (accept 시 buyer_contact 포함)

---

## my_dashboard

내 현황. 매물 + 받은 제안 + 보낸 제안 + 워치.

**입력:**

- section: enum (선택) --- all, listings, offers_received, offers_sent, watches. 기본 all.
- limit: number (선택, 기본 10)
- cursor: string (선택)

**처리:**

1. actor.user_id로 데이터 조회
2. section에 따라 해당 데이터만 반환

**출력:** { my_listings, offers_received, offers_sent, my_watches } (section별 필터)

---

## set_watch

조건 감시 등록. 키워드 + 필터 저장. 새 매물 등록 시 Meilisearch로 매칭 → 알림.

**입력:**

- idempotency_key: string (필수)
- query: string (필수) --- 검색 키워드
- max_price: number (선택)
- max_distance_km: number (선택)
- location: { name: string, lat: number, lng: number } (선택)
- notify_method: string (선택, 기본 "kakao")

**처리:**

1. watches INSERT
2. 기존 active 매물 중 Meilisearch로 즉시 매칭 검색
3. 매칭 결과 반환

**출력:** 생성된 watch + 즉시 매칭된 listings

---

## market_price

시세 조회. 유사 매물의 가격 분포.

**입력:**

- query: string (필수) --- 상품 키워드
- condition: string (선택) --- 상태 필터

**처리:**

1. Meilisearch 검색 (active + sold 매물 대상)
2. 가격 분포 계산

**출력:**

```
{
  similar_items: [{ id, title, price, status, created_at }],
  price_stats: { min, max, avg, median, sample_count }
}
```
