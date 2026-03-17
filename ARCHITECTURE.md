# Architecture

## 시스템 구조

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  ChatGPT    │  │  Claude     │  │  Gemini     │
│  (MCP)      │  │  (MCP)      │  │  (MCP)      │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       └────────────────┼────────────────┘
                        │ OAuth 2.1 + MCP
              ┌─────────▼─────────┐
              │  Haggle 백엔드     │
              │                   │
              │  MCP 서버         │
              ├───────────────────┤
              │  PostgreSQL       │
              ├───────────────────┤
              │  Meilisearch      │
              │  (검색 인덱스)     │
              ├───────────────────┤
              │  알림 서비스       │
              │  (카카오톡 채널)   │
              └───────────────────┘
```

에이전트 클라이언트가 시맨틱 레이어(의도 파싱, 결과 랭킹)를 담당한다.
백엔드는 빠른 구조화 검색과 데이터 저장만 한다.

## 디렉토리 구조

```
haggle/
├── CLAUDE.md                    에이전트 진입점
├── ARCHITECTURE.md              이 파일
├── docs/
│   ├── PRODUCT.md               제품 철학과 원칙
│   ├── DATA_SCHEMA.md           매물 데이터 구조
│   ├── MCP_TOOLS.md             MCP 도구 명세
│   ├── API_PATTERNS.md          코드 패턴과 규칙
│   └── DECISIONS.md             설계 결정 기록
├── src/
│   ├── server/                  MCP 서버 + REST API 진입점
│   ├── tools/                   MCP 도구 구현
│   │   ├── search-listings.ts   매물 검색
│   │   ├── get-listing.ts       매물 상세
│   │   ├── register-item.ts     매물 등록
│   │   ├── update-listing.ts    매물 수정
│   │   ├── manage-listing.ts    매물 상태 변경
│   │   ├── make-offer.ts        제안 넣기
│   │   ├── respond-offer.ts     제안 응답
│   │   ├── my-dashboard.ts      대시보드
│   │   ├── set-watch.ts         조건 감시
│   │   ├── market-price.ts      시세 조회
│   │   └── CLAUDE.md            도구별 구현 규칙
│   ├── db/                      PostgreSQL (Prisma)
│   │   ├── client.ts            PrismaClient 싱글턴
│   │   ├── queries/             쿼리 함수 (외부 노출 인터페이스)
│   │   └── CLAUDE.md            DB 규칙
│   ├── search/                  Meilisearch 클라이언트
│   │   ├── client.ts            Meilisearch 연결
│   │   ├── sync.ts              DB → 검색 인덱스 동기화
│   │   └── query.ts             검색 쿼리 실행
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

## 의존성 방향

```
tools → db, search, notify, lib
db → lib
search → lib
notify → lib
```

- tools끼리 서로 의존하지 않는다.
- db, search, notify끼리 서로 의존하지 않는다.
- lib은 어디에도 의존하지 않는다.

## 기술 스택

| 영역          | 기술                                  |
| ------------- | ------------------------------------- |
| MCP 서버      | TypeScript, @modelcontextprotocol/sdk |
| DB            | PostgreSQL                            |
| ORM           | Prisma                                |
| 검색          | Meilisearch (한국어 형태소 분석)      |
| 인증          | OAuth 2.1 (외부 IdP → JWT)            |
| 런타임        | Node.js 22                            |
| 테스트        | Vitest                                |
| 패키지 매니저 | pnpm                                  |
| 호스팅        | Railway 또는 Fly.io                   |
| 알림          | 카카오톡 채널 API                     |
| ChatGPT 앱    | OpenAI Actions API                    |
