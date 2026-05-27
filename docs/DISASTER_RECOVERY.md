# Disaster Recovery — 1페이지 플랜

> **언제 이 문서를 보나:** 사이트 다운, DB 잠금, 결제 폭주 실패, 인스턴스 데이터 손실,
> 도메인 탈취 의심, 보안 사고 의심. **이 문서를 폰에도 저장해 두세요.**

작성: 2026-05-27 · 다음 검토: 2026-08-27 (분기마다)

---

## 0. 30초 안에 — 누구한테 알릴까

| 상황 | 1차 연락 | 2차 |
|---|---|---|
| Vercel/Next.js 사이트 다운 | Vercel Status: https://www.vercel-status.com | Sentry 알림 + `/api/health` |
| DB 응답 없음 | Supabase Status: https://status.supabase.com | Supabase MCP, 직접 콘솔 |
| 결제 폭주 실패 | Toss Status: https://status.tosspayments.com | Toss 가맹점 1644-7475 |
| 도메인 (DNS) | 가비아 1588-3669 | DNS 콘솔 직접 |
| 보안 침해 의심 | KISA 118 (24h) | 변호사 |

---

## 1. 자가 진단 명령 (5분)

```powershell
# 1. 사이트 reachable?
curl -I https://www.farmerstail.kr

# 2. health endpoint
curl https://www.farmerstail.kr/api/health | jq

# 3. DNS 정상?
nslookup farmerstail.kr
nslookup www.farmerstail.kr

# 4. 마지막 배포 상태
gh run list --workflow=vercel --limit 3
```

응답:
- 200 OK → 앱 살아있음. 특정 페이지/기능만 문제일 가능성
- 503 degraded → `/api/health` 응답에 어떤 dependency 가 fail 인지 표시
- timeout / DNS 실패 → 도메인 또는 Vercel 인프라 문제

---

## 2. 시나리오별 1차 대응

### A. 사이트가 안 열림 (5xx 또는 timeout)

1. Vercel 콘솔 → **Deployments** → 직전 Ready 배포 → **Promote to Production**
2. 그래도 안 되면 Vercel Status 확인 (인프라 장애일 수 있음)
3. 사용자 안내: Twitter/Instagram에 "현재 사이트 일시 장애" 단문

```bash
# 마지막 안정 배포로 즉시 롤백 (1분)
vercel rollback <deployment-id>
```

### B. DB 응답 없음 / 느림

1. Supabase 콘솔 → **Database** → **Health** 점검
2. **Connection Pooling** 사용량 확인 (PgBouncer 만료 connection 누적)
3. Slow query 확인: `pg_stat_statements`
4. 임시 조치: `app/api/cron/*` 일시 정지 (Vercel cron 설정에서 OFF) — 부하 줄이기

```sql
-- Supabase SQL editor에서 즉시 확인
select * from pg_stat_activity where state = 'active' order by query_start;
```

### C. 결제가 폭주적으로 실패 (Toss)

