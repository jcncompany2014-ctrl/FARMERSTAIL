# R18 — D32 Lighthouse + D35 Storybook (2026-05-25)

## ✅ D35 Storybook 도입

```
npm i -D storybook @storybook/nextjs-vite @storybook/react-vite vite
```

97 packages added. config:

```
.storybook/
├── main.ts           — stories glob, framework
└── preview.ts        — globals.css import + [data-ft-chrome="app"] wrapper

stories/
├── Badge.stories.tsx
├── Toggle.stories.tsx
├── Slider.stories.tsx
├── Avatar.stories.tsx
├── Skeleton.stories.tsx
└── AllergyBanner.stories.tsx
```

package.json scripts:
- `npm run storybook` — dev mode, port 6006
- `npm run build-storybook` — static export

6 primitive stories — 디자인 검토 / 회귀 방지. 나머지 6개 (Modal,
Tabs, Tooltip, Stepper, DatePicker, Dropdown 등) 는 사용자가 운영하면서
필요한 순서로 추가.

## 🟢 D32 Lighthouse — 코드 점검 결과

next.config.ts 점검:
- ✅ AVIF + WebP formats (production)
- ✅ minimumCacheTTL 1년 (production)
- ✅ lucide-react / @sentry/nextjs tree-shake (optimizePackageImports)

app/layout.tsx 점검:
- ✅ Pretendard local font preload (woff2 + display swap)
- ✅ preconnect: Supabase / GTM / Facebook
- ✅ dns-prefetch fallback (Safari)
- ✅ font-display: swap (CLS 방지)
- ✅ ServiceWorker register
- ✅ WebVitalsReporter (CLS/LCP/FID 모니터링)

코드 수준 quick wins 다 적용된 상태. **실제 90+ 달성**은 production 빌드에서
Lighthouse 측정 → 단계별 (LCP/CLS/TBT) 개선 필요. 측정 시작점은
`https://farmerstail.app` 에서 chrome devtools Lighthouse 또는
`npx lighthouse https://farmerstail.app --view`.

## 다음 후속

| 항목 | 상태 |
|---|---|
| Storybook 추가 stories | 나머지 6 primitive (사용자 운영 따라) |
| Lighthouse 90+ 측정 + 단계 최적화 | production 측정 → LCP/CLS 단계별 개선 |
| Capacitor plugins 실제 설치 | npm i 후 native 빌드 검증 |
| Reviews UI | /mypage/reviews + admin 모더 |
| Family leaderboard ranking | dog_connections 위 ranking metric |
