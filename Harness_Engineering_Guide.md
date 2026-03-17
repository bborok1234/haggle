# Haggle: 하네스 엔지니어링 가이드

AI 네이티브 중고 마켓플레이스. 프론트엔드 없음. MCP 서버 + ChatGPT 앱이 전부.

---

## Part 1: 하네스 엔지니어링이란

### OpenAI가 배운 것 (2026.02.11 블로그)

코덱스 팀이 5개월간 100만 줄을 사람이 코드 한 줄 안 쓰고 만들었다. 3명 시작, 7명까지 확장, 엔지니어 1인당 하루 3.5개 PR 머지. 코드를 쓰는 건 에이전트고, 사람의 일은 에이전트가 올바른 코드를 쓸 수 있는 환경을 만드는 것이었다.

핵심 교훈 4개:

"지도를 줘라, 1,000페이지 매뉴얼을 주지 마라." 처음에 거대한 AGENTS.md 하나에 전부 넣어봤는데 실패했다. 컨텍스트가 한정된 자원이라 거대한 지시 파일이 실제 태스크를 밀어냈다. AGENTS.md는 100줄짜리 목차로 두고, 상세 내용은 docs/에 분산시켰다.

"에이전트가 볼 수 없으면 존재하지 않는 것이다." 슬랙 대화, 구글 독스, 머릿속 지식은 에이전트에게 없는 것이다. 모든 의사결정을 레포 안 마크다운으로 넣어야 한다.

"문서가 아니라 운영 정책을 써라." ETH 취리히 연구(2026.03)에 따르면 LLM이 생성한 컨텍스트 파일은 오히려 성능을 떨어뜨렸다. 효과 있는 건 에이전트가 추론할 수 없는 구체적 정보뿐이다. "클린 아키텍처를 따릅니다"는 쓸모없고, "pnpm test로 테스트 실행"은 유용하다.

"설명하지 말고 명령하라." 에이전트가 무시하는 건 설명 형태의 지시다. 따르는 건 정확한 커맨드 + 완료 조건이다.

### 컨텍스트 5계층 구조

```
1. CLAUDE.md / AGENTS.md   목차 (~100줄). 에이전트 진입점.
2. ARCHITECTURE.md          코드베이스 지도. 디렉토리별 역할.
3. docs/                    상세 지식. 스키마, 도구 스펙, 제품 원칙.
4. 디렉토리별 CLAUDE.md     경로 스코프 규칙. 그 폴더 안에서만 적용.
5. 린터/테스트              기계적 강제. 규칙 어기면 CI 실패.
```

---

## Part 2: Haggle이란

### 한 줄

AI 네이티브 중고 마켓플레이스. ChatGPT/Claude에서 중고 물건을 사고판다.

### 왜 만드는가

기존 중고 플랫폼(당근, 번개, 중고나라)은 사람이 앱에서 검색하고, 글을 쓰고, 채팅하는 UI 기반 경험이다. Haggle은 AI가 사용하는 것을 전제로 처음부터 설계한다. 사람은 "이거 팔래" 한마디면 되고, "인물용 렌즈 50만 이하" 한마디면 된다. 앱도, 웹사이트도 없다.

### 배포 채널

```
ChatGPT (GPT Store 앱)  ← 1순위. 9억 사용자 접근.
Claude (MCP 서버)        ← 2순위. MCP 레지스트리 등록.
Gemini (MCP)             ← 3순위. MCP 지원 시작.

전부 같은 백엔드를 바라본다.
```

### 초기 진입

특정 취미 장터 커뮤니티(카메라, 기타, 자전거 등)를 먼저 잡는다. 카페 장터의 매물을 수동으로 30~50개 DB에 넣고, "회원분들을 위해 만들었어요" 식으로 들어간다. 단가 높고, 스펙 구조화 가능하고, 반복 거래 많은 카테고리가 좋다.

### 5가지 제품 원칙

1. 사람은 의도만 말한다. 나머지는 AI가 한다.
2. 카테고리가 없다. 임베딩 의미 검색이 대체한다.
3. 페이지가 없다. 바이어의 질문에 따라 정보 형태가 달라진다.
4. 실시간 채팅이 없다. 비동기 제안 구조. 연락은 카톡에서.
5. 거래 완결은 외부에서. 결제/택배는 이 시스템 밖의 일이다.

