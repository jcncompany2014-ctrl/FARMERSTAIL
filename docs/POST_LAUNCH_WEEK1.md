# 출시 첫 주 SOP — 일상 운영 가이드

> 자고 일어나서 매일 아침 보는 문서. 출시 +14일 까지가 가장 변수 많은 시기.
> 의사결정 부하 ↓ 위해 순서·시간·기준 미리 박아둠.

작성: 2026-05-27 · 다음 갱신: 출시 +14일 회고 후

---

## 🎬 Day 0 — 출시 당일

### 출시 직전 1시간 (D-Day 09:00 ~ 10:00 권장)

```powershell
cd C:\Users\A\Desktop\projects\farmerstail-app

# 1. 마지막 배포 상태 확인
git log --oneline -5
git status

# 2. Vercel 최신 배포 Ready?
# https://vercel.com/dashboard

# 3. Toss 운영 키 (LIVE) 셋업 확인 — Vercel ENV 에서
# TOSS_SECRET_KEY = live_sk_...
# NEXT_PUBLIC_TOSS_CLIENT_KEY = live_ck_...
```

✅ Toss 입점심사 통과 → 키 교체 안 됐으면 **출시 보류**. 테스트 키로 결제 받으면 실제 입금 안 됨.

### 출시 10:00 ~ 첫 주문까지

**SNS 공지 순서** (이미 작성된 BETA_OUTREACH.md 활용):
1. 인스타그램 피드 — 브랜드 소개 + 첫 SKU 5장 (오전 10시)
2. 카카오톡 채널 단체 메시지 — 베타 10명 시드 (오전 11시)
3. 인스타 스토리 + 카카오 채널 alert — 가입 시 5,000원 쿠폰 (점심 12시)
4. 친구·가족 5명에게 진심 부탁 메시지 (오후 1시)

**홈에서 직접 점검할 것:**
- [ ] 홈 페이지 → `/products` → 5종 SKU 다 떠?
- [ ] `/products/[slug]` → 가격·이미지·재고 정상?
- [ ] `/signup` → 가입 폼 정상 작동?
- [ ] `/cart` → 빈 카트 표시 OK?
- [ ] `/legal/privacy` `/business` → 사업자 정보 정확?
- [ ] `/contact` → 폼 제출 → 본인 메일 도착?
- [ ] `/r/FT-XXXXXX` (본인 코드 테스트) → /signup?ref= 자동?

### 첫 주문 도착 시 — 30분 안에 처리

1. **알림 확인**: 환영 메일 + 본인 메일에 admin 알림
2. **Toss 콘솔**: 결제 정상 승인됨? 가상계좌면 입금 대기
3. **`/admin/orders/[id]`**: 주문 상태 = "paid"
4. **payment_events 타임라인**: paid 이벤트 정상 기록
5. **재고 차감 확인**: `/admin/products/[id]` → 재고 -1
6. **출고 준비**: 송장 출력 (CJ대한통운 또는 사용 배송사)
7. **사용자에게 카카오/SMS 알림**: "주문 잘 받았어요! 내일 출고 예정"

> **첫 주문 한 건은 사진 찍어두기.** 인스타 후속 콘텐츠 + 본인 기록용.

---

## 🌅 Day 1-7 — 매일 아침 루틴 (15분)

### 09:00 — 인프라 점검 (5분)

```powershell
# Health check
curl https://www.farmerstail.kr/api/health | jq '.status'
# → "ok" 이어야 함. "degraded" 면 dependencies 확인.

# Vercel 어제 배포들
gh run list --limit 5

# Sentry — 어제 새 error 있나
# https://farmerstail.sentry.io
```

✅ status="ok" + Sentry 새 error 0건 → 다음
⚠️ degraded → `docs/DISASTER_RECOVERY.md` 시나리오 진단
🔥 Sentry error 5건+ → 즉시 Sentry 로 가서 stack trace 확인

### 09:05 — 주문 통계 (3분)

Supabase SQL Editor:
```sql
-- 어제 vs 그제 주문 수 + 매출
SELECT
  date_trunc('day', created_at) AS day,
  count(*) AS orders,
  sum(total_amount) AS revenue
FROM public.orders
WHERE status = 'paid'
  AND created_at >= current_date - interval '7 days'
GROUP BY 1
ORDER BY 1 DESC;
```

기록: **어제 주문 N건, 매출 ₩X** 를 본인 노트(가능하면 Notion/엑셀) 에.

### 09:08 — CS 응대 (5분)

확인 순서:
1. **story@farmerstail.kr 받은편지함** — 24h 룰 (전일 받은 메일 응대)
2. **카카오톡 채널** — 미응답 메시지 (한 줄이라도 답)
3. **/contact 폼 제출** — Resend 대시보드에서 stats

**응답 템플릿**: `docs/CS_TEMPLATES.md` 의 13개 카테고리 활용.

> ⚠️ **알러지 클레임은 즉시 처리.** 사진 요청 → 환불 + 사과 + 다음 박스 50% off 쿠폰.

### 09:13 — 재고 점검 (2분)

```sql
-- 재고 5개 이하 SKU
SELECT slug, name, stock_qty
FROM public.products
WHERE is_active = true AND stock_qty <= 5
ORDER BY stock_qty;
```

3 이하 → 즉시 발주. 0 → `/admin/products/[id]` 에서 비활성화 또는 "재입고 알림" 모드.

---

## 📊 주 1회 (일요일 저녁 권장) — 30분

### 1) 한 주 KPI 정리 (10분)

