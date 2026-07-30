-- 구독 생성도 서버가 소유한다 — subscriptions·subscription_items INSERT 회수
-- (2026-07-30 최종감사 후속 · 1차 ①의 남은 절반)
--
-- # 남아 있던 구멍
-- 20260730000000 이 `subscriptions` 의 **UPDATE** 권한을 화이트리스트로 잠갔지만
-- **INSERT 는 열려 있었다.** 그 주석에도 이렇게 적어 뒀다:
--   "남은 구멍: INSERT 는 여전히 클라이언트가 total_amount 를 넣는다 →
--    구독 생성을 서버 라우트로 옮기는 것이 근본 해결(후속, 주석에 기록)."
--
-- 주문 화면이 직접 insert 했기 때문에 금액·상태·배송횟수가 전부 브라우저에서 온
-- 값이었다. 즉 `{"total_amount": 100}` 으로 구독을 만들면 청구 크론이 그 저장값을
-- 그대로 긁는다 — **저장 금액으로 청구한다는 것이 우리 정본 규칙**이므로
-- (20260730000000 · charge-amount-guard 참조) 100원만 내고 박스를 계속 받을 수
-- 있었다. 재계산 검문소를 알림 전용으로 바꾼 것도 이 층위에서 막는다는 전제였다.
--
-- # 조치
-- `POST /api/subscriptions/create` 신설. 서버가
--   · 강아지 소유권 확인
--   · 주문 화면과 **같은 입력**(cycle 1 처방 + is_active 제품 + 요청 화식 티어)으로
--     같은 순수함수(computeBoxItems·priceBox)를 돌려 **금액을 직접 계산**
--   · 화면이 보여준 금액과 다르면 **거부**(가격이 바뀐 채 동의 없는 금액을
--     청구하지 않기 위해 — 조용히 새 금액으로 만들지 않는다)
--   · status·next_delivery_date·total_deliveries·customerKey 도 서버가 정함
-- 을 하고, 품목까지 같은 트랜잭션 흐름에서 만든다(실패 시 구독 취소).
--
-- 클라이언트가 보내는 것은 배송지·화식 티어·**검산용 금액**뿐이다.
--
-- 적용 전 실측: 저장소에서 이 두 표를 INSERT 하는 곳은 전부 서버 라우트
-- (subscriptions/create · personalization/approve · cron/subscription-charge)이고
-- 모두 service_role(admin) 클라이언트를 쓴다 → 회수해도 깨지는 경로가 없다.
--
-- # 남는 것
-- anon 은 이미 전면 차단돼 있다. 이제 고객(authenticated)은 이 두 표에 대해
-- **SELECT + 정해진 4칸 UPDATE** 만 할 수 있다(status·next_delivery_date·
-- reminder_enabled·last_failed_charge_reason — 건너뛰기·일시정지·해지용).
-- 돈에 닿는 칸은 어느 방향으로도 클라이언트가 쓸 수 없다.

revoke insert on public.subscriptions from authenticated;
revoke insert on public.subscriptions from anon;
revoke insert on public.subscription_items from authenticated;

comment on table public.subscriptions is
  '정기배송. 금액·상태·배송일은 서버 소유 — 생성은 POST /api/subscriptions/create, 수정은 지정된 4칸만 고객이 UPDATE 가능(20260730000000). 청구는 저장된 total_amount 로 하므로 이 표에 클라이언트가 금액을 쓸 수 있으면 그대로 저청구가 된다(2026-07-30).';
