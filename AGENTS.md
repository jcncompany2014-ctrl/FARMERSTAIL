<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ⛔ App / Web 분리 — 절대 web 시각 변경 금지

> **⚠️ 2026-06-12 Phase Q 피벗 — 이 섹션 부분 해제.** 사장님 지시로 전면 전환:
> 웹 = 설문 퍼널(브랜드 스토리 → 설문 → 맞춤 플랜 → 체험팩), 앱 = 기록·캐릭터
> 농장(커머스 제거). 이에 따라 **웹 랜딩/퍼널 페이지의 farm v4 리디자인은 허용**
> (배경 #FAF9F5 near-white, serif 제목, pill 버튼, rounded-3xl 카드 — app/page.tsx
> docstring 참조). 단 ① app/web dispatch 구조(AuthAwareShell · ft_app cookie)
> ② 결제/체크아웃 로직 ③ 법정 푸터(SiteFooter 사업자 정보)는 여전히 불변.
> 아래 기존 규칙은 "v3 app 작업이 web 을 침범하지 않기 위한" 가드로서 유효.

이 repo 는 **app (PWA / Capacitor) 과 web (browser) 을 같은 URL 로 호스팅**하면서
chrome / 시각만 다르게 dispatch 한다 (`AuthAwareShell` → `AppChrome` | `WebChrome`,
구분 cookie `ft_app`). **현재 진행 중인 v3 redesign 은 app 전용**. Web 의
editorial (serif heading / white card / rounded-xl) 톤은 유지해야 한다.

## ✅ 안전 (touch OK — app-only)

| 경로 / 파일 | 이유 |
|---|---|
| `app/(main)/**` | `(main)/layout.tsx` 가 AppChrome 강제. web 사용자는 redirect. |
| `app/dashboard/**` | app 전용 홈 |
| `components/v3/**` | 정의상 app 전용 (각 컴포넌트 docstring 명시: `data-ft-chrome="app"`) |
| `app/layout.tsx` 의 root-level Provider (Toast/Confirm 등) | 행위만 제공, web 페이지에서 trigger 안 되면 invisible |
| `lib/design/tokens.ts` 의 v3 추가 | app 컨텍스트에서만 import 되면 OK |
| `app/globals.css` 의 `[data-ft-chrome="app"]` 스코프 안 룰 | scope 자동 분리 |

## ⛔ 여전히 금지 — 직접 시각 수정

| 경로 / 파일 | Web 영향 이유 |
|---|---|
| `app/(auth)/login/page.tsx` · `signup/page.tsx` | `(auth)` 그룹은 web+app 공유 |
| `app/cart/page.tsx`, `app/cart/CartList.tsx` | top-level, AuthAwareShell 분기 |
| `app/checkout/**` | top-level, AuthAwareShell 분기 |
| `app/products/page.tsx`, `app/products/[slug]/**` | top-level, AuthAwareShell 분기 |
| `app/mypage/orders/**` | top-level web/app 공유 |
| `components/ui/**` (Toast, Button, Form, BottomSheet, EmptyState, Skeleton, Spinner, ErrorScreen, CopyButton, Motion, ProgressiveDisclosure) | UI primitives — web 페이지도 import |
| `components/auth/AuthHero.tsx` | login/signup 에서 사용 — web/app 공통 |

## ✅ R14 — variant prop 으로 공유 컴포넌트 분기

R14 (2026-05-25) 부터 일부 공유 컴포넌트는 **`variant: 'web' | 'app'` prop** 으로
시각 분기. 같은 컴포넌트 안에서 borderRadius / boxShadow / fontFamily 만 다르게,
코드 fork 없이 web editorial 톤 + app v3 톤 동시 지원.

| 컴포넌트 | variant 적용 |
|---|---|
| `components/cart/CartReceipt.tsx` | ✅ |
| `components/cart/CartUpsell.tsx` | ✅ |
| `components/products/CatalogProductCard.tsx` | ✅ |
| `components/products/CatalogChrome.tsx` | ✅ |
| `components/products/CatalogHero.tsx` | ✅ |
| `components/products/CatalogSubscribeBand.tsx` | ✅ |

페이지에서 호출 시:
```tsx
const isApp = await isAppContextServer()
return <CatalogProductCard product={p} variant={isApp ? 'app' : 'web'} />
```

이 컴포넌트들은 **variant prop 추가 / 확장은 OK**. 단 web variant 의 기존
시각 (borderRadius 18/22, archivo black 등) 은 default 로 유지.

