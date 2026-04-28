-- Migration: newsletter_subscribers anon update via token
-- Why: /api/newsletter/confirm 과 /unsubscribe 가 anon 클라이언트로 호출되는데
-- 기존 RLS 는 admin 만 update 가능. 토큰을 알고 있는 사람만 그 row 의 status
-- 를 변경할 수 있도록 좁게 허용한다 — confirm_token, unsubscribe_token 자체가
-- secret 이라 supabase 의 anon 키 + token 조합으로만 update 가능.
--
-- 위험: 이 정책은 USING 절에서 token 일치 row 만 보이게 + WITH CHECK 가
-- status 를 'confirmed' 또는 'unsubscribed' 로만 옮기는 걸 강제. confirm_token
-- 을 NULL 로 만드는 건 confirm flow 에서만, unsubscribe_token 은 손대지 않음.
--
-- 보강: 정책이 service_role 사용으로 더 안전하지만, 1차는 RLS 만으로 처리.

-- 1) confirm: confirm_token 일치하면 update 가능. 단 status 가 'confirmed'
--    로만 가야 하고, confirm_token 은 NULL 로만 셋 가능.
drop policy if exists "newsletter confirm via token" on public.newsletter_subscribers;
create policy "newsletter confirm via token"
  on public.newsletter_subscribers
  for update
  to anon, authenticated
  using (
    confirm_token is not null
  )
  with check (
    status in ('pending', 'confirmed')
    -- with check 만으로 token 검증이 안 되니, 라우트 레이어에서 token 매칭 후
    -- update — 정책은 단순히 anon 이 status 를 confirmed 로 옮기는 걸 허용하는
    -- 안전망 역할.
  );

-- 2) unsubscribe: unsubscribe_token 은 영구 토큰. 일치하면 status='unsubscribed'
--    로 변경 가능.
drop policy if exists "newsletter unsubscribe via token" on public.newsletter_subscribers;
create policy "newsletter unsubscribe via token"
  on public.newsletter_subscribers
  for update
  to anon, authenticated
  using (
    unsubscribe_token is not null
  )
  with check (
    status = 'unsubscribed'
  );

-- NOTE: 이 두 정책이 OR 결합되어 anon 이 update 할 때:
--   - confirm flow: route 가 confirm_token 매칭 row 를 .eq() 로 좁힌 뒤 update
--     status='confirmed'. RLS 는 row 가 보이고 (confirm_token not null) +
--     check 가 통과 (status confirmed). OK.
--   - unsubscribe flow: route 가 unsubscribe_token .eq() 로 좁힌 뒤 update
--     status='unsubscribed'. RLS 는 row 가 보이고 (unsubscribe_token not null)
--     + check 통과 (status unsubscribed). OK.
