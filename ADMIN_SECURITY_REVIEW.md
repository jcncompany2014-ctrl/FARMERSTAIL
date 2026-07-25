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

## DB 보안 어드바이저 정기 점검 (계획 E2) — 2026-07-25

`get_advisors(security)` 실행. **새로 조치할 WARN 0건.** 린터가 올리는 WARN 은
전부 "GRANT 가 존재한다"는 사실만 보는 것이고, 해당 함수들은 **내부에서
fail-closed 가드**를 갖고 있다. 직접 정의를 떠서 확인했다:

| 함수 | 린터 경고 | 실제 가드 | 판정 |
|---|---|---|---|
| `cohort_retention_weekly` · `cohort_ltv_weekly` | authenticated 실행 가능 | `IF NOT is_admin() THEN RAISE 'forbidden'` | ✅ 안전 |
| `dashboard_user_snapshot(p_user_id)` | authenticated 실행 가능 | `IF v_caller IS NULL OR v_caller <> p_user_id THEN RAISE` | ✅ 안전 (예전 fail-open IDOR 이 고쳐진 상태) |
| `has_dog_access` · `has_dog_role` | anon 실행 가능 | `IF v_uid IS NULL THEN RETURN FALSE` | ✅ 안전 |
| `set_consent_level` | anon 실행 가능 | `v_uid IS NULL → {ok:false,'로그인이 필요해요'}` | ✅ 안전 |
| `set_marketing_consent` | anon 실행 가능 | `v_uid IS NULL → raise 'UNAUTHORIZED'` | ✅ 안전 |
| `fetch_photo_request` · `submit_photo_request` · `fetch_vet_share` | anon 실행 가능 | **의도적** — 토큰으로 여는 공유/업로드 링크 | ✅ 설계대로 |
| `increment_blog_view` · `is_admin` | anon 실행 가능 | 공개 조회수 / 호출자 본인 여부만 반환 | ✅ 무해 |

INFO 3건(`anthropic_usage`·`email_suppressions`·`rate_limit_counters` = RLS 켜짐 +
정책 없음)은 **service_role 전용 테이블이라 의도한 상태**다. 정책이 없다는 건
anon·authenticated 에게 전면 거부라는 뜻이라 오히려 올바른 자세.

새로 추가된 도장판 함수 3종(`fn_expire_stamps`·`fn_lock_completed_cards`·
`fn_tier_rank`)은 경고 목록에 **없다** = EXECUTE 가 제대로 revoke 돼 있다.

### ⚠️ 사장님이 직접 켜셔야 하는 것 1건
**유출 비밀번호 차단(Leaked Password Protection)이 꺼져 있다.** Supabase 가
HaveIBeenPwned 목록과 대조해 이미 털린 비밀번호로는 가입/변경을 막아주는 기능이다.
Supabase 대시보드 → Authentication → Policies 에서 토글. 코드 변경 불요이고,
이메일 가입 경로가 살아 있는 한 켜 두는 편이 낫다. (계정 설정이라 제가 대신
바꾸지 않았습니다.)

## 기록만 (조치 불요)

- `daily-briefing` 수신자 선정이 `profiles.role='admin'` 기준 — 판정 SSOT 인
  `app_metadata.role` 과 다르다. 다만 `profiles.role` 은 `prevent_profile_role_change`
  트리거가 사용자 변경을 막으므로 self-elevation 은 불가. 운영 계정은 둘 다 설정돼
  있어 현재 영향 0. 관리자가 늘면 그때 통일할 것.
- admin 페이지 39개 중 24개는 자체 가드 없이 layout 가드에 의존한다. 위 3·4번
  때문에 유출 위험은 없지만, **새 admin 페이지가 service_role 을 쓴다면 자체 가드는
  필수**다. (MASTER_WORK_PLAN §0-4 에 규칙으로 박아둘 것)
