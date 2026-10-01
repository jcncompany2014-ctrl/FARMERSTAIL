-- 2026-10-01 자견 월간 자동 재계산(사장님 확정 "자동으로 한 달씩 지나면서 계산해 … 한 달에 한 번 정도만 알림").
--
-- analyses 에 자동 갱신 행이 생긴다 — 설문으로 만든 분석과 섞이면 안 되는 곳이 있다:
--   · 재분석 월 3회 한도(survey/page) — 자동 행이 고객 재설문을 막으면 안 된다
--   · 분석 이력 '설문으로 받은 분석 총 N회' · 리포트 월 분석 수 · 어드민 설문↔분석 짝짓기
-- source: 'survey'(설문 제출 — 기존 전부) | 'growth_auto'(성장 자동 재계산, dog-age-update 크론).
-- weight_kg: 그 분석에 쓴 몸무게(실측 또는 성장곡선 추정). 다음 달 "1.5kg → 1.8kg" 안내에 쓴다. 옛 행은 null.
alter table public.analyses add column if not exists source text not null default 'survey';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analyses_source_check') then
    alter table public.analyses add constraint analyses_source_check check (source in ('survey', 'growth_auto'));
  end if;
end $$;
alter table public.analyses add column if not exists weight_kg numeric(5,2);

comment on column public.analyses.source is
  '분석 출처 — survey(설문 제출) | growth_auto(자견 월간 성장 자동 재계산). 재분석 한도·이력·어드민 짝짓기는 survey 만 센다.';
comment on column public.analyses.weight_kg is
  '이 분석에 쓴 몸무게 kg (실측 또는 성장곡선 추정). 2026-10-01 이전 행은 null.';
