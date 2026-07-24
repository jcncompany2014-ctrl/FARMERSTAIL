-- 2026-07-25 보안 점검(get_advisors) — 20260716030000 lockdown 누락분 완성.
--
-- 배경: 07-16 lockdown 은 내부/트리거 SECURITY DEFINER 함수를
-- `public, anon, authenticated` 셋 다 revoke 하는 게 패턴이었는데, 두 함수가
-- authenticated revoke 를 빠뜨려 로그인 사용자에게 여전히 노출돼 있었다.
--
--  1) record_reward_event(...) — SECURITY DEFINER 인데 p_user_id 를 파라미터로
--     받아 meta_learning_events 에 그대로 INSERT(auth 체크 없음). 로그인 사용자가
--     아무 user_id 로나 ML 밴딧 학습 이벤트를 주입 → 학습 데이터 오염 벡터.
--     07-16 이 public·anon 만 revoke 하고 authenticated 를 놓쳤다. 앱은 이 RPC 를
--     호출하지 않고(service_role 만 grant) 서버 밴딧이 직접 쓰므로 revoke 무해.
--
--  2) prevent_profile_loyalty_change() — 트리거 함수(RETURNS trigger). RPC 로
--     직접 호출될 이유가 없다(호출해도 트리거 컨텍스트 없어 무의미). anon·
--     authenticated 둘 다 노출돼 있어 lockdown 패턴대로 정리.
--
-- service_role 은 이 REVOKE 대상 아님 — 서버측 호출은 그대로 동작.

REVOKE EXECUTE ON FUNCTION public.record_reward_event(text, text, numeric, uuid, jsonb)
  FROM authenticated;

-- 트리거 함수는 PUBLIC 기본 EXECUTE 를 revoke 해야 anon/authenticated 상속이
-- 끊긴다(from anon,authenticated 만으론 PUBLIC 상속이 남아 무효). 트리거 자체는
-- 소유자 권한으로 실행되므로 REVOKE 후에도 정상 동작.
REVOKE EXECUTE ON FUNCTION public.prevent_profile_loyalty_change()
  FROM PUBLIC, anon, authenticated;
