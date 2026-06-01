#!/usr/bin/env node
/**
 * 로컬 git hook 설치 — simple-git-hooks 의존성 없이 로컬에서만.
 *
 * 사용:
 *   node scripts/install-git-hooks.mjs    # 한 번 실행 (npm run install:hooks)
 *
 * 설치 항목:
 *   1) pre-commit  — staged 변경에 eslint + tsc (npm run precommit). 빠른 1차 방어.
 *   2) pre-push    — 전체 CI 미러: eslint + tsc + test + production build(CI env)
 *                    (npm run verify:push). "로컬 통과 / CI red" 격차를 push 전에 차단.
 *
 * 왜 pre-push 까지:
 *   pre-commit 은 build 를 안 돌려서, next build(production) 에서만 드러나는
 *   에러(예: env.ts 가 빌드 중 throw)를 못 잡는다. 마스터피스 P1 직후 CI 가
 *   3연속 red 였던 게 정확히 이 종류였다. pre-push 가 scripts/ci-build.mjs 로
 *   CI build job 을 그대로 재현해 막는다.
 *
 * skip (필요 시에만):
 *   git commit --no-verify   /   git push --no-verify
 */
import { writeFileSync, chmodSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const GIT_DIR = resolve(process.cwd(), '.git')
if (!existsSync(GIT_DIR)) {
  console.error(
    '[install-git-hooks] .git directory 없음 — git repo 루트에서 실행해야 함',
  )
  process.exit(1)
}

const HOOKS = {
  'pre-commit': `#!/usr/bin/env sh
# Auto-installed by scripts/install-git-hooks.mjs.
# Skip with: git commit --no-verify
set -e
echo "[pre-commit] eslint + tsc..."
npm run precommit
`,
  'pre-push': `#!/usr/bin/env sh
# Auto-installed by scripts/install-git-hooks.mjs.
# 전체 CI 미러 — push 가 CI 에서 red 나는 걸 사전 차단.
# eslint + tsc + test + production build(CI placeholder env, .env.local 숨김).
# Skip with: git push --no-verify  (가능하면 쓰지 말 것)
set -e
echo "[pre-push] CI 미러 검증: eslint + tsc + test + CI build..."
echo "[pre-push] (수 분 걸립니다 — CI 가 red 안 나도록 로컬에서 먼저 확인)"
npm run verify:push
echo "[pre-push] ✅ 통과 — push 진행"
`,
}

for (const [name, content] of Object.entries(HOOKS)) {
  const path = resolve(GIT_DIR, 'hooks', name)
  writeFileSync(path, content, 'utf8')
  try {
    chmodSync(path, 0o755)
  } catch {
    // Windows — 실행 권한 무시.
  }
  console.log(`[install-git-hooks] ${name} 설치 완료 → ${path}`)
}

console.log(
  '[install-git-hooks] 끝. pre-commit(빠름) + pre-push(전체 CI 미러) 활성화됨.',
)
