-- 🚨 보안 (2026-07-16) — **누구나 스스로 나무(최고) 등급을 줄 수 있었다.** 프로덕션 적용 완료
--
-- # 문제
-- `Users can update own profile` 정책은 `USING (auth.uid() = id)` — 본인 행 **전체**를
-- 수정할 수 있다. 그런데 profiles 에는 **로열티 값**이 같이 산다:
--   · stamp_count      도장 개수 = 등급의 기준 (2026-07-16 신설)
--   · tier             등급
--   · cumulative_spend 누적 결제액
--
-- 실증(롤백 테스트): authenticated 로 `update profiles set stamp_count = 999`
-- → 등급 트리거가 발화해 **seed → mate(나무)**. 나무 혜택은 **매 청구 10% 자동 할인**
-- (lib/discount.ts) 이므로 **누구나 스스로 영구 10% 할인** → 실제 금전 손실.
--
-- ⚠️ stamp_count 는 오늘 추가했지만 **구멍 자체는 이전부터 있었다** — cumulative_spend 를
-- 직접 올려도 똑같이 등급이 올라갔다. 등급 기준을 바꾸면서 드러난 것.
--
-- # 고침
-- `role` 은 이미 prevent_profile_role_change 로 지키고 있었다. **같은 패턴**을 로열티
-- 컬럼에도 적용. 정상 경로(결제 트리거·도장 트리거·service_role)는 auth.uid() 가 NULL
-- 이라 통과한다.
--
-- # 검증 (프로덕션, 롤백)
-- · 일반 회원이 stamp_count=999 → **차단**
-- · 본인 이름 수정 → **정상**(과잉 차단 아님)
-- · 결제 → 도장 → 등급 → **도장 1 · sprout 정상**
-- (⚠️ 처음엔 사장님 계정으로 테스트해서 "안 막혔다"고 나왔다 — admin 은 허용이 맞다.
--   보안 테스트는 **반드시 일반 회원 관점**으로 할 것.)

create or replace function public.prevent_profile_loyalty_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  IF NEW.stamp_count IS DISTINCT FROM OLD.stamp_count
     OR NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.tier_updated_at IS DISTINCT FROM OLD.tier_updated_at
     OR NEW.cumulative_spend IS DISTINCT FROM OLD.cumulative_spend
  THEN
    -- auth.uid() IS NULL = service_role / 트리거 내부(SECURITY DEFINER) → 허용.
    -- 도장·누적금액을 올리는 정상 경로가 전부 여기다.
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND (u.raw_app_meta_data ->> 'role') = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'forbidden: profiles 의 등급·도장·누적금액은 결제/도장 트리거와 admin 만 바꿀 수 있습니다'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

comment on function public.prevent_profile_loyalty_change() is
  '⚠️ 2026-07-16: profiles 의 stamp_count/tier/cumulative_spend 를 본인이 직접 고쳐 **스스로 나무 등급(매 청구 10% 할인)** 을 받을 수 있었다(실증). role 을 지키던 패턴을 로열티 컬럼에도 적용. 정상 경로(결제·도장 트리거·service_role)는 auth.uid() 가 NULL 이라 통과한다.';

drop trigger if exists profiles_lock_loyalty on public.profiles;
create trigger profiles_lock_loyalty
  before update of stamp_count, tier, tier_updated_at, cumulative_spend
  on public.profiles
  for each row execute function public.prevent_profile_loyalty_change();