### 기존 마켓플레이스와 다른 점

```
기존 UI 개념          Haggle에서는

매물 등록             "이거 팔래" + 사진
카테고리              없음. AI가 이해함
키워드 검색           의도 기반 자연어 요청
필터                  자연어 조건
상품 페이지           맥락 따라 달라지는 동적 정보
찜/관심               대화 기억 + 명시적 워치
거래 상태 관리        "팔렸어" 한마디 or AI가 확인
끌올                  관련성 기반이라 불필요
판매자 프로필         "이 사람 믿을 만해?"에 대한 답
채팅/협상             비동기 제안/역제안
알림 설정             에이전트에게 일 시키기
앱 설치               MCP 연결 한 줄 or GPT Store 클릭
```

### AI여서 가능한 새로운 것들

사진으로 검색. 비슷한 매물 자동 찾기.
연쇄 거래 조율. "이거 팔고 그 돈으로 저거 사줘."
벌크 등록. "이 5개 전부 시세 조사하고 한꺼번에 올려줘."
번들 제안. "이 사람 다른 매물도 보고 묶어서 제안해줘."

---

## Part 3: 기술 설계

### 기술 스택

```
MCP 서버: TypeScript (@modelcontextprotocol/sdk)
DB: PostgreSQL + pgvector
ORM: Drizzle
임베딩: OpenAI text-embedding-3-small (1536차원)
런타임: Node.js 22
테스트: Vitest
패키지 매니저: pnpm
호스팅: Railway 또는 Fly.io
알림: 카카오톡 채널 API
ChatGPT 앱: OpenAI Actions API 연동
```

### 전체 구조

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  ChatGPT    │  │  Claude     │  │  Gemini     │
│  (GPT App)  │  │  (MCP)      │  │  (MCP)      │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       └────────────────┼────────────────┘
                        │
              ┌─────────▼─────────┐
              │  Haggle 백엔드     │
              │                   │
              │  MCP 서버         │
              │  + REST API       │
              │  (ChatGPT용)      │
              ├───────────────────┤
              │  PostgreSQL       │
              │  + pgvector       │
              ├───────────────────┤
              │  알림 서비스       │
              │  (카카오톡 채널)   │
              └───────────────────┘
```

### 디렉토리 구조

```
haggle/
├── CLAUDE.md                    에이전트 진입점 (~100줄)
├── ARCHITECTURE.md              코드베이스 지도
├── docs/
│   ├── PRODUCT.md               제품 철학과 원칙
│   ├── DATA_SCHEMA.md           매물 데이터 구조
│   ├── MCP_TOOLS.md             MCP 도구 명세
│   ├── API_PATTERNS.md          코드 패턴과 규칙
│   └── DECISIONS.md             설계 결정 기록
├── src/
│   ├── server/                  MCP 서버 진입점
│   ├── tools/                   MCP 도구 구현
│   │   ├── register.ts          매물 등록
│   │   ├── search.ts            매물 검색
│   │   ├── offer.ts             제안 관리
│   │   ├── dashboard.ts         셀러/바이어 대시보드
│   │   ├── watch.ts             조건 감시 등록
│   │   ├── price.ts             시세 조회
│   │   └── CLAUDE.md            도구별 구현 규칙
│   ├── db/                      PostgreSQL 쿼리 (Drizzle)
│   │   ├── schema.ts            테이블 정의
│   │   ├── queries/             쿼리 함수
│   │   ├── migrate.ts           마이그레이션
│   │   └── CLAUDE.md            DB 규칙
│   ├── embedding/               임베딩 생성 및 유사도 검색
│   │   ├── generate.ts          OpenAI API 호출
│   │   └── search.ts            pgvector 유사도 검색
│   ├── notify/                  카카오톡 채널 알림
│   ├── lib/                     공유 유틸리티
│   │   ├── logger.ts            구조화된 로거
│   │   ├── result.ts            Result 타입
│   │   └── config.ts            환경 변수 관리
│   └── types/                   공유 타입
├── tests/
├── package.json
└── tsconfig.json
```

### 의존성 방향

```
tools → db, embedding, notify, lib
db → lib
embedding → lib
notify → lib

