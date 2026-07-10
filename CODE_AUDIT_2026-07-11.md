# CODE_AUDIT_2026-07-11 — 2차 전면 감사

> 1차 감사(CODE_AUDIT_2026-07-03, 651파일 전수) 이후. 기계검증 + 의존성 +
> Supabase 어드바이저(보안/성능) + 델타 코드(7/3 이후 11커밋) 정독.

## 요약
- **기계검증**: `npm run verify`(eslint+tsc+**1233 tests**) 그린, 클린 빌드/CI 통과. 델타 코드 스멜 0(console.log/TODO/FIXME 없음).
- **런타임 버그**: 없음. 실사용 차단 이슈 없음.
- 아래는 **하드닝·최적화·업그레이드** 항목. 대부분 프리런치라 긴급도 낮음. DB/의존성 변경은 사장님 승인 후.

---

## 🔴 보안 — 처리 권장 (실사용/PG 라이브 전)

### S1. npm 취약점 12건 (high 1 · moderate 10 · low 1)
- `ws` 8.20.0 (**high**, 메모리 노출·DoS) — 경로: `@supabase/realtime-js`(런타임) + `@next/bundle-analyzer`·`storybook`(dev)
- `tar` 7.5.13 (moderate) — 경로: `@capacitor/cli`(빌드 전용)
- 그 외: `@babel/core`·`postcss`·`brace-expansion`·`@opentelemetry/*` (대부분 dev/빌드)
- **조치**: `npm audit fix`(non-force)로 대부분 해결. ⚠️ Next는 수정 포크라 무단 업뎃 금지 → **ws/tar 등 개별 transitive만 타겟 확인 후** 적용. Realtime 미사용이면 ws 노출면도 사실상 없음.

### S2. Supabase 유출 비밀번호 보호 OFF
- `auth_leaked_password_protection` — HaveIBeenPwned 대조 미사용.
- **조치**: 대시보드 Auth 설정에서 **1클릭 활성화(무료)**. → 사장님.
  https://supabase.com/docs/guides/auth/password-security

### S3. 내부 RPC 함수에 anon/authenticated EXECUTE 잔존 (방어적 revoke 권장)
SECURITY DEFINER 함수 32종이 anon/authenticated 실행권한을 가짐(어드바이저 WARN 64건). 대부분 내부에서 `auth.uid()`/admin 체크로 가드하거나 토큰 게이트라 **당장 악용 불가**하지만, 실제로 **service_role로만 호출되는** 함수는 클라 실행권한이 불필요 → 최소권한 원칙으로 revoke 권장.
- ✅ **service_role 전용 확정(안전하게 revoke 가능)**: `refund_order_points`(admin.rpc), `sum_anthropic_calls_today`·`incr_anthropic_usage`(createAdminClient), 커머스 계열(`reserve_order_stock`·`restore_stock`·`record_reward_event`), 분석 `cohort_ltv_weekly`
- ⚠️ **확인 필요(요청 스코프 클라 가능성)**: `incr_rate_limit_counter`(rateLimitDB 의 supabase 인자 = 호출부별 상이 → 유지 가능성)
- ⏭ **가드 내장이라 무방**: `dashboard_user_snapshot`·`apply_point_delta`·`is_admin`·`has_dog_*`·토큰 게이트(`fetch_vet_share`·`fetch_photo_request`·`lookup_invitation_by_token`)
- 트리거 함수(9종)는 직접 RPC 호출 불가 — 어드바이저 오탐이나 청소차원 revoke 가능.

### S4. public bucket `event-images` — 광범위 SELECT(파일 목록 노출)
- `public_bucket_allows_listing` — 누구나 버킷 파일 리스팅 가능. 이벤트 이미지라 민감도 낮음. 객체 URL 접근엔 리스팅 정책 불필요 → 정책 좁히기 권장.

---

## 🟠 검토

### R1. RLS enabled·정책 0 (3테이블)
`rate_limit_counters`·`email_suppressions`·`anthropic_usage` — 정책 없어 클라 deny-all(=service_role/DEFINER만 접근). 내부 테이블이면 **의도된 안전 상태**. 의도 확인만.

---

## 🟡 성능 — 대부분 프리런치라 후순위 (유저·데이터 0)

| 항목 | 건수 | 판단 |
|---|---|---|
| `auth_rls_initplan` (`auth.uid()`→`(select auth.uid())`) | 160 | 단일 최대 레버. 유저 0인 지금 효과 0. **런칭 전 일괄** 가치 있음(부하 중 하면 위험) |
| `multiple_permissive_policies` | 109 | 정책 통합. 후순위 |
| `unused_index` | 81 | 프리런치라 당연. **지금 드롭 금지**(쿼리 생기면 필요) |
| `duplicate_index` | 3 | ✅ **안전한 즉시 정리 가능** |
| `unindexed_foreign_keys` | 31 | 선별 인덱스 추가 가치(캐스케이드/조인) |

---

## 코드 델타 (7/3→7/11, 11커밋)
QR 레시피 4종·기록허브 토글·petName/honorific 스윕·도장 추가→전량 제거. 전부 verify 그린, 스멜 없음. `public/` 4.7MB·500KB 초과 이미지 0(이미 최적화됨).

---

## ✅ 실행 완료 (2026-07-11, 사장님 "위 + 대규모 최적화" 승인)
- **RLS initplan 160→0**: 마이그 `rls_initplan_optimization`. 62테이블 160정책의 `auth.*()`→`(select auth.*())` 원자적 래핑. 드라이런 검증(미래핑 잔존 0) 후 적용, 정책수 212 유지·로직 동일. 118 qual 래핑 확인.
- **중복 인덱스 8개 드롭**: 마이그 `audit_cleanup_dup_indexes_and_grants`. dog_checkins·dog_formulas(2)·dog_invitations·photo_request_tokens·vet_share_tokens(3) 중복만 제거, constraint-backed `_key` 유지.
- **함수 최소권한**: 위 마이그 + `revoke_public_execute_anthropic_usage`. `refund_order_points`·`sum_anthropic_calls_today`·`incr_anthropic_usage` → anon/authenticated + PUBLIC EXECUTE 회수(postgres·service_role만). 셋 다 service_role 전용 호출 확인.
- **npm 취약점 12→3**: `npm audit fix`(non-force). high(ws) 포함 해결. 남은 3(next→postcss 등)은 breaking(--force) 필요라 제외. verify+클린빌드 그린.

## 남은 것 (사장님/후순위)
- **S2 유출비번 보호**: 대시보드 1클릭 (사장님)
- **S4 event-images 버킷 리스팅**: 정책 좁히기 (선택)
- **커머스 함수 revoke**(reserve_order_stock 등): 클라 호출 있어 보류(커머스 dormant)
- **후순위 성능**: multiple_permissive_policies(109)·unindexed_fk(31 선별)·나머지 SECURITY DEFINER 함수 PUBLIC revoke — 런칭 즈음
