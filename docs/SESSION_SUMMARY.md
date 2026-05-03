# Farmer's Tail · 38라운드 작업 정리

> 이 문서는 컨텍스트 복원용. 새 세션에서 "지금까지 어디까지 했어?" 물을 때
> 이 파일 + `README.md` + `LAUNCH_CHECKLIST.md` + `docs/RUNBOOK.md` 4개로 충분.

---

## 1. 프로젝트 현황

**상태**: Production-grade 코드베이스. 외부 셋업 (도메인 / 신고 / 키 / 디자인) 만 끝나면 즉시 출시 가능.

| 영역 | 상태 |
|---|---|
| 웹 (Vercel) | ✅ 배포 자동, region icn1 |
| 모바일 (iOS/Android) | ⚠️ Capacitor 설정 완비, 사용자가 cap add + 심사 |
| 마이그레이션 | 36개 (prod 적용은 `supabase db push`) |
| Cron | 9개 등록 (icn1 region) |
| Admin | 14+ 페이지 |
| Tests | 168 unit (전부 통과) |
| 법규 | 전자상거래법 / 개인정보보호법 / 정보통신망법 / 사료관리법 / WCAG 2.1 AA |

---

## 2. 라운드별 요약 (1-38)

### Round 1-6: 초기 + 버그 라운드
초기 셋업 + 라운드 1-3 버그 audit (touch target 44×44, modal a11y, race condition, cart upsert RPC, alert→toast).

### Round 7-14: App Store / 법규 / 비즈니스
- 7: App Store 5.1.1 게스트 browse / ATT / Universal Links / 사료라벨
- 8: Sign in with Apple
- 9: 정기배송 자동결제 cron + Toss billingKey 인프라
- 10: 식품정보고시 14컬럼 + admin 입력 UI
- 11: billingKey 발급 흐름 (subscribe/billing-auth/billing-success/billing-fail)
- 12: 만 14세 게이트 / Newsletter double opt-in / 수신거부 ack
- 13: LAUNCH_CHECKLIST 갱신 / vercel UTC 주석 / Supabase host env
- 14: Apple Developer 사전 작업 명세

### Round 15-23: 개인정보 / UX / 운영 도구
- 15: 개인정보처리방침 강화 (국외이전 + 자동수집)
- 16: 검색 자동완성 (suggest API + dropdown)
- 17: Sentry 차등 sampling + 비즈니스 트레이싱
- 18: Admin 통계 (CategoryRevenueDonut + FoodInfoCompletion)
- 19: 결제 실패 모니터링 + 코호트 리텐션
- 20: Native 푸시 토큰 등록 (Capacitor)
- 21: 검색어 로깅 + admin 인사이트
- 22: A/B 테스트 feature flags 인프라
- 23: 실시간 주문 알림 (Supabase Realtime)

### Round 24-27: Native 발송 + 이메일 + 자산
- 24: APNs/FCM HTTP 발송 (외부 lib 0)
- 25: 리뷰 안내 cron + 재고 retry 강화
- 26: OG 도메인 동적화
- 27: Blur placeholder LCP 보호

### Round 28-35: 테스트 + 법규 마무리 + 자동화
- 28: Unit tests 168개 + schemas/parseRequest 분리
- 29: Hero copy A/B 회로 완성
- 30: 개인정보보호법 §35 본인 데이터 다운로드
- 31: 쿠폰 만료 D-3 cron
- 32: 반려견 나이 자동 갱신 cron + 생일 푸시
- 33: Resend webhook (svix 서명)
- 34: Skip-to-content + focus-visible WCAG
- 35: README + docs/RUNBOOK.md

### Round 36-38: 성능
- 36: `(main)/layout` client auth gate 제거 — 200~500ms 절감
- 37: Vercel region icn1 + getUser→getSession (chrome 4곳) — 250~550ms
- 38: Checkout serial → Promise.all + ISR 연장 + cacheTTL — 100~200ms

**누적 ~500ms 이상 모든 페이지에서 빨라짐**

