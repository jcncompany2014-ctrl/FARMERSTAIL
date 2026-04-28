-- Migration: 수의영양학 AI v2 — surveys / dogs / analyses 컬럼 확장
-- Why: 기존 설문(체형/식생활/알레르기/건강 4단계)으로는 평범한 영양 계산기와
-- 차이가 나지 않음. 수의 임상에서 실제로 평가하는 변수들 (BCS 9점, MCS, Bristol
-- 변, 만성질환, 처방식, 복용약, 임신/수유) 을 더 받아 NRC/AAFCO/FEDIAF
-- 가이드라인 분기에 활용한다.
--
-- 모든 컬럼 nullable — 기존 데이터 영향 없음.

-- ── dogs 보강 ───────────────────────────────────────────────
alter table public.dogs
  add column if not exists breed_size text
    check (breed_size is null or breed_size in ('toy', 'small', 'medium', 'large', 'giant')),
  add column if not exists prescription_diet text;

comment on column public.dogs.breed_size is
  '체형 분류 — toy(<5kg) / small(5-10) / medium(10-25) / large(25-45) / giant(45+). 관절·칼슘·인 비율 분기에 사용.';
comment on column public.dogs.prescription_diet is
  '현재 복용 중인 처방식 이름 (없으면 NULL).';

-- ── surveys 보강 ───────────────────────────────────────────
alter table public.surveys
  add column if not exists mcs_score smallint
    check (mcs_score is null or (mcs_score >= 1 and mcs_score <= 4)),
  add column if not exists bristol_stool_score smallint
    check (bristol_stool_score is null or (bristol_stool_score >= 1 and bristol_stool_score <= 7)),
  add column if not exists chronic_conditions text[] default array[]::text[],
  add column if not exists current_medications text[] default array[]::text[],
  add column if not exists current_food_brand text,
  add column if not exists daily_walk_minutes smallint
    check (daily_walk_minutes is null or daily_walk_minutes >= 0),
  add column if not exists coat_condition text
    check (coat_condition is null or coat_condition in ('healthy', 'dull', 'shedding', 'itchy', 'lesions')),
  add column if not exists appetite text
    check (appetite is null or appetite in ('strong', 'normal', 'picky', 'reduced')),
  add column if not exists pregnancy_status text
    check (pregnancy_status is null or pregnancy_status in ('none', 'pregnant', 'lactating'));

comment on column public.surveys.mcs_score is
  'Muscle Condition Score (WSAVA): 1=normal, 2=mild loss, 3=moderate, 4=severe.';
comment on column public.surveys.bristol_stool_score is
  'Bristol Stool Form scale 1~7 — 1=hard pellets (변비), 4=ideal, 7=watery (설사).';
comment on column public.surveys.chronic_conditions is
  '만성질환 (diabetes, kidney, cardiac, pancreatitis, ibd, allergy_skin, arthritis, liver, dental).';
comment on column public.surveys.current_medications is
  '현재 복용 중인 약/보충제 (자유 입력 — admin 검토 시 reference).';

-- ── analyses 보강 ─────────────────────────────────────────
alter table public.analyses
  add column if not exists structured_analysis jsonb,
  add column if not exists risk_flags text[] default array[]::text[],
  add column if not exists vet_consult_recommended boolean not null default false,
  add column if not exists next_review_date date,
  add column if not exists guideline_version text;

comment on column public.analyses.structured_analysis is
  'AI 가 생성한 구조화 분석 — { summary, highlights[], transition_plan, citations[] }';
comment on column public.analyses.risk_flags is
  '위험 신호 (기계적으로 탐지) — 예: [BCS_OVERWEIGHT, KIDNEY_DIET_NEEDED].';
comment on column public.analyses.vet_consult_recommended is
  'true 일 때 UI 가 "수의사 상담 권장" 배너 노출. 만성질환 + 위험 BCS 등 자동 추론.';
comment on column public.analyses.next_review_date is
  '재분석 권장 시점 (보통 +90일). reminder cron 이 활용.';
comment on column public.analyses.guideline_version is
  '계산에 사용된 가이드라인 버전 (예: "NRC2006+AAFCO2024+FEDIAF2021"). 추후 reproducibility 확인.';

-- ── 인덱스 — 만성질환 빈도 분석 (admin 운영) ───────────────
create index if not exists surveys_chronic_idx
  on public.surveys using gin (chronic_conditions);
create index if not exists analyses_risk_flags_idx
  on public.analyses using gin (risk_flags);

-- ── 다음 재분석 reminder cron 용 인덱스 ───────────────────
create index if not exists analyses_next_review_idx
  on public.analyses (next_review_date)
  where next_review_date is not null;
