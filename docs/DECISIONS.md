# Design Decisions

## ADR-001: 프론트엔드를 만들지 않는다

에이전트 네이티브 제품이므로 UI는 AI 클라이언트(ChatGPT, Claude, Gemini)가 담당한다. ChatGPT 앱(GPT Store)으로 보완한다.

## ADR-002: 카테고리를 두지 않는다

에이전트가 시맨틱 레이어를 담당한다. 에이전트가 사용자 의도를 파싱해서 구조화된 검색 파라미터로 변환하므로, 고정 카테고리 분류가 불필요하다.

## ADR-003: 실시간 메시징을 구현하지 않는다

비동기 제안 구조를 사용한다. 실제 연락은 카카오톡에서. MCP의 요청-응답 특성과 맞다.

## ADR-004: 결제를 처리하지 않는다

금융 규제 복잡도가 사이드 프로젝트 범위를 벗어난다. 직거래/계좌이체로 충분하다.

## ADR-005: 임베딩 대신 Meilisearch

초기 설계는 OpenAI text-embedding-3-small + pgvector였으나 전환했다.

이유:

- 에이전트 클라이언트(ChatGPT/Claude)가 이미 시맨틱 레이어다. 백엔드에 지능을 중복할 이유가 없다.
- 프로덕션 MCP 마켓플레이스 서버(commercetools, Shopify MCP, Keepa MCP) 중 임베딩을 쓰는 곳은 0개.
- 외부 API(OpenAI) 의존 제거. 코어 기능이 외부 장애와 무관해진다.
- pgvector 확장 불필요. 배포 단순화.
- Meilisearch: 한국어 형태소 분석(Lindera/KoDic), 오타 교정, 패싯 검색 내장, Railway 원클릭 배포.

임베딩은 매물 500건 이상에서 키워드 검색의 한계가 측정될 때 재검토한다.

## ADR-006: 거래 연결은 카카오톡 오픈채팅

판매자가 제안을 수락하면 바이어 연락처가 공개되고, 판매자가 주도적으로 연락한다. 수락 전에는 연락처가 어느 쪽에도 노출되지 않는다.

## ADR-007: 알림은 카카오톡 채널

한국 사용자의 메시지 확인률이 가장 높은 채널이다. 초기에는 카카오톡 채널 일반 메시지(무료, 친구 추가 사용자 대상). 사업자 등록 후 알림톡 전환 가능하다.

## ADR-008: 인증은 OAuth 2.1 + 외부 IdP

MCP 2025-06-18 스펙에 따라 MCP 서버는 resource server로만 동작한다. 인증은 외부 IdP(Auth0 또는 Supabase Auth)에 위임. ChatGPT/Claude/Gemini 전부 동일한 OAuth 2.1 + PKCE 플로우를 사용하므로 인증 경로가 하나다. JWT sub claim = user identity.

읽기 도구(search_listings, get_listing, market_price)는 익명 허용. 쓰기 도구는 인증 필수.

## ADR-009: mutating 도구에 멱등성 키 필수

AI 에이전트 클라이언트는 tool call을 리트라이한다. register_item 2회 호출 시 매물이 2개 생성되면 안 된다. 모든 mutating 도구에 idempotency_key 파라미터를 필수로 둔다.

## ADR-010: 미디어는 presigned upload

register_item이 외부 photo URL을 직접 수납하지 않는다. 서버가 presigned upload URL을 발급하고, 에이전트가 업로드한 서버 소유 URL만 수납한다. 링크 깨짐, 프라이버시 유출, URL 인젝션 방지.

## ADR-011: 연락처는 제안 수락 시에만 공개

buyer_contact는 offer accepted 시에만 판매자에게 노출된다. get_listing이나 기본 응답에 포함하지 않는다.

## ADR-012: ORM은 Prisma

초기 설계는 Drizzle ORM이었으나 Prisma로 전환했다.

이유:

- Drizzle의 jsonb 이중 인코딩 버그(#5139)가 우리 스키마의 location/attributes jsonb 컬럼에 직격.
- Drizzle의 enum 마이그레이션 버그(#5340, #4982)가 listing_status/offer_status에 직격.
- Prisma는 jsonb, enum 모두 정상 동작. 20년 이상 검증된 생태계.
- 마이그레이션 도구 최고 품질 (데이터 유실 감지, 인터랙티브 프롬프트).
- 코드젠 필요(`prisma generate`)는 trade-off지만, 타입 품질이 최상이고 8개 테이블 규모에서 부담 아님.
- Prisma 7에서 Rust 엔진 → TypeScript 재작성. 번들 1.6MB, 콜드 스타트 80-150ms로 개선.

Kysely(순수 쿼리 빌더)도 후보였으나, 마이그레이션 도구 부재와 작은 커뮤니티를 고려해 Prisma 선택.

## ADR-013: Watch 매칭은 이벤트 드리븐 + 정기 보정

새 매물 등록/수정 시 활성 watch와 Meilisearch로 즉시 매칭. 누락 방지를 위해 정기 reconciliation 잡도 운영한다.

## ADR-014: MCP 세션 상태에 의존하지 않는다

MCP 스펙(2025-06-18)은 `Mcp-Session-Id`로 세션을 식별하지만, 실제로는 취약하다.

- 클라이언트 호스트(Claude Desktop 등)가 대화 중간에 `initialize`를 재호출해서 세션 ID가 바뀌는 버그 확인됨 (GitHub #458, 2026.02).
- SEP-1442(2025.09, 여전히 오픈): MCP를 stateless-by-default로 전환하자는 제안. 로드밸런싱과 수평 확장 문제.
- 스펙상 서버는 대화 히스토리를 볼 수 없다 (보안상 by design).

대응:

- 서버 내부 상태는 `Mcp-Session-Id`가 아닌 OAuth JWT의 user ID로 키잉한다.
- 모든 도구가 필요한 ID(listing_id, offer_id)를 파라미터로 명시적으로 받는다. 세션 기반 암묵적 컨텍스트 없음.
- mutating 도구는 idempotency_key로 재호출에 안전하다.
- DB가 유일한 상태 저장소. 인메모리 세션 상태 없음.

## ADR-015: ChatGPT MCP 네이티브 지원 확인, REST API는 필요 시 추가

초기 설계는 ChatGPT가 REST API(OpenAI Actions)만 지원한다고 가정했으나, 2025 말~2026 초 ChatGPT가 MCP를 네이티브 지원하기 시작했다 (ChatGPT Apps, OpenAI Agents SDK). ChatGPT, Claude, Gemini 전부 MCP를 지원하므로 MCP 서버 단일 구현으로 시작한다. REST API는 필요가 확인될 때 추가한다.
