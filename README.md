# Haggle

AI 에이전트가 중고 물건을 사고파는 마켓플레이스 MCP 서버.

ChatGPT, Claude, Gemini 같은 AI 에이전트가 매물 등록, 검색, 제안, 거래를 수행한다. 프론트엔드 없음. MCP 서버 + PostgreSQL + Meilisearch가 전부.

## Quick Start

```bash
# 1. 의존성 설치
pnpm install

# 2. 서비스 띄우기 (PostgreSQL + Meilisearch)
pnpm services:up

# 3. DB 마이그레이션
pnpm db:migrate

# 4. MCP 서버 실행 (stdio, 개발 모드)
pnpm dev -- --stdio --dev
```

개발 모드(`--dev`)는 테스트 유저를 자동 생성해서 인증 없이 모든 도구를 사용할 수 있다.

## Claude Desktop에서 사용

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "haggle": {
      "command": "npx",
      "args": ["tsx", "src/server/index.ts", "--stdio", "--dev"],
      "cwd": "/path/to/haggle",
      "env": {
        "DATABASE_URL": "postgresql://postgres:haggle@localhost:5433/haggle_dev",
        "MEILISEARCH_HOST": "http://localhost:7700",
        "MEILISEARCH_API_KEY": "haggle-dev-key",
        "JWT_SECRET": "dev-secret-key-at-least-32-characters!"
      }
    }
  }
}
```

## MCP 도구 (10개)

### 읽기 (인증 불필요)

| 도구              | 설명                                   |
| ----------------- | -------------------------------------- |
| `search_listings` | 키워드 + 필터로 매물 검색              |
| `get_listing`     | 매물 상세 (판매자, 제안 현황)          |
| `market_price`    | 유사 매물 시세 (최저/최고/평균/중간값) |

### 쓰기 (인증 필수)

| 도구             | 설명                                                     |
| ---------------- | -------------------------------------------------------- |
| `register_item`  | 매물 등록                                                |
| `update_listing` | 매물 수정 (소유자만)                                     |
| `manage_listing` | 매물 상태 변경 — 예약, 판매완료, 삭제, 재등록 (소유자만) |
| `make_offer`     | 매물에 구매 제안                                         |
| `respond_offer`  | 제안 수락/거절 (판매자만)                                |
| `my_dashboard`   | 내 매물, 받은/보낸 제안, 워치 현황                       |
| `set_watch`      | 검색 조건 감시 등록 + 즉시 매칭                          |

## 개발

```bash
pnpm build          # TypeScript 빌드
pnpm test           # 테스트 (47개)
pnpm lint           # ESLint + Prettier
pnpm services:up    # Docker 서비스
pnpm services:down  # Docker 서비스 중지
pnpm db:migrate     # DB 마이그레이션
pnpm prisma studio  # DB 브라우저
```

## 기술 스택

- TypeScript (strict) + Node.js 22
- MCP SDK (@modelcontextprotocol/sdk)
- PostgreSQL (Prisma ORM)
- Meilisearch (한국어 형태소 분석)
- Vitest (47 tests)

## 문서

- [아키텍처](ARCHITECTURE.md)
- [제품 철학](docs/PRODUCT.md)
- [MCP 도구 명세](docs/MCP_TOOLS.md)
- [코드 패턴](docs/API_PATTERNS.md)
- [설계 결정](docs/DECISIONS.md)
- [데이터 스키마](docs/DATA_SCHEMA.md)
