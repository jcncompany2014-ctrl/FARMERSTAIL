-- 홈이 결제가 멈춘 걸 **구조적으로 알 수 없었다** (2026-08-07 고객 실패경로 감사)
--
-- # 무슨 일이 있었나
-- `dashboard_user_snapshot` 이 구독에서 `id, status, next_delivery_date,
-- subscription_items` 만 돌려줬다. 그래서 홈은 `lib/subscription-state` 의
-- `subscriptionState()` 를 **부를 수가 없다** — 판정에 필요한 billing_key ·
-- failed_charge_count · requires_billing_key_renewal 이 오지 않기 때문이다.
--
-- 결과가 두 갈래로 갈린다:
--
--  ① 카드가 없거나 깨진 구독(status 는 아직 active)
--     → 홈이 "활성 · 정기배송" 이라 말하고 D-day 까지 붙인다. 그런데 청구
--       크론은 `.eq('requires_billing_key_renewal', false)` + billing_key 를
--       요구하므로 그 건을 **영원히 건너뛴다.** 고객은 오는 줄 안다.
--
--  ② 3회 실패로 자동 일시정지(paused)
--     → `WHERE s.status = 'active'` 필터에 걸려 **홈에서 구독이 통째로
--       사라진다.** 마이페이지를 스스로 열지 않는 한 아무 신호가 없다.
--
-- 마이페이지·강아지 카드·구독 탭은 이미 올바른 판정과 배너를 갖고 있다.
-- 홈만 입력이 없어서 못 하고 있었다 — 앱을 열면 가장 먼저 보는 화면인데.
--
-- # 고침
--  · status 필터를 ('active','paused') 로 넓힌다.
--  · 판정에 필요한 칸을 함께 돌려준다.
--
-- ★billing_key 값 자체는 내보내지 않는다 — 결제 자격증명이라 브라우저까지
--   갈 이유가 없다. 판정에 필요한 건 "있나 없나" 뿐이므로 boolean 으로 준다.
--   (lib/subscription-state 의 SubLike 는 string|null 을 받으므로, 호출부가
--    has_billing_key 를 그 모양으로 바꿔 넘긴다.)

create or replace function public.dashboard_user_snapshot(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_profile jsonb;
  v_dogs jsonb;
  v_subscription jsonb;
  v_attention jsonb;
begin
  -- ★가드는 fail-closed 다 (2026-07-16). 예전엔 fail-open 이라 anon 이 남의
  --   프로필·강아지·구독을 통째로 뽑을 수 있었다(실증).
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden';
  end if;

  select to_jsonb(p) into v_profile
  from (select name from public.profiles where id = p_user_id) p;

  select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at asc), '[]'::jsonb)
    into v_dogs
  from (
    select id, name, breed, birth_date, weight, created_at::text as created_at
    from public.dogs where user_id = p_user_id order by created_at asc limit 50
  ) d;

  /**
   * ★두 개를 따로 돌려준다 (2026-08-08 검토에서 잡힘).
   *
   * 처음엔 한 행만 뽑으면서 "멈춘 것 우선" 으로 정렬했는데, 강아지가 여러
   * 마리면 **살아 있는 배송이 홈에서 사라진다**:
   *   코코 = active · 카드 정상 · D-3   /   몽이 = paused
   * → 몽이가 뽑혀 "일시정지 상태예요" 만 뜨고 코코의 D-3 배송 스트립이
   *   통째로 없어진다. 화요일에 진짜 박스가 나가는데 홈은 멈췄다고 말한다.
   *
   * 배송 정보(subscription)와 조치 알림(attention)은 서로 다른 질문이므로
   * 한 행으로 답할 수 없다.
   */

  -- ① 배송 정보 — 실제로 청구가 도는 구독. (옛 동작 보존)
  select to_jsonb(s) into v_subscription
  from (
    select
      s.id, s.status, s.next_delivery_date,
      (s.billing_key is not null) as has_billing_key,
      coalesce(s.failed_charge_count, 0) as failed_charge_count,
      coalesce(s.requires_billing_key_renewal, false) as requires_billing_key_renewal,
      coalesce((select jsonb_agg(jsonb_build_object('product_name', si.product_name))
                from public.subscription_items si where si.subscription_id = s.id),
               '[]'::jsonb) as subscription_items
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.status = 'active'
      -- 청구 크론과 같은 조건 — 이게 아니면 박스가 오지 않는다.
      and s.billing_key is not null
      and s.requires_billing_key_renewal = false
      and s.next_delivery_date is not null
    order by s.next_delivery_date asc, s.created_at desc
    limit 1
  ) s;

  -- ② 조치 알림 — 고객이 손을 써야 하는 구독 하나. 없으면 null.
  --    급한 순서: 결제 깨짐 > 카드 미등록 > 일시정지.
  select to_jsonb(a) into v_attention
  from (
    select
      s.id, s.status,
      (s.billing_key is not null) as has_billing_key,
      coalesce(s.failed_charge_count, 0) as failed_charge_count,
      coalesce(s.requires_billing_key_renewal, false) as requires_billing_key_renewal,
      s.next_delivery_date
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.status in ('active', 'paused')
      and (
        s.billing_key is null                       -- 시작 전
        or s.requires_billing_key_renewal = true    -- 카드 재등록 필요
        or coalesce(s.failed_charge_count, 0) > 0   -- 결제 실패 누적
        or s.status = 'paused'                      -- 멈춤
      )
    order by
      case
        when s.requires_billing_key_renewal = true then 0
        when coalesce(s.failed_charge_count, 0) > 0 then 1
        when s.billing_key is null then 2
        else 3
      end,
      s.created_at desc
    limit 1
  ) a;

  return jsonb_build_object('profile', coalesce(v_profile, 'null'::jsonb),
                            'dogs', v_dogs,
                            'subscription', coalesce(v_subscription, 'null'::jsonb),
                            'attention', coalesce(v_attention, 'null'::jsonb));
end;
$function$;

comment on function public.dashboard_user_snapshot(uuid) is
  '홈 스냅샷. 가드 fail-closed(2026-07-16). 2026-08-07: 결제 상태 판정에 필요한 칸(has_billing_key·failed_charge_count·requires_billing_key_renewal)을 추가하고 paused 도 포함 — 홈이 결제가 멈춘 것을 구조적으로 알 수 없어 "활성"이라 말하거나 구독을 통째로 숨겼다. billing_key 값 자체는 내보내지 않는다.';
