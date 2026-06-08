# 결제 E2E 실측 테스트 — 머니패스 검증 체크리스트

> 정적 코드 점검(6차원 + 회귀 재검증)이 수렴한 뒤, **실제 토스 결제로 한 번
> 끝까지 돌려** 돈 배관을 확인하는 최종 단계. 코드로 정독·검증한 환급/적립/취소
> 로직을 실제 트랜잭션으로 재현한다.
>
> 대상 독자: 창업자(비개발). 각 단계의 **할 일 → 기대 결과 → SQL 확인**을 그대로
> 따라가면 된다. 하나라도 "기대"와 다르면 그 단계 번호와 SQL 결과를 캡처해 공유.

---

## 0. 준비

1. **토스 샌드박스 키** 발급 (운영 전환 전 테스트). Vercel(또는 .env.local)에:
   - `TOSS_SECRET_KEY` = 테스트 시크릿키 (`test_sk_...`)
   - `NEXT_PUBLIC_TOSS_CLIENT_KEY` = 테스트 클라이언트키 (`test_ck_...`)
   - 샌드박스는 실제 돈이 안 빠진다(테스트 카드 사용). 운영키로 바꾸기 전 여기서 전부 통과시킬 것.
2. **테스트 계정**: 새 이메일로 가입(노출된 `ian020529` 말고). 포인트·쿠폰을 admin 에서 수동 지급해 둔다.
   - admin → 포인트 수동 적립 10,000P, 첫구매 쿠폰(예: FIRSTBOX50) 1장.
3. **SQL 콘솔**: Supabase 대시보드 → SQL Editor. 아래 쿼리들을 실행해 확인.
4. 테스트할 강아지 1마리 등록 + 설문/분석 1회 완료(추천 박스가 나오게).

> ⚠️ 각 시나리오는 **새 주문**으로 진행(상태가 섞이지 않게). 주문번호(order_number)를
> 메모해 두면 SQL 추적이 쉽다.

---

## 시나리오 1 — 기본 구매 (포인트 + 쿠폰 사용)

**할 일**: 추천 박스 → 정기배송 신청 또는 단건 결제까지 진행. 결제 단계에서
**포인트 5,000P + 쿠폰** 적용 후 테스트카드로 결제 승인.

**기대 결과**
- 결제 성공 → 주문 완료 화면.
- 사용 포인트만큼 잔액 차감, 구매 적립 포인트(있으면) 증가.
- 쿠폰 used_count +1 (사용 처리).

**SQL 확인** (`:order` 자리에 order_number)
```sql
-- 주문 상태: paid 여야 함
select order_number, payment_status, order_status, total_amount,
       points_used, points_earned, points_refunded, coupon_code
from orders where order_number = ':order';

-- 원장: 사용(-)·적립(+) 정확? order_refund_* 는 아직 없어야 함
select reason, reference_type, delta, balance_after, created_at
from point_ledger
where user_id = (select user_id from orders where order_number=':order')
order by created_at desc limit 10;

-- 결제 원장: paid 양수 event 1건
select event_type, amount, prev_status, new_status, source
from payment_events
where order_id = (select id from orders where order_number=':order')
order by created_at;
```
✅ **합격**: payment_status=paid · points_refunded=0 · point_ledger 에 사용(-)·적립(+) 각 1건 · payment_events 에 paid(+) 1건.

---

## 시나리오 2 — 전량 취소 (시나리오 1 주문 사용)

**할 일**: 마이페이지 → 주문 → **전체 취소**.

**기대 결과**
- 환불 처리(테스트카드 환불). 주문 cancelled.
- **사용 포인트 전액 환급** + **구매 적립 포인트 회수** + **쿠폰 사용 복구**.

**SQL 확인**
```sql
select order_number, payment_status, order_status, refunded_amount,
       points_used, points_refunded
from orders where order_number = ':order';
-- ✅ payment_status=cancelled · points_refunded == points_used (전액 환급)

select reason, reference_type, delta from point_ledger
where user_id=(select user_id from orders where order_number=':order')
order by created_at desc limit 6;
-- ✅ order_refund_credit(+points_used) 1건 + order_refund_revoke(-points_earned) 1건

select status, amount, is_partial, refunded_by from refunds
where order_id=(select id from orders where order_number=':order');
-- ✅ refunds 행 1건(succeeded, is_partial=false)

select used_count from coupons where code = (
  select coupon_code from orders where order_number=':order');
-- ✅ used_count 가 시나리오1 대비 -1 (복구)
```
✅ **합격**: points_refunded == points_used · 적립 회수됨 · refunds 1건 · 쿠폰 used_count 복구.

