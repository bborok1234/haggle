# Data Schema

스키마의 source of truth는 prisma/schema.prisma. 이 문서는 설계 참조용.

## 테이블 개요

```
users ──< user_identities
  │
  ├──< listings ──< offers
  │       │          └──< offer_events
  │       ├──< listing_events
  │       └──< interests
  ├──< offers (buyer)
  └──< watches
```

## users

| 컬럼           | 타입        | 설명               |
| -------------- | ----------- | ------------------ |
| id             | uuid        | PK                 |
| display_name   | text        | 표시 이름          |
| contact_method | text        | 카톡 오픈채팅 등   |
| location       | jsonb       | { lat, lng, name } |
| created_at     | timestamptz | 생성일             |
| updated_at     | timestamptz | 수정일             |

## user_identities (인증)

OAuth 2.1 provider별 사용자 연결. 한 유저가 ChatGPT/Claude 등 복수 클라이언트로 접근 가능.

| 컬럼       | 타입        | 설명                          |
| ---------- | ----------- | ----------------------------- |
| id         | uuid        | PK                            |
| user_id    | uuid        | FK → users                    |
| provider   | text        | "chatgpt", "claude", "gemini" |
| subject    | text        | JWT sub claim (IdP 사용자 ID) |
| created_at | timestamptz | 생성일                        |

UNIQUE(provider, subject).

## listings (매물)

| 컬럼           | 타입        | 설명                            |
| -------------- | ----------- | ------------------------------- |
| id             | uuid        | PK                              |
| seller_id      | uuid        | FK → users                      |
| title          | text        | 매물 제목 (max 200)             |
| description    | text        | 상세 설명 (max 5000)            |
| price          | integer     | 가격 (원). 0 = 무료 나눔        |
| is_negotiable  | boolean     | 가격 협상 가능 여부             |
| status         | enum        | active, reserved, sold, deleted |
| location       | jsonb       | { lat, lng, name }              |
| photos         | text[]      | 서버 소유 사진 URL 배열         |
| attributes     | jsonb       | 속성 (자유 형식)                |
| view_count     | integer     | 조회수                          |
| interest_count | integer     | 관심 수                         |
| created_at     | timestamptz | 생성일                          |
| updated_at     | timestamptz | 수정일                          |

Meilisearch에 동기화되는 필드: id, title, description, price, is_negotiable, status, location, attributes, created_at.

## offers (제안)

| 컬럼          | 타입        | 설명                                   |
| ------------- | ----------- | -------------------------------------- |
| id            | uuid        | PK                                     |
| listing_id    | uuid        | FK → listings                          |
| buyer_id      | uuid        | FK → users                             |
| offered_price | integer     | 제안 가격 (원)                         |
| message       | text        | 메모 (max 1000)                        |
| buyer_contact | text        | 바이어 연락처 (offer accepted 시 공개) |
| status        | enum        | pending, accepted, declined, withdrawn |
| created_at    | timestamptz | 생성일                                 |
| updated_at    | timestamptz | 수정일                                 |

## watches (감시)

키워드 + 필터 기반. 새 매물 등록 시 Meilisearch로 매칭.

| 컬럼            | 타입        | 설명           |
| --------------- | ----------- | -------------- |
| id              | uuid        | PK             |
| user_id         | uuid        | FK → users     |
| query_text      | text        | 검색 키워드    |
| max_price       | integer     | 최대 가격      |
| max_distance_km | integer     | 최대 거리 (km) |
| location        | jsonb       | 기준 위치      |
| notify_method   | text        | 알림 방법      |
| is_active       | boolean     | 활성 여부      |
| created_at      | timestamptz | 생성일         |
| updated_at      | timestamptz | 수정일         |

## interests (관심)

| 컬럼       | 타입        | 설명          |
| ---------- | ----------- | ------------- |
| id         | uuid        | PK            |
| user_id    | uuid        | FK → users    |
| listing_id | uuid        | FK → listings |
| created_at | timestamptz | 생성일        |

## listing_events (매물 이력)

매물 상태 변경 추적. Append-only.

| 컬럼       | 타입        | 설명                                      |
| ---------- | ----------- | ----------------------------------------- |
| id         | uuid        | PK                                        |
| listing_id | uuid        | FK → listings                             |
| event_type | text        | created, updated, reserved, sold, deleted |
| old_status | text        | 변경 전 상태 (nullable)                   |
| new_status | text        | 변경 후 상태                              |
| actor_id   | uuid        | FK → users                                |
| created_at | timestamptz | 발생 시각                                 |

## offer_events (제안 이력)

제안 상태 변경 추적. Append-only.

| 컬럼       | 타입        | 설명                                   |
| ---------- | ----------- | -------------------------------------- |
| id         | uuid        | PK                                     |
| offer_id   | uuid        | FK → offers                            |
| event_type | text        | created, accepted, declined, withdrawn |
| old_status | text        | 변경 전 상태 (nullable)                |
| new_status | text        | 변경 후 상태                           |
| actor_id   | uuid        | FK → users                             |
| created_at | timestamptz | 발생 시각                              |
