-- subscriptions.user_id → profiles(id) FK 추가.
--
-- 왜: /admin/subscriptions · /admin/subscriptions/calendar · /admin/search-all
-- 세 화면이 `profiles(name, email)` 임베드를 쓰는데, subscriptions.user_id 의
-- FK 가 auth.users 만 가리켜 PostgREST 가 관계를 못 찾았다
-- (PGRST200 "Could not find a relationship" → HTTP 400). 세 화면 모두
-- "구독 목록을 불러오지 못했어요" 상태로 죽어 있었다 (2026-09-05 실측).
--
-- dogs · surveys · analyses 가 이미 같은 패턴(profiles FK, ON DELETE CASCADE)
-- 이고, 추가 전 고아 user_id 0건을 실측했다. 기존 auth.users FK(CASCADE)와
-- 공존한다 — 사용자 삭제 시 profiles 와 subscriptions 가 같은 문장 안에서
-- 함께 cascade 되므로 순서 충돌이 없다.
alter table public.subscriptions
  add constraint subscriptions_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
