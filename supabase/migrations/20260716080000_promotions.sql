-- 프로모션 — 오프라인·인스타 이벤트용 한시 할인 (사장님 확정 2026-07-16) — 적용 완료
--
-- 사장님이 admin 에서 이벤트를 만들면 **주소 하나**가 나온다: /start?p=busan1102
-- 오프라인은 그 QR 을 배너에 인쇄, 인스타는 프로필 링크에. 고객은 **코드를 본 적도
-- 입력한 적도 없다** — 링크로 들어와 설문하면 끝이고, 가입하는 순간 코드가 계정에
-- 박혀 첫 결제에 자동 적용된다.
--
-- # 쿠폰을 되살리는 게 아니다
-- 코드 입력·발급·보유·만료 UI 가 없다. "할인은 주문 시점 자동 계산" 철학을 그대로 두고
-- **유입 경로만** 추가한다.
--
-- # 등급 할인과 안 섞는다
-- lib/discount.ts(등급) 와 lib/promotions.ts(이벤트)는 **별도 축**이고, 결제 시
-- pickBetterDiscount 로 **더 큰 쪽 하나**만 고른다. 섞으면 "무엇이 우선인가·겹치면·
-- 슬롯은" 규칙이 다시 자란다 — 2026-07-16 에 150→80줄로 걷어낸 게 정확히 그것.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  discount_rate numeric not null check (discount_rate > 0 and discount_rate <= 1),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_signups integer check (max_signups is null or max_signups >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

comment on table public.promotions is
  '오프라인·인스타 이벤트용 한시 할인. code 가 URL 파라미터(/start?p=code)로 쓰인다. 고객은 코드를 입력하지 않는다 — 링크가 곧 코드.';

create index if not exists promotions_code_idx on public.promotions (code);

-- 누가 이 프로모션으로 가입했나 = 상한 카운트 + 성과 집계 + 계정당 1회 강제
create table if not exists public.promotion_claims (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  -- ★ 계정당 1개. 여러 링크를 타고 와도 **먼저 박힌 것 하나**만.
  user_id uuid not null unique references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  redeemed_order_id uuid references public.orders(id) on delete set null,
  redeemed_at timestamptz
);

comment on table public.promotion_claims is
  '프로모션으로 가입한 계정. user_id unique = 계정당 1회. redeemed_order_id 가 차면 사용 완료 — 안 그러면 매 결제마다 할인이 나간다. 상한 카운트와 채널 성과(가입 vs 결제)의 근거.';

create index if not exists promotion_claims_promo_idx on public.promotion_claims (promotion_id);

alter table public.promotions enable row level security;
alter table public.promotion_claims enable row level security;

-- 링크로 들어온 **비로그인**도 "이 이벤트 유효한가"를 알아야 하므로 열린 것만 읽게.
-- 끝난/꺼진 이벤트는 존재 자체가 안 보인다. 쓰기 정책 없음 = service_role(admin API) 만.
drop policy if exists "promotions_read_open" on public.promotions;
create policy "promotions_read_open" on public.promotions
  for select using (
    public.is_admin()
    or (active and now() >= starts_at and now() <= ends_at)
  );

drop policy if exists "promotion_claims_select_own" on public.promotion_claims;
create policy "promotion_claims_select_own" on public.promotion_claims
  for select using (auth.uid() = user_id or public.is_admin());

-- ── claim — **원자적으로**
--
-- "몇 명 찼나 세고 → 상한 미만이면 insert" 를 앱에서 두 번에 나눠 하면, 부스에서
-- **동시에 여러 명이 QR 을 찍는 순간** 전부 "아직 99명"을 보고 통과한다. 100명 상한에
-- 105명이 들어간다. 오프라인 행사는 정확히 그 동시성이 일어나는 곳이다.
-- → 세기와 넣기를 한 트랜잭션 + FOR UPDATE 로 묶는다.
create or replace function public.claim_promotion(p_code text)
returns table (ok boolean, reason text, rate numeric, promo_name text)
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
DECLARE
  v_uid uuid := auth.uid();
  v_promo public.promotions%ROWTYPE;
  v_count integer;
