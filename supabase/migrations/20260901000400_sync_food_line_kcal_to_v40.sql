-- 2026-09-01 — algorithm_food_lines 의 kcal 이 v4.0 이전 값에 멈춰 있었다.
--
-- 이 표는 admin override 이고 코드 기본값(lib/personalization/skuModel.ts)을 **이긴다**
-- (lines.ts: `override?.[line]?.kcalPer100g ?? FOOD_LINE_META[line].kcalPer100g`).
-- 2026-07-10 에 그때 코드로 시드됐고(updated_by = null — 사람이 만진 적 없다),
-- 2026-07-18 v4.0 이 kcal 만 바꿨는데 이 표가 안 따라갔다.
--
-- 밀도를 낮게 잡으면 같은 칼로리를 채우는 데 그램이 더 필요해 급여량이 커진다.
-- 실제 음식은 130kcal/100g 이므로 강아지는 목표보다 그만큼 더 먹게 된다:
--   닭 115→130 (+13%) · 오리 120→125 (+4%) · 돼지 115→125 (+9%) · 소 120→145 (+21%)
-- 살 빼려고 고르는 체중관리 라인(닭)이 13% 더 나가고 있었다.
--
-- ⚠️ 사장님이 정하신 **5g 반올림**(boxPricing.mealPortionG)과는 별개다 — 그쪽은
--    최대 2.5g 이고 의도된 것이다. 이건 밀도표가 낡아서 생긴 것이다.
--
-- kcal 외 영양값(단백·지방·칼슘·인·나트륨·오메가·비타민D)은 코드와 일치해 건드리지 않는다.
-- 연어(skin)는 이미 160 이고 아직 미출시다.
--
-- 재발 감시: 소스 테스트로는 DB 값을 못 보므로 런타임에 둔다 —
-- app/api/personalization/compute/route.ts 가 오버라이드와 코드 정본이 5% 넘게
-- 벌어지면 Sentry 경고(`personalization.food_line_kcal_drift`)를 남긴다.
update public.algorithm_food_lines set kcal_per_100g = 130, updated_at = now() where line = 'weight';
update public.algorithm_food_lines set kcal_per_100g = 125, updated_at = now() where line = 'basic';
update public.algorithm_food_lines set kcal_per_100g = 125, updated_at = now() where line = 'joint';
update public.algorithm_food_lines set kcal_per_100g = 145, updated_at = now() where line = 'premium';
