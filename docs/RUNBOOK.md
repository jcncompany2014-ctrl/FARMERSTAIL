# Farmer's Tail 운영 런북

운영 중 자주 발생하는 사고 / 점검 / 키 회전 절차.

> **원칙**: 사용자 영향 큰 사고 (결제 / 로그인 / DB) 는 5분 내 1차 대응 시작.
> **단, 데이터 destructive 작업은 절대 혼자 결정 안 함** — 백업 + 검토 후 실행.

---

## 1. 결제 실패 폭증

**증상**: `/admin/subscriptions/charges` 의 30일 성공률 하락 / Sentry 에 `subscription.charge.failed` warning 폭주 / 사용자 CS 문의 급증.

### 1차 대응 (5분)
1. `/admin/subscriptions/charges` → 실패 큐 보기. 같은 errorCode 가 다수면 **Toss 측 장애** 가능.
2. [Toss 가맹점 콘솔](https://docs.tosspayments.com/) → 장애 공지 / 결제 정지 여부 확인.
3. 장애면 cron 일시 정지: Vercel → Project Settings → Crons → `/api/cron/subscription-charge` 비활성. 다음 cron run 까지 기다림.

### 2차 대응 (30분)
- 사용자 단위 실패 (카드 만료 / 잔액 부족) — 자동으로 `subscription-charge-failed` 이메일 발송됨. 추가 액션 불요.
- 시스템 단위 실패 (Toss API 5xx) — Toss 와 통화 + Sentry replay 로 원인 파악.

### 사후
- Sentry 에서 `business.event=1 AND tag.event=subscription.charge.paused` 카운트 확인. 3회 누적 paused 사용자 수 = 매출 즉각 손실.
- 카드 갱신 안내 별도 push / 카톡 (수동) 발송 검토.

---

## 2. DB 연결 한도 초과

**증상**: Supabase Logs → `too many connections` / 사이트 502 / Vercel function timeout.

### 1차 대응
1. Supabase Dashboard → **Database → Reports → Connections** 그래프.
2. Pooler 사용 중인지 확인. 미사용이면 [Supavisor](https://supabase.com/docs/guides/database/connecting-to-postgres) 활성.
3. 한도 거의 도달 → Pro 플랜 upgrade 또는 connection pooling 즉시 켜기.

### 일반적 원인
- Cron 동시 실행 중 connection leak (try/catch 누락 → connection 미반환).
- Server Components 의 createClient() 가 매 request 새로 만들어지지만 Supabase JS 가 자체 pool — 보통 문제 안 됨.
- 운영 초기엔 pgbouncer transaction 모드로도 충분.

---

## 3. 메일 발송 실패

**증상**: Resend 대시보드 bounce rate 5%+ / 사용자 "주문 메일 안 와요" 문의.

### 점검 흐름
1. Resend → **Emails → Logs** — 최근 24h bounce / complained 카운트.
2. 도메인 인증 상태 — DKIM / SPF / DMARC 모두 verified 인지.
3. Resend webhook (`/api/webhooks/resend`) 가 자동으로 bounce 사용자를 newsletter_subscribers status='unsubscribed' 로 마킹 → 정상 동작 중인지 Sentry `email.bounced` 이벤트 카운트 확인.

### domain reputation 회복
- bounce rate 10%+ 면 Resend 가 발송 일시 정지 → 도메인 warm-up 다시.
- DMARC report monitoring 권장 ([dmarc.report](https://dmarc.report) 등 무료).

---

## 4. 사이트 다운

**증상**: `/api/health` 502 / 외부 모니터링 (UptimeRobot) 알림.

### 1차 대응 (3분)
1. [Vercel Status](https://www.vercel-status.com) — 글로벌 장애인지 확인.
2. Vercel Project → Deployments → 최신 배포 빌드 로그.
3. 빌드 실패면: 이전 배포로 즉시 rollback.
   ```bash
   vercel rollback
   # 또는 Dashboard → Deployments → 이전 deployment → "Promote to Production"
   ```
4. 배포 성공인데 런타임 에러 → Sentry → 가장 빈도 높은 issue 확인.

### Health 엔드포인트가 알려주는 것
- DB 연결 OK 여부 (Supabase ping)
- 빌드 SHA + 시각 — rollback 한 게 정말 prod 인지 검증

---

## 5. 데이터 정합 의심 (포인트 / 쿠폰)

**증상**: 사용자 "포인트가 사라졌어요" / "쿠폰이 두 번 차감됐어요" CS.

### 점검
```sql
-- 한 사용자의 포인트 ledger 합계 vs profiles.points_balance 일치 확인
SELECT
  p.id,
  p.points_balance AS stored,
  COALESCE(SUM(l.delta), 0) AS computed
FROM public.profiles p
LEFT JOIN public.point_ledger l ON l.user_id = p.id
WHERE p.id = '<USER_UUID>'
GROUP BY p.id;

-- 쿠폰 redemption 중복 여부 — 같은 (user, coupon, order)
SELECT user_id, coupon_id, order_id, COUNT(*)
FROM public.coupon_redemptions
GROUP BY user_id, coupon_id, order_id
HAVING COUNT(*) > 1;
```

불일치 발견 시:
1. 캡처 (스크린샷 + SQL 결과)
2. point_ledger 에 보정 row 직접 insert (atomic RPC `apply_point_delta` 사용)
3. 사용자 사과 + 보상 (10% 쿠폰 같은) 발송

---

## 6. 키 회전

### Supabase Service Role Key
1. Supabase Dashboard → **Settings → API → service_role** → **Generate new key**.
2. Vercel Project → **Environment Variables → SUPABASE_SERVICE_ROLE_KEY** → 새 값 반영.
3. **Production 배포 재실행** (env 변경은 새 빌드부터 적용).
4. 24시간 지난 후 이전 키 회수 (Supabase 가 자동 invalidate 안 함).

### Toss Secret Key
1. [Toss 가맹점 콘솔](https://app.tosspayments.com/) → API 키 → 재발급.
2. Vercel `TOSS_SECRET_KEY` 갱신 + 재배포.
3. **결제 webhook 도 재인증** — Toss webhook URL 에 새 secret 반영.

### VAPID (Web Push)
- 회전 시 모든 기존 구독자가 invalidate 됨 (재구독 필요). 신중히.
- `web-push` CLI 로 새 키 생성:
  ```bash
  npx web-push generate-vapid-keys
  ```
- 새 NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY 등록 → 재배포 → 사용자 push 재구독 안내.

### CRON_SECRET
- 값 단순 변경 후 Vercel env 갱신 + 재배포.
- 영향: cron 자체 — 24h 이상 지난 cron 실행이 401 로 실패 가능 (Vercel 이 새 값 반영하기 전).

---

## 7. 마이그레이션 적용 / 롤백

### 신규 마이그레이션 적용
```bash
# 로컬에서 변경 사항 검증
supabase db push --dry-run

# 적용
supabase db push

# 적용 후 검증
supabase db lint
```

### 롤백
- Supabase 는 마이그레이션 down script 자동 생성 안 함.
- **롤백 = 새 마이그레이션 작성** (이전 변경의 inverse). 직접 schema 삭제 금지.
- `supabase_migrations.schema_migrations` 테이블에서 마지막 row 강제 삭제는 절대 금지 (state mismatch).

---

## 8. iOS / Android 앱 강제 업데이트

스토어 심사 대기 시간 회피 — 앱이 remote URL 패턴이라 웹 deploy 만으로 UI / business logic 즉시 반영. 단, 다음은 재심사 필수:
- Capacitor plugin 추가 / 제거
- Info.plist / AndroidManifest.xml 변경 (권한 string 등)
- 앱 아이콘 / 스플래시 변경
- 번들 ID / 앱 이름 변경

웹만 변경된 경우엔 사용자가 앱 재시작 시 자동으로 새 버전 로드 (WebView cold start).

---

## 9. 백업 / 복구

### Supabase 자동 백업
- **Pro 플랜 이상**: 일별 자동 백업 7일 보관.
- Free / Hobby: 수동 export 필수.

### 수동 export
```bash
# Supabase CLI
supabase db dump --data-only > backup-$(date +%Y%m%d).sql
# 압축
gzip backup-*.sql
# S3 / Box / 로컬에 보관
```

### Point-in-time Recovery (PITR)
- Pro 플랜 사용 시 7일 이내 임의 시점 복구 가능.
- Dashboard → Database → Backups → Point in Time Recovery.

---

## 10. 사용자 데이터 삭제 (GDPR / 한국법 양립)

### 자가 탈퇴
- `/mypage/delete` → `/api/account/delete` → `auth.admin.deleteUser(id, true)` (soft delete) + PII anonymize.
- `account_deletions_audit` 에 sha256(email) 만 보관 — 같은 사람 재가입 감지 가능, 원본 추적 불가.
- 거래 기록 (orders, point_ledger, reviews) 은 5년 보관 (전자상거래법 §6).

### 운영자 강제 삭제 (악성 사용자 등)
1. Supabase Dashboard → Authentication → user 검색 → Delete.
2. profiles row 는 cascade 로 삭제됨 (FK).
3. orders 등 거래 기록은 user_id NULL 처리 (이미 익명화됨이라 문제 없음).

---

## 비상 연락

- 안성민 / 이준호 — `story@farmerstail.kr`
- DPO 동일 (개인정보 침해 신고).
- 민감한 보안 이슈 → 사용자에게 우선 노출 금지, 담당자 비공개 채널 우선.
