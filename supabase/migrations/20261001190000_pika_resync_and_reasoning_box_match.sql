-- 2026-10-01 ① 피카 옛 자견 공식 값 재동기화 ② 저장된 처방 근거에서 최종 박스에 없는 레시피를 말하는 문구 정리.
-- 사장님: "피카 새 공식 값으로 바꿀까요? ㅇㅇ 몰래 바꿔놔" · "'베이스: 치킨' 칩은 최종 박스와 안 맞아서 헷갈려요 … ㅇㅇ 칩도 지워
--   앞으로도 이런 헷갈리는 일 없게". 코드 쪽은 lib/personalization/reasoning-final(근거↔박스 대조)·clinical-exclusions.
--
-- ① 피카(서포터즈, 5.1kg 14주): 설문 11:49 < 새 자견 식 배포 15:22 라 옛 '간이 근사 ×3'(734kcal)이 남았다
--    (펀치·낑콩 재동기화 481b4b80 때 누락). 값 출처 = 현재 compute 라우트를 같은 lib 함수로 재현(scratchpad regen_pika).
--    카나리아: 같은 재현에 옛 mer(734·504)를 넣으면 저장 처방 formula·전환·버전·kcal·g 가 jsonb/값 일치,
--    정기배송 102,900원·160g×14·단가 7,350 일치(근거 칩은 이번 규칙으로 달라지는 게 맞다).
--    바뀌는 분석 칸: 9개 — mer, factor, protein_g, fat_g, carb_g, fiber_g, feed_g, micronutrients, factor_breakdown
--    정기배송은 카드 미등록·청구 0회일 때만(가드). 서포터즈 100원 구간은 그대로. 고객 알림 없음.
-- ② 근거 9건: 베이스 칩이 박스에 없는 레시피를 말함(낑콩·달·땅콩·서너·푸따냐·푸린) → 빼거나 박스 레시피만 남김,
--    레시피 문장 뒤 안전 안내가 붙은 칩(로아 스테로이드·푸따냐 슬개골)은 안내만 남김, 'v3 맞춤 베이스' 내부 버전 이름 정리.
--    각 문구는 지금 저장된 문구와 정확히 같을 때만 바뀐다(가드). 비율·kcal·금액 불변.
-- 신장·간·요로결석 강아지는 0마리 — 한우 재유입(코드에서 막음)이 실제로 나간 적은 없다(2026-10-01 조회).
do $$
declare n int;
begin
  -- 다른 DB(브랜치·마이그레이션 재생)에는 이 행들이 없다 — 그때는 아무것도 안 한다.
  select count(*) into n from public.analyses where id = '48342a0c-cbdf-404d-a0ff-b087395bc5c1';
  if n = 0 then return; end if;

  -- ── 피카 분석: mer 734 → 647 (옛 '간이 근사 ×3' → Klein 가정견 자견 식) ──
  update public.analyses set
    mer = 647,
    factor = 2.65,
    protein_g = 52,
    fat_g = 16,
    carb_g = 65,
    fiber_g = 10,
    feed_g = 443,
    micronutrients = '{"calcium":{"val":2.91,"unit":"g","min":1.94},"phosphorus":{"val":2.26,"unit":"g","min":1.62},"omega6":{"val":3.23,"unit":"g","min":2.14},"omega3":{"val":0.32,"unit":"g","min":0.13},"vitA":{"val":1617.5,"unit":"IU","min":808.75},"vitD":{"val":161.75,"unit":"IU","min":80.88},"vitE":{"val":16.18,"unit":"IU","min":8.09},"zinc":{"val":25.88,"unit":"mg","min":16.18},"iron":{"val":22.64,"unit":"mg","min":14.23},"copper":{"val":3.23,"unit":"mg","min":2.01}}'::jsonb,
    factor_breakdown = '[{"label":"성장기 기본(크는 몫 포함)","delta":2.65}]'::jsonb
  where id = '48342a0c-cbdf-404d-a0ff-b087395bc5c1' and mer = 734;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '피카 분석 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;

  -- ── 피카 처방: 661kcal/529g → 582kcal/466g · 오리 100% 그대로 · 근거는 박스 기준 ──
  update public.dog_formulas set
    formula = '{"lineRatios":{"basic":1,"weight":0,"skin":0,"premium":0,"joint":0},"toppers":{"vegetable":0,"protein":0},"v3":{"layerA":{"picks":[{"id":"chicken-basic","protein":"chicken","nameKr":"치킨","ratio":1,"kcalPer100g":130,"claims":[{"text":"4 SKU 중 단백질이 가장 진해, 근육 지키며 체중 관리에 적합","grade":"T2","basis":"v4.0 조단백 4 SKU 최고 · 최소 급여량(5kg 252g/일). 구 \"저칼로리\" 포지션은 조리수율 가정 붕괴로 폐기"},{"text":"비타민 B3·B6가 풍부한","grade":"T1","basis":"충족률 B3 1246% · B6 871% (≥250%)"},{"text":"비교적 소화가 수월한 일상식","grade":"T3","basis":"저지방 + 균형 단백 메커니즘"}],"isPrimary":true}],"blendedKcalPer100g":130,"dailyKcal":647,"dailyGrams":448,"crossReactWarnings":[],"needsConsultation":false,"scores":[{"protein":"chicken","score":0.42},{"protein":"duck","score":0.36},{"protein":"pork","score":0.3},{"protein":"beef","score":0.3}],"trace":[{"step":"need 가중치","detail":"maintain=0.6"},{"step":"적합도 점수","detail":"치킨 0.42 · 오리 0.36 · 흑돼지 0.3 · 한우 0.3"},{"step":"주 SKU","detail":"치킨 (점수 0.42 최고)"},{"step":"믹스 결정","detail":"단일 치킨 100%"},{"step":"간식 차감","detail":"간식 약 10% 만큼 밥 ↓ (총섭취 MER 유지, 10% 룰) — 647 → 582kcal/일"},{"step":"급여 그램","detail":"혼합 130kcal/100g · 582kcal/일 → 448g/일"}]},"layerB":{"routes":[],"waitlistConcerns":[],"trace":[]},"engineVersion":"v3.0.0"},"needsConsultation":false,"consultationReason":null}'::jsonb,
    reasoning = '[{"trigger":"12개월 미만 puppy","action":"성장기라 체중 관리·관절 레시피 대신 오리 위주로 잡았어요","chipLabel":"아기 강아지 · 성장기 맞춤","priority":2,"ruleId":"age-puppy","promisedLines":["basic","premium"]},{"trigger":"간식 급여 빈도","action":"간식 칼로리(약 10%)만큼 화식 양을 줄였어요 — 간식 위에 밥을 풀로 주면 과급·비만 위험이라, 간식은 하루 칼로리의 10% 이내로 유지해 주세요.","chipLabel":"간식 10% 반영 · 밥 ↓","priority":2,"ruleId":"treat-calorie-offset"},{"trigger":"첫 박스","action":"오리 단독 100%","chipLabel":"첫 박스는 한 가지로","priority":2,"ruleId":"first-box-single-protein"}]'::jsonb,
    daily_kcal = 582, daily_grams = 466, computed_at = now()
  where id = 'dc9565da-f841-4cb2-af0c-eda2f090d9ac' and daily_kcal = 661 and daily_grams = 529 and cycle_number = 1
    and transition_strategy = 'conservative' and algorithm_version = 'v2.0.0';
  get diagnostics n = row_count;
  if n <> 1 then raise exception '피카 처방 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;

  -- ── 피카 정기배송: 정가 102,900 → 90,000원 · 카드 미등록·청구 0회일 때만 ──
  update public.subscriptions set subtotal = 90000, total_amount = 90000
  where id = '2f5ea5e6-d8e6-4074-a805-a592b8c8d9ef' and total_amount = 102900 and subtotal = 102900
    and billing_key is null and total_deliveries = 0 and shipping_fee = 0;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '피카 정기배송 갱신 행 수 % (1 이어야 함) — 카드 등록·청구됐거나 바뀜, 전체 취소', n; end if;
  update public.subscription_items set product_name = '오리고기 화식 (140g 한 끼)', unit_price = 6430
  where subscription_id = '2f5ea5e6-d8e6-4074-a805-a592b8c8d9ef' and product_name = '오리고기 화식 (160g 한 끼)' and unit_price = 7350 and quantity = 14;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '피카 품목 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;

  -- ── 저장된 근거 정리 — 최종 박스에 없는 레시피를 말하는 문구(사장님 "칩도 지워") ──
  -- 낑콩: 뺌 goal-general_upgrade
  update public.dog_formulas set reasoning = (select coalesce(jsonb_agg(x order by o), '[]'::jsonb) from jsonb_array_elements(reasoning) with ordinality t(x, o) where not (x->>'ruleId' = 'goal-general_upgrade' and x->>'action' = '베이스 레시피: 치킨 (근거 기반 단백질 선택)'))
  where id = '8e4eebf8-c206-4207-8008-25848d3bb17c' and reasoning @> '[{"ruleId":"goal-general_upgrade","action":"베이스 레시피: 치킨 (근거 기반 단백질 선택)"}]'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '낑콩 goal-general_upgrade 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;

  -- 낑콩: 고침 age-puppy
  update public.dog_formulas set reasoning = (select jsonb_agg(case when x->>'ruleId' = 'age-puppy' and x->>'action' = '성장기라 체중 관리·관절 레시피 대신 오리·한우 위주로 잡았어요' then jsonb_set(x, '{action}', to_jsonb('성장기라 체중 관리·관절 레시피 대신 오리 위주로 잡았어요'::text)) else x end order by o) from jsonb_array_elements(reasoning) with ordinality t(x, o))
  where id = '8e4eebf8-c206-4207-8008-25848d3bb17c' and reasoning @> '[{"ruleId":"age-puppy","action":"성장기라 체중 관리·관절 레시피 대신 오리·한우 위주로 잡았어요"}]'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '낑콩 age-puppy 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;

  -- 달: 뺌 goal-joint_senior
  update public.dog_formulas set reasoning = (select coalesce(jsonb_agg(x order by o), '[]'::jsonb) from jsonb_array_elements(reasoning) with ordinality t(x, o) where not (x->>'ruleId' = 'goal-joint_senior' and x->>'action' = '베이스 레시피: 흑돼지 (근거 기반 단백질 선택)'))
  where id = '78af5bad-ba6a-4db3-b422-9aafb39a8bd6' and reasoning @> '[{"ruleId":"goal-joint_senior","action":"베이스 레시피: 흑돼지 (근거 기반 단백질 선택)"}]'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '달 goal-joint_senior 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;

  -- 땅콩(치킨): 고침 goal-weight_management
  update public.dog_formulas set reasoning = (select jsonb_agg(case when x->>'ruleId' = 'goal-weight_management' and x->>'action' = '베이스 레시피: 치킨 · 흑돼지 (근거 기반 단백질 선택)' then jsonb_set(x, '{action}', to_jsonb('베이스 레시피: 치킨 (근거 기반 단백질 선택)'::text)) else x end order by o) from jsonb_array_elements(reasoning) with ordinality t(x, o))
  where id = '7589a3d2-3ec3-4755-a9bc-c995231dbf2a' and reasoning @> '[{"ruleId":"goal-weight_management","action":"베이스 레시피: 치킨 · 흑돼지 (근거 기반 단백질 선택)"}]'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '땅콩(치킨) goal-weight_management 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;

  -- 땅콩(흑돼지): 뺌 goal-weight_management
  update public.dog_formulas set reasoning = (select coalesce(jsonb_agg(x order by o), '[]'::jsonb) from jsonb_array_elements(reasoning) with ordinality t(x, o) where not (x->>'ruleId' = 'goal-weight_management' and x->>'action' = '베이스 레시피: 치킨 (근거 기반 단백질 선택)'))
  where id = '4de73f3b-e1dd-49f4-9d35-37ee66602e0e' and reasoning @> '[{"ruleId":"goal-weight_management","action":"베이스 레시피: 치킨 (근거 기반 단백질 선택)"}]'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '땅콩(흑돼지) goal-weight_management 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;

  -- 로아: 고침 chronic-long-term-steroid
  update public.dog_formulas set reasoning = (select jsonb_agg(case when x->>'ruleId' = 'chronic-long-term-steroid' and x->>'action' = '관절 보강 레시피(흑돼지, 콜라겐 + Ca) 비중을 올렸어요 — Ca/P 손실 보충 (Plumb 9e). 체형 / 혈당 정기 모니터링 (의인성 비만/당뇨 위험).' then jsonb_set(x, '{action}', to_jsonb('Ca/P 손실 보충이 필요해요 (Plumb 9e). 체형 / 혈당 정기 모니터링 (의인성 비만/당뇨 위험).'::text)) else x end order by o) from jsonb_array_elements(reasoning) with ordinality t(x, o))
  where id = 'd7ef66c6-886b-4f79-b8e7-65b0c07eae22' and reasoning @> '[{"ruleId":"chronic-long-term-steroid","action":"관절 보강 레시피(흑돼지, 콜라겐 + Ca) 비중을 올렸어요 — Ca/P 손실 보충 (Plumb 9e). 체형 / 혈당 정기 모니터링 (의인성 비만/당뇨 위험)."}]'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '로아 chronic-long-term-steroid 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;

  -- 서너: 뺌 goal-joint_senior
  update public.dog_formulas set reasoning = (select coalesce(jsonb_agg(x order by o), '[]'::jsonb) from jsonb_array_elements(reasoning) with ordinality t(x, o) where not (x->>'ruleId' = 'goal-joint_senior' and x->>'action' = '베이스 레시피: 치킨 (근거 기반 단백질 선택)'))
  where id = '39487372-b01c-4d17-811d-e0ff103bcb5e' and reasoning @> '[{"ruleId":"goal-joint_senior","action":"베이스 레시피: 치킨 (근거 기반 단백질 선택)"}]'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '서너 goal-joint_senior 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;

  -- 서너: 뺌 bcs-overweight
  update public.dog_formulas set reasoning = (select coalesce(jsonb_agg(x order by o), '[]'::jsonb) from jsonb_array_elements(reasoning) with ordinality t(x, o) where not (x->>'ruleId' = 'bcs-overweight' and x->>'action' = '체중 관리 레시피(치킨) 비중을 올렸어요'))
  where id = '39487372-b01c-4d17-811d-e0ff103bcb5e' and reasoning @> '[{"ruleId":"bcs-overweight","action":"체중 관리 레시피(치킨) 비중을 올렸어요"}]'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '서너 bcs-overweight 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;

  -- 서너: 뺌 weight-trend-active-gain
  update public.dog_formulas set reasoning = (select coalesce(jsonb_agg(x order by o), '[]'::jsonb) from jsonb_array_elements(reasoning) with ordinality t(x, o) where not (x->>'ruleId' = 'weight-trend-active-gain' and x->>'action' = '체중 관리 레시피(치킨) 비중을 더 올렸어요 (적극 관리)'))
  where id = '39487372-b01c-4d17-811d-e0ff103bcb5e' and reasoning @> '[{"ruleId":"weight-trend-active-gain","action":"체중 관리 레시피(치킨) 비중을 더 올렸어요 (적극 관리)"}]'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '서너 weight-trend-active-gain 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;

  -- 푸따냐: 뺌 goal-weight_management
  update public.dog_formulas set reasoning = (select coalesce(jsonb_agg(x order by o), '[]'::jsonb) from jsonb_array_elements(reasoning) with ordinality t(x, o) where not (x->>'ruleId' = 'goal-weight_management' and x->>'action' = '베이스 레시피: 치킨 (근거 기반 단백질 선택)'))
  where id = '586df028-f575-45fc-b0e4-d0d2a997b869' and reasoning @> '[{"ruleId":"goal-weight_management","action":"베이스 레시피: 치킨 (근거 기반 단백질 선택)"}]'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '푸따냐 goal-weight_management 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;

  -- 푸따냐: 고침 chronic-musculoskeletal
  update public.dog_formulas set reasoning = (select jsonb_agg(case when x->>'ruleId' = 'chronic-musculoskeletal' and x->>'action' = '체중 관리 레시피(치킨) 비중을 올렸어요 — 비만이 악화 요인. 글루코사민·EPA 보조 권장 (Brisson 2010 Vet Clin 40:829, LaFond 2002 JAAHA 38:467).' then jsonb_set(x, '{action}', to_jsonb('비만이 악화 요인이라 체중 관리가 중요해요. 글루코사민·EPA 보조 권장 (Brisson 2010 Vet Clin 40:829, LaFond 2002 JAAHA 38:467).'::text)) else x end order by o) from jsonb_array_elements(reasoning) with ordinality t(x, o))
  where id = '586df028-f575-45fc-b0e4-d0d2a997b869' and reasoning @> '[{"ruleId":"chronic-musculoskeletal","action":"체중 관리 레시피(치킨) 비중을 올렸어요 — 비만이 악화 요인. 글루코사민·EPA 보조 권장 (Brisson 2010 Vet Clin 40:829, LaFond 2002 JAAHA 38:467)."}]'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '푸따냐 chronic-musculoskeletal 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;

  -- 푸린(흑돼지): 뺌 goal-joint_senior
  update public.dog_formulas set reasoning = (select coalesce(jsonb_agg(x order by o), '[]'::jsonb) from jsonb_array_elements(reasoning) with ordinality t(x, o) where not (x->>'ruleId' = 'goal-joint_senior' and x->>'action' = '베이스 레시피: 치킨 (근거 기반 단백질 선택)'))
  where id = '604f60fd-2df9-469f-baa7-c9846bcdc169' and reasoning @> '[{"ruleId":"goal-joint_senior","action":"베이스 레시피: 치킨 (근거 기반 단백질 선택)"}]'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '푸린(흑돼지) goal-joint_senior 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;

  -- 푸린(치킨): 고침 goal-general_upgrade
  update public.dog_formulas set reasoning = (select jsonb_agg(case when x->>'ruleId' = 'goal-general_upgrade' and x->>'chipLabel' = 'v3 맞춤 베이스' then jsonb_set(x, '{chipLabel}', to_jsonb('맞춤 베이스'::text)) else x end order by o) from jsonb_array_elements(reasoning) with ordinality t(x, o))
  where id = 'b3630acb-b637-4d90-8ff0-8168978d333e' and reasoning @> '[{"ruleId":"goal-general_upgrade","chipLabel":"v3 맞춤 베이스"}]'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '푸린(치킨) goal-general_upgrade 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;
end $$;
