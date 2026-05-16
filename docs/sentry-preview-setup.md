# Vercel Preview 에서 Sentry source map 보존하기 (audit #89)

## 왜 필요한가

PR Preview 환경에서 발생한 에러를 Sentry 에서 디버깅할 때, source map 이
없으면 stack trace 가 minified (예: `a.b.c.d`) 라 어느 코드인지 못 찾음.
Production 만 source map 업로드되면 PR 머지 전 디버깅 불가.

## 작업 순서 (30분, Vercel 대시보드)

### 1) Sentry — read-only auth token 발급
1. Sentry 대시보드 → **Settings → Account → API → Auth Tokens** 진입
2. `+ Create New Token` 클릭
3. 이름: `Vercel Preview Source Maps`
4. Scopes 선택 (최소 권한):
   - `project:read`
   - `project:releases` (source map upload)
   - `org:read`
5. `Create Token` → 토큰 복사 (다시 못 봄)

### 2) Vercel — Preview environment 에 토큰 주입
1. Vercel 대시보드 → 프로젝트 → **Settings → Environment Variables**
2. `+ Add New` 클릭
3. Key: `SENTRY_AUTH_TOKEN`
4. Value: 1단계에서 복사한 토큰
5. **Environments**: `Preview` 만 체크 (Production 이미 설정돼 있으면 그건 그대로)
6. `Save`

### 3) 검증
1. 다음 PR 만들 때 Vercel Preview 빌드 로그 확인
2. `[@sentry/nextjs] Source maps uploaded` 또는 비슷한 메시지 나오면 성공
3. Sentry 대시보드 → Releases 에 새 commit hash 가 보이면 OK

## 보안

- **Production token 과 분리**: Preview 환경이 leak 돼도 production source map 권한 X
- **Token rotation**: 6개월에 한 번 재발급 권장
- Read-only scope 라 prod release 못 만들고 못 지움

## 코드는 이미 준비됨

`next.config.ts` 의 sentryOptions 가 `SENTRY_AUTH_TOKEN` env 만 있으면
자동으로 source map 업로드 활성화. 코드 변경 없음.
