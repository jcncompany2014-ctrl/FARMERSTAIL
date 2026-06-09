#!/usr/bin/env node
/**
 * CI 빌드 정확 재현 — "로컬은 통과, CI 는 red" 격차를 push 전에 잡는다.
 *
 * # 왜 필요한가
 * `next build` 는 NODE_ENV=production 으로 돌고, lib/env.ts 는 production 에서
 * 필수 키(SUPABASE_SERVICE_ROLE_KEY 등)가 비면 throw 한다. 로컬 build 는
 * .env.local 이 그 키를 채워줘서 통과하지만, CI(GitHub Actions)는 .env.local 이
 * 없고 .github/workflows/ci.yml 의 build job env(placeholder)만 쓴다. 그래서
 * "로컬 build OK / CI build red" 가 발생할 수 있다 (마스터피스 P1 직후 실제 사례:
 *  analysis 라우트 page-data 수집 중 env.ts throw → CI 3연속 실패).
 *
 * # 이 스크립트가 하는 일 (CI 와 동일)
 *   1) .env.local 을 잠시 숨긴다 (finally + 신호 핸들러 + 다음 실행 시작 시
 *      자동 복원 → 비정상 종료에도 안전).
 *   2) ci.yml build job 의 env 블록을 "있는 그대로" 파싱해 주입한다 (드리프트 0).
 *   3) 깨끗한 env(시스템 변수 화이트리스트 + ci placeholder)로 `next build` 실행.
 * 통과하면 CI build job 도 통과한다.
 *
 * 사용: npm run build:ci   (pre-push hook 이 자동 호출)
 */
import { readFileSync, renameSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const CI_YML = resolve(ROOT, '.github/workflows/ci.yml')
const ENV_LOCAL = resolve(ROOT, '.env.local')
const ENV_HIDDEN = resolve(ROOT, '.env.local.cibak')

// ── 비정상 종료 복원: .env.local 이 숨겨진 채 남았으면 먼저 되돌린다 ──
function restoreEnvLocal() {
  if (existsSync(ENV_HIDDEN) && !existsSync(ENV_LOCAL)) {
    try {
      renameSync(ENV_HIDDEN, ENV_LOCAL)
      return true
    } catch {
      /* best-effort */
    }
  }
  return false
}
if (restoreEnvLocal()) {
  console.log('[build:ci] 이전 실행 잔여 .env.local.cibak → .env.local 복원함')
}
process.on('SIGINT', () => {
  restoreEnvLocal()
  process.exit(130)
})
process.on('SIGTERM', () => {
  restoreEnvLocal()
  process.exit(143)
})

// ── 1) ci.yml build job 의 env 블록 파싱 (SSOT — 직접 하드코딩 안 함) ──
function parseBuildEnv() {
  // CRLF 안전: Windows 체크아웃(core.autocrlf=true)으로 ci.yml 작업본이 CRLF 여도
  // 파서(LF 가정)가 깨지지 않게 정규화. 커밋 blob 은 LF 그대로 — 영향 없음.
  const yml = readFileSync(CI_YML, 'utf8').replace(/\r\n/g, '\n')
  const buildIdx = yml.indexOf('\n  build:')
  if (buildIdx === -1) throw new Error('ci.yml 에서 build job(\\n  build:)을 못 찾음')
  // build job 범위: 다음 2-space job(예: \n  audit:) 직전까지.
  const rest = yml.slice(buildIdx + 1)
  const nextJobOff = rest.slice(1).search(/\n {2}[A-Za-z0-9_-]+:\n/)
  const block = nextJobOff === -1 ? rest : rest.slice(0, nextJobOff + 1)
  const envIdx = block.indexOf('\n    env:')
  if (envIdx === -1) throw new Error('ci.yml build job 에 env: 블록이 없음')
  const envLines = block.slice(envIdx + 1).split('\n').slice(1)
  const env = {}
  for (const line of envLines) {
    if (/^ {4}\S/.test(line)) break // 4-space 키(steps:) → env 블록 끝
    const m = line.match(/^ {6}([A-Za-z0-9_]+):\s*(.*)$/)
    if (!m) continue // 주석/빈 줄 skip
    const value = m[2]
      .replace(/\s+#.*$/, '') // 인라인 주석 제거
      .replace(/^['"]|['"]$/g, '') // 양끝 따옴표 제거
      .trim()
    env[m[1]] = value
  }
  return env
}

// ── 2) 시스템 env 화이트리스트 (시크릿 제외 — env -i 와 동일 효과) ──
function systemEnv() {
  const keep = [
    'PATH', 'Path', 'HOME', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP',
    'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'ComSpec', 'PATHEXT',
    'NUMBER_OF_PROCESSORS', 'windir', 'HOMEDRIVE', 'HOMEPATH',
  ]
  const out = {}
  for (const k of keep) {
    if (process.env[k] !== undefined) out[k] = process.env[k]
  }
  return out
}

const ciEnv = parseBuildEnv()
// lib/env.ts 가 production 에서 hard-require(없으면 throw)하는 키.
const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]
const missing = REQUIRED.filter((k) => !ciEnv[k])
if (missing.length) {
  console.error(
    `[build:ci] ❌ ci.yml build env 에 필수 키 누락: ${missing.join(', ')}`,
  )
  console.error(
    '  → next build(production)가 env.ts 에서 throw 합니다. ci.yml 의 build job env 를 고치세요.',
  )
  process.exit(1)
}

console.log('[build:ci] CI 빌드 재현 시작 — .env.local 숨김 + ci.yml placeholder env')
console.log(`[build:ci] 주입 키(${Object.keys(ciEnv).length}): ${Object.keys(ciEnv).join(', ')}`)

const hadLocal = existsSync(ENV_LOCAL)
if (hadLocal) renameSync(ENV_LOCAL, ENV_HIDDEN)

let code = 1
try {
  const res = spawnSync('npm', ['run', 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...systemEnv(), ...ciEnv },
  })
  code = res.status ?? 1
} finally {
  if (hadLocal) restoreEnvLocal()
}

if (code === 0) {
  console.log(
    '\n[build:ci] ✅ CI 빌드 재현 통과 — 이 커밋은 CI build job 도 통과합니다.',
  )
} else {
  console.error(
    `\n[build:ci] ❌ CI 빌드 재현 실패 (exit ${code}) — 이대로 push 하면 CI red.\n` +
      '  위 build 로그의 첫 에러를 고친 뒤 다시 `npm run build:ci` 로 확인하세요.',
  )
}
process.exit(code)
