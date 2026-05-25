#!/usr/bin/env node
/**
 * Service Worker BUILD_SHA 자동 주입 (prebuild).
 *
 * 문제: public/sw.js 의 CACHE_NAME 이 'farmerstail-v4' 로 hardcoded.
 *   매 빌드마다 SW 자체가 변하지 않으면 브라우저가 새 sw.js 로 안 바꿈 →
 *   사용자 PWA 가 영구히 옛 캐시 보관 → 코드 변경이 사용자에 안 보임.
 *
 * 해결: 매 빌드 직전에 sw.js 의 CACHE_NAME 자리에 빌드 SHA / 타임스탬프 주입.
 *   sw.js 자체 내용이 바뀜 → 브라우저가 새 sw.js 받음 → install → activate →
 *   옛 캐시 삭제 → 사용자가 새 코드 자동 인지.
 *
 * 동작:
 *   1) public/sw.js 의 라인 `const CACHE_NAME = 'farmerstail-v4'` 를 찾음
 *   2) 그 자리에 `const CACHE_NAME = 'farmerstail-<SHA12>-<TS>'` 주입
 *   3) build SHA 우선순위: VERCEL_GIT_COMMIT_SHA → GIT_COMMIT_SHA → git rev-parse → fallback timestamp
 *   4) 빌드 후 git 에 들어가면 안 됨 → .gitignore 에 없으므로 빌드 끝나면
 *      원본 복원하거나, 그대로 두고 commit 안 함. Vercel 빌드는 ephemeral.
 *
 * 안전 장치:
 *   - 원본 패턴이 못 찾으면 throw — silent fail 방지
 *   - 이미 SHA 가 주입된 경우 (재실행) 새 값으로 다시 교체
 *   - 환경변수 SKIP_SW_INJECT=1 로 건너뛰기 가능 (로컬 dev 등)
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SW_PATH = path.resolve(__dirname, '..', 'public', 'sw.js')

if (process.env.SKIP_SW_INJECT === '1') {
  console.log('[inject-sw] SKIP_SW_INJECT=1 → 건너뜀')
  process.exit(0)
}

function shortSha() {
  // Vercel 빌드 환경
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12)
  }
  if (process.env.GIT_COMMIT_SHA) {
    return process.env.GIT_COMMIT_SHA.slice(0, 12)
  }
  // 로컬
  try {
    return execSync('git rev-parse --short=12 HEAD', {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return null
  }
}

const sha = shortSha()
const ts = Date.now().toString(36) // base36 짧게
// SHA 가 있으면 SHA + 짧은 timestamp, 없으면 timestamp 만 (둘 다 매 빌드 변경됨).
const tag = sha ? `${sha}-${ts}` : `dev-${ts}`
const newCacheName = `farmerstail-${tag}`

if (!fs.existsSync(SW_PATH)) {
  console.error(`[inject-sw] sw.js 를 못 찾음: ${SW_PATH}`)
  process.exit(1)
}

const original = fs.readFileSync(SW_PATH, 'utf-8')

// CACHE_NAME 라인 매칭: 'farmerstail-v4', 'farmerstail-abc123-xyz' 등 모두 매치.
const re = /const\s+CACHE_NAME\s*=\s*'farmerstail-[^']+'/m
if (!re.test(original)) {
  console.error('[inject-sw] sw.js 에서 CACHE_NAME 패턴을 찾지 못함')
  process.exit(1)
}

const updated = original.replace(
  re,
  `const CACHE_NAME = '${newCacheName}'`,
)

if (updated === original) {
  console.log(`[inject-sw] 변경 없음 (이미 ${newCacheName})`)
  process.exit(0)
}

fs.writeFileSync(SW_PATH, updated, 'utf-8')
console.log(
  `[inject-sw] CACHE_NAME → '${newCacheName}' (sha=${sha ?? 'none'})`,
)
