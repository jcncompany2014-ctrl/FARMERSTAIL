#!/usr/bin/env node
/**
 * audit #84: pre-commit hook 설치 — simple-git-hooks 의존성 없이 로컬에서만.
 *
 * 사용:
 *   node scripts/install-git-hooks.mjs    # 한 번 실행
 *
 * 효과:
 *   commit 시 staged 파일에 대해 lint + tsc 자동 실행. 실패 시 commit 차단.
 *
 * skip:
 *   git commit --no-verify
 */
import { writeFileSync, chmodSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const HOOK_PATH = resolve(process.cwd(), '.git/hooks/pre-commit')

if (!existsSync(resolve(process.cwd(), '.git'))) {
  console.error('[install-git-hooks] .git directory 없음 — git repo 안에서 실행해야 함')
  process.exit(1)
}

const hookContent = `#!/usr/bin/env sh
# Auto-installed by scripts/install-git-hooks.mjs (audit #84).
# Skip with: git commit --no-verify

set -e

echo "[pre-commit] eslint + tsc..."
npm run precommit
`

writeFileSync(HOOK_PATH, hookContent, 'utf8')
try {
  chmodSync(HOOK_PATH, 0o755)
} catch {
  // Windows — 실행 권한 무시.
}
console.log(`[install-git-hooks] ${HOOK_PATH} 설치 완료`)
