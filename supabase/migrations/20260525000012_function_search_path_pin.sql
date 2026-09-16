-- R38 (#42 audit) — 3 trigger function 의 search_path 고정.
-- 'function_search_path_mutable' WARN 해소.

ALTER FUNCTION public.touch_payment_refund_queue()
  SET search_path TO 'public', 'pg_catalog';

ALTER FUNCTION public.update_updated_at_column()
  SET search_path TO 'public', 'pg_catalog';

ALTER FUNCTION public.touch_user_integrations_updated_at()
  SET search_path TO 'public', 'pg_catalog';
