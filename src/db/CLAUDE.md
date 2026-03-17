# src/db/

PostgreSQL. Prisma ORM 사용. 검색은 Meilisearch에 위임.

## 규칙

- 스키마: prisma/schema.prisma에 정의 (프로젝트 루트).
- 쿼리 함수: src/db/queries/ 안에서만 작성.
- tools에서 직접 PrismaClient import 금지. queries/ 함수만 노출.
- 마이그레이션: pnpm prisma migrate dev.
- 스키마 변경 후: pnpm prisma generate 필수.
- 매물 CUD 시 Meilisearch 인덱스 동기화 호출 필수.

## 디렉토리

```
prisma/                     (프로젝트 루트)
├── schema.prisma           스키마 정의
└── migrations/             마이그레이션 파일

src/db/
├── client.ts               PrismaClient 싱글턴
├── queries/                쿼리 함수 (외부 노출 인터페이스)
│   ├── listings.ts
│   ├── users.ts
│   ├── offers.ts
│   └── watches.ts
└── CLAUDE.md               이 파일
```
