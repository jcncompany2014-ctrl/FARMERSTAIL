# Farmer's Tail — 출시 체크리스트

런칭 전 한 번 정독하면서 확인. 빨리 훑고 싶으면 ✅ 표시된 항목만 봐도 됨 — 나머지는 fail-safe (없어도 앱은 돌아가지만 기능 일부 제한).

---

## 0. 실수로 빠뜨리면 생사 갈리는 것

| | 항목 | 어디서 확인 |
|---|---|---|
| 🔴 | **Supabase 마이그레이션 4개 적용** | `supabase db push` |
| 🔴 | **환경변수 (production)** | Vercel Project Settings → Environment Variables |
| 🔴 | **Resend 도메인 인증** | resend.com → Domains → DKIM/SPF 통과 |
| 🔴 | **Toss Payments 운영 키** | Toss 가맹점 콘솔 → API 키 (테스트키 X) |
| 🔴 | **Sentry release 업로드** | Vercel build 에서 source map 자동 업로드 |
| 🔴 | **사업자 정보 (전자상거래법)** | `NEXT_PUBLIC_BUSINESS_*` env 채움 |

---

## 1. Supabase 마이그레이션 (적용 순서)

```bash
supabase db push
```
또는 SQL Editor 에서 다음을 순서대로:

1. `20260425000000_atomic_points_coupons.sql` — 포인트/쿠폰 race-safe RPC
2. `20260425000001_notifications_last_seen.sql` — 알림 unread 추적
3. `20260425000002_dashboard_snapshot.sql` — 대시보드 user-scoped 스냅샷
4. `20260425000003_perf_indexes.sql` — 핫 쿼리 인덱스 11종

**확인**: 적용 후 Supabase SQL Editor 에서:
```sql
SELECT proname FROM pg_proc
WHERE proname IN ('apply_point_delta', 'redeem_coupon',
                  'revoke_coupon_redemption', 'dashboard_user_snapshot');
-- 4 row 가 나와야 정상.
```

---

## 2. 환경변수 (Vercel Production)

### 🔴 필수 — 없으면 부팅 실패
| 키 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (공개 가능) |
| `SUPABASE_SERVICE_ROLE_KEY` | 관리자/웹훅/크론 (production 필수) |
| `NEXT_PUBLIC_SITE_URL` | `https://farmerstail.com` 같은 canonical URL |

### 🟡 결제 — 없으면 결제 시점 503
| 키 | 용도 |
|---|---|
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | Toss live key (test_ → live_) |
| `TOSS_SECRET_KEY` | Toss live secret |

### 🟡 메일 — 없으면 모든 거래 메일 silent skip
| 키 | 용도 |
|---|---|
| `RESEND_API_KEY` | Resend API key (`re_xxx`) |
| `EMAIL_FROM` | `"파머스테일 <no-reply@farmerstail.com>"` 형식. Resend 인증 도메인만 사용 가능 |
| `EMAIL_REPLY_TO` | (선택) "답장" 갈 주소 |

### 🟡 모니터링 — 없으면 에러 추적 안 됨
| 키 | 용도 |
|---|---|
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | 서버/클라 동시 설정 |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | source map 업로드 (CI 빌드용) |

### 🟢 분석 — 없으면 GA/Pixel 이벤트 미전송 (앱은 정상)
| 키 | 용도 |
|---|---|
| `NEXT_PUBLIC_GA_ID` | GA4 measurement id (`G-XXXX`) |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta Pixel id |

### 🟢 푸시 알림 (3종 모두 있어야 활성)
| 키 | 용도 |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push public |
| `VAPID_PRIVATE_KEY` | Web Push private |
| `VAPID_SUBJECT` | `mailto:` 또는 `https://` URL |

### 🟢 Cron (Vercel Cron 보호)
| 키 | 용도 |
|---|---|
| `CRON_SECRET` | `Authorization: Bearer <secret>` 검증 |

### 🟢 사업자 정보 (전자상거래법 §10)
| 키 | 용도 |
|---|---|
| `NEXT_PUBLIC_BUSINESS_COMPANY_NAME` | 상호 |
| `NEXT_PUBLIC_BUSINESS_CEO` | 대표자 |
| `NEXT_PUBLIC_BUSINESS_NUMBER` | 사업자등록번호 |
| `NEXT_PUBLIC_BUSINESS_MAIL_ORDER_NUMBER` | 통신판매업 신고번호 |
| `NEXT_PUBLIC_BUSINESS_ADDRESS` | 사업장 주소 |
| `NEXT_PUBLIC_BUSINESS_PHONE` | 고객센터 전화 |
| `NEXT_PUBLIC_BUSINESS_EMAIL` | 고객센터 이메일 |
| `NEXT_PUBLIC_BUSINESS_PRIVACY_OFFICER` | 개인정보 책임자 이름 |
| `NEXT_PUBLIC_BUSINESS_PRIVACY_OFFICER_EMAIL` | 개인정보 책임자 이메일 |

### 🟢 (선택) 카카오 채널
| 키 | 용도 |
|---|---|
| `NEXT_PUBLIC_KAKAO_CHANNEL_URL` | `https://pf.kakao.com/_xxxxx/chat`. 비어있으면 footer 카톡 버튼 미노출 |

### 🟢 Anthropic (강아지 분석 commentary)
| 키 | 용도 |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |

---

