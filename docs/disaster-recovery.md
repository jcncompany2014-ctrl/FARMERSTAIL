# 재해 복구 Runbook (Disaster Recovery)

**Last updated:** 2026-05-08
**Owner:** 솔로 운영자 (story@farmerstail.kr)

이 문서는 파머스테일 인프라가 부분 또는 전체 장애 시 단계별 복구 절차다.
모든 명령은 사용자 확인을 거친 후 실행하고, 의심되면 멈추고 복구 후 처리한다.

---

## 0. 사전 준비 (Setup once)

### 환경 변수 백업
모든 secret 은 1Password / Bitwarden 에 저장. **절대 .env.local 을 깃에 커밋하지 않는다.**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (RLS 우회 admin)
- `ANTHROPIC_API_KEY`
- `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`
- `TOSS_SECRET_KEY`, `TOSS_CLIENT_KEY`
- `RESEND_API_KEY`
- `CRON_SECRET`
- `KAKAO_JS_KEY`

### 백업 스케줄 (Supabase 자동)
- **Pro plan**: daily backup × 7일 보관 (Supabase 기본)
- **Free plan**: 수동 — 매주 일요일 `pg_dump` 로컬 저장 권장

### 알람 채널
- **Sentry** — exception/perf 자동
- **이메일** — story@farmerstail.kr (Sentry alarm)
- **카카오 Work** (옵션) — 추후 설정

---

## 1. Vercel 배포 실패 — 사이트 다운

### 증상
- 사용자가 farmerstail.kr 접속 시 500 / 502
- Vercel dashboard 의 latest deployment 가 빨강

### 즉시 조치 (5분)
1. Vercel dashboard → Deployments → **이전 정상 deployment 선택**
2. **⋯** 메뉴 → **Promote to Production** (= 즉시 rollback)
3. 사이트 정상화 확인 (`curl -I https://farmerstail.kr` → 200)

### 후속 조치
1. 실패 build log 확인 (Vercel Functions tab)
2. 로컬에서 `npx next build` 재현
3. 문제 fix → 새 commit → 자동 deploy
4. Sentry 에서 release 변경 추적

---

## 2. Supabase Postgres 다운 / 응답 지연

### 증상
- API 요청이 5초+ pending 후 timeout
- 사용자가 로그인 / 카탈로그 / 결제 모두 실패
- Sentry 에 supabase 관련 spike

### 즉시 조치
1. **Supabase Status Page** 확인: https://status.supabase.com
2. 자체 장애가 아니면:
   - Supabase Studio → Database → **Connection pooling** 사용 (PgBouncer)
   - active connections 확인. 100 한도 초과 시 idle 연결 kill:
     ```sql
     SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE state = 'idle' AND state_change < NOW() - INTERVAL '10 minutes';
     ```

### 데이터 복구 (롤백 필요한 경우)
1. Supabase Dashboard → Database → **Backups** 탭
2. 가장 최근 정상 시점 선택 → **Restore**
3. 복구 후 일관성 검증 sql:
   ```sql
   -- 주문 / 결제 / 정기배송 row 수 비교
   SELECT
     (SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '24 hours') AS orders_24h,
     (SELECT COUNT(*) FROM subscription_charges WHERE scheduled_for > CURRENT_DATE - 1) AS charges_today,
     (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '24 hours') AS new_users_24h;
   ```

### Point-in-time recovery (Pro plan only)
Supabase Pro 는 7일치 PITR 가능. 무료 plan 은 daily snapshot 만.

---

## 3. RLS 정책 사고 — 데이터 노출 또는 차단

### 증상
- 사용자가 다른 유저 데이터 보임 → **즉시 사이트 점검 모드**
- 또는 자기 데이터도 안 보임 → 정책 재배포

### 즉시 조치
1. **차단 모드** (배포 멈춤): Vercel → Production 환경에 점검 페이지 redirect
2. Supabase SQL editor 에서 문제 테이블 RLS 임시 강화:
   ```sql
   -- 예: profiles 테이블이 의심스러우면 select 모두 차단 → 빠른 본인만 허용
   DROP POLICY IF EXISTS profiles_select_others ON public.profiles;
   ```
3. 마이그레이션 파일에서 정책 검토 → fix 후 `apply_migration` 으로 재배포

### 사후 분석
- Sentry 에 의심 query 패턴 검색
- Supabase 의 query log 다운로드 → 영향 범위 산정
- 영향 받은 사용자에게 GDPR/PIPA 통지 (24h 내)

---

## 4. 결제 게이트웨이 (Toss) 장애

### 증상
- 결제 시도 시 "결제 모듈 로드 실패" 또는 webhook 미수신
- `subscription_charges` 가 status='pending' 으로 멈춤

### 즉시 조치
1. **Toss 개발자센터** 상태 페이지 확인
2. 사용자 사이트에 배너 노출 (admin 의 페널티 메시지):
   ```sql
   -- 또는 환경 변수로 banner 강제
   ```
3. 정기배송 cron 일시 중단:
   ```bash
   # Vercel dashboard 에서 vercel.json 의 schedule 주석 처리 commit
   ```

### 복구
1. Toss 정상화 후 cron 재실행 — `subscription-charge` cron 이 멱등 (UNIQUE
   subscription_id × scheduled_for) 이라 자동 catch-up
