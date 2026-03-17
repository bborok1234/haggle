# Roadmap

## 완료된 작업

| PR  | 내용                                      | 테스트 |
| --- | ----------------------------------------- | ------ |
| 001 | DB 스키마 + Prisma + 쿼리                 | 10     |
| 002 | Meilisearch 검색 레이어                   | 8      |
| 003 | MCP 서버 + 읽기 도구 3개                  | 5      |
| 004 | 인증 레이어 (JWT + Actor)                 | 7      |
| 005 | 쓰기 도구 3개 (register, update, manage)  | 7      |
| 006 | 제안 도구 2개 (make_offer, respond_offer) | 6      |
| 007 | 대시보드 + Watch                          | 4      |
| -   | README + --dev 모드                       | -      |

누적: MCP 도구 10개, 테스트 47개.

## 마일스톤

### M1: npm 배포 + 레지스트리 등록

발견 가능하게 만들기. 유저가 Haggle을 찾을 수 있는 상태.

- npm 패키지 발행 (`npx -y @haggle/mcp-server`)
- MCP Registry 등록 (`mcp-publisher publish`)
- Smithery 등록
- README에 클라이언트별 설정 스니펫 (Claude Desktop, Claude Code, Cursor, VS Code)
- 로컬 데모 모드 (--dev로 체험 가능)

### M2: 중앙 서버 배포

마켓플레이스는 공유 상태가 필수. 모든 유저가 같은 매물/제안을 보려면 중앙 서버 필요.

- Railway에 MCP 서버 + PostgreSQL + Meilisearch 배포
- Streamable HTTP 엔드포인트 공개
- npm 패키지가 로컬 데모 + 리모트 연결 양쪽 지원
- Health check + graceful shutdown

### M3: 인증 (OAuth 2.1)

중앙 서버에 실제 유저 구분.

- Auth0 셋업 + JWKS 검증 전환 (현재 HS256 → RS256)
- `/.well-known/oauth-protected-resource` 엔드포인트
- ChatGPT Dynamic Client Registration 지원
- Rate limiting

### M4: ChatGPT Apps SDK 제출

9억 사용자 접근.

- OpenAI 조직 신원 인증
- Content-Security-Policy 헤더
- 도구 annotation 감사 (readOnlyHint, destructiveHint, openWorldHint)
- 개인정보처리방침 URL
- 앱 아이콘, 설명, 스크린샷, 테스트 프롬프트
- `platform.openai.com/apps-manage`에서 제출

### M5: 시딩 + 알림 (M3-M4와 병렬)

- 카메라 카페 매물 30-50개 수동 시딩
- 카카오톡 채널 알림 연동
- 사진 업로드 플로우 (presigned URL)

### M6: 확장 (출시 후)

- Claude MCP Registry 등록
- Gemini MCP 지원
- 멀티 커뮤니티 확장 (기타, 자전거 등)
- 임베딩 검색 도입 검토 (매물 500건 이상 시)
- 모니터링 + 에러 추적
