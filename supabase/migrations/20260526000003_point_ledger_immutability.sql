-- R71 — point_ledger insert-only 원장 패턴 강제.
--
-- 이미 atomic RPC (apply_point_delta) 가 정상 insert 만 수행. 그러나
-- 누군가 실수로 또는 admin client 로 UPDATE/DELETE 시 잔액 무결성 깨짐.
-- payment_events 와 동일 패턴 (R60) — DB trigger 로 영구 차단.
--
-- # 잔액 계산
--  apply_point_delta RPC 가 prev balance + delta 로 balance_after 기록.
--  잘못 update 하면 다음 row 의 balance_after 가 어긋남.
--  → trigger 가 영구 차단해서 분식 불가능.

CREATE OR REPLACE FUNCTION public.block_point_ledger_mutations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'point_ledger is insert-only; UPDATE/DELETE forbidden (op=%, id=%)',
    TG_OP, COALESCE(NEW.id, OLD.id);
END;
$$;

DROP TRIGGER IF EXISTS point_ledger_no_update ON public.point_ledger;
CREATE TRIGGER point_ledger_no_update
  BEFORE UPDATE ON public.point_ledger
  FOR EACH ROW EXECUTE FUNCTION public.block_point_ledger_mutations();

DROP TRIGGER IF EXISTS point_ledger_no_delete ON public.point_ledger;
CREATE TRIGGER point_ledger_no_delete
  BEFORE DELETE ON public.point_ledger
  FOR EACH ROW EXECUTE FUNCTION public.block_point_ledger_mutations();

COMMENT ON FUNCTION public.block_point_ledger_mutations() IS
  '포인트 원장 불변성 강제. INSERT 만 허용. R71.';
