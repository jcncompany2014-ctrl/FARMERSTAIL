-- profiles 컬럼 화이트리스트 — 고객이 자기 계정 상태를 못 쓰게 (2026-07-31 감사)
--
-- # 문제
-- `profiles` 는 **28개 칸 전부** authenticated·anon 에게 UPDATE 가 열려 있었다
-- (실측: has_column_privilege 전 컬럼 true). RLS 는 본인 행 UPDATE 를 허용하므로
-- 고객이 REST 로 자기 행의 아무 칸이나 쓸 수 있었다.
--
-- 트리거가 막아 주는 것도 있다(그건 그대로 둔다):
--   · `role`                                   ← trg_prevent_profile_role_change
--   · `stamp_count`·`tier`·`tier_updated_at`·`cumulative_spend`
--                                              ← profiles_lock_loyalty
--   · `birth_year` 만 14세 미만                ← profiles_enforce_min_age
--
-- 트리거가 없어 **실제로 열려 있던 것들**:
--   · `deleted_at` — 고객이 자기 탈퇴 시각을 쓸 수 있었다. 계정은 탈퇴한 것처럼
--     보이는데(account-purge 크론이 5년 뒤 파기 대상으로 잡는다) 구독은 그대로라
--     **청구는 계속된다.** 반대로 실제 탈퇴자가 이 값을 지우면 파기를 회피한다.
--   · `admin_note` — 사장님이 그 고객에 대해 적어 둔 상담 메모·주의사항을
--     **당사자가 지우거나 위조**할 수 있었다.
--   · `email` — profiles 의 이메일만 바꿔 auth 계정과 어긋나게 만들 수 있었다
--     (어드민 고객 목록·CS 검색이 profiles.email 을 본다).
--   · `consent_level`·`consent_max_rewarded_level` — 동의 단계는 보상과 엮인
--     값이라 본인이 올릴 수 있으면 안 된다.
--   · `id`·`created_at` — 식별자·가입 시각.
--
-- # 조치 — subscriptions(20260730000000) 와 같은 화이트리스트 방식
-- 앱이 **고객 경로에서 실제로 쓰는 칸만** 부여한다(저장소 전수로 확인):
--   배송지·이름  : name · phone · zip · address · address_detail
--                  (주문 생성 시 프로필 저장, 계정 화면 프로필 폼)
--   마케팅 동의  : agree_email · agree_email_at · agree_sms · agree_sms_at ·
--                  marketing_policy_version  (본인이 켜고 끄는 값)
--   생년월일     : birth_year · birth_month · birth_day  (age-gate·가입 폼)
--   온보딩       : onboarded_at  (튜토리얼 완료 표시)
--
-- 화이트리스트의 이점: **새 컬럼은 자동으로 차단**된다. 고객이 써야 하는 칸이
-- 생기면 그때 명시적으로 GRANT 하고, 그 리뷰가 목적이다.
--
-- # 같이 옮긴 호출부 (규칙13 — 잠그면 그 칸을 쓰던 코드가 조용히 죽는다)
-- 어드민 메모 저장이 쿠키 클라이언트로 admin_note 를 쓰고 있었다 →
-- `PATCH /api/admin/users/[id]/note` 신설, 관리자 검증 후 service_role 로 쓴다.
-- (2026-07-31 에 카드 등록이 정확히 그렇게 죽어 있던 것을 겪었다.)
--
-- anon 은 프로필을 만질 이유가 없다 — UPDATE 전면 회수.
-- SELECT 는 유지(본인 프로필 조회). INSERT 도 유지(가입 시 행 생성).

revoke update on public.profiles from authenticated;
revoke update on public.profiles from anon;

grant update (
  name,
  phone,
  zip,
  address,
  address_detail,
  agree_email,
  agree_email_at,
  agree_sms,
  agree_sms_at,
  marketing_policy_version,
  birth_year,
  birth_month,
  birth_day,
  onboarded_at
) on public.profiles to authenticated;

comment on column public.profiles.deleted_at is
  '탈퇴 시각. 서버(service_role)만 쓴다 — 고객이 직접 쓰면 계정은 탈퇴로 보이는데 구독 청구는 계속되는 상태가 만들어진다(2026-07-31).';

comment on column public.profiles.admin_note is
  '사장님 운영 메모(상담 내용·주의사항). 고객 본인이 못 쓴다 — 쓰기는 PATCH /api/admin/users/[id]/note (관리자 검증 후 service_role). 2026-07-31.';
