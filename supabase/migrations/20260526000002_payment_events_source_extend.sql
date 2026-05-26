-- R61 — payment_events.source enum 확장.
--
-- 추가 source:
--   'cron_subscription_charge' — 정기구독 자동 결제 cron
--   'cron_order_expire'        — 주문 만료 cron (30분 결제 미완료)
--
-- 이전 R60 의 'cron_refund_queue' 와 의미 분리.

ALTER TABLE public.payment_events
  DROP CONSTRAINT IF EXISTS payment_events_source_check;

ALTER TABLE public.payment_events
  ADD CONSTRAINT payment_events_source_check CHECK (source IN (
    'user_checkout',
    'toss_webhook',
    'user_cancel',
    'partial_cancel',
    'cron_refund_queue',
    'cron_subscription_charge',
    'cron_order_expire',
    'admin_panel'
  ));
