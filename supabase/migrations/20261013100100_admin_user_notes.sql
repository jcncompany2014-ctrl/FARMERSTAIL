-- 운영 메모를 관리자만 읽는 표로 옮긴다 — 1단계: 새 표 만들기 (2026-10-13 점검, 규칙197).
--
-- # 왜
-- 사장님 운영 메모(상담 내용·주의사항)가 profiles.admin_note 에 있었다. profiles 는 고객이 **자기 행을
-- 읽을 수 있는** 표라(RLS 본인 SELECT, 칸 권한 전체 SELECT) 고객이 자기 메모를 읽을 수 있었다.
-- 쓰기는 20260731000100 에서 막았지만 읽기는 남아 있었다. 어드민 화면도 "고객 본인도 볼 수 있어요"라고
-- 경고만 띄우고 있었다.
--
-- # 어떻게
-- 1단계(이 파일): admin_user_notes 표를 만들고 옛 메모를 옮긴다. 고객(anon·authenticated)은 쓸 수 없고,
--   읽기는 관리자(is_admin())만. 쓰기는 서버 라우트(app/api/admin/users/[id]/note)가 service_role 로 한다.
-- 2단계(20261013100200): 새 코드가 배포된 뒤 profiles.admin_note 칸을 지운다(비어 있거나 다 옮겨졌을 때만).
--
-- 운영 확인(2026-10-13 SELECT): profiles.admin_note 가 채워진 행 0건. 그래도 옮기는 문장을 둔다(다시 실행 안전).
-- ★적용 순서: 이 파일을 **코드 배포 전에** 적용한다 — 새 코드는 이 표를 읽고 쓴다.

create table if not exists public.admin_user_notes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text not null check (char_length(note) between 1 and 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.admin_user_notes is
  '사장님 운영 메모(고객별 1건). 고객은 읽기·쓰기 불가 — 관리자만 읽고(is_admin), 쓰기는 서버(service_role). 2026-10-13 profiles.admin_note 에서 옮김.';

alter table public.admin_user_notes enable row level security;

revoke all on table public.admin_user_notes from anon, authenticated;
grant select on table public.admin_user_notes to authenticated;
grant all on table public.admin_user_notes to service_role;

drop policy if exists admin_user_notes_admin_select on public.admin_user_notes;
create policy admin_user_notes_admin_select on public.admin_user_notes
  for select to authenticated
  using (public.is_admin());

-- 옛 메모 옮기기 — 칸이 아직 있을 때만(2단계 뒤 다시 실행해도 안전).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'admin_note'
  ) then
    execute $q$
      insert into public.admin_user_notes (user_id, note)
      select p.id, left(btrim(p.admin_note), 2000)
      from public.profiles p
      join auth.users u on u.id = p.id
      where p.admin_note is not null and btrim(p.admin_note) <> ''
      on conflict (user_id) do nothing
    $q$;
  end if;
end $$;

-- 자기 검증 — 고객은 못 쓰고, 관리자 읽기 정책이 있다.
do $$
begin
  if has_table_privilege('authenticated', 'public.admin_user_notes', 'insert')
     or has_table_privilege('authenticated', 'public.admin_user_notes', 'update')
     or has_table_privilege('authenticated', 'public.admin_user_notes', 'delete')
     or has_table_privilege('anon', 'public.admin_user_notes', 'select') then
    raise exception 'admin_user_notes 에 고객 쓰기·익명 읽기 권한이 남아 있다';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_user_notes' and policyname = 'admin_user_notes_admin_select'
  ) then
    raise exception 'admin_user_notes 관리자 읽기 정책이 없다';
  end if;
end $$;