---

## 시나리오 3 — 부분 취소 (단일) — 새 주문

**할 일**: 여러 품목 주문(포인트 일부 사용) → 마이페이지에서 **일부 품목만** 취소.

**기대 결과**: 취소 품목 비율만큼 부분 환불 + **비례 포인트 환급**. 주문은
partially_refunded(나머지 유효). 쿠폰은 유지(잔여 주문에 적용).

**SQL 확인**
```sql
select order_number, payment_status, refunded_amount, points_used, points_refunded
from orders where order_number=':order';
-- ✅ payment_status=partially_refunded · 0 < points_refunded < points_used (비례)

select reason, reference_type, delta from point_ledger
where user_id=(select user_id from orders where order_number=':order')
  and reference_type='order_refund_credit' order by created_at desc;
-- ✅ 비례 환급 1건(delta = floor(points_used × 취소가치/지불가치))
```
✅ **합격**: 부분 비례 환급 정확 · points_refunded < points_used · 쿠폰 used_count 변화 없음.

---

## 시나리오 4 — 순차 부분취소 (★회귀 가드 핵심) — 새 주문

> 점검에서 잡은 BLOCKER(2회차 환급 소실) + 회귀(과다환급)의 실측 검증.

**할 일**: 3품목 이상 주문(포인트 사용) → **A 품목 취소** → (잠시 후) **B 품목 취소**
→ 남은 품목까지 취소(전량 도달).

**기대 결과**: 매 취소마다 비례 포인트가 **누락 없이** 환급되고, **총 환급 합 ==
points_used**(초과·부족 없음). 마지막 취소로 전량 도달 시 적립 회수 + 쿠폰 복구.

**SQL 확인**
```sql
select points_used, points_refunded, payment_status
from orders where order_number=':order';
-- ✅ 최종: points_refunded == points_used · payment_status=cancelled

select reference_type, count(*), sum(delta)
from point_ledger
where user_id=(select user_id from orders where order_number=':order')
  and reference_type='order_refund_credit'
group by reference_type;
-- ✅ 여러 환급 row(각 부분취소 1건) · sum(delta) == points_used (초과 없음)

select count(*) from refunds
where order_id=(select id from orders where order_number=':order');
-- ✅ 부분취소 횟수만큼 refunds 행
```
✅ **합격**: 환급 합계 == points_used(2회차도 정상, 과다 없음) — 이게 핵심 통과 기준.

---

## 시나리오 5 — 정기구독 청구 (선택, 빌링키 필요)

**할 일**: 정기배송 신청(빌링 등록) → admin 또는 수동으로 `subscription-charge`
cron 1회 트리거(`Authorization: Bearer $CRON_SECRET`).

**기대 결과**: 카드 청구 1회 + 주문 paid + 다음 배송일 갱신. **재트리거해도 같은
날 중복 청구 안 됨**(멱등).

**SQL 확인**
```sql
select status, payment_key, scheduled_for, amount from subscription_charges
where subscription_id=':subId' order by created_at desc limit 5;
-- ✅ 성공 1건(succeeded, payment_key 존재) · 같은 scheduled_for 중복 없음

select next_delivery_date, last_charged_at, total_deliveries
from subscriptions where id=':subId';
-- ✅ next_delivery_date 가 미래로 갱신
```
✅ **합격**: 1회 청구 · 재트리거 시 중복 없음 · 다음 배송일 전진.

---

## 합격 종합 기준 (운영 전환 GO 조건)

- [ ] 시나리오 1~4 전부 SQL ✅ (특히 **4: 환급합 == points_used**)
- [ ] payment_events SUM 과 orders.refunded_amount 정합 (reconcile cron 수동 1회 실행 → mismatch 0)
- [ ] 적립 회수·쿠폰 복구가 전량취소에서 동작
- [ ] (정기구독 쓰면) 5번 멱등 통과

마지막으로 reconcile 수동 실행:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://www.farmerstail.kr/api/cron/payment-ledger-reconcile
# ✅ mismatchCount: 0
```

> 이 체크리스트가 전부 ✅ 면, 코드로 정독·검증한 머니패스가 실제 결제에서도
> 동일하게 동작함이 확인된 것 — 그때 토스 **운영키**로 전환해 실서비스 오픈.
