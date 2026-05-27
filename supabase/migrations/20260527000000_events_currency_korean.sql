-- 이벤트 카피의 통화 표기를 한글 "원" 으로 통일.
--
-- 배경:
--   이전까지 v3 컴포넌트 (PDP / Home / Catalog / Dashboard) 와 admin (Finance /
--   Insights / PaymentEventTimeline) 에서 ₩ 기호와 한글 "원" 이 혼재.
--   사용자 결정으로 한글 "원" 으로 통일 — 한국어 가독성 + 모바일 polyfill 문제
--   없음 + 다른 사용자 노출 카피 (lib/copy-strings.ts 등) 와 일관성.
--
-- 이 migration 은 이미 events 테이블에 INSERT 된 seed row 의 텍스트 컬럼들을
-- UPDATE 한다. events.ts 의 신규 INSERT 는 새 카피로 들어가지만 기존 row 는
-- 그대로라 한 번 정리.
--
-- 영향 row: events.slug = 'welcome' / 'subscription-launch'

-- WELCOME 이벤트
UPDATE public.events
SET
  tagline = REPLACE(tagline, '₩', ''),
  highlight = REPLACE(REPLACE(highlight, '₩5,000', '5,000원'), '₩', ''),
  detail_lede = REPLACE(detail_lede, '₩', ''),
  perks = REPLACE(perks::text, '₩', '')::jsonb,
  terms = REPLACE(terms::text, '₩', '')::jsonb
WHERE slug = 'welcome';

-- 한 번 더 명시적 fix — REPLACE 만으론 "₩5,000" 같은 패턴이 "5,000" 으로
-- 만 변할 수 있어서 "원" 접미를 다시 붙여준다.
UPDATE public.events
SET
  tagline = REPLACE(tagline, '5,000 즉시', '5,000원 즉시'),
  detail_lede = REPLACE(detail_lede, '5,000 즉시', '5,000원 즉시'),
  perks = REPLACE(perks::text, '5,000 즉시', '5,000원 즉시')::jsonb,
  perks = REPLACE(perks::text, '15,000', '15,000원')::jsonb
WHERE slug = 'welcome';

-- SUBSCRIPTION LAUNCH 이벤트
UPDATE public.events
SET
  perks = REPLACE(perks::text, '₩70,000', '70,000원')::jsonb,
  perks = REPLACE(perks::text, '₩', '')::jsonb
WHERE slug = 'subscription-launch';

-- 검증 — 이 migration 적용 후 events 테이블에 ₩ 가 남아있으면 안 됨
DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM public.events
  WHERE
    tagline LIKE '%₩%' OR
    highlight LIKE '%₩%' OR
    detail_lede LIKE '%₩%' OR
    perks::text LIKE '%₩%' OR
    terms::text LIKE '%₩%';

  IF remaining > 0 THEN
    RAISE NOTICE 'WARN: % rows still contain ₩ character. Inspect manually.', remaining;
  END IF;
END $$;
