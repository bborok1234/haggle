# PR-004: 인증 레이어

## 목표

JWT 검증 + Actor 컨텍스트 추출 + 인증 미들웨어. 쓰기 도구 보호, 읽기 도구는 익명 허용.

## 접근법

옵션 A: JWT 검증 구조 + 개발용 서명 키. 프로덕션 시 IdP JWKS로 전환 가능.

## 기술 결정

- JWT 라이브러리: `jose` (JWKS 페칭, RS256/ES256/HS256 지원, ESM 네이티브)
- 개발/테스트: HS256 + 로컬 시크릿 (`.env`의 `JWT_SECRET`)
- 프로덕션: `createRemoteJWKSet` + IdP JWKS URL
- 미들웨어 패턴: soft auth (토큰 있으면 검증, 없으면 통과 → 도구 핸들러에서 체크)
- SDK 흐름: `requireBearerAuth → req.auth → transport → extra.authInfo`
- stdio: authInfo 항상 undefined → 핸들러에서 graceful 처리

## 핵심 패턴

```
Express middleware (soft auth)
  → req.auth = AuthInfo { token, clientId, scopes, extra: { sub } }
  → transport.handleRequest(req, res)
  → tool handler: extra.authInfo?.extra?.['sub']
  → resolveActor(prisma, sub, provider) → User
```

## TDD 플로우

### RED: 테스트 먼저

```
# JWT 검증
Given 유효한 JWT (sub="user-123")
When verifyToken 호출
Then AuthInfo 반환 (extra.sub = "user-123")

Given 만료된 JWT
When verifyToken 호출
Then 에러 throw

Given 잘못된 서명 JWT
When verifyToken 호출
Then 에러 throw

# Actor 해석
Given JWT sub가 DB에 없는 새 유저
When resolveActor 호출
Then 새 User 생성 + 반환

Given JWT sub가 DB에 있는 기존 유저
When resolveActor 호출
Then 기존 User 반환

# 도구 인증 가드
Given authInfo가 있는 extra
When requireAuth(extra) 호출
Then ok(Actor) 반환

Given authInfo가 없는 extra
When requireAuth(extra) 호출
Then err('AUTH_REQUIRED') 반환
```

### GREEN: 구현

1. `jose` 설치
2. src/lib/auth.ts — verifyToken, resolveActor, requireAuth
3. src/server/index.ts — soft auth 미들웨어 추가 (HTTP 경로)
4. .env.example — JWT_SECRET 추가
5. config.ts — JWT_SECRET 추가

## 산출물

```
src/lib/auth.ts          JWT 검증 + resolveActor + requireAuth
src/server/index.ts      미들웨어 연결 (수정)
src/lib/config.ts        JWT_SECRET 추가 (수정)

tests/lib/auth.test.ts   JWT 검증 + Actor 해석 + 가드 BDD 테스트
```

## 자동 검증

- pnpm build (tsc)
- pnpm test (vitest)
- pnpm lint

## 수동 검증

- [ ] curl로 HTTP 서버에 토큰 없이 search_listings 호출 → 성공
- [ ] curl로 HTTP 서버에 유효한 JWT로 보호된 도구 호출 → 성공
- [ ] curl로 HTTP 서버에 토큰 없이 보호된 도구 호출 → isError
