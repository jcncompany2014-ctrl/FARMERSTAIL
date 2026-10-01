-- 2026-10-01 자견 칼로리 식 교체(NRC 사육장식 → Klein 2019 가정견 식 + FEDIAF 성장곡선 추정, 규칙143) 뒤
-- 이미 저장된 자견 두 마리(펀치·낑콩)의 분석·처방을 새 식으로 재동기화한다.
-- 사장님: "저장된 걸 변경할 수는 없어? 펀치 낑콩이 변경해야 돼" · 서너는 테스트 값이라 제외 · 고객 알림 없음("몰래").
--
-- 값 출처: lib/nutrition.ts calculateNutrition(설문 당시 입력 그대로, 예상 성견체중은 묻지 않고 생일 주령으로 추정)
--   + app/api/personalization/compute/route.ts 504~716행을 같은 lib 함수로 재현해 만든 처방.
-- 카나리아: 같은 재현 경로에 옛 mer(785·236)를 넣으면 저장 처방과 formula·reasoning·transition_strategy·
--   algorithm_version·daily_kcal·daily_grams 가 전부 jsonb/값 일치(2026-10-01 확인). 칼로리 외 분석 칸(단백질%·
--   위험표시·RER)도 저장값과 같다 — 입력 재현이 정확하다.
-- 가드: 옛 값(mer·daily_kcal)일 때만 바꾸고, 정확히 1행씩이 아니면 전체 취소(그사이 재설문·재계산 보호).
-- analyses.created_at 은 그대로(재분석 월 한도·이력 시각 불변). dog_formulas.computed_at = now() 라
--   compute 의 stale 판정(최신 분석 > 처방)에 걸리지 않는다. guideline_version 은 안 올린다(올리면 전원
--   이력 화면에 '재분석 권장' 배너가 떠 변경이 드러난다).
do $$
declare n int;
begin
  -- 다른 DB(브랜치·마이그레이션 재생)에는 이 행들이 없다 — 그때는 아무것도 안 한다.
  select count(*) into n from public.analyses
   where id in ('b3a844d4-7fd1-414b-b45a-6558352ae44a', '3ed2c5f9-88c6-48b3-ac01-09b0a399829f');
  if n = 0 then return; end if;

  -- 펀치: mer 785 → 723 · 박스 707kcal → 651kcal/521g
  update public.analyses set
    rer = 342, mer = 723, factor = 2.11,
    protein_g = 58, fat_g = 18, carb_g = 72, fiber_g = 11,
    feed_g = 496, micronutrients = '{"calcium": {"val": 3.25, "unit": "g", "min": 2.17}, "phosphorus": {"val": 2.53, "unit": "g", "min": 1.81}, "omega6": {"val": 3.62, "unit": "g", "min": 2.39}, "omega3": {"val": 0.36, "unit": "g", "min": 0.14}, "vitA": {"val": 1807.5, "unit": "IU", "min": 903.75}, "vitD": {"val": 180.75, "unit": "IU", "min": 90.38}, "vitE": {"val": 18.07, "unit": "IU", "min": 9.04}, "zinc": {"val": 28.92, "unit": "mg", "min": 18.07}, "iron": {"val": 25.3, "unit": "mg", "min": 15.91}, "copper": {"val": 3.62, "unit": "mg", "min": 2.24}}'::jsonb,
    factor_breakdown = '[{"label": "성장기 기본(크는 몫 포함)", "delta": 2.11}]'::jsonb
  where id = 'b3a844d4-7fd1-414b-b45a-6558352ae44a' and mer = 785;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '펀치 분석 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;
  update public.dog_formulas set
    formula = '{"lineRatios": {"basic": 0, "weight": 0, "skin": 0, "premium": 0, "joint": 1}, "toppers": {"vegetable": 0, "protein": 0}, "v3": {"layerA": {"picks": [{"id": "pork-joint", "protein": "pork", "nameKr": "흑돼지", "ratio": 1, "kcalPer100g": 125, "claims": [{"text": "비타민 B1(티아민)이 풍부한", "grade": "T1", "basis": "충족률 714% — 4 SKU 중 최강 (≥250%)"}, {"text": "기호성이 높아 입맛이 까다롭거나 회복기인 아이에게", "grade": "positioning", "basis": "흑돼지 뒷다리살 기호성 — 매칭용(효능 아님)"}], "isPrimary": true}], "blendedKcalPer100g": 125, "dailyKcal": 723, "dailyGrams": 521, "crossReactWarnings": [], "needsConsultation": false, "scores": [{"protein": "pork", "score": 0.66}, {"protein": "beef", "score": 0.3}], "trace": [{"step": "알레르기 차단", "detail": "치킨 제외 — ''닭·칠면조'' 알레르기와 충돌"}, {"step": "알레르기 차단", "detail": "오리 제외 — ''오리'' 알레르기와 충돌"}, {"step": "need 가중치", "detail": "maintain=0.6, sensitive=0.6"}, {"step": "적합도 점수", "detail": "흑돼지 0.66 · 한우 0.3"}, {"step": "주 SKU", "detail": "흑돼지 (점수 0.66 최고)"}, {"step": "믹스 결정", "detail": "단일 흑돼지 100%"}, {"step": "간식 차감", "detail": "간식 약 10% 만큼 밥 ↓ (총섭취 MER 유지, 10% 룰) — 723 → 651kcal/일"}, {"step": "급여 그램", "detail": "혼합 125kcal/100g · 651kcal/일 → 521g/일"}]}, "layerB": {"routes": [{"concern": "digestion", "sourceId": "source-digestion", "sourceNameKr": "장·소화 보완", "status": "coming_soon", "available": false}], "waitlistConcerns": ["digestion"], "trace": [{"step": "소스 라우팅", "detail": "''digestion'' → 장·소화 보완(준비중 — 대기열)"}]}, "engineVersion": "v3.0.0"}, "needsConsultation": false, "consultationReason": null}'::jsonb,
    reasoning = '[{"trigger": "오리 알레르기", "action": "오리 레시피는 제외했어요 (주재료가 알레르기와 겹쳐요)", "chipLabel": "오리 차단", "priority": 0, "ruleId": "allergy-basic"}, {"trigger": "닭·칠면조 알레르기", "action": "치킨 레시피는 제외했어요 (주재료가 알레르기와 겹쳐요)", "chipLabel": "닭·칠면조 차단", "priority": 0, "ruleId": "allergy-weight"}, {"trigger": "닭·칠면조 알레르기 + 연어 레시피", "action": "닭·칠면조 알레르기견은 연어 도 IgE cross-react 가능 (Bexley 2017/2019, Martín 2004). 차단 안 함, 도입 시 관찰 권장.", "chipLabel": "연어 비슷한 단백질 주의", "priority": 0, "ruleId": "cross-react-skin"}, {"trigger": "맞춤 추천 베이스", "action": "베이스 레시피: 흑돼지 (근거 기반 단백질 선택)", "chipLabel": "맞춤 베이스", "priority": 1, "ruleId": "goal-allergy_avoid"}, {"trigger": "연어 레시피 준비중", "action": "연어 레시피는 준비 중이라 오리로 담았어요. 출시되면 자동으로 반영돼요.", "chipLabel": "연어 → 오리", "priority": 1, "ruleId": "gate-line-skin"}, {"trigger": "12개월 미만 puppy", "action": "성장기라 체중 관리·관절 레시피 대신 오리·한우 위주로 잡았어요", "chipLabel": "아기 강아지 · 성장기 맞춤", "priority": 2, "ruleId": "age-puppy"}, {"trigger": "간식 급여 빈도", "action": "간식 칼로리(약 10%)만큼 화식 양을 줄였어요 — 간식 위에 밥을 풀로 주면 과급·비만 위험이라, 간식은 하루 칼로리의 10% 이내로 유지해 주세요.", "chipLabel": "간식 10% 반영 · 밥 ↓", "priority": 2, "ruleId": "treat-calorie-offset"}, {"trigger": "위장 민감 (자주)", "action": "오리 레시피 위주로 시작해요 — 위장이 적응하면 다른 레시피를 늘려요", "chipLabel": "위장 민감 · 오리 위주", "priority": 6, "ruleId": "gi-sensitive"}, {"trigger": "잘 먹는 고기: 한우, 흑돼지, 양고기", "action": "첫 박스는 선호하신 흑돼지 레시피로 시작해요. 적응을 본 뒤 다음 박스부터 추천 비율을 반영해요.", "chipLabel": "첫 박스 · 선호 흑돼지", "priority": 7, "ruleId": "preferred-first-box"}]'::jsonb,
    daily_kcal = 651, daily_grams = 521, computed_at = now()
  where id = '7f0c518f-bbb9-43ef-9af2-2ddcd7e7d805' and daily_kcal = 707 and cycle_number = 1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '펀치 처방 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;

  -- 낑콩: mer 236 → 218 · 박스 224kcal → 207kcal/166g
  update public.analyses set
    rer = 96, mer = 218, factor = 2.26,
    protein_g = 17, fat_g = 5, carb_g = 22, fiber_g = 3,
    feed_g = 158, micronutrients = '{"calcium": {"val": 0.98, "unit": "g", "min": 0.65}, "phosphorus": {"val": 0.76, "unit": "g", "min": 0.55}, "omega6": {"val": 1.09, "unit": "g", "min": 0.72}, "omega3": {"val": 0.11, "unit": "g", "min": 0.04}, "vitA": {"val": 545, "unit": "IU", "min": 272.5}, "vitD": {"val": 54.5, "unit": "IU", "min": 27.25}, "vitE": {"val": 5.45, "unit": "IU", "min": 2.73}, "zinc": {"val": 8.72, "unit": "mg", "min": 5.45}, "iron": {"val": 7.63, "unit": "mg", "min": 4.8}, "copper": {"val": 1.09, "unit": "mg", "min": 0.68}}'::jsonb,
    factor_breakdown = '[{"label": "성장기 기본(크는 몫 포함)", "delta": 2.26}]'::jsonb
  where id = '3ed2c5f9-88c6-48b3-ac01-09b0a399829f' and mer = 236;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '낑콩 분석 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;
  update public.dog_formulas set
    formula = '{"lineRatios": {"basic": 1, "weight": 0, "skin": 0, "premium": 0, "joint": 0}, "toppers": {"vegetable": 0, "protein": 0}, "v3": {"layerA": {"picks": [{"id": "chicken-basic", "protein": "chicken", "nameKr": "치킨", "ratio": 1, "kcalPer100g": 130, "claims": [{"text": "4 SKU 중 단백질이 가장 진해, 근육 지키며 체중 관리에 적합", "grade": "T2", "basis": "v4.0 조단백 4 SKU 최고 · 최소 급여량(5kg 252g/일). 구 \"저칼로리\" 포지션은 조리수율 가정 붕괴로 폐기"}, {"text": "비타민 B3·B6가 풍부한", "grade": "T1", "basis": "충족률 B3 1246% · B6 871% (≥250%)"}, {"text": "비교적 소화가 수월한 일상식", "grade": "T3", "basis": "저지방 + 균형 단백 메커니즘"}], "isPrimary": true}], "blendedKcalPer100g": 130, "dailyKcal": 218, "dailyGrams": 159, "crossReactWarnings": [], "needsConsultation": false, "scores": [{"protein": "chicken", "score": 0.42}, {"protein": "duck", "score": 0.36}, {"protein": "pork", "score": 0.3}, {"protein": "beef", "score": 0.3}], "trace": [{"step": "need 가중치", "detail": "maintain=0.6"}, {"step": "적합도 점수", "detail": "치킨 0.42 · 오리 0.36 · 흑돼지 0.3 · 한우 0.3"}, {"step": "주 SKU", "detail": "치킨 (점수 0.42 최고)"}, {"step": "믹스 결정", "detail": "단일 치킨 100%"}, {"step": "간식 차감", "detail": "간식 약 5% 만큼 밥 ↓ (총섭취 MER 유지, 10% 룰) — 218 → 207kcal/일"}, {"step": "급여 그램", "detail": "혼합 130kcal/100g · 207kcal/일 → 159g/일"}]}, "layerB": {"routes": [], "waitlistConcerns": [], "trace": []}, "engineVersion": "v3.0.0"}, "needsConsultation": false, "consultationReason": null}'::jsonb,
    reasoning = '[{"trigger": "맞춤 추천 베이스", "action": "베이스 레시피: 치킨 (근거 기반 단백질 선택)", "chipLabel": "맞춤 베이스", "priority": 1, "ruleId": "goal-general_upgrade"}, {"trigger": "12개월 미만 puppy", "action": "성장기라 체중 관리·관절 레시피 대신 오리·한우 위주로 잡았어요", "chipLabel": "아기 강아지 · 성장기 맞춤", "priority": 2, "ruleId": "age-puppy"}, {"trigger": "간식 급여 빈도", "action": "간식 칼로리(약 5%)만큼 화식 양을 줄였어요 — 간식 위에 밥을 풀로 주면 과급·비만 위험이라, 간식은 하루 칼로리의 10% 이내로 유지해 주세요.", "chipLabel": "간식 5% 반영 · 밥 ↓", "priority": 2, "ruleId": "treat-calorie-offset"}, {"trigger": "잘 먹는 고기: 치킨, 오리, 한우, 흑돼지, 양고기", "action": "잘 먹는 고기 레시피에 조금 더 힘을 실었어요", "chipLabel": "선호 단백질 가산", "priority": 7, "ruleId": "preferred-protein-bonus"}, {"trigger": "잘 먹는 고기: 치킨, 오리, 한우, 흑돼지, 양고기", "action": "첫 박스는 선호하신 오리 레시피로 시작해요. 적응을 본 뒤 다음 박스부터 추천 비율을 반영해요.", "chipLabel": "첫 박스 · 선호 오리", "priority": 7, "ruleId": "preferred-first-box"}, {"trigger": "첫 박스", "action": "오리 단독 100%", "chipLabel": "첫 박스는 한 가지로", "priority": 2, "ruleId": "first-box-single-protein"}]'::jsonb,
    daily_kcal = 207, daily_grams = 166, computed_at = now()
  where id = '8e4eebf8-c206-4207-8008-25848d3bb17c' and daily_kcal = 224 and cycle_number = 1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '낑콩 처방 갱신 행 수 % (1 이어야 함) — 그사이 바뀜, 전체 취소', n; end if;
end $$;
