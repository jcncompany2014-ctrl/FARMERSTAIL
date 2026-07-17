-- algorithm 계수 테이블 SELECT 잠금 (2026-07-17 보안)
--
-- # 문제
-- algorithm_food_lines / algorithm_chronic_severity / algorithm_breed_predispose 가
-- `TO authenticated USING (true)` 라, 아무 계정이나 로그인 후 우리 추천 알고리즘의
-- 튜닝 계수(견종 소인·질환별 보정치·라인 영양계수)를 통째로 덤프할 수 있었다(준영업비밀).
--
-- # 조치 — admin 전용 SELECT
-- 이 계수를 실제로 읽는 곳:
--   · compute API (유저 요청) → service-role(createAdminClient)로 읽게 전환(코드 동시 변경).
--   · personalization cron → 이미 service-role → 영향 없음.
--   · admin 설정 UI → is_admin() 통과.
-- 따라서 authenticated 공개 SELECT 는 불필요 → is_admin() 전용으로 조인다.
-- (INSERT/UPDATE/DELETE 는 원래 admin 전용이라 그대로.)

drop policy if exists algorithm_food_lines_authenticated_read on public.algorithm_food_lines;
create policy algorithm_food_lines_admin_read on public.algorithm_food_lines
  for select using (public.is_admin());

drop policy if exists algorithm_chronic_severity_authenticated_read on public.algorithm_chronic_severity;
create policy algorithm_chronic_severity_admin_read on public.algorithm_chronic_severity
  for select using (public.is_admin());

drop policy if exists algorithm_breed_predispose_authenticated_read on public.algorithm_breed_predispose;
create policy algorithm_breed_predispose_admin_read on public.algorithm_breed_predispose
  for select using (public.is_admin());

comment on table public.algorithm_food_lines is
  '2026-07-17: 준영업비밀(라인 영양계수). SELECT 를 authenticated USING(true) → admin 전용으로 조임. compute 는 service-role 로 읽음. 유저 공개 SELECT 로 되돌리지 말 것.';
