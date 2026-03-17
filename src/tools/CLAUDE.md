# src/tools/

MCP 도구 구현 디렉토리. 파일 하나 = 도구 하나.

## 규칙

- 입력: Zod 스키마로 검증. any 금지.
- 출력: 타입 정의 필수.
- 에러: MCP 에러 코드 반환. throw 금지. Result 타입 사용.
- DB: src/db/queries/ 함수만 호출. 직접 SQL 금지.
- 검색: src/search/ 함수만 호출. 직접 Meilisearch 클라이언트 금지.
- 도구 간 import 금지. 공유 로직은 src/lib/로.
- mutating 도구에 idempotency_key 파라미터 필수.
- 인증 필요 도구는 actor 컨텍스트에서 user_id 추출. 입력으로 받지 않음.
- 테스트: tests/tools/에 단위 테스트 필수.

## 새 도구 추가 시

1. docs/MCP_TOOLS.md에서 스펙 확인
2. src/tools/{도구명}.ts 생성
3. Zod 입력 스키마 정의
4. 출력 타입 정의
5. Result<T, E> 반환
6. tests/tools/{도구명}.test.ts 작성
7. src/server/에서 도구 등록
