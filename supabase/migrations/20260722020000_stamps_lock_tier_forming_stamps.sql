-- 등급을 만든 스탬프는 만료 안 됨(잠금) — 사장님 모델 2026-07-22
--
-- # 왜 (앞 마이그레이션의 '1년 만료 + ratchet'만으로는 부족)
-- 사장님 모델: "10개 모아 씨앗이 됐으면 그 1~10번은 안 사라진다. 만료는 등급 위
-- 현재 판(11번째~)의 느슨한 스탬프에만 걸린다." 즉 스탬프 카드 한 장(10개)을 채워
-- 등급이 오르면 그 10개는 **영구 잠금**(expires_at='infinity')돼 등급을 지킨다.
--
-- # 결과 — '1년 만료면 나무 도달 불가' 걱정은 틀렸다
-- 꾸준한 구독자는 판(10개, 2주×10=~4.6개월)을 만료(1년) 전에 채워 계속 잠그며
-- 나무(50)까지 오른다. 오래 쉬면 현재 판의 '느슨한' 스탬프만 만료돼 카드가 0칸까지
-- 비고, 잠긴 스탬프가 등급을 그대로 잡아 준다(강등 없음).
--
-- # stamp_count 의미
-- stamp_count = 잠긴 것(infinity) + 살아있는 느슨한 것. 잠금 덕에 만료로는 절대 등급
-- 임계 밑으로 안 떨어져 tier=fn_compute_tier(stamp_count) 가 스스로 강등되지 않는다.
-- (환불로 잠긴 스탬프가 삭제되는 경우만 tg_profiles_sync_tier 의 ratchet 이 방어.)
--
-- # 검증(실측 2026-07-22, 합성 유저 트랜잭션 롤백)
--   24개 적립 → stamp_count 24 · 새싹 · 잠김20 · 느슨4(새싹판 4칸)
--   느슨 만료   → stamp_count 20 · 새싹(유지) · 잠김20 · 느슨0(새싹판 0칸)

create or replace function public.fn_lock_completed_cards(uid uuid)
returns void language plpgsql security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  loose_alive integer;
begin
  loop
    select count(*) into loose_alive
      from public.stamps
     where user_id = uid
       and expires_at > now()
       and expires_at <> 'infinity'::timestamptz;
    exit when loose_alive < 10;
    -- 가장 오래된 10개(현재 판을 채운 것)를 영구 잠금.
    update public.stamps
       set expires_at = 'infinity'::timestamptz
     where id in (
       select id from public.stamps
        where user_id = uid
          and expires_at > now()
          and expires_at <> 'infinity'::timestamptz
        order by stamped_at asc, id asc
        limit 10
     );
  end loop;
  -- 살아있는(잠금 포함) 개수로 캐시 갱신 → tg_profiles_sync_tier 로 등급 반영.
  perform public.fn_refresh_stamp_count(uid);
end;
$function$;

comment on function public.fn_lock_completed_cards(uuid) is
  '판(10개) 완성 시 그 10개를 영구 잠금(expires_at=infinity). 등급을 만든 스탬프는 만료 안 됨. 만료는 현재 판의 느슨한 스탬프에만. 적립 트리거가 호출.';

-- 적립 트리거 — 1년 만료(느슨) 삽입 후 완성 판 잠금. 취소/환불 회수.
create or replace function public.tg_orders_stamp()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if new.user_id is null or new.subscription_id is null then
    return new;
  end if;

  if (tg_op = 'INSERT' and new.payment_status = 'paid')
     or (tg_op = 'UPDATE'
         and old.payment_status is distinct from 'paid'
         and new.payment_status = 'paid')
  then
    insert into public.stamps (user_id, order_id, stamped_at, expires_at)
    values (
      new.user_id,
      new.id,
      coalesce(new.paid_at, now()),
      coalesce(new.paid_at, now()) + interval '1 year'
    )
    on conflict (order_id) where order_id is not null do nothing;
    -- 방금 적립으로 판이 찼으면 잠그고 stamp_count 갱신.
    perform public.fn_lock_completed_cards(new.user_id);
  end if;

  if (tg_op = 'UPDATE'
      and old.payment_status = 'paid'
      and new.payment_status in ('cancelled', 'refunded'))
  then
    delete from public.stamps where order_id = new.id;
    perform public.fn_refresh_stamp_count(new.user_id);
  end if;

  return new;
end;
$function$;

comment on table public.stamps is
  '구독 결제 1회 = 도장 1개. 느슨한 스탬프는 적립 + 1년 만료. 판(10개) 완성 시 그 10개는 영구 잠금(expires_at=infinity)돼 등급을 지킨다(2026-07-22). stamp_count = 잠금+느슨살아있음.';
