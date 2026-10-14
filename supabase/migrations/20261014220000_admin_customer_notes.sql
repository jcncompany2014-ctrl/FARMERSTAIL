-- 카톡 문의 기록 — 고객별 시간순 메모 (2026-10-14 어드민 고객 화면 C2, 규칙254).
--
-- # 왜
-- 문의는 카카오톡 채널로 와서 어드민에 흔적이 0이었다. 한 칸짜리 운영 메모(admin_user_notes)는 '기억할 것' 한 덩어리라
-- "10/3 카톡: 배송일 문의 → 10/7 다시 확인" 같은 시간순 기록을 남길 곳이 없었다.
-- admin_user_notes 는 그대로 둔다(고객 화면 맨 위 '기억할 것'). 시간순 기록은 이 새 표에 쌓는다.
--
-- # 다른 화면이 읽는 칸 — 어드민 홈 '오늘 할 일'(B 갈래)
--   follow_up_on (다시 볼 날, KST 날짜) · done (처리 여부)
--   "follow_up_on <= 오늘(KST) and not done" 인 행이 오늘 챙길 일이다. 인덱스 admin_customer_notes_follow_up_idx 가 그 조회용.
--
-- # 권한
-- 고객(anon·authenticated)은 읽지도 쓰지도 못한다. 읽기는 관리자(is_admin())만, 쓰기는 서버 라우트
-- (app/api/admin/users/[id]/notes)가 관리자 확인 뒤 service_role 로 한다 — admin_user_notes 와 같은 원칙.
--
-- ★적용 순서: 이 파일을 **코드 배포 전에** 적용한다 — 새 고객 화면이 이 표를 읽는다(없으면 그 칸만 '불러오지 못했어요').

create table if not exists public.admin_customer_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 문의가 온 날(KST). 기본 = 오늘. 지난 문의를 늦게 적을 때 바꿔 넣는다.
  noted_on date not null default ((now() at time zone 'Asia/Seoul')::date),
  channel text not null default 'kakao'
    check (channel in ('kakao', 'phone', 'instagram', 'email', 'other')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  -- 다시 볼 날(KST). 없으면 할 일에 뜨지 않는다.
  follow_up_on date,
  done boolean not null default false,
  done_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.admin_customer_notes is
  '고객별 시간순 문의 기록(카톡·전화 등). 고객은 읽기·쓰기 불가 — 관리자만 읽고(is_admin), 쓰기는 서버(service_role). '
  '어드민 홈 할 일 = follow_up_on <= 오늘(KST) and not done. 2026-10-14 C2.';
comment on column public.admin_customer_notes.follow_up_on is '다시 볼 날(KST 날짜). 오늘 이하 + done=false 면 어드민 홈 할 일에 뜬다.';
comment on column public.admin_customer_notes.done is '처리 여부. true 면 할 일에서 빠진다.';

create index if not exists admin_customer_notes_user_idx
  on public.admin_customer_notes (user_id, noted_on desc, created_at desc);
create index if not exists admin_customer_notes_follow_up_idx
  on public.admin_customer_notes (follow_up_on)
  where not done and follow_up_on is not null;

drop trigger if exists admin_customer_notes_set_updated_at on public.admin_customer_notes;
create trigger admin_customer_notes_set_updated_at
  before update on public.admin_customer_notes
  for each row execute function public.set_updated_at();

alter table public.admin_customer_notes enable row level security;

revoke all on table public.admin_customer_notes from anon, authenticated;
grant select on table public.admin_customer_notes to authenticated;
grant all on table public.admin_customer_notes to service_role;

drop policy if exists admin_customer_notes_admin_select on public.admin_customer_notes;
create policy admin_customer_notes_admin_select on public.admin_customer_notes
  for select to authenticated
  using (public.is_admin());

-- 자기 검증 — 고객은 못 쓰고 익명은 못 읽고, 관리자 읽기 정책·할 일 칸이 있다.
do $$
begin
  if has_table_privilege('authenticated', 'public.admin_customer_notes', 'insert')
     or has_table_privilege('authenticated', 'public.admin_customer_notes', 'update')
     or has_table_privilege('authenticated', 'public.admin_customer_notes', 'delete')
     or has_table_privilege('anon', 'public.admin_customer_notes', 'select')
     or has_table_privilege('anon', 'public.admin_customer_notes', 'insert') then
    raise exception 'admin_customer_notes 에 고객 쓰기·익명 권한이 남아 있다';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_customer_notes' and policyname = 'admin_customer_notes_admin_select'
  ) then
    raise exception 'admin_customer_notes 관리자 읽기 정책이 없다';
  end if;
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'admin_customer_notes'
        and column_name in ('user_id', 'noted_on', 'body', 'follow_up_on', 'done', 'done_at')) <> 6 then
    raise exception 'admin_customer_notes 칸(user_id·noted_on·body·follow_up_on·done·done_at)이 모자라다 — 어드민 홈 할 일이 이 이름을 읽는다';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.admin_customer_notes'::regclass) then
    raise exception 'admin_customer_notes RLS 가 꺼져 있다';
  end if;
end $$;
