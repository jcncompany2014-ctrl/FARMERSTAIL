# 운영 cheatsheet — 자주 쓰는 1페이지

> 명령어만 모음. 자세한 설명은 `LAUNCH_CHECKLIST.md` / `USER_ACTIONS.md` / `docs/payment-flow.md` / `docs/RUNBOOK.md` 참고.

---

## 🚀 배포 / Git

```powershell
# 현재 상태 확인
cd C:\Users\A\Desktop\projects\farmerstail-app
git status
git log --oneline origin/main..HEAD     # 푸시 안 된 commit

# 푸시 (Vercel 자동 배포 트리거)
git push origin main

# 마지막 배포 rollback (긴급 상황)
# Vercel 대시보드 → Deployments → 직전 Ready 배포 → ⋯ → Promote to Production
```

## 🔬 코드 검증

```powershell
# 푸시 전 검증 (eslint + tsc + 1032 tests)
npm run verify

# tsc만 빠르게 (60초)
npx tsc --noEmit

# 특정 파일만 lint
npx eslint app/admin/products/ProductForm.tsx

# Vercel 빌드 환경과 동일하게 (.next 캐시 무시)
Remove-Item -Recurse -Force .next; npx next build
```

## 📧 뉴스레터 발송

```powershell
# 1) 발송 대상 수 확인 (실제 발송 X)
npm run newsletter:vol-01:dry

# 2) 본인 메일로 테스트
npm run newsletter:vol-01:test story@farmerstail.kr

# 3) confirmed 구독자 전원에게 일괄 발송
npm run newsletter:vol-01:send
```

⚠️ 위 명령어는 `.env.local` 의 `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SITE_URL` 자동 로드 (Node 24 `--env-file-if-exists`). 셸 export 불필요.

## 🧪 테스트

```powershell
# 전체 테스트 (1032개)
npm test

# 특정 파일만
node --experimental-strip-types --disable-warning=ExperimentalWarning --test lib/business.test.ts

# Playwright E2E
npm run test:e2e
```

## 🔧 Vercel

```
대시보드: https://vercel.com/farmerstail/farmerstail
env 추가:  https://vercel.com/farmerstail/farmerstail/settings/environment-variables
배포 목록: https://vercel.com/farmerstail/farmerstail/deployments

수동 재배포 (env 변경 후):
  Deployments → 최근 ⋯ → Redeploy
  ⚠️ "Use existing Build Cache" 해제
```

## 🗄️ Supabase

```
SQL Editor:  https://app.supabase.com/project/adynmnrzffidoilnxutg/sql
Auth:        https://app.supabase.com/project/adynmnrzffidoilnxutg/auth/users
Storage:     https://app.supabase.com/project/adynmnrzffidoilnxutg/storage/buckets
Logs:        https://app.supabase.com/project/adynmnrzffidoilnxutg/logs
```

### 자주 쓰는 SQL

```sql
-- 신규 가입자 (오늘)
SELECT COUNT(*) FROM auth.users WHERE created_at > current_date;

-- 결제 원장 SUM 검증 (잔액 정합성)
SELECT order_id, SUM(amount) AS net
FROM payment_events
GROUP BY order_id
HAVING SUM(amount) < 0;  -- 음수면 정합성 깨짐

-- 정기배송 활성 구독자
SELECT user_id, COUNT(*) FROM dog_subscriptions
WHERE status = 'active'
GROUP BY user_id ORDER BY COUNT(*) DESC;

-- 마이그레이션 적용 카운트
SELECT COUNT(*) FROM supabase_migrations.schema_migrations
WHERE version >= '20260423000000';
```

## 📊 모니터링 / 로그

```
Sentry (에러):       https://sentry.io/organizations/farmerstail
Vercel Logs:        https://vercel.com/farmerstail/farmerstail/logs
Microsoft Clarity:   https://clarity.microsoft.com
Resend Logs:        https://resend.com/emails
GA4:                https://analytics.google.com
Google Search Console: https://search.google.com/search-console
네이버 서치어드바이저:  https://searchadvisor.naver.com
Bing Webmaster Tools:  https://www.bing.com/webmasters

헬스체크:            curl https://www.farmerstail.kr/api/health
```

## 💳 결제 (Toss)

```
콘솔:    https://app.tosspayments.com
가맹점:  https://app.tosspayments.com/customers
운영키:  https://app.tosspayments.com/developers/api-keys
Webhook: https://app.tosspayments.com/developers/webhook
정산:    https://app.tosspayments.com/settlements/list
```

## 🐛 사이트 다운 시 (긴급 SOP)

```powershell
# 1. Vercel 상태 확인
curl https://www.farmerstail.kr/api/health
# 200 OK 정상 / 503 degraded / timeout 다운

# 2. Vercel 자체 인프라
# https://www.vercel-status.com — Vercel 측 issue 면 대기 외 방법 X

# 3. Sentry 에러 폭증 확인
# https://sentry.io → Issues → 최근 1시간

# 4. 직전 배포로 rollback
# Vercel Deployments → 직전 "Ready" 배포 → ⋯ → Promote to Production
```

## 📧 결제 실패 폭증 시

```powershell
# 1. Toss 가맹점 상태
# https://app.tosspayments.com → 가맹점 → 운영 상태

# 2. Sentry 결제 에러
# Sentry → Filter: webhook/payments → 최근 1시간

# 3. payment_events 정합성 (SQL Editor)
SELECT order_id, payment_status, total_amount, refunded_amount, paid_amount,
       (SELECT SUM(amount) FROM payment_events WHERE order_id = o.id) AS ledger_sum
FROM orders o
WHERE created_at > now() - interval '24 hours'
  AND payment_status IN ('paid', 'partial_refund', 'refunded');
-- ledger_sum != (total_amount - refunded_amount) 이면 불일치

# 4. 환불 큐 점검
SELECT * FROM payment_refund_queue WHERE status = 'pending' ORDER BY created_at;
```

## 📬 메일 발송 안 됨

```
1. Resend 상태:           https://resend-status.com
2. Resend Logs:           https://resend.com/emails → 최근 24h fail rate
3. 도메인 verified 유지:    https://resend.com/domains → farmerstail.kr 상태
4. 카페24 DNS 변동 점검:    https://dns.google/resolve?name=farmerstail.kr&type=TXT
```

## 🔄 매일 5분 루틴

```
1. Sentry → 새 Issue 확인
2. /admin/orders → 신규 주문 처리
3. 1:1 문의 (이메일) 응답
4. Toss 정산 확인 (있으면)
```

## 📅 매주 30분 루틴

```
1. /admin/cohort → 신규 가입 추세
2. /admin/finance → 매출/환불 정합성
3. Clarity → 세션 녹화 5개 시청
4. GSC + 네이버 색인 / 검색어 점검
```

## 📅 매월 2시간 루틴

```
1. 뉴스레터 발송 (Vol. XX)
2. 블로그 글 1-2개 추가
3. 사용자 인터뷰 2-3건 (PMF 검증)
4. 세무사에게 매입/매출 정리 자료 전달
```
