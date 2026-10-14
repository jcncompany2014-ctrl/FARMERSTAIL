-- 서포터즈 가격 인상 동의 기록 (2026-10-14 어드민 강화 A1, 규칙241).
--
-- # 왜
-- 서포터즈 6명은 100원(10/20·11/3·11/17) → 반값(12/1 첫 회) → 정가(2027-01-23 첫 회)로 값이 오른다.
-- 정기결제 대금을 올리려면 고객의 동의가 있어야 하는데(전자상거래법 2025-02 개정), 동의를 받았는지가 어디에도
-- 남지 않았다 — 사장님이 인스타 DM 으로 받아도 기억에만 있었다. 그래서 동의 기록을 남기고, 청구 크론은
-- **가격이 오르는 회차인데 그 인상의 동의 기록이 없으면 청구하지 않고 보류**한다(20261014200100 의 보류 표).
--
-- # 왜 subscription_trials 의 칸이 아니라 새 표인가 (누가 판단해도 되게 적어 둔다)
--  1) 인상이 사람마다 두 번(100원→반값, 반값→정가)이다 — 칸으로 두면 '언제·경로·메모·기록자·취소'가 두 벌 = 10칸이 넘는다.
--  2) 기록을 '취소'해도 지우지 않고 남겨야 한다(누가 언제 왜 취소했는지가 증빙이다) — 한 사람에 여러 행이 필요하다.
--  3) 도장을 떼면(어드민 '취소') subscription_trials 행이 **지워진다**(app/api/admin/trials DELETE). 동의 증빙이 같이
--     사라지면 안 된다.
--  4) subscription_trials 는 청구 크론이 결제마다 회차를 깎는 표다 — 사람이 쓰는 증빙과 기계가 쓰는 돈 상태를 섞지 않는다.
--
-- # 권한
-- 고객(anon·authenticated)은 쓸 수 없다. 읽기는 관리자(is_admin())만. 쓰기는 서버 라우트
-- (app/api/admin/trials/consents)가 관리자 확인 뒤 service_role 로 한다. 청구 크론도 service_role 로 읽는다.
--
-- ★적용 순서: 이 파일 → 20261014200100 → 코드 배포. 새 코드는 이 표를 읽는다 — 표가 없으면 서포터즈 청구가
--   '동의 조회 실패'로 건너뛰어진다(모르면 긁지 않는다). 운영 확인(2026-10-14 SELECT): 서포터즈 6명 모두
--   100원 3회 남음 → 첫 인상 회차는 12/1 이라 지금 적용해도 당장 막히는 청구는 없다.

create table if not exists public.subscription_price_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 어느 인상인가 — to_half = 100원 → 반값, to_full = 반값(또는 100원) → 정가.
  rise text not null check (rise in ('to_half', 'to_full')),
  -- 고객이 동의한 날(KST 날짜). 미래 날짜는 서버 라우트가 막는다.
  consented_on date not null,
  -- 어떤 경로로 받았나.
  channel text not null check (channel in ('instagram_dm', 'kakao', 'sms', 'phone', 'email', 'in_person', 'other')),
  memo text not null default '' check (char_length(memo) <= 500),
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- 기록 취소 — 지우지 않고 표시만 한다(증빙).
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoke_reason text check (revoke_reason is null or char_length(revoke_reason) <= 300),
  check (consented_on >= date '2026-09-01')
);

comment on table public.subscription_price_consents is
  '서포터즈 가격 인상(100원→반값 / 반값→정가) 고객 동의 기록. 청구 크론은 인상 회차에 유효한 기록(revoked_at null)이 없으면 청구를 보류한다. 고객 쓰기 불가 — 관리자 읽기(is_admin)·서버 쓰기(service_role). 2026-10-14 A1.';

-- 한 사람·한 인상에 유효한 기록은 하나 — 취소된 기록은 몇 개든 남는다.
create unique index if not exists subscription_price_consents_active_uniq
  on public.subscription_price_consents (user_id, rise)
  where revoked_at is null;

create index if not exists subscription_price_consents_user_idx
  on public.subscription_price_consents (user_id);

alter table public.subscription_price_consents enable row level security;

revoke all on table public.subscription_price_consents from anon, authenticated;
grant select on table public.subscription_price_consents to authenticated;
grant all on table public.subscription_price_consents to service_role;

drop policy if exists subscription_price_consents_admin_select on public.subscription_price_consents;
create policy subscription_price_consents_admin_select on public.subscription_price_consents
  for select to authenticated
  using (public.is_admin());

-- 자기 검증 — 고객은 못 쓰고 익명은 못 읽으며, RLS 가 켜져 있고 관리자 읽기 정책이 있다.
do $$
begin
  if has_table_privilege('authenticated', 'public.subscription_price_consents', 'insert')
     or has_table_privilege('authenticated', 'public.subscription_price_consents', 'update')
     or has_table_privilege('authenticated', 'public.subscription_price_consents', 'delete')
     or has_table_privilege('anon', 'public.subscription_price_consents', 'select')
     or has_table_privilege('anon', 'public.subscription_price_consents', 'insert') then
    raise exception 'subscription_price_consents 에 고객 쓰기·익명 권한이 남아 있다';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.subscription_price_consents'::regclass) then
    raise exception 'subscription_price_consents RLS 가 꺼져 있다';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscription_price_consents'
      and policyname = 'subscription_price_consents_admin_select'
  ) then
    raise exception 'subscription_price_consents 관리자 읽기 정책이 없다';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscription_price_consents' and cmd <> 'SELECT'
  ) then
    raise exception 'subscription_price_consents 에 SELECT 아닌 정책이 있다 — 쓰기는 service_role 만';
  end if;
end $$;
