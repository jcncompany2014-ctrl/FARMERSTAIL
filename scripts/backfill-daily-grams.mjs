/**
 * dog_formulas.daily_grams 백필 — 옛 kcal 밀도로 굳은 저장값을 현행으로 덮어쓴다.
 * (2026-08-03, 사장님: "재계산해서 덮어")
 *
 * # 왜 필요한가
 * `daily_grams` 는 `daily_kcal × lineRatios` 에서 나오는 **유도값**인데 DB 에
 * 따로 저장된다. 레시피 kcal 밀도가 v4.0 으로 바뀐 2026-07-24 **이전에** 만들어진
 * 행은 옛 밀도로 계산된 숫자를 그대로 들고 있다.
 *   예) 푸린 cycle 1 — 184 kcal 인데 저장 160g (÷1.15). 현행은 142g (÷1.30).
 *
 * 화면은 이제 저장값을 안 읽고 다시 센다(lib/personalization/dailyGrams).
 * 이 스크립트는 **저장값 자체**를 맞춰 어드민·이력·다른 소비자도 같은 숫자를
 * 보게 한다.
 *
 * # 쓰는 법
 *   node scripts/backfill-daily-grams.mjs           # 미리보기(기본) — 쓰지 않음
 *   node scripts/backfill-daily-grams.mjs --write   # 실제로 덮어씀
 *
 * 환경변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local)
 *
 * # 안전
 *  · 기본이 미리보기다. `--write` 없이는 한 행도 안 바뀐다.
 *  · 바뀌는 행만 UPDATE 하고, 무엇이 몇 g→몇 g 인지 전부 출력한다.
 *  · daily_kcal 이나 lineRatios 가 없으면 **건너뛴다**(추측해서 쓰지 않는다).
 *  · 키 값은 출력하지 않는다.
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { dailyGramsFromMix } from '../lib/personalization/lines.ts'

function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    /* .env.local 없으면 실제 환경변수를 쓴다 */
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error(
    '환경변수가 없습니다: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY',
  )
  process.exit(1)
}

const WRITE = process.argv.includes('--write')
const supabase = createClient(url, key, { auth: { persistSession: false } })

const { data: rows, error } = await supabase
  .from('dog_formulas')
  .select('id, dog_id, cycle_number, daily_kcal, daily_grams, formula, created_at')
  .order('created_at', { ascending: true })

// 규칙1 — 조회 실패를 "행 없음" 으로 읽지 않는다.
if (error) {
  console.error('dog_formulas 조회 실패:', error.message)
  process.exit(1)
}

let same = 0
let skipped = 0
const changes = []

for (const row of rows ?? []) {
  const ratios = row.formula?.lineRatios
  if (!row.daily_kcal || !(row.daily_kcal > 0) || !ratios) {
    skipped++
    continue
  }
  const next = dailyGramsFromMix(ratios, row.daily_kcal)
  if (!(next > 0)) {
    skipped++
    continue
  }
  if (next === row.daily_grams) {
    same++
    continue
  }
  changes.push({ ...row, next })
}

console.log(`대상 ${rows?.length ?? 0}행 — 그대로 ${same} · 건너뜀 ${skipped} · 바뀜 ${changes.length}`)
for (const c of changes) {
  const dens = (c.daily_kcal / (c.daily_grams || 1)).toFixed(3)
  const nextDens = (c.daily_kcal / c.next).toFixed(3)
  console.log(
    `  · dog ${String(c.dog_id).slice(0, 8)} cycle ${c.cycle_number} — ` +
      `${c.daily_grams}g → ${c.next}g  (${c.daily_kcal}kcal · ${dens} → ${nextDens} kcal/g)`,
  )
}

if (!WRITE) {
  console.log('\n미리보기입니다. 실제로 덮어쓰려면 --write 를 붙이세요.')
  process.exit(0)
}

let ok = 0
for (const c of changes) {
  const { error: upErr } = await supabase
    .from('dog_formulas')
    .update({ daily_grams: c.next })
    .eq('id', c.id)
  if (upErr) {
    console.error(`  ✖ ${c.id}: ${upErr.message}`)
    continue
  }
  ok++
}
console.log(`\n덮어씀 ${ok}/${changes.length}행.`)
