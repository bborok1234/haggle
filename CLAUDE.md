# Haggle

에이전트 네이티브 중고 마켓플레이스 MCP 서버.
AI 에이전트(ChatGPT/Claude/Gemini)가 중고 물품을 등록, 검색, 거래한다.
프론트엔드 없음. MCP 서버 + DB + 검색엔진이 전부.

## 빌드와 실행

- 패키지 매니저: pnpm
- 빌드: pnpm build
- 테스트: pnpm test
- 개발 서버: pnpm dev
- 린트: pnpm lint (ESLint + Prettier)
- DB 마이그레이션: pnpm prisma migrate dev
- Prisma 클라이언트 생성: pnpm prisma generate

## 기술 스택

- 언어: TypeScript (strict mode)
- MCP SDK: @modelcontextprotocol/sdk
- DB: PostgreSQL (Prisma ORM)
- 검색: Meilisearch (한국어 형태소 분석)
- 인증: OAuth 2.1 (외부 IdP → JWT)
- 런타임: Node.js 22
- 테스트: Vitest
- 알림: 카카오톡 채널 API

## 코드 규칙 (위반 시 린트 실패)

- 클래스를 쓰지 않는다. 순수 함수 + 타입으로 작성.
- any 타입 금지. Zod로 런타임 검증.
- 에러는 throw하지 않는다. Result<T, E> 타입 반환.
- console.log 금지. src/lib/logger.ts 사용.
- 환경 변수 직접 접근 금지. src/lib/config.ts 경유.
- DB 쿼리는 src/db/queries/ 안에서만. tools에서 직접 Prisma Client 호출 금지.
- 매물 CUD 시 Meilisearch 인덱스 동기화 필수. src/search/ 경유.
- mutating 도구에 idempotency_key 파라미터 필수.

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
