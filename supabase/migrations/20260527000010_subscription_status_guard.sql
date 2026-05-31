-- R96-E (D7): 정기구독 상태 전이 가드.
--
-- # 문제
-- subscriptions 상태 전이가 전부 클라이언트 직접 Supabase write 이고,
-- RLS (subs_update_own_or_admin) 는 user_id 소유권만 검사하고 status
-- 전이는 검증하지 않는다. status 컬럼엔 CHECK/enum 도 없다 (baseline).
--
-- 그 결과 악의적/버그성 클라이언트가
--   .update({ status:'active', next_delivery_date:<과거> }).eq('id', …)
-- 로 **해지(cancelled)된 구독을 부활 + 즉시 청구**시킬 수 있다 (UI 는
-- cancelled 구독에 버튼을 안 그리지만 방어선이 UI 뿐).
--
-- # Fix
-- BEFORE UPDATE 트리거로 terminal 상태 (cancelled) 에서 비-cancelled 로의
-- 전이를 차단. cancelled 는 영구 종료 상태 — 재개하려면 새 구독 신청.
-- (트리거는 미래 UPDATE 만 영향, 기존 데이터 무관 — 안전 적용.)

CREATE OR REPLACE FUNCTION public.guard_subscription_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- cancelled → (active/paused 등) 부활 차단. cancelled → cancelled 는 허용
  -- (다른 컬럼 갱신 가능).
  IF OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION
      'cancelled subscription cannot be reactivated (id=%); create a new subscription instead',
      OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_subscription_status ON public.subscriptions;
CREATE TRIGGER trg_guard_subscription_status
  BEFORE UPDATE OF status ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_subscription_status_transition();

COMMENT ON FUNCTION public.guard_subscription_status_transition() IS
  'R96-E (D7): cancelled 구독 부활(즉시 청구) 차단 — UI 가드 우회 방어';
