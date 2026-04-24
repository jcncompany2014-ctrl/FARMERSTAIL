-- 웹 푸시 세부 선호 설정.
--
-- 쓰임새
-- ----
-- 지금까지 웹 푸시는 "켠다/끈다" 두 가지 상태뿐이었는데, 카테고리별 선호
-- (예: "주문은 받고 마케팅은 끄기") 와 "야간 시간대에는 울리지 않기" 를 붙인다.
-- GDPR-style consent 트래킹이 아니라 "유저 편의성 세팅" — 법적 동의는 별도 테이블.
--
-- 설계
-- ----
--  · user_id 를 PK 로. 유저당 한 행만 — 기기별 환경설정이 아니라 계정 단위.
--  · 모든 카테고리 플래그 기본값 true (켜면 모두 받음).
--  · quiet_hours_{start,end} 는 0-23 정수. start > end 면 "밤→새벽" 랩어라운드.
--  · 랩어라운드를 지원해야 "22시부터 8시까지 조용" 같은 흔한 패턴 가능.
--
-- 서버사이드 체크 지점
-- ------------------
--  · lib/push.ts 의 pushToUser 가 전달받은 category 를 여기와 대조한다.
--  · cron 으로 돌리는 cart-recovery / restock-dispatch 가 각자의 카테고리로 호출.

BEGIN;

CREATE TABLE IF NOT EXISTS public.push_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_order boolean NOT NULL DEFAULT true,        -- 결제/배송 이벤트
  notify_restock boolean NOT NULL DEFAULT true,      -- 재입고 알림
  notify_cart boolean NOT NULL DEFAULT true,         -- 장바구니 리마인더
  notify_marketing boolean NOT NULL DEFAULT false,   -- 프로모션/쿠폰 (기본 OFF — 동의 전)
  quiet_hours_start smallint,                         -- 0-23 (NULL 이면 quiet 없음)
  quiet_hours_end smallint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- quiet_hours 값 제약.
ALTER TABLE public.push_preferences
  DROP CONSTRAINT IF EXISTS push_preferences_quiet_hours_range;
ALTER TABLE public.push_preferences
  ADD CONSTRAINT push_preferences_quiet_hours_range
  CHECK (
    (quiet_hours_start IS NULL AND quiet_hours_end IS NULL)
    OR (
      quiet_hours_start IS NOT NULL
      AND quiet_hours_end IS NOT NULL
      AND quiet_hours_start BETWEEN 0 AND 23
      AND quiet_hours_end BETWEEN 0 AND 23
      AND quiet_hours_start <> quiet_hours_end
    )
  );

ALTER TABLE public.push_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_preferences_self_select ON public.push_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY push_preferences_self_upsert ON public.push_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY push_preferences_self_update ON public.push_preferences
  FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE public.push_preferences IS
  '계정별 웹 푸시 선호. 카테고리 플래그 + quiet hours.';
COMMENT ON COLUMN public.push_preferences.quiet_hours_start IS
  '조용한 시간대 시작 (0-23). NULL 이면 quiet 없음. end 와 함께 랩어라운드 가능.';

COMMIT;
