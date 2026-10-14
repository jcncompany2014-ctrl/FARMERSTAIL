-- 새 식단 제안 앞당기기 요청 — 어드민이 알레르기를 고친 뒤 '고객에게 변경 제안 보내기' (2026-10-14 C5, 규칙258).
--
-- # 왜
-- 카톡으로 "닭 알레르기가 있어요"를 들은 사장님이 어드민 고객 화면에서 알레르기를 고치면(관리자 수정 설문 행),
-- 박스 계산은 바로 그 값을 읽어 지금 식단에 닭이 있으면 포장 목록에서 '알레르기 확인 필요 — 보내지 마세요'로 멈춘다.
-- 레시피·금액을 바꾸는 건 고객 동의가 필요하다(§13의2, 금액 변경 동의 모달 · 3일 타임아웃) — 어드민이 직접 바꾸지 않는다.
-- 그 동의 흐름을 만드는 곳은 재제안 크론(personalization-progression) 하나뿐이고, 그 크론은 박스 3개마다만 제안한다.
-- 이 표는 "이 강아지는 박스 3개를 기다리지 말고 다음 크론 실행에서 제안을 만들어 달라"는 요청이다. 크론이 같은 경로
-- (decideNextBox → 알레르기 게이트 → 금액 비교 → 승인 대기 + priceChange → 푸시·메일 → 동의 모달 → approve)로 처리한다.
-- 어드민이 식단·금액을 계산하거나 쓰는 코드는 없다(정본을 다시 짜지 않는다).
--
-- # 권한
-- 고객은 읽기·쓰기 불가. 관리자 읽기(is_admin()), 쓰기는 서버(service_role — 어드민 라우트·크론)만.
--
-- ★적용 순서: 코드 배포 전에 적용한다. 크론은 이 표를 못 읽으면 앞당김만 건너뛰고 정기 재제안은 그대로 돈다.

create table if not exists public.formula_proposal_requests (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  -- 보호자(강아지 주인).
  user_id uuid not null,
  reason text not null default 'admin_allergy_edit' check (reason in ('admin_allergy_edit')),
  -- 근거가 된 관리자 수정 설문 행.
  survey_id uuid references public.surveys(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  -- 크론이 살펴본 시각 · 결과. 결과의 자세한 내용(승인 대기·자동 적용)은 dog_formulas 가 정본이다.
  processed_at timestamptz,
  outcome text check (outcome in ('proposed', 'not_proposed')),
  check ((processed_at is null and outcome is null) or (processed_at is not null and outcome is not null))
);

comment on table public.formula_proposal_requests is
  '재제안 크론에 "박스 3개를 기다리지 말고 다음 실행에서 제안" 요청(어드민 알레르기 수정 뒤). 고객 읽기·쓰기 불가. 2026-10-14 C5.';

-- 강아지당 대기 요청 1건 — 두 번 눌러도 하나만.
create unique index if not exists formula_proposal_requests_one_open
  on public.formula_proposal_requests (dog_id)
  where processed_at is null;

alter table public.formula_proposal_requests enable row level security;

revoke all on table public.formula_proposal_requests from anon, authenticated;
grant select on table public.formula_proposal_requests to authenticated;
grant all on table public.formula_proposal_requests to service_role;

drop policy if exists formula_proposal_requests_admin_select on public.formula_proposal_requests;
create policy formula_proposal_requests_admin_select on public.formula_proposal_requests
  for select to authenticated
  using (public.is_admin());

-- 자기 검증.
do $$
begin
  if has_table_privilege('authenticated', 'public.formula_proposal_requests', 'insert')
     or has_table_privilege('authenticated', 'public.formula_proposal_requests', 'update')
     or has_table_privilege('authenticated', 'public.formula_proposal_requests', 'delete')
     or has_table_privilege('anon', 'public.formula_proposal_requests', 'select') then
    raise exception 'formula_proposal_requests 에 고객 쓰기·익명 읽기 권한이 남아 있다';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'formula_proposal_requests' and policyname = 'formula_proposal_requests_admin_select'
  ) then
    raise exception 'formula_proposal_requests 관리자 읽기 정책이 없다';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'formula_proposal_requests' and indexname = 'formula_proposal_requests_one_open'
  ) then
    raise exception '강아지당 대기 요청 1건 인덱스가 없다';
  end if;
end $$;
