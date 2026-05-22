<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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
