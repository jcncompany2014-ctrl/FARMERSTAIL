-- 2026-10-06 10차 점검 B — subscriptions.next_delivery_date 에 값 검사(화요일 · 유한 · 정상 범위).
--
-- 고객은 이 칸을 직접 UPDATE 할 수 있다(4칸 화이트리스트). 그런데 값 검사가 하나도 없어, supabase-js 로
-- '-infinity'·'infinity'·'0001-01-02 BC' 같은 값을 쓸 수 있었다. PG 는 이걸 date 로 받고 JSON 으로 그대로 내려보낸다.
-- 그러면 lib/datetime-kst 의 new Date(...).toISOString() 이 RangeError 를 던져 **청구 크론 전체**(try 밖 필터)·
-- 리마인더 크론·어드민 화면이 멈춘다 — 한 고객의 값 하나로 그날 모든 고객이 청구되지 않는다.
--
-- ★isodow=2 만으로는 부족하다: extract(isodow from 'infinity'::date) 는 NULL 이고 CHECK 는 NULL 을 통과시킨다(실측).
--   그래서 isfinite + 범위를 같이 건다.
-- 모든 정상 쓰기와 호환된다 — 청구 크론(nextCycleDateAligned, 화요일 보장) · billing-issue(nextShipDate) ·
-- 재개(resumeShipDate) · 미루기(+14) · 되돌리기(undoSkipTarget 화요일 검사) · 어드민 발송일(화요일만) · null 경로.
-- 발송 요일을 늘리면(lib/shipping-schedule '목요일 추가' 확장안) 이 CHECK 도 함께 바꾼다.

alter table public.subscriptions
  add constraint subscriptions_next_delivery_tuesday check (
    next_delivery_date is null or (
      isfinite(next_delivery_date)
      and next_delivery_date between date '2026-01-01' and date '2099-12-31'
      and extract(isodow from next_delivery_date) = 2
    )
  );