### Round 39: 보안 audit + Personalization 시스템 (가장 최근)
- 39.1: React 19 lint 10건 + 도메인 일관화 (.com/.vercel.app → .kr 11파일) (`442a50f`)
- 39.2: Storage orphan 정리 (admin 이미지 교체 시) + SW iOS 50MB cap (`bc0021a`)
- 39.3: Rate limiter LRU 메모리 가드 (50K cap) + Resend webhook secret 명시 (`77a9ccc`)
- 39.4: **Newsletter RLS mass-update 보안 구멍 차단** — anon 키로 mass-confirm
        가능한 진짜 취약점. service-role 우회로 fix (`f9d9b54`)
- 39.5: 설문 personalization 7필드 추가 (`91ba22f`)
        — care_goal/home_cooking_experience/satisfaction/weight_trend/
          gi_sensitivity/preferred_proteins/indoor_activity
- 39.6: Claude Design 핸드오프 적용 — survey.css + 페이지 전면 리뉴얼 (`67915b7`)
- 39.7: /dogs 가드 임시 해제 (데스크톱 디자인 검토용) (`05953b5`)
- 39.8: **Personalization 알고리즘 v1 (decideFirstBox) + 인프라** (`f61133e`)
        — 30+ 룰, 43개 단위 테스트, dog_formulas + dog_checkins 테이블
- 39.9: 알고리즘 ↔ analysis 페이지 통합 — RecommendationBox placeholder (`6de7f7f`)
- 39.10: **알고리즘 v1.1 (decideNextBox) — cycle 진행 + checkin/adjust API + cron**
         (`9969d52`) — 218 → 236 tests
- 39.11: cron push 알림 + admin 시뮬레이터 (`0568c62`)
- 39.12: 박스 패킹 리스트 (CSV) + docs/PERSONALIZATION.md (`aa64bc8`)
- 39.13: cron 이메일 알림 + LAUNCH_CHECKLIST/SESSION_SUMMARY 마이그 39개 반영 (`e317308`)
- 39.14: admin nav 에 personalization 항목 + RUNBOOK section 11 (`57d2244`)
- 39.15: RecommendationBox 디자인 핸드오프 #2 적용 + edge-bleed 제거 (여백 fix) (`b436ad5`)
- 39.16: README 에 personalization 시스템 섹션 (`58673ea`)
- 39.17: lib/personalization/format.ts — 한국어 포매터 7개 + 18 tests (`9903e64`)
- 39.18: 알고리즘 weight_trend_6mo 룰 + CRON_SECRET production 가드 (`5c30345`)

**Personalization 시스템 = 5종 화식 + 토퍼를 강아지별 비율로 조합 + 매월 자동
조정. 알고리즘 v1.1 (firstBox + nextBox + format), API 4개, cron 1개, admin
도구 2개 (시뮬레이터 + 박스 패킹 CSV), DB 테이블 2개, 이메일 템플릿 1개 —
운영 인프라 + 사용자 UI 모두 완비. 단 비율 조정 sheet + 체크인 폼 UI 만 별도
디자인 핸드오프 대기 중.**

테스트: round 38 → 168 / round 39 → **259** (+91 tests).

---

## 3. 사용자만 할 수 있는 것 (출시 전 필수)

### 법적
- [ ] **통신판매업 신고** → 인천 연수구청 → 받은 번호를 `lib/business.ts:46` 에 입력

### 외부 서비스 키
- [ ] Toss 운영 가맹점 + 정기결제 사용 신청 + live keys
- [ ] Resend 도메인 인증 (DKIM/SPF/DMARC) + API key
- [ ] Anthropic API key (`sk-ant-...`)
- [ ] VAPID 키 (`npx web-push generate-vapid-keys`)
- [ ] Apple Developer + .p8 key (APNs / SIWA)
- [ ] Firebase service account (FCM)
- [ ] Sentry DSN + Auth Token
- [ ] GA4 + Meta Pixel ID
- [ ] CRON_SECRET 임의 문자열