tools끼리 서로 의존하지 않는다.
db, embedding, notify끼리 서로 의존하지 않는다.
```

### MCP 도구 7개

```
register_item    매물 등록. 사진+텍스트 → 임베딩 생성 → DB 저장.
find_items       매물 검색. 자연어 → 임베딩 유사도 + 필터.
get_item_detail  매물 상세. 속성+사진+판매자+제안현황.
make_offer       제안 넣기. 희망가격+연락처+메모. 판매자에게 알림.
my_dashboard     전체 현황. 내 매물+받은 제안+보낸 제안+워치.
update_listing   매물 수정. 가격/상태/설명 변경.
set_watch        감시 등록. 자연어 조건 → 임베딩. 매칭 시 알림.
market_price     시세 조회. 유사 매물 가격 분포.
```

### 데이터 스키마

listings (매물): id, seller_id, title, description, price, status(active/reserved/sold/deleted), location(lat/lng/name), photos[], attributes(jsonb), embedding(vector 1536), view_count, interest_count, created_at, updated_at

users: id, external_id(MCP 클라이언트 식별), display_name, contact_method(카톡 오픈채팅 등), location, created_at

offers (제안): id, listing_id, buyer_id, offered_price, message, buyer_contact, status(pending/accepted/declined/withdrawn), created_at

watches (감시): id, user_id, query_text, query_embedding(vector), max_price, max_distance_km, notify_method, is_active, created_at

interests (관심): id, user_id, listing_id, created_at

### 설계 결정 기록

001: 프론트엔드를 만들지 않는다. AI 네이티브 제품이므로 UI는 AI 클라이언트가 담당. ChatGPT 앱으로 보완.

002: 카테고리를 두지 않는다. 임베딩 의미 검색이 카테고리를 대체. AI 검색 환경에서 더 유연하고 정확.

003: 실시간 메시징을 구현하지 않는다. 비동기 제안 구조. 연락은 카톡. MCP의 요청-응답 특성과 맞음.

004: 결제를 처리하지 않는다. 금융 규제 복잡도. 사이드 프로젝트 범위 밖. 직거래/계좌이체로 충분.

005: 임베딩에 OpenAI text-embedding-3-small. 가격 대비 성능 최적. pgvector 호환.

006: 거래 연결은 카카오톡 오픈채팅. 판매자가 제안을 수락하면 바이어 연락처가 공개되고, 판매자가 주도적으로 연락. 오픈채팅 링크 노출 문제 해결.

007: 알림은 카카오톡 채널. 한국 사용자의 메시지 확인률이 가장 높은 채널. 초기에는 카카오톡 채널 일반 메시지(무료, 친구 추가 사용자 대상). 사업자 등록 후 알림톡 전환 가능.

---

## Part 4: CLAUDE.md 컨텐츠

에이전트에게 이 프로젝트를 맡길 때 루트에 놓을 파일이다. 약 100줄.

```markdown
# Haggle

AI 네이티브 중고 마켓플레이스 MCP 서버.
사용자가 ChatGPT/Claude를 통해 중고 물품을 등록, 검색, 거래한다.
프론트엔드 없음. MCP 서버 + DB + 임베딩이 전부.

## 빌드와 실행

- 패키지 매니저: pnpm
- 빌드: pnpm build
- 테스트: pnpm test
- 개발 서버: pnpm dev
- 린트: pnpm lint (ESLint + Prettier)
- DB 마이그레이션: pnpm db:migrate

## 기술 스택

- 언어: TypeScript (strict mode)
- MCP SDK: @modelcontextprotocol/sdk
- DB: PostgreSQL + pgvector (Drizzle ORM)
- 임베딩: OpenAI text-embedding-3-small
- 런타임: Node.js 22
- 테스트: Vitest
- 알림: 카카오톡 채널 API

## 코드 규칙 (위반 시 린트 실패)

