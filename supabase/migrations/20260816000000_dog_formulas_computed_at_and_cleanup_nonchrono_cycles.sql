-- 2026-08-16 4라운드 감사 — dog_formulas 회차·시간 정렬 모순 해소 (2단계).
--
-- # 문제
-- created_at 하나가 두 역할을 겸했다: (a) 재계산 시각(staleness 판정),
-- (b) "가장 새 처방" 정렬 키. compute 가 upsert 마다 created_at 을 덮어써
-- 행 생성 시각이 거짓이 됐고, v3 이전에 만들어진 cycle 2 행이 새 cycle 1 보다
-- **먼저** 생성된 강아지 2마리(둘 다 사장님 계정, 활성 구독 0, FK 참조 0)에서
-- cycle_number 정렬(재제안 크론)과 created_at 정렬(청구·피킹·홈)이 서로 다른
-- 처방을 가리켰다.
--
-- # ① 잔재 2행 삭제 — v2 lineRatios 전용 payload(v3.picks 없음), 삭제 전 원본:
-- {"id":"83150888-ab60-4cdc-a09e-dc00055191ca","dog_id":"63f605f4-c383-4677-ae9e-79c47cde1df1",
--  "user_id":"a5737a47-171b-47d9-aca0-591116b0b0e5","cycle_number":2,
--  "formula":{"toppers":{"protein":0,"vegetable":0},"lineRatios":{"skin":0,"basic":0,"joint":0.8,"weight":0.2,"premium":0}},
--  "daily_kcal":568,"daily_grams":451,"algorithm_version":"v2.0.0","approval_status":"auto_applied",
--  "created_at":"2026-07-10T19:42:20.139924+00"}
-- {"id":"1016a2d8-c077-445c-b632-4b947fe1a0ff","dog_id":"d237d513-5129-45c9-bbcd-b7ad3e906cdb",
--  "user_id":"a5737a47-171b-47d9-aca0-591116b0b0e5","cycle_number":2,
--  "formula":{"toppers":{"protein":0,"vegetable":0},"lineRatios":{"skin":0,"basic":0.5,"joint":0.1,"weight":0.1,"premium":0.3}},
--  "daily_kcal":314,"daily_grams":240,"algorithm_version":"v2.0.0","approval_status":"declined",
--  "created_at":"2026-07-04T19:08:39.827018+00"}
delete from public.dog_formulas
where id in (
  '83150888-ab60-4cdc-a09e-dc00055191ca',
  '1016a2d8-c077-445c-b632-4b947fe1a0ff'
) and cycle_number = 2;

-- # ② 역할 분리 — computed_at(재계산 시각) 신설, created_at 은 행 생성 시각으로 불변화.
-- compute 라우트가 이후 created_at 대신 computed_at 만 갱신한다(코드 커밋과 한 쌍).
alter table public.dog_formulas
  add column if not exists computed_at timestamptz not null default now();

-- 기존 행 백필 — 지금까지의 created_at 이 곧 마지막 재계산 시각이었다.
update public.dog_formulas set computed_at = created_at;
