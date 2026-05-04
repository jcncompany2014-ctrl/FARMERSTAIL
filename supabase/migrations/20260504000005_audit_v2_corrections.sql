-- ============================================================================
-- Migration: audit v2 corrections (v1.6) — 14 인용 정정 + 6 한국 품종 추가
-- ============================================================================
--
-- 학술 인용 audit (2026-05-04 sub-agent) 결과 fix:
--   1. 5 품종 인용 정정 (boxer/labrador/rottweiler/saint_bernard/poodle/shiba/etc)
--   2. 6 한국 인기 품종 추가 (포메/요키/비숑/코기/닥스훈트/진돗개)
--   3. 코드 cite 정정 (Heath 2007 / Pan 2010 / Wakshlag 2014 / Bexley 2019)
--   4. 약물 매핑 정정 (pancreatin EPI 분리, metformin 제거, apoquel/cytopoint
--      /levothyroxine/trilostane 추가)
--   5. 신규 ChronicConditionKey 7개 (epi/hypothyroid/cushings/patellar_luxation
--      /ivdd/tracheal_collapse/mmvd)
--
-- 본 SQL 은 algorithm_breed_predispose 변경만 — 코드 변경은 git diff 참조.
-- ============================================================================

-- ── 5 품종 인용 정정 ────────────────────────────────────────────────
UPDATE algorithm_breed_predispose SET citations = ARRAY[
  'Meurs et al. (2013) JVIM 27(6):1437-1440 — boxer striatin'
] WHERE breed_key = 'boxer';

UPDATE algorithm_breed_predispose SET citations = ARRAY[
  'Smith et al. (2001) JAVMA 219(12):1719-1724 — DJD with HD',
  'German (2006) J Nutr 136:1940S — 비만 prevalence'
] WHERE breed_key = 'labrador';

UPDATE algorithm_breed_predispose SET citations = ARRAY[
  'Smith et al. (2001) JAVMA 219(12):1719-1724 — large breed DJD',
  'AAFCO 2024 Large-size Growth — Ca 1.8% DM cap'
] WHERE breed_key = 'rottweiler';

UPDATE algorithm_breed_predispose SET citations = ARRAY[
  'Vollmar (2000) J Am Anim Hosp Assoc 36:125 — DCM in 77 St. Bernard',
  'Hazewinkel & Tryfonidou (2002) Mol Cell Endocrinol 197:23-33'
] WHERE breed_key = 'saint_bernard';

UPDATE algorithm_breed_predispose SET citations = ARRAY[
  'Berendt et al. (2002) JAVMA 220(11):1648 — idiopathic epilepsy in standard poodles'
],
predispose_conditions = ARRAY['epilepsy'],
cautions = ARRAY['Standard Poodle 특발성 간질 호발 — ketogenic 영양 검토 (Berendt 2002)']
WHERE breed_key = 'poodle';

UPDATE algorithm_breed_predispose SET citations = ARRAY[
  'Picco et al. (2008) Vet Dermatol 19:150 — allergic skin disease prevalence by breed'
] WHERE breed_key = 'shiba';

UPDATE algorithm_breed_predispose SET citations = ARRAY[
  'Borgarelli & Buchanan (2012) J Vet Cardiol 14(1):93-101 — MMVD review'
] WHERE breed_key IN ('chihuahua', 'maltese');

UPDATE algorithm_breed_predispose SET citations = ARRAY[
  'Stephenson et al. (2012) JVIM 26:1305 — Great Dane DCM',
  'Meurs et al. (2001) JVIM 15:51'
] WHERE breed_key = 'great_dane';

UPDATE algorithm_breed_predispose SET citations = ARRAY[
  'Wess et al. (2010) JVIM 24:533 — Doberman DCM',
  'Meurs et al. (2007) JVIM 21:1016 — DCM SNP in Doberman'
] WHERE breed_key = 'doberman';

UPDATE algorithm_breed_predispose SET citations = ARRAY[
  'Polzin (2011) Vet Clin Small Anim 41:15-30 — CKD 종설',
  'Hill 2016 Hill et al. small breed urolithiasis'
] WHERE breed_key = 'shih_tzu';

-- ── 6 한국 인기 품종 신규 추가 ─────────────────────────────────────
INSERT INTO algorithm_breed_predispose
  (breed_key, korean_label, breed_keywords, predispose_conditions, cautions, citations) VALUES
  ('pomeranian', '포메라니안',
    ARRAY['포메','pomeranian','포메라니안'],
    ARRAY['patellar_luxation','tracheal_collapse','dental'],
    ARRAY['소형견 — 슬개골 탈구 / 기관 허탈 / 치주질환 호발. 비만 회피 + 글루코사민'],
    ARRAY['LaFond et al. (2002) JAAHA 38:467 — small breed orthopedic']),
  ('yorkshire_terrier', '요크셔테리어',
    ARRAY['요크셔','yorkshire','yorkie','요키','요크'],
    ARRAY['liver','tracheal_collapse','dental','patellar_luxation'],
    ARRAY['포트시스템션트 (PSS) / 기관 허탈 호발 — 간 보조 + 저단백 평가'],
    ARRAY['Tobias & Rohrbach (2003) JAVMA 223:1636 — PSS breed predispose']),
  ('bichon', '비숑 프리제',
    ARRAY['비숑','bichon','frise','프리제'],
    ARRAY['allergy_skin','urinary_stone','dental'],
    ARRAY['아토피 / 요결석 (struvite·oxalate) / 치주질환 호발'],
    ARRAY['Picco et al. (2008) Vet Dermatol 19:150']),
  ('welsh_corgi', '웰시 코기',
    ARRAY['코기','corgi','welsh corgi','펨브로크','pembroke'],
    ARRAY['ivdd','arthritis','diabetes'],
    ARRAY['추간판 탈출증 / 비만 + 인슐린 의존성 당뇨 호발 — 체중관리 핵심'],
    ARRAY['Brisson (2010) Vet Clin Small Anim 40:829']),
  ('dachshund', '닥스훈트',
    ARRAY['닥스훈트','dachshund','닥스'],
    ARRAY['ivdd','arthritis'],
    ARRAY['추간판 탈출증 (chondrodystrophic) 호발 — 비만 회피 + 글루코사민·EPA'],
    ARRAY['Brisson (2010) Vet Clin Small Anim 40:829 — IVDD breed risk']),
  ('jindo', '진돗개',
    ARRAY['진돗개','jindo','진도','진도견'],
    ARRAY['arthritis','allergy_skin'],
    ARRAY['한국 토종 천연기념물 — 고관절 이형성 / 아토피 보고 (드물지만 임상 사례)'],
    ARRAY['국내 수의대 임상 사례 보고'])
ON CONFLICT (breed_key) DO NOTHING;
