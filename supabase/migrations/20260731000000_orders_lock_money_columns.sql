-- 주문 원장을 서버가 소유한다 — orders UPDATE 권한 회수 (2026-07-31 감사)
--
-- # 문제 — subscriptions 를 잠그기 전과 **똑같은 구멍**이 orders 에 남아 있었다
-- RLS 는 본인 주문의 UPDATE 를 허용하고(`orders_update_own_or_admin`:
-- `auth.uid() = user_id OR is_admin()`), 컬럼 권한은 **전혀 잠겨 있지 않았다.**
-- 실측(2026-07-31, has_column_privilege):
--   authenticated · anon **둘 다** total_amount · subtotal · payment_status ·
--   order_status · refunded_amount · payment_key · paid_at · user_id 전부 true
--
-- 즉 고객이 REST 로 자기 주문 행을 직접 고쳐
--   · `total_amount` 를 낮추거나 (매출 기록 조작)
--   · `payment_status='paid'` 로 바꿔 **결제 없이 결제완료**를 만들거나
--   · `refunded_amount` 를 부풀리거나
--   · `user_id` 를 남에게 넘겨 자기 주문을 숨길 수 있었다.
-- orders 는 전자상거래법 §6 상 5년 보존 대상 거래기록이라, 조작되면 정산·환불
-- 분쟁에서 우리가 반박할 자료가 없어진다.
--
-- 1차(20260730000000)에서 subscriptions 를 잠그면서 orders 는 보지 못했다.
-- 청구는 subscriptions.total_amount 로 하므로 **돈이 덜 빠져나가지는 않지만**,
-- 기록이 오염되는 것은 별개의 피해다.
--
-- # 조치 — 전면 회수 (subscriptions 처럼 화이트리스트가 필요 없다)
-- 저장소 전수 확인: `orders` 를 UPDATE 하는 곳은 **16곳 전부 서버 라우트·크론**이고
-- 모두 service_role(admin) 클라이언트를 쓴다. 고객 화면이 orders 를 쓰는 코드는
-- 0건이다(`'use client'` 파일 중 orders 를 update 하는 곳 없음).
-- 유일한 예외였던 `/api/admin/orders/[id]/status` 는 쿠키 클라이언트를 쓰고
-- 있어서 이 마이그레이션과 **같은 커밋에서** admin 클라이언트로 옮겼다 —
-- 권한을 잠그면 그 칸을 쓰던 코드가 조용히 죽는다는 것을 오늘 카드 등록에서
-- 겪었기 때문에, 잠금과 호출부를 반드시 같이 본다(규칙13).
--
-- SELECT 는 유지한다 — 고객이 자기 주문 내역을 봐야 한다(RLS 가 범위를 지킨다).
-- INSERT 도 유지한다 — 주문 생성은 아직 클라이언트 경로가 있고, 그건 구독 생성
-- 이관(20260730000500)과 같은 후속 작업이다.
--
-- anon 은 애초에 로그인 사용자의 주문을 만질 이유가 없다 → INSERT 도 함께 회수.

revoke update on public.orders from authenticated;
revoke update on public.orders from anon;
revoke insert on public.orders from anon;

comment on table public.orders is
  '주문 원장. 전자상거래법 §6 상 5년 보존 대상 — 금액·결제상태·환불액은 서버(service_role)만 쓴다(2026-07-31). RLS 는 본인 행 UPDATE 를 허용하지만 컬럼 권한이 없어 실제로는 못 쓴다. 고객 화면은 SELECT 만.';
