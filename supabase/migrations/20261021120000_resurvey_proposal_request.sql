-- 설문을 다시 하면 다음 박스부터 새 설문으로 제안(2026-10-21 사장님 — 서포터즈 낑콩이가 설문을 다시 했는데 박스는 첫 설문 그대로였다).
--
-- # 왜
-- 재제안 크론(personalization-progression)은 '박스 3개마다'만 새 식단을 계산한다. 그래서 정기배송 중인 아이가 설문을 다시 해도
-- 박스는 다음 주기(최대 6주)까지 첫 설문 기준으로 나갔다. 사장님 결정: "바로 다음 박스부터 제안".
-- 어드민 알레르기 수정 때 쓰는 '앞당김 요청'(formula_proposal_requests, 규칙258)을 그대로 쓴다 — 크론이 같은 정본 경로
-- (최신 설문 → decideNextBox → 알레르기 게이트 → 금액 비교 → 바뀌면 고객 동의 · 같으면 조용히)로 처리한다. 계산하는 코드는 새로 없다.
--
-- # 무엇을
--  1) reason 에 'resurvey' 추가.
--  2) surveys 에 새 행이 들어오면(그 강아지의 두 번째 이상 설문) + 그 강아지 정기배송이 진행 중(active + 카드 등록)이면
--     요청 1건을 남긴다. 강아지당 대기 요청은 1건(부분 유일 인덱스) — 이미 있으면 그대로 둔다.
--     어드민 알레르기 수정 라우트가 같은 설문 행 뒤에 직접 넣는 요청은 23505(이미 있음)를 성공으로 읽는다.
--
-- # 권한
-- 트리거 함수는 SECURITY DEFINER(고객은 이 표에 쓸 수 없다) · search_path 고정 · 누구도 직접 부를 수 없게 EXECUTE 회수.

alter table public.formula_proposal_requests drop constraint if exists formula_proposal_requests_reason_check;
alter table public.formula_proposal_requests
  add constraint formula_proposal_requests_reason_check check (reason in ('admin_allergy_edit', 'resurvey'));

create or replace function public.queue_resurvey_proposal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- 첫 설문은 제안할 이전 박스가 없다.
  if not exists (
    select 1 from public.surveys s
    where s.dog_id = new.dog_id and s.id <> new.id and s.created_at <= new.created_at
  ) then
    return new;
  end if;
  -- 진행 중인 정기배송(카드 등록)이 있을 때만. 자격은 크론이 한 번 더 본다(승인 대기 중·다음 회차 있음 등).
  if not exists (
    select 1 from public.subscriptions sub
    where sub.dog_id = new.dog_id and sub.status = 'active' and sub.billing_key is not null
  ) then
    return new;
  end if;
  insert into public.formula_proposal_requests (dog_id, user_id, reason, survey_id)
  values (new.dog_id, new.user_id, 'resurvey', new.id)
  on conflict (dog_id) where processed_at is null do nothing;
  return new;
end;
$$;

revoke all on function public.queue_resurvey_proposal() from public, anon, authenticated;

drop trigger if exists surveys_queue_resurvey_proposal on public.surveys;
create trigger surveys_queue_resurvey_proposal
  after insert on public.surveys
  for each row execute function public.queue_resurvey_proposal();

comment on function public.queue_resurvey_proposal() is
  '다시 한 설문(정기배송 진행 중) → 재제안 크론 앞당김 요청(reason resurvey). 2026-10-21.';

-- 자기 검증.
do $$
begin
  if has_function_privilege('authenticated', 'public.queue_resurvey_proposal()', 'execute')
     or has_function_privilege('anon', 'public.queue_resurvey_proposal()', 'execute') then
    raise exception 'queue_resurvey_proposal 을 고객이 직접 부를 수 있다';
  end if;
  if has_table_privilege('authenticated', 'public.formula_proposal_requests', 'insert') then
    raise exception 'formula_proposal_requests 에 고객 쓰기 권한이 생겼다';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'surveys_queue_resurvey_proposal' and not tgisinternal
  ) then
    raise exception '설문 다시 하기 트리거가 없다';
  end if;
end $$;
