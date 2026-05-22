<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ⛔ App / Web 분리 — 절대 web 시각 변경 금지

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

## ⛔ 금지 (touch 시 web 도 변경됨)

| 경로 / 파일 | Web 영향 이유 |
|---|---|
| `app/(auth)/login/page.tsx` · `signup/page.tsx` | `(auth)` 그룹은 web+app 공유 |
| `app/cart/page.tsx`, `app/cart/CartList.tsx` | top-level, AuthAwareShell 분기 |
| `app/checkout/**` | top-level, AuthAwareShell 분기 |
| `app/products/page.tsx`, `app/products/[slug]/**` | top-level, AuthAwareShell 분기 |
| `app/mypage/orders/**` (note: 이건 `app/(main)/mypage` 와 다른 경로 — top-level web/app 공유) | top-level, AuthAwareShell 분기 |
| `components/products/**` (CatalogProductCard, RelatedProducts, RecentlyViewed, ProductReviews 등) | catalog/PDP 양쪽 컨텍스트에서 import |
| `components/cart/**` | 모바일 핸드오프 전용처럼 보이지만 page.tsx 가 양쪽에서 import |
| `components/ui/**` (Toast, Button, Form, BottomSheet, VariantSelector, EmptyState, Skeleton, Spinner, ErrorScreen, CopyButton, StockBadge, Motion, ProgressiveDisclosure) | UI primitives — web 페이지도 import |
| `components/auth/AuthHero.tsx` | login/signup 에서 사용 — web/app 공통 |

## 변경 시 분리 패턴

공유 페이지 / 컴포넌트에서 **반드시** 시각이 바뀌어야 할 때:

```tsx
// 1) responsive boundary — mobile=app, desktop=web 으로 분기
<div className="md:hidden"> {/* app view — 자유롭게 v3 */} </div>
<div className="hidden md:block"> {/* web view — 손대지 말 것 */} </div>

// 2) Server-side context check
import { isAppContextServer } from '@/lib/app-context'
const isApp = await isAppContextServer()
return isApp ? <V3View /> : <WebView />

// 3) CSS scope (globals.css)
[data-ft-chrome="app"] .my-component { /* app-only override */ }
```

## 빠른 self-check

새 코드 작성 / 수정 전에 1초 답:

1. 이 파일이 `app/(main)/**` 또는 `components/v3/**` 안에 있나? → **OK**
2. 그 외라면: web 에도 노출되나? → 조사 필요. 답이 yes 면 **금지**.

이 규칙 위반은 web editorial 톤 손상 → 사용자 즉시 revert 요청 → 작업 손실.

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
- If that passes but Vercel still fails, then it's a Vercel environment issue (Node version, env var, etc). Otherwise, the bug is real.

# Commit / push checklist

Before `git push`, mentally run through:

1. `npm run verify` — passes? (or at minimum `npx tsc --noEmit` no-pipe)
2. Pre-commit hook ran on `git commit`? (look for `[pre-commit] eslint + tsc...` in commit output)
3. Touched a server↔client boundary or route signature? → consider `rm -rf .next && npx next build` once before push.

Skipping #1 is how ~10 Vercel builds failed in this repo. Don't.
