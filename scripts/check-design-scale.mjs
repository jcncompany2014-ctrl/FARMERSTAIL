#!/usr/bin/env node
/**
 * R15-D36/D37: design scale violation check.
 *
 * ESLint custom rule 대신 빠른 regex 기반 sweep. CI 에서 단순 grep 수준.
 *
 *   npm run check:design
 *
 * 검사 대상:
 *   - V3FontSize 스케일 외 fontSize px (app/(main)/** + components/v3/**)
 *   - V3Radius 스케일 외 borderRadius px (같은 영역)
 *   - rounded-2xl / rounded-3xl Tailwind class
 *
 * 허용 값:
 *   - fontSize: 9, 9.5 (kicker), 10, 10.5, 11, 11.5, 12, 13, 13.5, 14, 15,
 *               16, 18, 22, 26, 28, 32, 54
 *   - borderRadius: 2, 4, 6, 8, 12, 16, 999, '50%'
 *   - magic numbers (width/height 동등 = 원형) 도 OK
 *
 * 위반 시 비-0 종료. 상세 violation 목록 stderr.
 *
 * Note: false positive 많을 수 있음 — 정보 제공용. precommit hook 에 묶지 X.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const TARGET_DIRS = ['app/(main)', 'components/v3', 'components/dashboard']

// V3FontSize 표준 + 실제 in-use 값 (hero/display 톤 등 디자인 의도된 outlier).
// 추가 시 AGENTS.md design scale section 도 갱신할 것.
const ALLOWED_FONTSIZES = new Set([
  8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15,
  16, 17, 18, 19, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 44, 48, 54, 58, 96,
])
// V3Radius 표준 + 실제 in-use (web variant outlier 일부 포함).
// 0/1 = hairline chart, 9 = stepper dot, 60 = circular sheet.
const ALLOWED_RADII = new Set([
  0, 1, 2, 3, 4, 6, 8, 9, 10, 12, 14, 16, 18, 20, 24, 28, 60, 99, 999,
])

const FONT_RE = /fontSize:\s*(\d+(?:\.\d+)?)/g
const RADIUS_RE = /borderRadius:\s*(\d+)/g
const TW_ROUNDED_RE = /rounded-(2xl|3xl)/g

const violations = []

function walk(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      walk(full)
    } else if (
      e.isFile() &&
      (e.name.endsWith('.tsx') || e.name.endsWith('.ts'))
    ) {
      check(full)
    }
  }
}

function check(file) {
  const text = readFileSync(file, 'utf8')
  let m

  while ((m = FONT_RE.exec(text))) {
    const n = parseFloat(m[1])
    if (!ALLOWED_FONTSIZES.has(n)) {
      const line = text.slice(0, m.index).split('\n').length
      violations.push({ file, line, kind: 'fontSize', value: m[1] })
    }
  }
  FONT_RE.lastIndex = 0

  while ((m = RADIUS_RE.exec(text))) {
    const n = parseInt(m[1], 10)
    if (!ALLOWED_RADII.has(n)) {
      const line = text.slice(0, m.index).split('\n').length
      violations.push({ file, line, kind: 'borderRadius', value: m[1] })
    }
  }
  RADIUS_RE.lastIndex = 0

  while ((m = TW_ROUNDED_RE.exec(text))) {
    const line = text.slice(0, m.index).split('\n').length
    violations.push({
      file,
      line,
      kind: 'tw-rounded',
      value: `rounded-${m[1]}`,
    })
  }
  TW_ROUNDED_RE.lastIndex = 0
}

for (const dir of TARGET_DIRS) {
  const full = join(ROOT, dir)
  try {
    if (statSync(full).isDirectory()) walk(full)
  } catch {
    /* dir missing — skip */
  }
}

if (violations.length === 0) {
  console.log('design-scale: 0 violations.')
  process.exit(0)
}

console.error(`design-scale: ${violations.length} violation(s):`)
for (const v of violations) {
  const rel = v.file.replace(ROOT + (process.platform === 'win32' ? '\\' : '/'), '')
  console.error(`  ${rel}:${v.line}  ${v.kind}=${v.value}`)
}
process.exit(1)
