-- ① 추천엔진 에너지밀도 — 최종 마스터 레시피 v2.1 정합 (2026-06-03)
--
-- 배경: 기존 seed(20260504000001)의 kcal_per_100g (215/175/225/195/200) 은
-- 옛 "화식 5종 영양분석 보고서 v2(2026-04) 이론값" 으로, 실제 화식(73% 수분)의
-- as-fed ~130-160 kcal/100g 대비 과대평가. 이 값으로 일일 급여량(g)을 계산하면
-- 25-40% 과소 급여 → 출시 시 저체중 유발 위험.
--
-- 교정: 최종 레시피 sheet7 설계값 (닭130·오리150·돼지140·소160) 으로 정렬.
-- skin(연어)은 제품 보류 + 추천 게이트 대상이라 실데이터 확정 전까지 미변경.
update public.algorithm_food_lines set
  kcal_per_100g = case line
    when 'basic'   then 130   -- 닭  (sheet11 129.1)
    when 'weight'  then 150   -- 오리 (sheet11 152.2)
    when 'joint'   then 140   -- 돼지 (sheet11 137.9)
    when 'premium' then 160   -- 소  (sheet11 160.6)
    else kcal_per_100g
  end,
  updated_at = now()
where line in ('basic', 'weight', 'joint', 'premium');
