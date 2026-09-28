# 배합 계산기 (Light 초저지방 · 냉동 소스 기획용, 2026-09-28)

기획서 `docs/SAUCE_AND_LIGHT_LINE_PLAN_2026_10.md` 7장의 숫자를 다시 만드는 스크립트. 앱 코드와 무관(빌드·테스트 대상 아님).

- `formula.py` — v4.0 마스터레시피 방식 계산기: 생 기준 배합비 · 수비드 수율≈100% · Atwater 4/9/4 ·
  시트3 채택값 MAX(FEDIAF,AAFCO)×1.15 per 1000kcal 대조. 프리믹스 v1.4 = 사양 + 2026-07 실측 역산(Ca 9.24 · P 7.97%)
- `fdc_data.json` — USDA FoodData Central **SR Legacy**(2018-04) 원료 35종 발췌. 원본 CSV(약 6MB zip)는
  `https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip` → `usda/` 에 풀고
  `python fdc_from_csv.py` 로 재생성
- 실행: `python run_validate.py`(현 4종 검산) · `run_light_final.py`(Light E안) · `run_lowfat*.py`(비교안) ·
  `run_salmon_cost.py`(연어유 유무·원가) · `run_sauce_safety.py` / `run_sauce_cap.py`(소스 오메가3 vs NRC 상한)

⚠ 이론치다. 지방은 이론이 공인검정 실측보다 ~1%p 높게 나온다(공정 잔류). 명태·황태·감자·해바라기유·흰쌀 단가,
타우린·요오드 일부 값은 추정(⚠). 성분등록 전에 시제품 공인분석으로 확정한다.