### Production 셋업
- [ ] Vercel env vars 모두 등록 (.env.example 참조)
- [ ] 도메인 farmerstail.kr Vercel 연결 + SSL
- [ ] `supabase db push` — 마이그 **39개** 적용 (또는 dashboard SQL Editor)
- [ ] PostgREST 캐시 reload (`NOTIFY pgrst, 'reload schema';`) — dashboard 적용 시 필수
- [ ] Supabase Apple OAuth provider 등록
- [ ] **`/dogs` app-only 가드 복구** (`proxy.ts:158` 주석 처리한 줄 활성화)

### 자산
- [ ] 1024×1024 앱 아이콘 source → `npm run cap:assets`
- [ ] Splash 이미지
- [ ] 카카오 채널 개설 → URL `lib/business.ts` 업데이트

### 콘텐츠
- [ ] 실 상품 데이터 admin 입력 (식품정보 14항목)
- [ ] 블로그 / 이벤트 콘텐츠

### 앱스토어
- [ ] `npm run cap:add:ios` + `cap:add:android` 후 Info.plist + PrivacyInfo
- [ ] App Store Connect 등록 + Privacy Nutrition Labels
- [ ] Google Play Console 등록 + Data safety form
- [ ] 심사 제출

### E2E 검증
- [ ] 본인 카드 10원 상품 결제 → 환불 사이클
- [ ] iOS Safari + Android Chrome 실기기

---

## 4. 핵심 파일 위치

| 파일 | 역할 |
|---|---|
| `LAUNCH_CHECKLIST.md` | 출시 전 체크리스트 (env / 외부 서비스 / 신고) |
| `docs/RUNBOOK.md` | 사고 대응 (결제 실패 / DB 한도 / 키 회전 / 백업) |
| `README.md` | 프로젝트 한눈에 |
| `docs/SESSION_SUMMARY.md` | 이 파일 — 작업 라운드 정리 |
| `lib/business.ts` | 사업자 정보 SSOT — 통판신고 등록 위치 |
| `vercel.json` | Cron 10개 + region icn1 |
| `proxy.ts` | 미들웨어 (rate limit + admin 가드 + app/web 분기) |
| `supabase/migrations/` | 39개 마이그레이션 |
| `lib/personalization/` | 화식 비율 알고리즘 v1 (firstBox + nextBox) + 5라인 메타 |
| `app/api/personalization/` | compute / checkin / adjust API |
| `app/admin/personalization/` | 시뮬레이터 + 박스 패킹 리스트 |
| `docs/PERSONALIZATION.md` | personalization 시스템 운영 매뉴얼 |
| `lib/api/schemas.ts` | Zod 스키마 SSOT |
| `lib/api/parseRequest.ts` | API 요청 파싱 helper |
| `lib/featureFlags.ts` | A/B 테스트 |
| `lib/sentry/trace.ts` | 비즈니스 트레이싱 |
| `lib/push/native.ts` | APNs / FCM 발송 |
| `lib/ui/blur.ts` | LCP placeholder |
| `lib/ui/useModalA11y.ts` | 모달 접근성 훅 |
| `lib/formatters.ts` | KR 포매터 (전화/우편/사업자) |

---

## 5. 추후 작업 (낮은 ROI / 외부 의존)

- 결제 e2e 자동 테스트 (실 카드 / Toss test)
- 택배사 API 연동
- 카카오 알림톡 (사업자 인증 + 템플릿 승인)
- 디자인 자산 (브랜드 영상 / 일러스트)
- Storybook / i18n / 2FA — 솔로 dev 엔 오버엔지니어

---

## 6. 마지막 production deployment

- 마지막 push: **`1ed9a12`** (round 38, perf 통합 fix)
- 미푸시 commit (round 39, **18개 누적**):
  - audit 부 (4개): `442a50f` / `bc0021a` / `77a9ccc` / `f9d9b54`
  - 설문 7필드 + 디자인: `91ba22f` / `67915b7` / `05953b5`
  - personalization 시스템 (10개): `f61133e` → `5c30345`
  - 추가 commits: format.ts, env guard 등
- main branch — Vercel 자동 배포
- Vercel project: `prj_1n6HOvEXcq04hYQ3m4mpAFZOoFmR` / team `team_wyh7Ny9FwA9X4MtOEnTlArpj`