## 변경 시 분리 패턴 (다른 공유 영역)

variant prop 이 아직 안 들어간 다른 공유 영역에선 다음 중 하나:

```tsx
// 1) responsive boundary — mobile=app, desktop=web 으로 분기
<div className="md:hidden"> {/* app view — 자유롭게 v3 */} </div>
<div className="hidden md:block"> {/* web view — 손대지 말 것 */} </div>

// 2) Server-side context check
import { isAppContextServer } from '@/lib/app-context'
const isApp = await isAppContextServer()
return isApp ? <V3View /> : <WebView />

// 3) variant prop 신규 추가 (권장 — R14 패턴)
function MyComponent({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  const isApp = variant === 'app'
  // borderRadius: isApp ? 4 : 18, ...
}
```

## 빠른 self-check

새 코드 작성 / 수정 전에 1초 답:

1. 이 파일이 `app/(main)/**` 또는 `components/v3/**` 안에 있나? → **OK**
2. variant prop 지원 컴포넌트인가? → **`isApp ? 'app' : 'web'` 패스만 OK**
3. 그 외 공유 영역이면: web default 톤 보존 + variant 추가하거나 컨텍스트 분기.

# ⛔ 돈·데이터를 다루는 코드 — 2026-07-30 최종감사로 못 박은 규칙

하루에 "critical 수정 완료"를 두 번 보고했고 **둘 다 불완전**했다. 아래는 그
실패에서 나온 것이고, 전부 **실제로 틀렸던 방식**이다(가정 아님).

## 1) Supabase 호출은 `error` 를 반드시 꺼낸다 — "데이터 없음" ≠ "실패"

```ts
const { data } = await supabase.from('x').select()       // ⛔ 금지
const { data, error } = await supabase.from('x').select() // ✅
```
`data` 만 받으면 **오류와 빈 결과가 구분되지 않는다.** 실제 피해 두 건:
- 웹훅이 DB 오류를 "이미 처리됨"으로 읽고 토스에 **200** 을 돌려줘 재시도를
  끊었다. 멱등 기록까지 남아 수동 재시도도 막혀 **복구 경로가 0개**가 됐다.
- 새 정기배송 화면이 조회 실패를 "구독 없음"으로 표시해, 결제가 걸린 고객에게
  "정기배송을 시작할 수 있어요"를 안내했다.

`update(...).select()` 도 같다. **0행이 "이미 처리됨"인지 "오류"인지 먼저 가른다.**

## 2) "검증 못 하면 통과"를 쓰기 전에 그 조건의 생성 주체를 확인한다

청구 검문소에 "재계산 못 하면 검사 건너뜀"을 넣었다. 그런데 재계산에 필요한
`fresh_ratio` 가 **고객이 쓸 수 있는 칸**이어서, `{"total_amount":100,
"fresh_ratio":0}` 로 검문소가 그대로 비켜섰다 — **막으려던 critical 이 필드
하나로 열려 있었다.**

→ 방어를 만들면 **탈출구를 열거하고, 그 조건을 사용자가 만들 수 있는지** 본다.

## 3) 값을 검사하기 전에 "쓸 수 없게" 만드는 층위를 먼저 본다

같은 문제의 옳은 해법은 애플리케이션 검사가 아니라 **DB 컬럼 권한 회수**였다
(`20260730000000_subscriptions_lock_money_columns.sql`).
`subscriptions` 는 **화이트리스트**다 — 고객은 4칸만 UPDATE 할 수 있고,
**새 칸은 자동으로 차단**된다. 고객이 써야 하는 칸이 생기면 그때 명시적으로
GRANT 하고, 그 리뷰가 목적이다.

## 4) 주석이 주장하는 방어는 grep 으로 실물을 확인한다

`"UPDATE-with-RETURNING 으로 atomically 선점(last_charge_lock_at 마킹)"` 이라는
주석이 있었지만 **코드는 SELECT** 였고 그 컬럼명은 저장소 전체에서 **그 주석 한
줄이 유일한 등장**이었다. 없는 방어를 있다고 믿게 만드는 주석이 코드가 없는
것보다 위험하다 — 나도 그 파일을 여러 번 고치면서 읽고 넘어갔다.

## 5) 금액은 **저장값으로 청구**한다. 재계산으로 깎거나 막지 않는다

