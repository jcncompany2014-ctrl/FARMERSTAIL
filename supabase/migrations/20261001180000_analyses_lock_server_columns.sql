-- analyses.source · analyses.weight_kg 는 서버(크론, service_role)만 쓴다 (2026-10-01).
--
-- # 왜
-- 자견 월간 성장 재계산(lib/growth, dog-age-update 크론)이 넣는 분석 행은 추정 체중으로 계산된다.
-- 그 행의 mer 은 등록 체중(dogs.weight)보다 큰 체중 기준이라, 처방 계산(personalization/compute)의
-- 물리적 타당성 검사(isPlausibleMer)가 그 행에 한해 weight_kg 를 기준 체중으로 쓴다.
-- 그런데 analyses 는 고객이 직접 INSERT·UPDATE 할 수 있는 표다(설문 완료·AI 코멘트 캐시).
-- 고객이 source='growth_auto' · weight_kg 를 마음대로 넣을 수 있으면, 그 검사가 고객이 만든 값으로
-- 비켜선다 — mer 은 청구액으로 흐르는 입력이다(AGENTS 규칙2: 탈출구 조건의 생성 주체를 본다).
--
-- # 어떻게
-- 고객 역할(authenticated·anon)로 들어온 쓰기는 이 두 칸을 강제로 되돌린다.
--   INSERT → source='survey', weight_kg=NULL   (고객이 만드는 분석은 언제나 설문 분석)
--   UPDATE → 원래 값 유지
-- service_role(크론)·postgres(마이그레이션)는 그대로 통과한다.
-- 표 권한을 칸 단위로 쪼개지 않는 이유: 설문 INSERT 가 30칸 넘게 쓰고, 한 칸이라도 빠뜨리면
-- 모든 고객의 설문 저장이 멈춘다. 트리거는 두 칸만 만지고 나머지는 건드리지 않는다.
--
-- SECURITY INVOKER(기본) 여야 current_user 가 호출 역할이다 — DEFINER 로 바꾸면 소유자로 읽혀
-- 잠금이 통째로 풀린다.

create or replace function public.analyses_lock_server_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.source := 'survey';
      new.weight_kg := null;
    else
      new.source := old.source;
      new.weight_kg := old.weight_kg;
    end if;
  end if;
  return new;
end;
$$;

comment on function public.analyses_lock_server_columns() is
  '고객 역할의 analyses 쓰기에서 source·weight_kg 를 되돌린다 — 자견 월간 자동 갱신 표식은 서버만(2026-10-01).';

drop trigger if exists analyses_lock_server_columns on public.analyses;
create trigger analyses_lock_server_columns
  before insert or update on public.analyses
  for each row execute function public.analyses_lock_server_columns();
