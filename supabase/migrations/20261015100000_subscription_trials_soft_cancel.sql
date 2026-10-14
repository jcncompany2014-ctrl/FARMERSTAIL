-- 서포터즈 도장 '취소'를 행 삭제가 아니라 기록으로 남긴다 (2026-10-15 어드민 수정 F-a, 규칙259·260).
--
-- # 왜
-- 어드민 체험단 화면의 '도장 취소'가 subscription_trials 행을 지웠다. 청구 크론의 가격 인상 동의 장치(priceRiseGate)는
-- 체험 도장(행)이 있는 사람만 보므로, 이미 100원으로 결제된 서포터즈의 도장을 취소하면 동의 장치를 건너뛰고 그 주
-- 토요일에 정가가 바로 결제됐다(앞 결제 100원 → 이번 정가 = 인상인데 동의 확인 없음). 체험단 화면에서도 사라져
-- 동의를 기록할 곳이 없었다. 다시 찍으면 남은 3회가 아니라 100원 4회 + 반값 4회로 새로 시작했다.
--
-- # 고침
-- 서포터즈 가격으로 결제된 적이 있는 사람의 도장 취소 = 남은 회차 0(cheap_remaining = half_remaining = 0) + 취소 시각.
-- 그러면 청구 크론은 '앞 결제 100원·반값 → 이번 정가 = 정가 인상(to_full)'으로 보고 정가 동의가 기록돼야만 결제한다.
-- 취소할 때 남아 있던 회차는 cancelled_*_remaining 에 남겨 두고, 다시 찍으면 그 값으로 되살린다.
-- 서포터즈 가격 결제가 한 번도 없는 사람(잘못 찍은 도장)은 지금처럼 행을 지운다(앱 app/api/admin/trials 가 가른다).
--
-- # 읽는 법
--  · cancelled_at is null  = 진행 중(또는 회차를 다 쓴) 도장.
--  · cancelled_at not null = 도장 취소됨. 이때 남은 회차는 반드시 0 이고 cancelled_*_remaining 이 채워져 있다(아래 check).
--  · 남은 회차 0 인 행은 원래도 '체험 끝(정가)'으로 읽힌다 — chargeTimingFor·trialPricing·priceRiseGate 를 바꾸지 않는다.
--
-- # 권한
-- 표 권한은 그대로(고객·익명 권한 없음, service_role 전용 — 20260924150000). 새 칸도 자동으로 고객 접근 밖이다.
--
-- ★적용 순서: 20261015100000(이 파일) → 20261015100100(회차 되돌림 트리거가 이 칸을 읽는다) → 20261015100200 → 코드 배포.
--   이 파일만 먼저 적용해도 옛 코드는 그대로 돈다(새 칸은 비어 있고, 옛 코드는 행을 지운다).

alter table public.subscription_trials
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancelled_cheap_remaining integer,
  add column if not exists cancelled_half_remaining integer;

comment on column public.subscription_trials.cancelled_at is
  '도장 취소 시각(2026-10-15). 있으면 남은 회차는 0 이고 다음 결제부터 정가 — 정가 인상 동의(to_full)가 있어야 결제된다.';
comment on column public.subscription_trials.cancelled_by is
  '도장을 취소한 관리자(auth.users.id).';
comment on column public.subscription_trials.cancelled_cheap_remaining is
  '도장 취소 때 남아 있던 100원 회차 — 다시 찍으면 이 값으로 되살린다. 취소 뒤 발송 전 환불이 회차를 되돌리면 여기에 더한다.';
comment on column public.subscription_trials.cancelled_half_remaining is
  '도장 취소 때 남아 있던 반값 회차 — 다시 찍으면 이 값으로 되살린다.';

-- 모양 고정: 취소 안 됨 → 취소 칸 셋 다 비움 / 취소됨 → 남은 회차 0 + 남겨 둔 회차 둘 다 있음(0 이상).
alter table public.subscription_trials drop constraint if exists subscription_trials_cancel_shape_check;
alter table public.subscription_trials add constraint subscription_trials_cancel_shape_check check (
  (cancelled_at is null and cancelled_cheap_remaining is null and cancelled_half_remaining is null)
  or (
    cancelled_at is not null
    and cheap_remaining = 0
    and half_remaining = 0
    and cancelled_cheap_remaining is not null
    and cancelled_cheap_remaining >= 0
    and cancelled_half_remaining is not null
    and cancelled_half_remaining >= 0
  )
);

-- 자기 검증 — 칸·모양 제약이 있고, 고객(anon·authenticated)은 여전히 이 표에 아무 권한이 없다.
do $$
declare
  v_def text;
begin
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'subscription_trials'
      and column_name in ('cancelled_at', 'cancelled_by', 'cancelled_cheap_remaining', 'cancelled_half_remaining')
  ) <> 4 then
    raise exception 'subscription_trials 도장 취소 칸 4개가 다 생기지 않았다';
  end if;
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint
  where conrelid = 'public.subscription_trials'::regclass and conname = 'subscription_trials_cancel_shape_check';
  if v_def is null or v_def not like '%cheap_remaining = 0%' or v_def not like '%half_remaining = 0%' then
    raise exception 'subscription_trials 도장 취소 모양 제약이 없거나 남은 회차 0 을 강제하지 않는다: %', v_def;
  end if;
  if has_table_privilege('authenticated', 'public.subscription_trials', 'select')
     or has_table_privilege('authenticated', 'public.subscription_trials', 'update')
     or has_table_privilege('anon', 'public.subscription_trials', 'select')
     or has_table_privilege('anon', 'public.subscription_trials', 'update') then
    raise exception 'subscription_trials 에 고객·익명 권한이 생겼다 — service_role 전용이어야 한다';
  end if;
  if exists (select 1 from public.subscription_trials where cancelled_at is not null) then
    raise exception '적용 직후인데 취소된 도장이 있다 — 옛 데이터를 확인할 것';
  end if;
end $$;
