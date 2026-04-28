-- Migration: products.sales_count + auto increment trigger
-- Why: 베스트 정렬이 큐레이션 sort_order 였는데, 실제 누적 판매량 기반으로
-- 전환. 결제 완료 (orders.payment_status = 'paid') 시 order_items 의
-- 각 product 별 quantity 만큼 sales_count 자동 증가.

alter table public.products
  add column if not exists sales_count integer not null default 0;

create index if not exists products_sales_count_idx
  on public.products (sales_count desc) where is_active = true;

-- Trigger: orders.payment_status 가 'paid' 로 전환되는 순간 한 번 증가.
-- 가상계좌 등 'pending' → 'paid' 케이스도 동일하게 처리.
create or replace function public.tg_orders_increment_sales_count()
returns trigger
language plpgsql
security definer
as $$
declare
  rec record;
begin
  -- INSERT 일 때 status 가 처음부터 paid 인 케이스, UPDATE 일 때 paid 로 전환.
  if (tg_op = 'INSERT' and new.payment_status = 'paid')
     or (tg_op = 'UPDATE'
         and old.payment_status is distinct from 'paid'
         and new.payment_status = 'paid')
  then
    for rec in
      select product_id, sum(quantity)::int as q
      from public.order_items
      where order_id = new.id
      group by product_id
    loop
      update public.products
        set sales_count = sales_count + rec.q
        where id = rec.product_id;
    end loop;
  end if;

  -- paid → cancelled / refunded 전환 시 차감.
  if (tg_op = 'UPDATE'
      and old.payment_status = 'paid'
      and new.payment_status in ('cancelled', 'refunded'))
  then
    for rec in
      select product_id, sum(quantity)::int as q
      from public.order_items
      where order_id = new.id
      group by product_id
    loop
      update public.products
        set sales_count = greatest(0, sales_count - rec.q)
        where id = rec.product_id;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_increment_sales_count on public.orders;
create trigger orders_increment_sales_count
  after insert or update of payment_status on public.orders
  for each row execute function public.tg_orders_increment_sales_count();
