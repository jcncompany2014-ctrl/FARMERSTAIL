# /admin 경로 보안 점검 — 2026-07-25

사장님 요청("관리자페이지 경로에 대한 보안은 확실히 한지 점검")에 따른 전수 확인.
**결론: 직접 접근 차단은 확실하다. 발견된 구멍 1건은 데이터 유출이 아닌 화면 껍데기
문제이며, 막는 비용(요청마다 auth 왕복 추가)이 이득보다 커서 의도적으로 두었다.**

## 방어 계층 (전부 확인됨)

| # | 계층 | 상태 | 확인 내용 |
|---|---|---|---|
| 1 | `app/admin/layout.tsx` 서버 가드 | ✅ | 비로그인 → `/login`, 비관리자 → `/dashboard`. **주소 직접 입력은 여기서 막힌다.** |
| 2 | 관리자 판정 기준 | ✅ | `app_metadata.role === 'admin'` 단일 소스. service_role 로만 쓸 수 있어 **사용자가 스스로 올릴 수 없다**. `user_metadata`(self-elevation 가능)는 어디서도 안 본다. |
| 3 | RLS | ✅ | admin 페이지 대부분이 사용자의 anon 키 클라이언트로 조회 → 비관리자는 0행. 실제 데이터 경계는 여기다. |
| 4 | service_role(RLS 우회) 페이지 | ✅ | 4개뿐 — `promotions`·`automation`·`cohort`·`beta-cohort`. **4개 모두 자체 가드 보유.** 이게 가장 중요한 불변식이다. |
| 5 | `/api/admin/**` 11개 라우트 | ✅ | isAdmin 누락 0건 (ADMIN_API_REVIEW.md) |
| 6 | cron 라우트 | ✅ | `daily-briefing` 포함 `isAuthorizedCronRequest` 통과 필수 |
| 7 | 검색 노출 | ✅ | `app/robots.ts` 가 `/admin`·`/admin/*` disallow + layout metadata `robots: noindex, nocache` 이중 차단 |

## 발견된 구멍 1건 — 화면 껍데기(데이터 유출 아님)

App Router 는 admin 페이지끼리 **클라이언트 네비게이션**할 때 공용 layout 을 다시
실행하지 않는다. 그래서 관리자로 로그인한 뒤 세션이 무효화되거나 권한이 회수돼도,
**새로고침 전까지는 admin 화면이 계속 보인다.**

다만 그 상태에서도:
- 일반 페이지 → anon 클라이언트 + RLS → **0행**. 빈 화면만 보인다.
- service_role 4개 페이지 → 페이지 가드가 네비게이션마다 다시 실행 → **리다이렉트**.

즉 **보이는 건 빈 껍데기이고 데이터는 안 나간다.**

### 왜 미들웨어를 넣지 않았나 (의도적 결정)

`middleware.ts` 로 `/admin/:path*` 를 감싸면 RSC 요청까지 전부 검사해 이 구멍이
닫힌다. 실제로 작성해서 검토까지 했지만 **넣지 않기로 했다**:

1. 미들웨어의 `getUser()` 는 **매 요청 Supabase auth 서버 왕복**이다. Next 는 링크를
   프리페치하므로 사이드바 메뉴 15개가 화면에 들어오는 것만으로 왕복이 여러 번 는다.
   사장님이 같은 날 제보하신 **"버벅임·렉"과 정면으로 충돌한다.**
2. 왕복을 피하려고 JWT 를 검증 없이 읽으면 **가드로서 무의미하다** — 쿠키는 사용자가
   제어하므로 role=admin 을 적은 가짜 JWT 를 넣으면 통과한다(그 뒤 layout·RLS 가
   막지만, 그렇다면 미들웨어를 넣는 의미가 없다).
3. 막으려는 대상이 **데이터 유출이 아니라 빈 화면**이다. 비용 대비 이득이 맞지 않는다.

**다시 검토할 조건:** 관리자 계정이 2명 이상이 되거나(권한 회수 시나리오가 실제가 됨),
admin 에서 service_role 사용처가 늘어날 때. 그때는 미들웨어를 넣고 프리페치를
`prefetch={false}` 로 끄는 조합으로 간다.

## 기록만 (조치 불요)

- `daily-briefing` 수신자 선정이 `profiles.role='admin'` 기준 — 판정 SSOT 인
  `app_metadata.role` 과 다르다. 다만 `profiles.role` 은 `prevent_profile_role_change`
  트리거가 사용자 변경을 막으므로 self-elevation 은 불가. 운영 계정은 둘 다 설정돼
  있어 현재 영향 0. 관리자가 늘면 그때 통일할 것.
- admin 페이지 39개 중 24개는 자체 가드 없이 layout 가드에 의존한다. 위 3·4번
  때문에 유출 위험은 없지만, **새 admin 페이지가 service_role 을 쓴다면 자체 가드는
  필수**다. (MASTER_WORK_PLAN §0-4 에 규칙으로 박아둘 것)
