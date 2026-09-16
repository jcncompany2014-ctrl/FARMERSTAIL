-- R38 (#42 RLS audit) — arm_stats view SECURITY DEFINER → INVOKER.
--
-- Supabase advisor 가 detect 한 ERROR 1건 fix. 단순 aggregation view
-- (meta_learning_events 의 context/arm_id 별 count/sum/avg/max). DEFINER
-- 였을 때 view 가 creator role 의 RLS 우회 가능성. INVOKER 로 전환해
-- querying user 의 RLS 그대로 적용.

ALTER VIEW public.arm_stats SET (security_invoker = on);

COMMENT ON VIEW public.arm_stats IS
  'meta_learning_events 의 context/arm_id 별 통계. SECURITY INVOKER (R38).';