- 클래스를 쓰지 않는다. 순수 함수 + 타입으로 작성.
- any 타입 금지. Zod로 런타임 검증.
- 에러는 throw하지 않는다. Result<T, E> 타입 반환.
- console.log 금지. src/lib/logger.ts 사용.
- 환경 변수 직접 접근 금지. src/lib/config.ts 경유.
- DB 쿼리는 src/db/queries/ 안에서만. tools에서 직접 SQL 금지.

## MCP 도구 추가 시

1. docs/MCP_TOOLS.md에서 스펙 확인
2. src/tools/에 파일 하나 = 도구 하나
3. 입력: Zod 스키마. 출력: 타입 정의.
4. 에러: MCP 에러 코드 반환 (throw 금지)
5. tests/tools/에 단위 테스트 필수

## 상세 문서

- 제품 철학: docs/PRODUCT.md
- 데이터 스키마: docs/DATA_SCHEMA.md
- MCP 도구 명세: docs/MCP_TOOLS.md
- 코드 패턴: docs/API_PATTERNS.md
- 설계 결정: docs/DECISIONS.md
- 아키텍처: ARCHITECTURE.md
```

---

## Part 5: 에이전트에게 작업 시키는 순서

한 번에 "마켓플레이스 만들어줘"가 아니라 깊이 우선으로 하나씩 시킨다. 각 단계에서 참조할 문서를 명시한다.

```
단계 1: 스캐폴딩
  "CLAUDE.md와 ARCHITECTURE.md를 읽고 디렉토리 구조를 생성해줘.
   package.json, tsconfig.json, vitest.config.ts,
   ESLint/Prettier 설정, src/lib/의 공유 유틸리티 포함."

단계 2: DB 스키마
  "docs/DATA_SCHEMA.md를 읽고 src/db/schema.ts에
   Drizzle ORM 스키마를 작성해줘. 마이그레이션도 생성."

단계 3: 임베딩 레이어
  "src/embedding/generate.ts와 search.ts를 구현해줘.
   OpenAI text-embedding-3-small API 호출 + pgvector 유사도 검색.
   테스트 포함."

단계 4: 검색 도구
  "docs/MCP_TOOLS.md의 find_items 명세를 읽고
   src/tools/search.ts를 구현해줘. 테스트 포함."

단계 5: 등록 도구
  "docs/MCP_TOOLS.md의 register_item 명세를 읽고
   src/tools/register.ts를 구현해줘. 테스트 포함."

단계 6: MCP 서버 연결
  "src/server/에 MCP 서버를 구성해줘.
   search와 register 도구를 연결.
   로컬에서 Claude Desktop으로 테스트 가능한 상태까지."

단계 7~: 나머지 도구를 하나씩 추가
  dashboard → offer → watch → price → update_listing
```

각 단계 끝에 테스트를 돌리고, 린트를 통과시키고, 다음 단계로 넘어간다. 에이전트가 "어디를 보면 되는지" 항상 알고 있다. CLAUDE.md가 목차, docs/가 상세 스펙.

---

## Part 6: 이 문서들의 위치

이 가이드는 market_research/에 있다. 실제 프로젝트를 시작하면 haggle/ 레포를 만들고 Part 4의 CLAUDE.md를 루트에 놓는다. docs/ 안의 파일들(PRODUCT.md, DATA_SCHEMA.md, MCP_TOOLS.md, DECISIONS.md)은 이 가이드의 Part 3에 있는 내용을 각각 독립 파일로 분리해서 넣는다.

```
market_research/
└── Harness_Engineering_Guide.md   ← 이 파일 (설계 전체)

haggle/                            ← 실제 프로젝트 레포
├── CLAUDE.md                      ← Part 4 내용
├── ARCHITECTURE.md                ← Part 3 디렉토리+의존성
├── docs/
│   ├── PRODUCT.md                 ← Part 2 제품 원칙
│   ├── DATA_SCHEMA.md             ← Part 3 데이터 스키마
│   ├── MCP_TOOLS.md               ← Part 3 MCP 도구 명세
│   ├── API_PATTERNS.md            ← 코드 패턴 (구현 시 작성)
│   └── DECISIONS.md               ← Part 3 설계 결정
├── src/
│   └── ...
└── tests/
```

에이전트에게 "Harness_Engineering_Guide.md를 읽고 haggle/ 레포를 초기화해줘"라고 시키면 이 구조가 나온다.