```sql
-- 가입자 / 첫 결제 / 정기 가입 / 환불 한 주 통계
SELECT
  (SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '7 days') AS new_signups,
  (SELECT count(DISTINCT user_id) FROM public.orders
     WHERE status = 'paid' AND created_at >= now() - interval '7 days') AS unique_buyers,
  (SELECT count(*) FROM public.dog_subscriptions
     WHERE status = 'active' AND created_at >= now() - interval '7 days') AS new_subscriptions,
  (SELECT count(*) FROM public.payment_events
     WHERE event_type IN ('refunded','partial_refunded')
     AND created_at >= now() - interval '7 days') AS refunds;
```

기록 + 일주일 트렌드 (지난 주 대비 ±%).

### 2) SKU 성과 (5분)

```sql
SELECT
  p.slug, p.name,
  count(oi.id) AS sold,
  sum(oi.unit_price * oi.quantity) AS revenue
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
JOIN public.products p ON p.id = oi.product_id
WHERE o.status = 'paid'
  AND o.created_at >= now() - interval '7 days'
GROUP BY p.slug, p.name
ORDER BY revenue DESC;
```

**Top 3 = 다음 주 광고 / 인스타 포스팅 우선순위**.
**Bottom 1-2 = 라벨/사진 개선 또는 단종 검토**.

### 3) 베타 유저 피드백 정리 (5분)

- 카카오 채널 + 이메일에서 받은 텍스트 피드백 5개 모아 메모
- 공통 불만 1-2개 추출 → 다음 주 fix backlog 에 추가
- 좋은 피드백 1개 → 인스타 후기 콘텐츠 (사용자 동의 후)

### 4) 다음 주 콘텐츠 준비 (10분)

- 블로그 1편 초안 (작성은 평일 짬짬이) — 토픽은 `supabase/seed/blog-posts.sql` 의 10편 외 새 토픽
- 뉴스레터 1편 토픽 — Vol. 02 준비
- 인스타 5장 (제품 1, 후기 1, 영양 정보 1, 비하인드 1, CTA 1)

---

## 🚨 위급 상황 분기

### A. 사이트 다운 / 결제 폭주 실패
→ `docs/DISASTER_RECOVERY.md` Section 2 참조

### B. 부정 환불 신청 의심
**증거 수집 순서:**
1. `/admin/orders/[id]` → payment_events 타임라인
2. `/admin/users/[id]` → 가입 IP, 디바이스, 이전 환불 이력
3. `coupon_redemptions` → 동일 IP/이메일 다중 가입 의심
4. **3건 이상 패턴 → 사용자 정지 + Toss 분쟁 신청 검토**

### C. 알러지 클레임
**즉시 처리 우선순위 절대 1위.** 한 명의 알러지 사고가 펫푸드 브랜드 전체를 죽임.
1. 사진 + 강아지 증상 메시지 즉시 요청
2. 전액 환불 + 사과 메일
3. 동물병원 진료비 환급 제안 (영수증 제출 시)
4. 해당 SKU 의 알러지 표시 점검 (`/admin/products/[id]`)
5. **같은 단백질 라인 다른 주문자에게 사전 알림** 검토

### D. 재고 0 + 주문 들어옴
1. 즉시 Toss 결제 취소 + 환불 (전액)
2. 사용자 사과 메시지 + 5,000P 적립 보상
3. `/admin/products/[id]` 비활성화
4. 자동화 점검 — 왜 sold_out 처리 안 됐는지 (`sales_count` 트리거 확인)

### E. 사기성 카드 결제 / chargeback
- Toss 가맹점 콘솔 → 분쟁 알림 즉시 확인
- 환불 처리 + 사용자 일시 정지
- **chargeback 3건 이상 → Toss 가맹점 위험도 ↑, 즉시 1:1 문의**

---

## 📋 첫 주 (D-Day +7) 회고 체크리스트

- [ ] 누적 가입자 ___ 명
- [ ] 누적 주문 ___ 건, 매출 ₩___
- [ ] 정기배송 가입 ___ 건
- [ ] CS 응대 평균 응답 시간 ___ 시간
- [ ] Sentry 누적 error ___ 건 (resolved %)
- [ ] Top SKU: ___________
- [ ] Bottom SKU: __________
- [ ] 베타 유저 NPS (1-10) 평균: ___
- [ ] 다음 주 fix backlog: 1) ____ 2) ____ 3) ____

이 데이터 가지고 다음 주 의사결정. KPI 트렌드가 좋으면 광고 시작 검토, 나쁘면 fix 우선.

---

## 🌱 한 달 (D-Day +30) 마일스톤

- [ ] 50명 베타 유저 달성 (현재 ___)
- [ ] LTV 추정 (cumulative_spend / users) ___ 원
- [ ] 정기배송 retention 1개월 ___ %
- [ ] 광고 ROAS 측정 시작 (만약 광고 돌렸다면)
- [ ] /about 페이지 픽션 디테일 컨펌 (USER_ACTIONS #8)
- [ ] Admin audit log wiring (R77-P2 PMF 후 작업)
- [ ] 단종 SKU 결정 (있다면)
- [ ] 다음 SKU 라인 기획 시작

---

## 💡 메모

- "자고 일어나서 가장 먼저 보는 화면"을 Vercel + Sentry + 받은편지함 3개로 고정
- 일주일 데이터가 쌓이기 전까진 KPI 보고 일희일비 X — n=10 이하 노이즈
- CS 응답은 진심으로. 솔로 운영자의 경쟁력 = 직접 답하는 진정성
- 매일 결정해야 할 게 너무 많다 → 이 문서가 그 일부를 미리 결정해둔 것
