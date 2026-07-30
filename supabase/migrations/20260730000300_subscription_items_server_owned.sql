-- 박스 내용은 서버가 소유한다 — subscription_items UPDATE/DELETE 회수
-- (2026-07-30 최종감사 4차)
--
-- # 문제 1 — 이 표가 주문 원장으로 흘러간다
-- `subscription_items` 는 화면 9곳이 "실제 배송 박스"로 읽고, 청구 크론이
-- 그대로 **`order_items` 로 복사**한다(subscription-charge/route.ts).
-- 그런데 authenticated 에게 UPDATE·DELETE·INSERT 가 전부 열려 있었고,
-- `unit_price` 컬럼도 쓸 수 있었다(실측: has_column_privilege = true).
--
-- 청구 자체는 `subscriptions.total_amount` 로 하므로 **돈이 덜 빠져나가지는
-- 않는다.** 대신 고객이 unit_price 를 100 으로 바꾸면 그 값이 주문 품목으로
-- 복사돼 **주문내역·admin 주문 상세·재고 예측이 전부 그 금액을 사실로 표시**한다.
-- 환불·분쟁·정산의 근거가 되는 기록이라 조작되면 우리가 반박할 자료가 없다.
--
-- # 문제 2 — 처방을 승인해도 이 표가 안 바뀌었다
-- 저장소 전체에서 이 표는 **insert 만 있었고 update 가 한 곳도 없었다.**
-- 승인 후 실제 상태:
--   · 실제 포장(피킹 리스트) = dog_formulas + boxPricing → 새 처방  ✔
--   · 청구액(subscriptions.total_amount) = 승인 시 갱신      → 새 금액  ✔
--   · 화면 9곳 · 주문내역(order_items)  = subscription_items → 옛 레시피 ✘
-- 고객은 닭고기를 승인하고 닭고기 값을 내고 닭고기를 받는데, 주문내역에는
-- 소고기가 적혀 있었다. 문의가 오면 우리도 무엇이 맞는지 알 수 없다.
--
-- # 조치
-- 이제 `/api/personalization/approve` 가 승인 시 service_role 로 이 표를 다시
-- 만든다(지우고 넣기 — 라인 구성 자체가 바뀌므로 행 upsert 로는 없어진 라인이
-- 남는다). 고객이 쓸 이유가 사라졌으므로 UPDATE·DELETE 를 회수한다.
--
-- INSERT 는 **남긴다** — 가입 시 클라이언트(OrderClient)가 아직 직접 넣는다.
-- 그래서 삽입 시점 조작은 여전히 열려 있다. 근본 해결은 구독 생성을 서버
-- 라우트로 옮기는 것이고(subscriptions 도 같은 상태 — 20260730000000 주석 참조),
-- 그때 이 INSERT 도 함께 회수한다. 여기서 미리 막으면 가입이 즉시 깨진다.
--
-- 적용 전 실측:
--   authenticated: update=true, delete=true, insert=true, unit_price 쓰기 가능
--   저장소 전체에서 subscription_items 의 update/delete 호출 0건 → 회수해도
--   깨지는 코드 경로가 없다.
--   행 9개(모두 정상 가입분).

revoke update, delete on public.subscription_items from authenticated;
revoke update, delete on public.subscription_items from anon;

-- anon 은 애초에 이 표를 만질 이유가 없다(로그인 사용자의 구독 품목).
revoke insert on public.subscription_items from anon;

comment on table public.subscription_items is
  '구독 박스의 품목 스냅샷. 정본은 dog_formulas + lib/personalization/boxPricing 이고 이 표는 그 파생이다 — 처방이 승인되면 서버가 다시 만든다(/api/personalization/approve). 청구 크론이 order_items 로 복사하는 값이라 조작되면 주문 원장이 오염된다: UPDATE/DELETE 는 service_role 전용(2026-07-30). INSERT 는 가입 화면이 아직 직접 하므로 남아 있고, 구독 생성을 서버로 옮길 때 함께 회수한다.';

comment on column public.subscription_items.unit_price is
  '한 팩 표시 단가(boxPricing 의 pricePerPack, 10원 올림). ⚠️ 청구 근거가 아니다 — 청구는 subscriptions.total_amount. 이 값들로 다시 합계를 만들면 올림이 누적돼 총액이 어긋난다.';
