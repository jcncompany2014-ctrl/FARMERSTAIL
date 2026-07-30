import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 2026-07-30 최종감사로 못 박은 규칙 중 **기계가 잡을 수 있는 것**을 테스트로.
 *
 * 문서(AGENTS.md)에만 적으면 다음에 또 놓친다 — 실제로 같은 날 두 번 놓쳤다.
 * 테스트는 깨지므로 놓칠 수 없다. 규칙 전문과 각 규칙이 생긴 실패 사례는
 * AGENTS.md 의 "돈·데이터를 다루는 코드" 절에 있다.
 */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p)
  }
  return out
}

const ROOT = process.cwd()

/** 저장소 상대 경로 (슬래시 통일) — 비교·메시지용. */
function rel(file: string): string {
  return file.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '')
}

/**
 * `cycle_number` 정렬이 **의도된** 곳. 추가할 때는 이유를 함께 적는다.
 *
 * 왜 기본이 금지인가: 회차 번호가 큰 것이 최신이 아니다. 프로덕션 실측으로
 * cycle 2 가 cycle 1 보다 **5일 먼저** 생성돼 있었고, 그 때문에 8/4 청구가
 * 153,100 → 90,900원(−40.6%)이 될 예정이었다. 청구·피킹 리스트·화면이 서로
 * 다른 처방을 가리키면 "청구한 금액과 담는 박스가 다르다" 가 된다.
 */
const CYCLE_ORDER_ALLOWED: Array<{ file: string; why: string }> = [
  {
    file: 'app/api/cron/personalization-progression/route.ts',
    why: '다음 회차 번호를 `cur.cycle_number + 1` 로 만든다 — created_at 으로 고르면 기존 회차와 번호가 충돌한다',
  },
  {
    file: 'app/(main)/dogs/[id]/formulas/page.tsx',
    why: '처방 이력 목록 — 회차 순 표시가 맞다(하나를 고르는 것이 아님)',
  },
]