2. 24h 이상 장애 시 사용자에게 별도 안내 메일 발송

---

## 5. AI 챗봇 (Anthropic) 장애 / 비용 폭주

### 증상
- /api/chatbot 가 502 응답
- Anthropic dashboard 에서 quota burn 급증

### 즉시 조치
1. **environment variable** `ANTHROPIC_API_KEY` 비우기 → 챗봇 자동 비활성
   (NOT_CONFIGURED 503 응답)
2. /api/chatbot rate-limit 강화:
   ```ts
   // app/api/chatbot/route.ts
   limit: 5, // → 1 또는 0
   ```
3. 사용자 UI 에서 챗봇 entry point 숨기기 (feature flag)

### 비용 폭주 원인 디버깅
- abuse 사용자 IP 식별 (Sentry breadcrumb) → IP allowlist 또는 차단
- prompt injection 시도 — system prompt 의 안전 가드 강화

---

## 6. Sentry 가 발생한 critical alarm

### Sentry 에서 high-priority 이슈 분류
- **fatal**: 결제 / RLS / 로그인 — **5분 내 확인 필수**
- **error**: 사용자 노출 에러 — 1시간 내
- **warning**: 성능 / web-vitals — 다음 주 review

### 처리 흐름
1. Sentry → Issue 클릭 → breadcrumb / stack trace 확인
2. 영향 사용자 수 / 발생 빈도 → priority 결정
3. fix branch → PR → merge → auto deploy
4. 같은 이슈 closed → 재발 monitor

---

## 7. PWA / Service Worker 망가짐

### 증상
- 사용자가 캐시된 옛 버전 보임
- offline page 가 잘못 그려짐

### 즉시 조치
1. `public/sw.js` 의 cache version 변경 (예: `v3` → `v4`)
2. 새 deploy → 사용자가 페이지 새로고침 시 새 SW 활성화 (`controllerchange`
   이벤트 → `window.location.reload()` 자동)
3. 강제 unregister 가 필요하면 admin 측에서 사용자에게 안내:
   "설정 → Safari/Chrome 에서 사이트 데이터 삭제"

---

## 8. 도메인 / SSL 만료

### 증상
- 브라우저 "보안 연결 안 됨" 경고

### 사전 예방
- Vercel auto-renew 활성화 (기본 ON, 7일 전 알림)
- 도메인 등록 만료일 캘린더 1년치 알림

### 만료 후 복구
- 도메인 등록자 (가비아/Cloudflare) 결제 → 새 cert 자동 발급 (5~30분)
- DNS 레코드 검증 — `dig farmerstail.kr +short`

---

## 9. 정기 점검 체크리스트 (월 1회)

### 인프라
- [ ] Sentry 미해결 이슈 청소 (1주 이상 묵은 거 review)
- [ ] Supabase 백업 정상 동작 확인 (Restore test 1회)
- [ ] Vercel function logs 에 비정상 spike 없는지
- [ ] Domain SSL 만료일 검토

### 데이터 무결성
- [ ] 결제 실패 retry 큐 (`requires_billing_key_renewal=true`) 사용자 list 검토
- [ ] 정기배송 status 별 row 수 (orphan / 비정상 없는지)
- [ ] 쿠폰 만료 cleanup cron 결과 확인

### 보안
- [ ] admin 권한 보유 사용자 list (`profiles.role='admin'`) 검토
- [ ] 사용 안 하는 service_role key rotation
- [ ] 새로 추가된 API endpoint rate-limit 적용 여부

### 비용
- [ ] Vercel / Supabase / Anthropic / Resend / Toss 월 사용량 vs 예산
- [ ] LTV / CAC 트렌드 — 코호트 retention 표 (admin/page) 확인

---

## 10. 응급 연락처

| 영역 | 채널 | 응답 SLA |
|------|------|---------|
| Vercel | dashboard support | 평일 24h |
| Supabase | dashboard support / community Discord | Pro 24h, Free 1주 |
| Toss Payments | 개발자센터 1:1 | 평일 영업일 |
| Anthropic | console.anthropic.com support | 영업일 |
| 도메인 등록자 | 가비아 / Cloudflare 콘솔 | 즉시 (자동화) |

---

## 부록 A — pg_dump 로컬 백업 (Free plan 보강)

```bash
# Supabase project ref + connection string (dashboard → Database)
PG_URL="postgresql://postgres:[PWD]@db.[REF].supabase.co:5432/postgres"

# 매주 일요일 cron 또는 수동:
pg_dump "$PG_URL" \
  --no-owner --no-privileges --clean --if-exists \
  -f "backup-$(date +%Y%m%d).sql"

# 압축 + S3 / Google Drive 업로드
gzip "backup-$(date +%Y%m%d).sql"
```

## 부록 B — sentry alarm 기본 설정

`sentry.server.config.ts` 의 PII scrubbing 이미 적용. 추가 alarm rule:

1. Sentry dashboard → Alerts → New Alert Rule
2. **fatal level + first seen** → 즉시 이메일
3. **error rate >5/hour for prod env** → 1시간 burst 시 알림
4. **transaction p95 latency >2s** → 성능 회귀

각 rule 의 destination 을 story@farmerstail.kr 로.
