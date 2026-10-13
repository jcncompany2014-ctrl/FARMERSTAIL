-- 운영 메모를 관리자만 읽는 표로 옮긴다 — 2단계: profiles.admin_note 칸 지우기 (2026-10-13 점검, 규칙197).
--
-- ★적용 순서: 20261013100100(새 표) 적용 → 새 코드 배포(메모 화면·탈퇴가 admin_note 를 안 씀) → **그 뒤에** 이 파일.
--   새 코드 배포 전에 지우면 옛 코드의 탈퇴 처리(profiles 익명화가 admin_note: null 을 쓴다)가 '없는 칸'으로
--   실패해 탈퇴 자체가 멈춘다.
--
-- # 조건부
-- 칸이 비어 있거나, 채워진 메모가 전부 admin_user_notes 에 같은 글로 옮겨져 있을 때만 지운다.
-- 하나라도 안 옮겨졌으면 예외로 멈춘다(메모를 잃지 않는다). 칸이 이미 없으면 아무것도 안 한다(다시 실행 안전).
-- 운영 확인(2026-10-13 SELECT): 채워진 admin_note 0건. admin_note 를 참조하는 DB 함수 0개(pg_proc 검색).

do $$
declare
  v_left int;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'admin_note'
  ) then
    return;
  end if;

  execute $q$
    select count(*)
    from public.profiles p
    where p.admin_note is not null and btrim(p.admin_note) <> ''
      and not exists (
        select 1 from public.admin_user_notes n
        where n.user_id = p.id and n.note = left(btrim(p.admin_note), 2000)
      )
  $q$ into v_left;

  if v_left > 0 then
    raise exception 'profiles.admin_note 에 admin_user_notes 로 옮겨지지 않은 메모가 % 건 있다 — 먼저 옮길 것', v_left;
  end if;

  alter table public.profiles drop column admin_note;
end $$;
