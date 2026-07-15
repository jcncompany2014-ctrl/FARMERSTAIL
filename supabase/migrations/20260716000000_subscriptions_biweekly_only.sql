-- 배송 주기 2주 고정을 **스키마로 강제**.
--
-- # 배경 (사장님 2026-07-16 "우리 지금 배송주기 1주/2주/4주에서 2주 하나로 고정했잖아,
--   하나하나 놓치지 말고 다 찾으라고")
-- UI 의 '주기 변경' 패널만 지웠지 뿌리가 그대로 살아 있었다:
--  · coverage_weeks 의 DB **기본값이 4** — 옛 4주 모델이 스키마 기본값으로 생존했다.
--    값을 안 넣고 insert 하면 4주 구독이 생기고, 그러면 크론의 '레거시 월 branch' 가
--    깨어나 캘린더 월 배송이 된다.
--  · 코드 곳곳(cron·admin·재개·건너뛰기·billing-issue)이
--    `coverage_weeks === 2 ? +14일 : +1개월`, 비박스면 `interval_weeks * 7` 로 3갈래.
--  · /subscribe/[slug] 에는 주기 선택기(1/2/4주)가 통째로 살아 있었다(도달 불가).
--
-- # 왜 '기본값'이 아니라 '제약'인가
-- 박스는 **14일치**다. 매주로 오면 음식이 두 배가 되고, 4주면 2주 뒤에 굶는다 —
-- 다른 주기는 물리적으로 성립하지 않는다. 기본값만 바꾸면 누군가 다시 4를 넣을 수
-- 있으므로 CHECK 로 못박는다.
--
-- # 안전
-- 적용 시점 실데이터 1건(interval 2 / coverage 2) — 위반 행 없음.
-- 되돌리려면 CHECK 만 DROP 하면 된다. 검증: interval/coverage=4 insert 시도 →
-- 23514 violates check constraint 로 거부됨을 확인.
ALTER TABLE public.subscriptions
  ALTER COLUMN coverage_weeks SET DEFAULT 2,
  ALTER COLUMN interval_weeks SET DEFAULT 2;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_biweekly_only
  CHECK (interval_weeks = 2 AND coverage_weeks = 2);

COMMENT ON COLUMN public.subscriptions.interval_weeks IS
  '배송·결제 주기(주). 2 고정 — 박스가 14일치라 다른 주기는 성립하지 않는다(CHECK subscriptions_biweekly_only). 발송 요일은 화요일 고정(lib/shipping-schedule).';
COMMENT ON COLUMN public.subscriptions.coverage_weeks IS
  '박스가 담는 급여 기간(주). 2 고정 — interval_weeks 와 항상 같다.';
