-- 이벤트 할인의 최대 금액(원) — 사장님 2026-10-19 "할인율 50퍼 · 최대 할인 금액 5만원"
--
-- 큰 아이의 완전 화식 박스는 20만원이 넘는다 — 50%면 10만원 넘게 깎인다. 이벤트마다 상한을 둘 수 있게 칸을 하나 더한다.
-- null = 상한 없음(예전 이벤트·이미 받은 혜택은 그대로 — 가입 때 약속한 것을 바꾸지 않는다).
--
-- 청구는 pending_promotion_terms 로 할인율과 상한을 **한 번에** 읽는다(lib/payments/auto-discount.ts).
-- pending_promotion_rate 는 지우지 않는다 — 새 코드가 이 마이그레이션보다 먼저 배포되면 그쪽으로 물러난다(PGRST202 안전판).
--
-- 확인(적용 뒤, 부작용 없는 조회):
--   select column_name, data_type, is_nullable from information_schema.columns
--    where table_schema = 'public' and table_name = 'promotions' and column_name = 'max_discount_amount';
--   select has_function_privilege('authenticated', 'public.pending_promotion_terms(uuid)', 'execute');  -- false 여야
--   select has_function_privilege('service_role', 'public.pending_promotion_terms(uuid)', 'execute');   -- true 여야

alter table public.promotions
  add column if not exists max_discount_amount integer
  check (max_discount_amount is null or max_discount_amount > 0);

comment on column public.promotions.max_discount_amount is
  '최대 할인 금액(원). null = 상한 없음. 첫 결제 할인 = min(박스 금액 × discount_rate 내림, 이 값).';

create or replace function public.pending_promotion_terms(p_user_id uuid)
returns table (rate numeric, max_discount integer)
language sql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $function$
  SELECT p.discount_rate, p.max_discount_amount
    FROM public.promotion_claims c
    JOIN public.promotions p ON p.id = c.promotion_id
   WHERE c.user_id = p_user_id
     AND c.redeemed_order_id IS NULL
   LIMIT 1
$function$;

comment on function public.pending_promotion_terms(uuid) is
  '아직 안 쓴 프로모션의 할인율과 최대 할인 금액(없으면 0행). pending_promotion_rate 와 같은 판정 — 기간 만료는 보지 않는다(가입 때 받은 권리).';

revoke execute on function public.pending_promotion_terms(uuid) from public, anon, authenticated;
grant execute on function public.pending_promotion_terms(uuid) to service_role;
