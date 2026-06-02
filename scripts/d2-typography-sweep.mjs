#!/usr/bin/env node
/**
 * D2 타이포 정합 sweep — app 전용 영역의 off-scale `text-[Npx]` 리터럴을
 * V3FontSize 최근접 스케일로 치환한다(전부 ≤1px diff = 육안 무해).
 *
 * # 안전 경계 (AGENTS.md)
 *  - 대상: app/(main)/**, app/dashboard/**, components/v3/** (전부 app 전용).
 *  - web/공유 영역(app/products, app/cart, app/checkout, app/(auth), components/ui,
 *    components/products 등)은 절대 건드리지 않는다 — ROOTS 에 미포함.
 *  - ASCII Tailwind 클래스명만 치환 — 한글/로직 무관, 회귀 위험 최소.
 *
 * # 매핑 (off-scale → 최근접 on-scale, ≤1px diff 만)
 *  10→10.5, 11→10.5, 11.5→12, 12.5→12, 13→13.5, 14→13.5, 15→16, 17→16.
 *  on-scale(9/10.5/12/13.5/16/22/32/54)은 유지. 2px+ diff(18/19/20+/8/hero)는
 *  육안 인지 가능하므로 이 자동 sweep 에서 제외(판단 필요 → 별도).
 *
 * 사용: node scripts/d2-typography-sweep.mjs --dry   (미적용 카운트)
 *       node scripts/d2-typography-sweep.mjs         (적용)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DRY = process.argv.includes('--dry')
const ROOTS = ['app/(main)', 'app/dashboard', 'components/v3']
const MAP = {
  '10': '10.5',
  '11': '10.5',
  '11.5': '12',
  '12.5': '12',
  '13': '13.5',
  '14': '13.5',
  '15': '16',
  '17': '16',
}

function walk(dir, acc = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const e of entries) {
    const p = join(dir, e)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, acc)
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) acc.push(p)
  }
  return acc
}

let totalFiles = 0
let totalReplacements = 0
const perValue = {}
const touchedFiles = []

for (const root of ROOTS) {
  for (const file of walk(root)) {
    let src = readFileSync(file, 'utf8')
    let changed = 0
    for (const [from, to] of Object.entries(MAP)) {
      // 1) Tailwind 클래스: text-[13px] → text-[13.5px]
      const reClass = new RegExp(`text-\\[${from.replace('.', '\\.')}px\\]`, 'g')
      src = src.replace(reClass, () => {
        changed++
        perValue[from] = (perValue[from] || 0) + 1
        return `text-[${to}px]`
      })
      // 2) inline style 숫자: fontSize: 13 → fontSize: 13.5
      //    토큰/변수(fontSize: V3FontSize.base)는 숫자 미매칭 → 미접촉.
      //    negative lookahead 로 13.5/135 등 오염 방지(on-scale 13.5 보호).
      const reInline = new RegExp(
        `fontSize: ${from.replace('.', '\\.')}(?![\\d.])`,
        'g',
      )
      src = src.replace(reInline, () => {
        changed++
        perValue[`inline-${from}`] = (perValue[`inline-${from}`] || 0) + 1
        return `fontSize: ${to}`
      })
    }
    if (changed > 0) {
      totalFiles++
      totalReplacements += changed
      touchedFiles.push(`${file} (${changed})`)
      if (!DRY) writeFileSync(file, src, 'utf8')
    }
  }
}

console.log(`${DRY ? '[DRY-RUN] ' : '[APPLIED] '}files=${totalFiles} replacements=${totalReplacements}`)
console.log('per-value:', JSON.stringify(perValue))
console.log('files:\n  ' + touchedFiles.slice(0, 80).join('\n  '))
