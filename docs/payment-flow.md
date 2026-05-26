# 결제 시스템 — 아키텍처 + 운영 가이드

R60~R64 마무리 후 정리. 솔로 운영자가 미래에 결제 디버깅·CS 대응할 때 참조.

## 1. 전체 흐름

```
사용자 → CheckoutForm → Toss 결제창 → /api/payments/confirm → orders 업데이트
                                                            ↓
                                                       payment_events 한 줄 insert (원장)
                                                            ↓
가상계좌 / 환불 / 만료      → /api/payments/webhook       → orders 업데이트 + 원장 insert
사용자 취소               → /api/orders/[id]/cancel      → orders 업데이트 + 원장 insert
부분 취소                → /api/orders/[id]/cancel-items → orders 업데이트 + 원장 insert
정기구독 자동결제           → /api/cron/subscription-charge → orders 업데이트 + 원장 insert
30분 미결제 만료           → /api/cron/order-expire        → orders 업데이트 + 원장 insert
```

## 2. 핵심 테이블

### orders — 현재 상태 (snapshot)
- payment_status: pending / paid / cancelled / refunded / partial_refund / failed
- order_status: pending / preparing / shipping / delivered / cancelled / expired
- **UPDATE 허용** — "현재 어떤 상태인지" 빠른 조회용

### payment_events — 원장 (insert-only ledger)
- **INSERT 만** — DB trigger 가 UPDATE/DELETE 영구 차단
- 모든 결제 이벤트 영원 보존. 환불은 음수 amount.
- SUM(amount) = 현재 잔액. 0 = 완전 환불.
- 8 event_type: paid / refunded / partial_refunded / failed / cancel_requested / webhook_received / admin_action / cron_refund_queue
- 8 source: user_checkout / toss_webhook / user_cancel / partial_cancel / cron_refund_queue / cron_subscription_charge / cron_order_expire / admin_panel

### payment_refund_queue — 자동 환불 재시도
- confirm 후 DB 업데이트 실패 → 자동 환불 → 또 실패 → 큐 적재 → cron 재시도 (5회 한)
- status: pending / succeeded / permanently_failed

### refunds — 환불 audit (별도)
- 부분 환불 시 어떤 item 들이 취소됐는지 audit row

## 3. CS 시나리오 대응

### "결제 됐는데 주문이 안 보여요"
1. Toss 대시보드에서 paymentKey 확인
2. /admin/orders 에서 그 order_id 검색
3. 안 보이면 → DB 업데이트 실패 케이스 → payment_refund_queue 확인
4. 또는 webhook 미수신 → /api/payments/webhook 으로 재처리 (paymentKey 만으로 re-fetch)

### "어제 환불해주세요"
1. /admin/orders/[id] 에서 PaymentEventTimeline 보기
2. paid 이벤트 + 환불 이벤트 있는지 시계열 확인
3. 환불 안 됐으면 partial cancel API 또는 Toss 대시보드 환불

### "이중 결제 됐어요"
1. webhook handler 의 idempotent check 가 막아줘야 정상
2. 막혔으면 — orders 의 동일 orderId 한 건만 paid. 다른 paymentKey 있으면 cancel
3. 막혔지만 Toss 에 paid 2건이면 — Toss 환불

## 4. 운영 대시보드

- **/admin/orders** — 주문 list + 상태 필터
- **/admin/orders/[id]** — 주문 상세 + payment_events 시계열
- **/admin/finance** — 일별 매출 (paid - refund = net)
- **/admin/refunds** — 환불 작업 (수동)

## 5. 환경 변수

```
TOSS_SECRET_KEY=live_sk_...    # 서버 only
TOSS_CLIENT_KEY=live_ck_...    # NEXT_PUBLIC_ 으로 노출
NEXT_PUBLIC_SITE_URL=https://www.farmerstail.kr
```

## 6. 보안 — 가이드라인 기준 95% 합격

✅ 결제 상태 세분화 (6+ states)
✅ PG↔DB 동기화 (webhook + re-fetch + 자동 환불 큐)
✅ 멱등성 (orderId 유니크, webhook idempotent)
✅ 부분 환불 (cancel-items 별도 API)
✅ 원장 불변성 (DB trigger 강제)
⚠️ 멀티 PG 추상화 — Toss 직접 호출, 다른 PG 추가 시 abstract layer

## 7. 위험 신호 — 즉시 대응

| 시그널 | 원인 | 대응 |
|---|---|---|
| payment_refund_queue 의 permanently_failed > 0 | 자동 환불 5회 실패 | Toss 대시보드 수동 환불 |
| /admin/finance 의 환불률 > 10% | 품질 문제 | feeding_outcomes 분석 |
| webhook 미수신 + 가상계좌 deposit_at > 2시간 | Toss 장애 가능 | Toss 상태 페이지 확인 |
| payment_events SUM != orders.refunded_amount | 데이터 불일치 | 수동 reconciliation |

## 8. 솔로 운영 체크리스트

매일:
- /admin/orders 신규 주문 확인
- /admin/finance 어제 매출 확인
- Sentry 결제 관련 error 확인

매주:
- payment_refund_queue 미해결 건 확인
- 환불 사유 분류 (feeding_outcomes.reason_category)

매월:
- /admin/finance 월간 추이
- 환불률 trend
- Toss 정산 vs DB 매출 reconciliation

## 9. 원장 trigger 검증 SQL — 운영자 sanity check

운영 시작 후 한 번씩 trigger 동작 확인. Supabase SQL Editor:

```sql
-- 1. 임의 row insert (orders 의 실 ID 필요)
INSERT INTO payment_events (
  order_id, event_type, amount, source
) VALUES (
  (SELECT id FROM orders LIMIT 1), 'paid', 0, 'admin_panel'
) RETURNING id;

-- 2. UPDATE 시도 → 에러 발생해야 정상
UPDATE payment_events SET amount = 99999 WHERE id = '...';
-- ERROR: payment_events is insert-only ledger; UPDATE/DELETE forbidden

-- 3. DELETE 시도 → 에러 발생해야 정상
DELETE FROM payment_events WHERE id = '...';
-- ERROR: payment_events is insert-only ledger; UPDATE/DELETE forbidden

-- 정리 — service_role 도 trigger 에 막힘. 실수로 만든 row 라도 못 지움.
-- → 운영 후 잘못된 데이터 영원히 남음. 신중하게 insert.
```

## 10. 미래 정리 백로그 (별도 R-cycle)

- **legacy CSS alias 정리**: `bg-bg-3`, `text-text` 같은 v3 token alias 53+/file 사용 중. globals.css 의 alias 정의는 시각 영향 0 (v3 token 의 alias) 이라 코드 일관성만 영향. 한 PR 에 한 파일씩 점진적 마이그레이션 권장.
- **off-scale font** 일괄 정리: `text-[11px]`, `text-[13px]` 등 V3FontSize 외 값. 마찬가지로 점진적.
- **멀티 PG 추상화**: 현재 Toss 직접 호출. 다른 PG (네이버페이/카카오페이) 추가 시점에 abstract layer 만들기. over-engineering 위험이라 PMF 후 진행.