1. Toss 가맹점 콘솔 (https://app.tosspayments.com) 에서 가맹점 상태 확인
2. 만약 가맹점 상태 정상이면 우리 측 webhook 처리 문제 가능 — `payment_events` 테이블에 ledger 가 끊겼는지 확인
3. 사용자 환불 처리 임시 정지하고 (admin 페이지에서) CS 채널로 안내 후 추후 일괄 처리

### D. 도메인 (DNS) 문제

1. 가비아 콘솔에서 DNS 레코드 확인 — A `216.198.79.1`, CNAME `cname.vercel-dns.com` 정상?
2. 도메인 만료 여부 (가비아 → 보유 도메인) — **만료 7일 전 자동 갱신 미리 설정**
3. DNS propagation 확인: https://www.whatsmydns.net

### E. 보안 침해 의심

1. **즉시 비밀번호 변경**: Vercel, Supabase, GitHub, Resend, Toss, 도메인 등록기관
2. Supabase service_role key **로테이트** (Supabase 콘솔 → Settings → API)
3. GitHub access token / Vercel deploy key 로테이트
4. `git log` 에서 비정상 commit 점검
5. KISA 118 (24h) 신고

---

## 3. 백업 & 복원

### 자동 백업
- **Supabase**: 일 단위 자동 백업 (Free tier 7일 보관, Pro 30일)
- **Vercel**: Git 기반이라 자동 복원 가능. `git revert` 또는 `vercel rollback`

### 수동 백업 (월 1회 권장)
```bash
# DB 덤프 (Supabase → 로컬 SQL 파일)
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d).sql

# 백업 파일 압축 + 안전한 곳 (Google Drive, 외장 HDD) 에 보관
gzip backup-*.sql
```

### 복원 (응급)
```bash
# Supabase 콘솔 → Database → Backups → 원하는 시점 선택 → Restore
# 또는 SQL 덤프에서 복원
psql "$DATABASE_URL" < backup-20260527.sql
```

> **주의:** Production DB 에 복원은 신중. 새 Supabase 프로젝트 만들어 복원 → 데이터 확인 후 마이그레이션 권장.

---

## 4. 핵심 환경변수 (시크릿 보관)

이 키들이 유출되면 즉시 로테이트. 평소에 1Password 또는 환경별 별도 .env 파일로 보관.

| 키 | 어디에 | 로테이트 방법 |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 콘솔 | Settings → API → Reset |
| `TOSS_SECRET_KEY` | Toss 가맹점 콘솔 | 가맹점 설정 → API 키 → 재발급 |
| `RESEND_API_KEY` | Resend 콘솔 | API Keys → Revoke → New |
| `SENTRY_DSN` | Sentry 콘솔 | 노출돼도 큰 위험 X (write-only) |
| `CRON_SECRET` | Vercel ENV | 새 random string → Vercel + cron 설정 동시 갱신 |

---

## 5. 사용자 커뮤니케이션 템플릿

### 사이트 다운 (Twitter / Instagram)
> 안녕하세요, 파머스테일이에요. 현재 사이트가 일시 장애 중입니다. 빠르게 복구 중이며 결제·배송에는 영향 없습니다. 진행 상황을 이 글에 업데이트해드릴게요. 🙏

### 결제 실패
> 결제 시스템이 일시 불안정합니다. 결제가 진행되었으나 주문이 보이지 않는다면 story@farmerstail.kr 로 결제 시각과 카드 마지막 4자리를 보내주세요. 24시간 내 확인 후 처리해드립니다.

### 보안 사고 (의무 공지 필요시)
> **개인정보 처리 관련 안내** — [날짜]에 [내용] 사고가 발생했음을 확인하고, 영향 받은 회원께 [방법]으로 개별 안내드렸습니다. KISA에도 동시 신고했습니다. 자세한 내용은 사업자 정보 페이지를 확인해 주세요.

---

## 6. 분기별 점검 체크리스트

매 분기 첫 주 (3개월마다) 다음 항목 확인 — 캘린더에 반복 일정으로:

- [ ] DB 백업 1회 수동 실행 + 복원 테스트 (새 staging Supabase 프로젝트에)
- [ ] Vercel rollback 1회 시뮬레이션
- [ ] 도메인 만료일 확인 (가비아 → 보유 도메인)
- [ ] SSL 인증서 만료일 확인 (Vercel 자동 갱신이지만 확인)
- [ ] 모든 시크릿 키 로테이트 여부 검토
- [ ] 이 문서의 연락처 / 명령어 / URL 이 모두 valid 한지 확인

---

## 7. "절대 하지 말 것"

- **`git push --force` to main** — 배포 히스토리 파괴 가능
- **Supabase production DB drop / truncate** — 백업 확인 전 절대
- **`.env` 파일 git commit** — pre-commit hook 으로 차단되지만 재확인
- **사용자에게 비밀번호 묻기** (이메일/전화) — 우리는 절대 묻지 않음. 피싱
- **모르는 사람이 보낸 첨부 파일 열기** — 운영자 PC 가 사실상 admin 키

---

**기록:** 이 문서를 폰에 PDF 로 출력해 두기. 사이트 다운 시엔 컴퓨터를 못 보는 경우 흔함.