## 3. 외부 서비스 사전 설정

### Toss Payments
- [ ] 가맹점 등록 완료 (사업자등록증 제출)
- [ ] 운영 클라이언트키 / 시크릿키 발급 (test_*, live_* 구분)
- [ ] 결제 webhook URL 등록: `https://[domain]/api/payments/webhook`
- [ ] 환불/취소 권한 활성화

### Resend
- [ ] 도메인 추가 (`farmerstail.com`)
- [ ] DKIM/SPF/DMARC DNS 레코드 등록 + 검증 통과
- [ ] `EMAIL_FROM` 의 도메인이 인증된 도메인과 일치 확인

### Sentry
- [ ] 프로젝트 생성 (Next.js 템플릿)
- [ ] DSN 복사 → env
- [ ] Auth Token 발급 (source map 업로드용 권한)
- [ ] Slack/이메일 알림 채널 연동

### Supabase
- [ ] RLS 정책 활성 확인 (`auth.uid()` 기반)
- [ ] Storage 버킷 권한 (products / blog / events / dog-photos)
- [ ] Email Auth → 비밀번호 재설정 메일 템플릿 (Supabase 측에서 설정)
- [ ] OAuth 카카오 provider 등록 (redirect URL: `https://[domain]/auth/callback`)

### Vercel
- [ ] Production 도메인 연결 (`farmerstail.com`)
- [ ] HTTPS / HSTS 자동 (Vercel 기본)
- [ ] Cron Jobs 활성화 (`vercel.json` 의 `/api/cron/*`)
- [ ] Region: `icn1` (서울) 권장

---

## 4. 도메인 / DNS

- [ ] A/AAAA 레코드: Vercel
- [ ] DKIM/SPF/DMARC: Resend
- [ ] CAA 레코드 (Vercel 권장)
- [ ] 카카오 OAuth Redirect URL 등록: `https://[domain]/auth/callback`
- [ ] Robots.txt 검증: `https://[domain]/robots.txt` (자동 생성)
- [ ] Sitemap 검증: `https://[domain]/sitemap.xml` (자동 생성)

---

## 5. 출시 후 일주일 모니터링

| 메트릭 | 어디서 | 임계 |
|---|---|---|
| Lighthouse 모바일 점수 | PageSpeed Insights | LCP < 2.5s, CLS < 0.1, INP < 200ms |
| Sentry 에러율 | sentry.io | session 당 < 0.5% |
| Resend 발송 실패율 | resend.com | < 2% |
| Supabase RLS 거부 | Supabase Logs → API | 정상 사용자 거부 0 |
| Toss 결제 성공률 | Toss 콘솔 | > 95% |
| Web Vitals (실 사용자) | `/api/metrics/web-vitals` → Sentry | 이상치 트래킹 |

---

## 6. 운영 헬스체크

- `GET /api/health` — DB 연결 + 빌드 SHA. UptimeRobot / BetterStack 으로 1분 단위 폴링.
- `GET /api/og` — OG 이미지 동적 생성 (브라우저에서 직접 열어 확인).
- 카카오톡 share — `https://devtools.kakao.com/scrap` 으로 share card 미리보기.

---

## 7. 자주 잊는 작은 것들

- [ ] `manifest.json` 의 `icons` 가 `/public/icons/` 에 실제 존재 (192, 512)
- [ ] `apple-touch-icon` 도 함께 (iOS 홈 화면 추가용)
- [ ] 회원 탈퇴 (`/mypage/delete`) 가 진행 중인 주문 있으면 차단되는지 테스트
- [ ] 결제 webhook 이 idempotent — 같은 paymentKey 두 번 호출 안전
- [ ] 정기배송 알림 cron — `reminder_enabled` 토글 후 다음날 메일 도착 확인
- [ ] 모바일 PWA 설치 — iOS Safari "공유 → 홈 화면 추가" 동작 확인
- [ ] CSP / Permissions-Policy — `next.config.ts` 헤더가 정상 노출되는지 (개발자도구 Network → Response Headers)

---

## 8. 신경 쓰지 않아도 되는 것

- 번들 사이즈 분석 (`@next/bundle-analyzer`) — Turbopack 비호환. webpack 모드로 별도 빌드해야 작동. 출시 후 이슈 생기면.
- 다크 모드 토글 UI — `data-theme` 훅은 열려있지만 토글 UI 없음. iOS/Android 시스템 설정 자동 추종.
- Bundle analyzer / Lighthouse 자동화 — 운영 기간 데이터 보고 결정.

---

## 9. 비상 대응

| 상황 | 대응 |
|---|---|
| 결제 실패 폭증 | Toss 콘솔 → 가맹점 상태 확인. webhook 5xx → Sentry → /api/payments/webhook 확인 |
| DB connection 한도 | Supabase Dashboard → Performance. Pro 플랜 upgrade 또는 connection pooling |
| 메일 발송 실패 | Resend → Logs → 도메인 정지 여부 확인 |
| 사이트 다운 | Vercel Status + `/api/health` ping. 마지막 배포 rollback (`vercel rollback`) |
| 데이터 정합 의심 | Supabase 로 직접 쿼리. point_ledger / coupon_redemptions 정합성 검사 |

---

런칭은 한 번뿐이고, 위 1-3 단계가 가장 자주 빠지는 것들. 한 번씩 손가락으로 짚어가며 확인 권장.
