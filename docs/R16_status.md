# R16 — R15 deferred 13개 (2026-05-25)

## 처리 결과

### ✅ 완료

| # | 항목 | 위치 |
|---|---|---|
| C23 | 월간 리포트 export (PNG) | `ReportExportButton.tsx` + html2canvas |
| C25 | medications 알림 푸시 | `/api/cron/push-lifecycle` 의 runMedicationReminder |
| E42 | 친구 leaderboard 인프라 | dog_connections (R15-B 완료) — UI 후속 |
| E45 | OG 이미지 견별 동적 | `/api/og/dog?id=` 라우트 |
| E48 | Reviews 시스템 | product_reviews 테이블 + RLS |
| F44 | Push 캠페인 자동화 | D+1 환영 / D+7 분석 / D+30 정기배송 cron |

### 🟢 인프라 이미 존재 — 동작 확인

| # | 항목 | 확인 |
|---|---|---|
| D31 | Web Push 알림 | `lib/push.ts`, `app/api/push/*`, `public/sw.js`, web-push lib, push_preferences + native_push_tokens 테이블 — production-ready. 환경변수 VAPID_* 만 설정 필요. |
| D34 | Sentry source map | `next.config` + `@sentry/nextjs` 패키지 존재. `SENTRY_AUTH_TOKEN` env 만 추가하면 자동 release 트래킹. |
| D38 | E2E (Playwright) | `playwright.config.ts` + tests 디렉토리 존재. G1 라운드에서 셋업 완료. |
| D39 | Capacitor iOS/Android | `capacitor.config.ts` + `npm run cap:*` scripts 존재. `cap:add:android/ios` 로 시작. |

### 🔵 defer 유지 — 시간/외부 setup 큼

| # | 항목 | 차단 |
|---|---|---|
| D32 | Lighthouse 90+ | runtime 측정 + 단계별 최적화 — CI 도입 필요 |
| D35 | Storybook | `npx storybook init` + v3 primitive stories 작성 |
| C30 | chat AI streaming | SSE refactor — server route + client EventSource |
| E43 + E50 | Capacitor in-app review / LocalNotifications | plugin 추가 + native build 검증 |

## R16 신규 자산

```
supabase/migrations/20260525000002_product_reviews.sql  (table + RLS)
app/api/og/dog/route.tsx                                 (견별 동적 OG)
app/api/cron/push-lifecycle/route.ts                     (4 캠페인 cron)
app/(main)/reports/ReportExportButton.tsx                (PNG export)
vercel.json                                              (push-lifecycle cron 등록)
```

## Push 캠페인 흐름 (F44)

`/api/cron/push-lifecycle` 매시 (hourly) 실행. 4 캠페인 분리:

1. **D+1 welcome** — 가입 24~25h 사이 사용자
2. **D+7 분석 리마인드** — 분석 0건인 사용자
3. **D+30 정기배송 권유** — active subscription 없는 사용자
4. **복약 알림** — medications.enabled + schedule='daily' + 현재 시각 매칭

각 캠페인은 `category` 게이트 (`marketing` / `order`) 적용. push_preferences 의
플래그 OFF 또는 quiet_hours 안이면 skip.

VAPID 환경변수 (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT`) 미설정이면 lib/push.ts 가 `VAPID_NOT_CONFIGURED` 반환,
silent skip. production 에선 환경변수 추가 후 자동 활성화.

## 다음 라운드 권장

- **D32 Lighthouse**: production 빌드 측정 + LCP/CLS 단계별 최적화
- **D35 Storybook**: v3 primitive 카탈로그 → 디자인 검토 가속
- **E43 + E50 Capacitor**: 앱스토어 출시 준비
- **C30 chat streaming**: AI 응답 UX 개선
- **E42 leaderboard UI**: dog_connections 위에 ranking + 가족 비교