test('★ 규칙6: dog_formulas 에서 "최신 하나"를 회차 번호로 고르지 않는다', () => {
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'lib')))) {
    const src = readFileSync(file, 'utf8')
    if (!src.includes('dog_formulas')) continue
    const r = rel(file)
    if (CYCLE_ORDER_ALLOWED.some((a) => r.endsWith(a.file))) continue

    // 같은 파일의 다른 테이블 정렬(예: dog_checkins)을 오탐하지 않도록,
    // `from('dog_formulas')` 이후 12줄 안의 order 만 본다.
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!/from\(\s*['"]dog_formulas['"]/.test(lines[i] ?? '')) continue
      for (let j = i; j < Math.min(i + 12, lines.length); j++) {
        const line = lines[j] ?? ''
        if (/\.order\(\s*['"]cycle_number['"]/.test(line)) {
          offenders.push(`${r}:${j + 1} :: ${line.trim()}`)
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'dog_formulas 정렬은 created_at 으로 — 청구·피킹 리스트·화면이 같은 처방을 ' +
      '가리켜야 한다. 의도된 예외는 CYCLE_ORDER_ALLOWED 에 이유와 함께 추가.\n' +
      'AGENTS.md 규칙6.\n' +
      offenders.join('\n'),
  )
})

test('★ 규칙5: 청구액 가드는 알림 전용 — 금액을 바꾸거나 막지 않는다', () => {
  const src = readFileSync(
    join(ROOT, 'lib/payments/charge-amount-guard.ts'),
    'utf8',
  )
  // 옛 설계의 흔적이 돌아오면 저청구(min)·정상고객 차단(refuse)이 함께 돌아온다.
  assert.equal(
    /verdict:\s*'refuse'/.test(src),
    false,
    'charge-amount-guard 는 청구를 막지 않는다(알림 전용). AGENTS.md 규칙5.',
  )
  assert.equal(
    /Math\.min\(/.test(src),
    false,
    'min() 으로 청구액을 낮추면 저청구가 된다(실측 −40.6%). AGENTS.md 규칙5.',
  )
})

test('★ 규칙1: 결제 경로의 Supabase update 는 error 를 꺼낸다', () => {
  // "데이터 없음"과 "실패"가 구분되지 않으면 복구 경로가 사라진다.
  // 실제 피해: 웹훅이 DB 오류를 '이미 처리됨'으로 읽고 토스에 200 을 돌려줘
  // 재시도를 끊었고, 멱등 기록까지 남아 수동 재시도도 막혔다.
  const targets = [
    'app/api/payments/webhook/route.ts',
    'app/api/payments/billing-issue/route.ts',
    'app/api/cron/subscription-charge/route.ts',
  ]
  const offenders: string[] = []
  for (const t of targets) {
    const src = readFileSync(join(ROOT, t), 'utf8')
    const re =
      /const\s*\{\s*data:\s*\w+\s*\}\s*=\s*await\s+supabase[\s\S]{0,200}?\.update\(/g
    for (const m of src.matchAll(re)) {
      const head = (m[0] ?? '').split('\n')[0] ?? ''
      offenders.push(`${t} :: ${head.trim()}`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'update 결과는 error 를 함께 꺼낸다 — 0행이 "이미 처리됨"인지 "오류"인지 ' +
      '갈라야 한다. AGENTS.md 규칙1.\n' + offenders.join('\n'),
  )
})

test('★ 규칙7: vercel.json 크론은 전부 하루 1회 이하', () => {
  // 넘으면 Vercel 이 요금 한도로 **빌드 시작을 거부**한다. Vercel 쪽에 배포 기록이
  // 아예 안 생겨서 진단이 어렵다(2026-07-30 실제로 겪음 — 커밋 3개가 조용히 미반영).
  const cfg = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
    crons: Array<{ path: string; schedule: string }>
  }
  const tooOften = cfg.crons.filter((c) => {
    const hour = c.schedule.trim().split(/\s+/)[1] ?? ''
    return (
      hour === '*' ||
      hour.includes(',') ||
      hour.includes('/') ||
      hour.includes('-')
    )
  })
  assert.deepEqual(
    tooOften.map((c) => `${c.path} (${c.schedule})`),
    [],
    '하루 1회를 넘는 크론이 있으면 배포가 거부된다. Pro 업그레이드 후 되돌릴 ' +
      '목록은 PAYMENT_REHEARSAL.md 최상단. AGENTS.md 규칙7.',
  )
})

test('★ 규칙12: 구독은 클라이언트가 만들지 않는다 (금액을 서버가 정한다)', () => {
  // 주문 화면이 `subscriptions` 를 직접 insert 하던 시절, 금액·상태·배송횟수가
  // 전부 브라우저에서 온 값이었다. UPDATE 권한만 잠갔던 1차로는 부족했다 —
  // `{"total_amount": 100}` 으로 **만들면** 청구 크론이 그 저장값을 그대로
  // 긁는다(저장 금액으로 청구하는 것이 정본 규칙이므로).
  // 이제 POST /api/subscriptions/create 가 같은 순수함수로 직접 계산한다.
  // DB 권한도 회수했지만(20260730000500), 코드에서 시도하면 런타임에 조용히
  // 실패하므로 여기서도 막는다.
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app')).concat(
    walk(join(ROOT, 'components')),
  )) {
    const src = readFileSync(file, 'utf8')
    if (!src.startsWith("'use client'")) continue
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!/from\(\s*['"]subscriptions?(_items)?['"]/.test(lines[i] ?? '')) continue
      for (let j = i; j < Math.min(i + 6, lines.length); j++) {
        if (/\.insert\(/.test(lines[j] ?? '')) {
          offenders.push(`${rel(file)}:${j + 1}`)
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '구독·구독품목 생성은 서버 라우트에서만 한다 — 클라이언트가 만들면 금액을 ' +
      '정할 수 있다. AGENTS.md 규칙3 계열.\n' + offenders.join('\n'),
  )
})

test('★ 규칙11: 금액 합산은 boxPricing 밖에서 하지 않는다', () => {
  // 주문 화면이 `items.reduce((s, it) => s + it.cycleTotal, 0)` 로 직접 합하고
  // 저장·청구는 `priceBox(items)`(품절·구독불가 제외)를 써서 **화면 금액 >
  // 실제 청구액**이 됐다. 화면에서 본 금액이 그 뒤 모든 화면의 금액과 영구히
  // 달라지는 상태였다. 합산 규칙(라인 최종가 기준·올림 위치)의 정본은 하나다.
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'lib')))) {
    const r = rel(file)
    if (r.endsWith('lib/personalization/boxPricing.ts')) continue
    const src = readFileSync(file, 'utf8')
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      if (/(reduce|\+=)/.test(line) && /cycleTotal/.test(line)) {
        offenders.push(`${r}:${i + 1} :: ${line.trim()}`)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'cycleTotal 합산은 priceBox(boxPricing) 하나만 한다 — 화면과 청구가 갈라진다.\n' +
      offenders.join('\n'),
  )
})

test('★ 규칙8: lib/push.ts 는 service_role 클라이언트를 쓴다', () => {
  // 쿠키 클라이언트로 돌아가면 크론에서 auth.uid() 가 NULL 이 되고, 관련 4개
  // 테이블이 전부 self-only RLS 라서 **모든 조회가 0행** → 알림이 한 건도 나가지
  // 않으면서 크론은 성공으로 집계된다. 실제로 그 상태였다(2026-07-30).
  const src = readFileSync(join(ROOT, 'lib/push.ts'), 'utf8')
  assert.equal(
    src.includes('createAdminClient'),
    true,
    'lib/push.ts 는 createAdminClient() 를 써야 한다. AGENTS.md 규칙8.',
  )
  assert.equal(
    /from\s+'@\/lib\/supabase\/server'/.test(src),
    false,
    '쿠키 기반 createClient 를 쓰면 크론에서 0건 발송이 된다. AGENTS.md 규칙8.',
  )
})

test('★ 규칙9: 푸시를 보내는 크론은 조용시간(KST 22–08)에 두지 않는다', () => {
  // 푸시 클라이언트를 고쳐 알림이 실제로 나가게 되면, 조용시간에 예약된 크론은
  // 그 즉시 **정당하게 차단**된다("고객이 껐으니 안 보낸 것"). 두 문제는 반드시
  // 같이 고쳐야 한다 — 하나만 고치면 조용한 실패가 정당화되기만 한다.
  // 조용시간 기본값은 설정 화면 토글이 넣는 22→8 (PreferencesPanel).
  const cfg = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
    crons: Array<{ path: string; schedule: string }>
  }
  const offenders: string[] = []
  for (const c of cfg.crons) {
    const name = c.path.replace('/api/cron/', '')
    let src: string
    try {
      src = readFileSync(join(ROOT, 'app/api/cron', name, 'route.ts'), 'utf8')
    } catch {
      continue
    }
    if (!src.includes('pushToUser')) continue

    const utcHour = Number(c.schedule.trim().split(/\s+/)[1])
    if (Number.isNaN(utcHour)) continue
    const kstHour = (utcHour + 9) % 24
    // isWithinQuietHours(22, 8) 와 같은 판정: h >= 22 || h < 8
    if (kstHour >= 22 || kstHour < 8) {
      offenders.push(`${name}: UTC ${c.schedule} → KST ${kstHour}시`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '이 크론은 알림을 보내는데 KST 조용시간에 예약돼 있다 — 조용시간을 켠 고객에겐 ' +
      '영구히 안 나간다. AGENTS.md 규칙9.\n' + offenders.join('\n'),
  )
})

test('★ 규칙3: subscriptions 금액·빌링 칸을 클라이언트가 UPDATE 하지 않는다', () => {
  // DB 권한(화이트리스트, 20260730000000)이 실제 방어선이지만, 코드가 시도하면
  // 런타임에 조용히 실패한다. 코드에서도 막는다.
  const protectedCols = [
    'total_amount',
    'subtotal',
    'fresh_ratio',
    'billing_key',
    'total_deliveries',
  ]
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app')).concat(
    walk(join(ROOT, 'components')),
  )) {
    const src = readFileSync(file, 'utf8')
    if (!src.startsWith("'use client'")) continue
    if (!src.includes("from('subscriptions')")) continue
    for (const m of src.matchAll(/\.update\(\s*\{([\s\S]{0,600}?)\}\s*\)/g)) {
      const body = m[1] ?? ''
      for (const col of protectedCols) {
        if (new RegExp(`\\b${col}\\s*:`).test(body)) {
          offenders.push(`${rel(file)} :: update 에 ${col}`)
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '금액·빌링키 등은 service_role 전용이다(20260730000000 마이그레이션). ' +
      'AGENTS.md 규칙3.\n' + offenders.join('\n'),
  )
})