`lib/payments/charge-amount-guard.ts` 는 **알림 전용**이다. 재계산이 정당하게
어긋나는 경우가 여럿이고(재고 변동 · 플랜 화면 레시피 선택 미저장 · 처방 회차
차이) 그 크기가 조작과 구분되지 않는다(실측 40%). `min()` 으로 낮춰 청구하면
저청구(실측 −40.6%), `refuse` 로 막으면 정상 고객의 박스가 멈춘다.
**저장 금액 = 고객이 동의하고 모든 화면이 보여주는 값.** 그것으로 긁고, 어긋나면
사람에게 알린다. 불변식 테스트가 이걸 지킨다.

## 6) 처방(dog_formulas)을 고를 때 `cycle_number` 로 정렬하지 않는다

회차 번호가 큰 것이 최신이 아니다 — 프로덕션 실측으로 cycle 2 가 cycle 1 보다
**5일 먼저** 생성돼 있었다. `created_at DESC` 를 쓴다.
그리고 **주문 화면은 cycle 1 고정**이다(사장님 제보로 고친 것). 금액을 만든
기준과 대조하는 기준이 다르면 조용히 저청구가 된다.

## 7) 배포가 반영 안 되면 **GitHub 커밋 status 부터** 본다

Vercel 이 크론 요금 한도로 **빌드 시작을 거부**하면 Vercel 쪽에 배포 기록이
아예 안 생긴다. 유일한 신호가 GitHub 커밋 status 의
`Vercel — Deployment failed.` + 링크였다. 웹훅·계정을 뒤지기 전에 그것부터.
`vercel.json` 의 크론은 **전부 하루 1회 이하**로 유지한다.

## 8) 검증은 부작용 없는 조회로 한다

권한 확인은 `has_column_privilege()` 같은 순수 함수로. 프로덕션을 **바꿔서**
확인하지 않는다. 불가피하면 롤백하는 트랜잭션 안에서.
배포 확인용 신호(카나리아)는 쓰기 전에 **"바뀌면 초록"과 "안 바뀌면 빨강"을 둘 다**
검산한다 — 두 번 연속 무효한 신호로 잘못 결론냈다(FAQ 는 DB 에서 오고, 다른
하나는 사이트 봇차단 403 페이지를 검사하고 있었다).

# Verification before push — DO NOT shortcut this

**The exit-code-via-pipe trap.** Commands like `npx tsc --noEmit 2>&1 | head -30` return the exit code of `head`, NOT `tsc`. tsc can print 20 type errors and exit 1, but `| head` returns 0 and the shell reports "success." This silently broke ~10 Vercel builds before being caught.

**Always verify with one of these patterns** (in order of preference):

```bash
# 1) Canonical script — eslint + tsc + tests, all chained with && (exit propagates)
npm run verify

# 2) Or raw tsc, NO pipe
npx tsc --noEmit

# 3) Or pipe with explicit exit propagation
set -o pipefail; npx tsc --noEmit 2>&1 | tail -30
```

**Never** do `npx tsc --noEmit | head` / `| tail` / `| wc` and check `$?`. The exit code belongs to the last command in the pipe.

**Pre-commit hook is installed** (`scripts/install-git-hooks.mjs` writes to `.git/hooks/pre-commit`, runs `npm run precommit` = eslint + tsc with full exit code). If a fresh clone, run `npm run install:hooks` once. Skip only with `git commit --no-verify` and only when you know why.

# Why Vercel still catches things `npx tsc` doesn't

Even with proper exit-code handling, `npx tsc --noEmit` and `next build` are not identical:

1. **`next build` regenerates `.next/types/`** — auto-generated route signatures (PageProps, layout props, etc) that tsconfig includes via `".next/types/**/*.ts"`. Without a fresh build, these can be stale or missing.
2. **The `next` tsconfig plugin** runs in editors/IDE but not always in the bare `tsc` CLI — it adds extra route-prop checks during build.
3. **Incremental cache** (`tsconfig.tsbuildinfo`) can skip re-checking files whose direct content didn't change but whose dependent types did.

