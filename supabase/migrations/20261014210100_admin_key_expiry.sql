-- 외부 키 만료일 — 사장님이 설정일을 적는 칸 (2026-10-14 어드민 B4, 규칙252).
--
-- # 왜
-- 만료가 있는 외부 키 두 개가 **응답에도 환경값에도 만료일이 없다**(조사 2026-10-14):
--  · 배송조회 키(tracker.delivery 무료) — 21일마다 만료. 환경값 DELIVERY_TRACKER_CLIENT_ID·SECRET 에는 값만 있고,
--    API 는 만료 전엔 아무 말이 없다가 만료되면 HTTP 200 + UNAUTHENTICATED 를 준다(lib/tracking isTrackerAuthError).
--  · 인스타 DM 장기 토큰 — 60일. 이 앱이 아니라 별도 프로젝트(farmerstail-insta)의 Vercel 환경값에 있다 — 여기서 읽을 수 없다.
-- 그래서 만료 예정일을 계산할 근거는 **사장님이 적는 설정일**뿐이다. 이 표에 설정일(set_on)과 만료일(expires_on)을 두고,
-- 아침 브리핑(daily-briefing)이 7·3·1일 전에 경보함(admin_alerts, 종류 ops.key_expiring)과 브리핑에 올린다.
-- 토스 키는 만료가 없고 '라이브 전환 여부'만 본다 — 환경값 접두사(lib/payments/key-mode)로 판정하므로 여기 행이 없다.
--
-- ★키 값은 여기 없다 — 날짜만. 화면·로그에도 키 값은 내지 않는다(존재·만료일만).
--
-- # 권한
--  · 고객(anon·authenticated) 쓰기 없음. 읽기는 관리자(is_admin())만. 쓰기는 관리자 확인 뒤 app/api/admin/key-expiry 가 service_role 로.
--
-- # 첫 값 (사장님이 화면에서 고칠 수 있다)
--  · 배송조회 키: 2026-10-09 설정 → 2026-10-30 만료(21일) — 작업 지시서 기준.
--  · 인스타 DM 토큰: 2026-09-22 발급 → 2026-11-21 만료(60일) — 운영 메모 기준("11/21경 만료").

create table if not exists public.admin_key_expiry (
  key_name text primary key check (key_name in ('delivery_tracker', 'instagram_dm')),
  set_on date,
  expires_on date,
  note text check (note is null or char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (set_on is null or expires_on is null or expires_on >= set_on)
);

comment on table public.admin_key_expiry is
  '외부 키 만료일(키 값 없음 — 날짜만). 사장님이 설정일을 적고 브리핑이 7·3·1일 전에 경보. 관리자 읽기 · 쓰기는 service_role(어드민 라우트). 2026-10-14.';

alter table public.admin_key_expiry enable row level security;

revoke all on table public.admin_key_expiry from anon, authenticated;
grant select on table public.admin_key_expiry to authenticated;
grant all on table public.admin_key_expiry to service_role;

drop policy if exists admin_key_expiry_admin_select on public.admin_key_expiry;
create policy admin_key_expiry_admin_select on public.admin_key_expiry
  for select to authenticated
  using (public.is_admin());

insert into public.admin_key_expiry (key_name, set_on, expires_on, note)
values
  ('delivery_tracker', date '2026-10-09', date '2026-10-30', '무료 키 21일 — 10/9 설정(작업 지시서 기준). 재발급하면 화면에서 설정일을 바꿔 주세요.'),
  ('instagram_dm', date '2026-09-22', date '2026-11-21', '장기 토큰 60일 — 별도 프로젝트(farmerstail-insta) 환경값. 운영 메모 기준 11/21경 만료.')
on conflict (key_name) do nothing;

-- 자기 검증 — 고객은 못 쓰고 익명은 못 읽고, 관리자 읽기 정책이 있고, 두 키 행이 있다.
do $$
begin
  if has_table_privilege('authenticated', 'public.admin_key_expiry', 'insert')
     or has_table_privilege('authenticated', 'public.admin_key_expiry', 'update')
     or has_table_privilege('authenticated', 'public.admin_key_expiry', 'delete')
     or has_table_privilege('anon', 'public.admin_key_expiry', 'select') then
    raise exception 'admin_key_expiry 에 고객 쓰기·익명 읽기 권한이 남아 있다';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.admin_key_expiry'::regclass) then
    raise exception 'admin_key_expiry 에 RLS 가 꺼져 있다';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_key_expiry' and policyname = 'admin_key_expiry_admin_select'
  ) then
    raise exception 'admin_key_expiry 관리자 읽기 정책이 없다';
  end if;
  if (select count(*) from public.admin_key_expiry where key_name in ('delivery_tracker', 'instagram_dm')) <> 2 then
    raise exception 'admin_key_expiry 첫 값 두 줄이 없다';
  end if;
end $$;
