-- discount_reason CHECK 에 'promotion' 이 빠져 있었다 (2026-08-12 4라운드 감사).
--
-- lib/payments/auto-discount.ts:116 이 프로모션 할인에 reason='promotion' 을 돌려주고
-- subscription-charge 가 그 값을 orders.discount_reason 에 넣는다. 그런데 CHECK 는
-- 쿠폰 시절 값(first_order/tier/birthday/none)만 허용해서, **이벤트 페이지로 가입한
-- 고객의 첫 정기결제가 주문 INSERT 단계에서 100% 실패**한다(ORDER_INSERT_FAILED).
-- 사장님이 이벤트로 첫 고객을 받는 바로 그 경로다.
--
-- 함께 정리: 'first_order'·'birthday' 는 2026-07-17 할인 개편으로 폐기(기본 15% +
-- 나무 10%만 남고 나머지는 이벤트 프로모션으로 통합). 기존 행이 있으면 CHECK 추가가
-- 실패하므로 먼저 확인하고 없을 때만 뺀다.
--
-- 프로덕션 적용: 2026-08-12 (MCP apply_migration). 적용 후 롤백 트랜잭션 안에서
-- 'promotion' 수용·'first_order' 거부를 확인하고, 테스트 행이 남지 않았음을 검산.

do $$
declare
  stale_count int;
begin
  select count(*) into stale_count
  from public.orders
  where discount_reason in ('first_order', 'birthday');

  if stale_count > 0 then
    raise exception '폐기된 discount_reason 을 쓰는 주문이 % 건 있다 — 목록에서 빼기 전에 확인 필요', stale_count;
  end if;
end $$;

alter table public.orders drop constraint if exists orders_discount_reason_check;

alter table public.orders add constraint orders_discount_reason_check
  check (
    discount_reason is null
    or discount_reason = any (array['tier'::text, 'promotion'::text, 'none'::text])
  );