BEGIN
  -- fail-closed. 가입 직후 호출되는 함수다.
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'unauthenticated', 0::numeric, NULL::text; RETURN;
  END IF;

  -- 이미 받은 계정이면 조용히 끝낸다(계정당 1회). 예외로 터뜨리면 가입이 깨진다.
  IF EXISTS (SELECT 1 FROM public.promotion_claims c WHERE c.user_id = v_uid) THEN
    RETURN QUERY SELECT false, 'already_claimed', 0::numeric, NULL::text; RETURN;
  END IF;

  -- ★ 이 잠금이 상한의 동시성을 막는다.
  SELECT * INTO v_promo FROM public.promotions p
   WHERE p.code = lower(trim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_found', 0::numeric, NULL::text; RETURN;
  END IF;

  -- 게이트 — lib/promotions.ts promotionGate 와 **같은 순서·같은 경계**여야 한다.
  IF NOT v_promo.active THEN
    RETURN QUERY SELECT false, 'inactive', 0::numeric, v_promo.name; RETURN;
  END IF;
  IF now() < v_promo.starts_at THEN
    RETURN QUERY SELECT false, 'not_started', 0::numeric, v_promo.name; RETURN;
  END IF;
  IF now() > v_promo.ends_at THEN
    RETURN QUERY SELECT false, 'ended', 0::numeric, v_promo.name; RETURN;
  END IF;
  IF v_promo.max_signups IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.promotion_claims c
     WHERE c.promotion_id = v_promo.id;
    IF v_count >= v_promo.max_signups THEN
      RETURN QUERY SELECT false, 'full', 0::numeric, v_promo.name; RETURN;
    END IF;
  END IF;

  INSERT INTO public.promotion_claims (promotion_id, user_id)
  VALUES (v_promo.id, v_uid)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY SELECT true, 'claimed', v_promo.discount_rate, v_promo.name;
END;
$function$;

comment on function public.claim_promotion(text) is
  '가입 직후 프로모션을 계정에 박는다. 세기+넣기를 FOR UPDATE 로 묶어 상한 동시성을 막는다(부스에서 동시에 QR 찍는 상황). 게이트 순서는 lib/promotions.ts promotionGate 와 일치해야 한다.';

revoke execute on function public.claim_promotion(text) from public, anon;
grant execute on function public.claim_promotion(text) to authenticated;

-- 결제 시점에 "이 계정이 쓸 수 있는 프로모션 할인율".
create or replace function public.pending_promotion_rate(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $function$
  SELECT p.discount_rate
    FROM public.promotion_claims c
    JOIN public.promotions p ON p.id = c.promotion_id
   WHERE c.user_id = p_user_id
     AND c.redeemed_order_id IS NULL
   LIMIT 1
$function$;

comment on function public.pending_promotion_rate(uuid) is
  '아직 안 쓴 프로모션의 할인율(없으면 NULL). ⚠️ 기간 만료를 보지 않는다 — 부스에서 약속하고 나중에 결제하는 게 정상이라 **가입 때 받은 권리**는 지킨다. 기간은 claim 시점에만 검사한다.';

revoke execute on function public.pending_promotion_rate(uuid) from public, anon, authenticated;
grant execute on function public.pending_promotion_rate(uuid) to service_role;

-- 검증(프로덕션 롤백 테스트):
--  · 상한 2명에 4명 시도 → 2명 통과 · 3·4번째 'full' · 중복 시도 'already_claimed'
--  · 첫 결제 전 0.5 → 소진 후 NULL(매번 50% 나가면 큰일) → 다른 링크 재시도 거부
--  · 대문자 코드('TEST-BUSAN')도 정상 인식
