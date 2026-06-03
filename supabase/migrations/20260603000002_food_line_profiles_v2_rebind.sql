-- v2.0 ③-A: algorithm_food_lines 전체 프로파일을 skuModel(레시피 v2.1) 정합 +
-- 라인 리바인드 반영 (2026-06-03).
--
-- 리바인드: weight 키 = 닭(체중관리·최저kcal·최저지방), basic 키 = 오리(노블).
-- 임상 룰('weight 라인 = 다이어트' 전제)이 무변경으로 레시피 정합되도록 닭을
-- weight 에 바인딩. 따라서 DB basic/weight 행의 값도 스왑(오리/닭).
--
-- 프로파일 = sheet3 목표 × sheet7 충족률 (protein/fat/Ca/P/Na/vitD),
-- omega 는 USDA 추정. 20260603000001(kcal-only)을 전체 프로파일로 확장.
update public.algorithm_food_lines as a set
  kcal_per_100g            = v.kcal,
  protein_pct_dm           = v.protein,
  fat_pct_dm               = v.fat,
  calcium_pct_dm           = v.ca,
  phosphorus_pct_dm        = v.p,
  sodium_pct_dm            = v.na,
  omega3_pct_dm            = v.o3,
  omega6_pct_dm            = v.o6,
  vitamin_d_iu_per_100g_dm = v.vd,
  updated_at               = now()
from (values
  ('basic',   150, 40.6, 27.5, 0.615, 0.501, 0.193, 0.33, 3.3,  127),  -- 오리
  ('weight',  130, 49.5, 19.1, 0.650, 0.584, 0.179, 0.17, 3.3,   76),  -- 닭
  ('joint',   140, 45.1, 21.8, 0.610, 0.561, 0.140, 0.17, 5.0,   98),  -- 돼지
  ('premium', 160, 38.7, 28.7, 0.587, 0.478, 0.155, 0.10, 1.7,   68),  -- 소
  ('skin',    160, 26.0, 16.0, 1.000, 0.800, 0.350, 6.70, 1.7, 1200)   -- 연어(보류)
) as v(line, kcal, protein, fat, ca, p, na, o3, o6, vd)
where a.line = v.line;