When a Vercel build fails on something local tsc missed, before assuming it's flaky:
- `rm -rf .next && npx next build` — reproduces Vercel's exact check locally (~90s).
  **⚠️ Stop the dev server first.** The dev server keeps its state in `.next/dev/`.
  Deleting `.next` underneath a running dev server breaks it — every request 500s
  with `ENOENT .next/dev/routes-manifest.json` and
  `Cannot find module '../chunks/ssr/[turbopack]_runtime.js'`. The tell that two
  Turbopack processes are fighting over one directory is
  `Persisting failed: Another write batch or compaction is already active`.
  (Hit this 2026-07-30 — the owner saw a wall of 500s and thought the port had
  changed. It hadn't: the port stays 3000, only the cache was gone.)
  Recovery: stop dev server → `rm -rf .next` → start dev server.
- If that passes but Vercel still fails, then it's a Vercel environment issue (Node version, env var, etc). Otherwise, the bug is real.

# Commit / push checklist

Before `git push`, mentally run through:

1. `npm run verify` — passes? (or at minimum `npx tsc --noEmit` no-pipe)
2. Pre-commit hook ran on `git commit`? (look for `[pre-commit] eslint + tsc...` in commit output)
3. Touched a server↔client boundary or route signature? → consider `rm -rf .next && npx next build` once before push.

Skipping #1 is how ~10 Vercel builds failed in this repo. Don't.

# v3 Design scale — single source of truth

R14 (2026-05-23) 에서 정리된 표준 스케일. 새 코드는 이 외 값을 쓰지 않는다.
미준수 발견 시 그 자리에서 정리.

## Spacing scale (8pt 베이스)

| Token | px | 용도 |
|---|---|---|
| 1 | 4 | icon gap, tag inner |
| 2 | 8 | inline gap (text-icon, button label-icon) |
| 3 | 12 | card 내부 row gap, 카드 사이 간격 (`mt-3`) |
| 4 | 16 | card 외곽 padding (`p-4`) |
| 5 | 20 | section 좌우 padding 표준 (`px-5`) |
| 7 | 28 | 큰 hero 카드 padding |
| 10 | 40 | 페이지 상단/하단 여백 |
| 16 | 64 | 섹션 사이 큰 여백 (rare) |

표준 패턴: `mx-5 mt-3 gap-3 px-5 py-4`. 이 외 mx-/mt-/p- 값이 등장하면 정리 대상.

## Typography scale (`V3FontSize`)

| Token | px | 용도 |
|---|---|---|
| xxs | 9 | 페이지네이션 카운터 |
| xs | 10.5 | mono kicker, badge |
| sm | 12 | 보조 본문, subtitle |
| base | 13.5 | 본문 (한국어 가독성 하한) |
| md | 16 | 카드 제목, 강조 본문 |
| lg | 22 | section heading (h2) |
| xl | 32 | 페이지 헤더 (h1 small) |
| xxl | 54 | hero display |

**그 외 px 금지.** 13/14/15 같은 임의 값은 V3FontSize 의 base/md 로 정리.

## Letter spacing

| Use | Value |
|---|---|
| hero display (xxl) | -0.025em |
| heading (h1/h2) | -0.02em |
| body (md/base) | -0.015em / -0.01em |
| mono kicker | 0.16em |

## Line height

| Use | Value (class) |
|---|---|
| hero display | `leading-tight` (0.95) |
| h2/h3 | `leading-snug` (1.1) |
| card title | `leading-snug` ~ `leading-normal` (1.1-1.35) |
| body / paragraph | `leading-relaxed` (1.55) |

## Border radius

| Token | px | 용도 |
|---|---|---|
| xs | 2 | badge, chip |
| sm | 4 | **signature** — card, button, input |
| md | 12 | modal, sheet header, hero card |
| pill | 999 | pill button, status dot |

`rounded-xl` (12), `rounded-2xl` (16), `rounded-3xl` (24) 는 v3 어디서도 쓰지 않는다.
hero gradient 카드는 `rounded-[12px]` (md tier) 명시. 일반 카드는 `rounded` (4).

## Color contrast — WCAG audit

`lib/design/contrast.ts` 의 `V3_CONTRAST_PAIRS` 가 표준 조합. 요약:

- `ink` (#16140f) on `paper` (#f4ede0) — 14.6:1 — AAA pass
- `inkSoft` (#3a342a) on `paper` — 9.7:1 — AAA pass
- `inkMute` (#706854) on `paper` — 4.75:1 — **AA pass** (마스터피스 P1-A2 darken, 이전 #7d7460=3.7)
- `inkFaint` (#b6ab93) on `paper` — 1.9:1 — **텍스트 금지** (UI hint 전용)

**규칙:** `inkMute`(#706854) 는 본문 AA(4.5:1) 통과 — app 라이트 ≤13.5px 보조 본문에 안전. 더 강한 강조는 `inkSoft`(9.7:1).


