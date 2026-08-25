import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import {
  availableBillingMethods,
  billingMethodFlags,
} from './payments/billing-methods.ts'

/**
 * 2026-07-30 최종감사로 못 박은 규칙 중 **기계가 잡을 수 있는 것**을 테스트로.
 *
 * 문서(AGENTS.md)에만 적으면 다음에 또 놓친다 — 실제로 같은 날 두 번 놓쳤다.
 * 테스트는 깨지므로 놓칠 수 없다. 규칙 전문과 각 규칙이 생긴 실패 사례는
 * AGENTS.md 의 "돈·데이터를 다루는 코드" 절에 있다.
 */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    // .claude = 격리 에이전트가 남긴 **낡은 워크트리 사본**이 들어 있다
    // (2026-08-19 규칙57 이 잡아냈다 — 옛 코드가 규칙을 오탐시킨다). 소스가
    // 아니므로 모든 규칙에서 제외한다.
    if (
      name === 'node_modules' ||
      name === '.next' ||
      name === '.git' ||
      name === '.claude'
    )
      continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p)
  }
  return out
}

const ROOT = process.cwd()

/**
 * 파일을 읽되 **CRLF 를 LF 로 정규화**한다.
 *
 * 왜 한 곳으로 모으나 (2026-07-31): 이 파일의 규칙 다수가 개행을 직접 다룬다 —
 * `split('\n')` 으로 줄번호를 세고, 규칙14 는 `/^ {6}(\w+): \{\n {8}Row/` 로
 * types.ts 를 파싱한다. Windows 에서 **새로 체크아웃하면** git 이 CRLF 로 쓰므로
 * 그 정규식이 하나도 안 맞는다 — 규칙14 는 테이블 0개를 읽고 자기 가드에 걸려
 * 터졌다(다른 워크트리에서 실제로 그렇게 죽어 있었다).
 *
 * 내 작업 트리는 어쩌다 LF 라서 초록이었다. 즉 **나한테만 도는 규칙**이었다.
 * 규칙마다 정규식을 CRLF 로 고치면 다음에 추가하는 규칙이 또 샌다 — 입구를 막는다.
 */
function read(path: string): string {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
}

/**
 * 이 파일이 클라이언트 컴포넌트인가.
 *
 * # 왜 함수로 뺐나 (2026-08-08 테스트 감사)
 * 예전엔 `src.startsWith("'use client'")` 였다. 그런데:
 *  · 파일 맨 위에 **주석 헤더**가 있으면 지시어가 첫 바이트가 아니다
 *  · `"use client"`(쌍따옴표)도 유효한데 못 잡는다
 * 그 두 경우에 규칙이 **파일을 통째로 스킵**한다 — 실측으로 클라이언트 파일
 * 181개 중 12개가 이미 검사 대상 밖이었다. 규칙이 초록인 이유가 "위반이
 * 없어서"가 아니라 "안 봐서" 인 상태다.
 */
function isUseClient(src: string): boolean {
  // 앞쪽 주석·공백을 걷어낸 뒤 첫 지시어를 본다.
  const head = src.replace(/^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, '')
  return /^['"]use client['"]/.test(head)
}

/**
 * 주석을 걷어낸다 — **규칙이 주석에 속지 않게.**
 *
 * 2026-07-31: 규칙20 카나리아가 통과해 버렸다. 버그를 되돌려 놨는데도 초록이었고,
 * 이유는 내가 그 위에 써 둔 설명 주석에 `data.session` 이 들어 있어서 규칙이
 * 그걸 "처리했다"는 증거로 셌기 때문이다. 즉 **설명을 잘 써 둘수록 규칙이
 * 무력해지는** 구조였다(규칙17 에서도 체인 중간 주석 때문에 한 번 겪었다).
 * 소스를 문자열로 훑는 규칙은 이걸 먼저 통과시킨다.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
}

/**
 * 줄수 보존형 주석 제거 — 위반 **줄번호**를 보고하는 규칙용.
 * 규칙14가 주석 속 코드 예시(`.gt(...)` 설명)를 실제 필터로 오인해
 * 빨간불을 냈다(2026-08-08) — "설명을 달면 규칙에 걸린다"는 규칙17이 이미
 * 고친 함정과 같은 뿌리다. 블록 주석은 내용만 공백화해 줄을 지킨다.
 */
function stripCommentsKeepLines(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
}

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
    const src = read(file)
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
  const src = read(
    join(ROOT, 'lib/payments/charge-amount-guard.ts'))
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
    const src = read(join(ROOT, t))
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

test('★ 규칙7: vercel.json 크론은 하루 1회 이하 (의도적 예외만 허용)', () => {
  // Hobby 플랜에선 하루 1회를 넘기면 Vercel 이 요금 한도로 **빌드 시작을 거부**한다
  // (2026-07-30 실측 — 커밋 3개 조용히 미반영). Pro 에선 잦은 크론이 허용되지만,
  // 런어웨이 크론(비용·과발송)을 막으려고 규칙은 남기고 **의도적 예외만** 아래에
  // 이유와 함께 둔다. 목록에 없는데 하루 1회를 넘으면 실수로 본다.
  //
  // ✅ 2026-08-11 Vercel Pro 업그레이드. 아래 둘은 원래 sub-daily 설계였고 Hobby
  //    때문에 daily 로 강등했던 것을 원복한 것이다.
  const FREQUENT_ALLOWED: Record<string, string> = {
    '/api/cron/push-lifecycle':
      'hourly(0 * * * *) — 복약 알림이 사용자 지정 시각에 발화해야 함. 마케팅 3종은 ' +
      'CRON_IS_HOURLY 게이트로 설정 시각 1회만(24× 과발송 방지).',
    '/api/cron/refund-retry':
      'hourly(30 * * * *) — 환불 실패 backoff(5분→15분→1시간→6시간). 매시간이면 ' +
      '5분·15분 단계는 ~1시간 내, 이후는 표대로(실효 반나절). 하루 1회면 4~5일. ' +
      '분단위 인터벌 크론은 cron-watchdog 이 파싱 못 해 매시간이 상한.',
  }
  const cfg = JSON.parse(read(join(ROOT, 'vercel.json'))) as {
    crons: Array<{ path: string; schedule: string }>
  }
  const tooOften = cfg.crons.filter((c) => {
    if (c.path in FREQUENT_ALLOWED) return false
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
    '하루 1회를 넘는 크론이 있다. 의도적 예외는 FREQUENT_ALLOWED 에 이유와 함께 ' +
      '추가(Pro 필요). AGENTS.md 규칙7.',
  )
})

test('★ 규칙14: .select() 가 없는 컬럼을 부르지 않는다', () => {
  /**
   * 2026-07-31 — 이것 때문에 **두 기능이 통째로 죽어 있었다.**
   *  · 주문 CSV 내보내기: `shipping_memo` · `tracking_carrier` (실제는
   *    delivery_memo · carrier) → 쿼리 실패 → CSV 가 한 번도 안 만들어짐
   *  · 고객 영수증 페이지: `shipping_address/_detail/_zip/_memo` (실제는
   *    address / address_detail / zip / delivery_memo) → 쿼리 실패 →
   *    order 가 null → notFound() → **모든 영수증이 404**
   *
   * 없는 컬럼은 tsc 가 못 잡는다(select 문자열이라). 실패도 조용하다 — 둘 다
   * error 를 안 받아서 "데이터 없음"처럼 보였다.
   * 생성된 타입(lib/supabase/types.ts)을 스키마 정본으로 삼아 대조한다.
   */
  const typesSrc = read(join(ROOT, 'lib/supabase/types.ts'))

  // types.ts 에서 테이블별 Row 키를 뽑는다.
  const tableCols = new Map<string, Set<string>>()
  const tableRe = /^ {6}(\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/gm
  for (const m of typesSrc.matchAll(tableRe)) {
    const cols = new Set(
      [...(m[2] ?? '').matchAll(/^ {10}(\w+)\??:/gm)].map((x) => x[1]!),
    )
    if (cols.size > 0) tableCols.set(m[1]!, cols)
  }
  assert.ok(
    tableCols.size > 20,
    `types.ts 파싱 실패 — 테이블 ${tableCols.size}개만 읽혔다(정규식 확인)`,
  )

  /**
   * PostgREST **계산 컬럼** — 테이블을 인자로 받는 함수라 types.ts(테이블
   * 스키마 생성물)에는 없지만 select 에 쓸 수 있다.
   *
   * 마이그레이션에서 자동으로 뽑는다. 손으로 목록을 적으면 다음 계산 컬럼이
   * 생겼을 때 이 규칙이 **정상 코드를 빨간불로 만들고**, 그러면 사람이 규칙을
   * 무시하기 시작한다.
   */
  // ★walk() 는 .ts/.tsx 만 돌려준다 — 마이그레이션은 직접 읽는다.
  //  (처음에 walk 로 썼더니 파일을 0개 보고도 조용히 지나갔다.)
  const migDir = join(ROOT, 'supabase/migrations')
  for (const name of readdirSync(migDir)) {
    if (!name.endsWith('.sql')) continue
    const sql = read(join(migDir, name))
    for (const m of sql.matchAll(
      /create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\(\s*public\.(\w+)\s*\)/gi,
    )) {
      const fnName = m[1]
      const tableName = m[2]
      if (fnName && tableName) tableCols.get(tableName)?.add(fnName)
    }
  }

  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app'))
    .concat(walk(join(ROOT, 'lib')))
    .concat(walk(join(ROOT, 'components')))) {
    const src = stripCommentsKeepLines(read(file))
    const re = /\.from\(\s*['"](\w+)['"]\s*\)\s*\n?\s*\.select\(\s*([`'"])([\s\S]*?)\2/g
    for (const m of src.matchAll(re)) {
      const table = m[1]!
      const known = tableCols.get(table)
      if (!known) continue // 뷰·RPC·미지 테이블은 건너뛴다
      // 중첩 관계 `rel(a, b)` 는 통째로 제거하고 최상위 컬럼만 본다.
      const body = (m[3] ?? '').replace(/\w+\s*\([^)]*\)/g, ' ')
      for (const raw of body.split(',')) {
        const col = raw.trim()
        // 별칭(alias:col)·`*`·빈 칸·템플릿 조각은 검사 대상 밖.
        if (!/^[a-z_][a-z0-9_]*$/.test(col)) continue
        if (!known.has(col)) {
          const line = src.slice(0, m.index ?? 0).split('\n').length
          offenders.push(`${rel(file)}:${line} :: ${table}.${col} 없음`)
        }
      }
    }
  }
  /**
   * ★ 필터(.eq/.is/.in ...)도 같이 본다 — select 만 봐서는 못 잡는다.
   * 2026-07-31 실제 피해:
   *  · 건강 알림 크론 3개가 `dogs.deleted_at` 으로 필터 — 그 컬럼은 **없다**.
   *    쿼리가 실패했고 error 를 안 받아 **매번 0마리 처리 후 '성공'** 집계.
   *    체중 리마인더·급변 경보·DCM 안내가 한 번도 나가지 않았다.
   *  · 개인정보 다운로드가 `order_items.user_id` 로 필터 — 없는 컬럼이라
   *    **항상 빈 배열**. 주문 품목·구독 구성이 통째로 빠진 채 내보내졌다
   *    (개인정보보호법 §35 열람권). 심지어 바로 위 주석이 "user_id 컬럼 없음"
   *    이라고 스스로 밝히고 있었는데 코드는 그대로였다.
   */
  for (const file of walk(join(ROOT, 'app'))
    .concat(walk(join(ROOT, 'lib')))
    .concat(walk(join(ROOT, 'components')))) {
    const src = stripCommentsKeepLines(read(file))
    for (const m of src.matchAll(/\.from\(\s*['"](\w+)['"]\s*\)([\s\S]{0,900})/g)) {
      const known = tableCols.get(m[1]!)
      if (!known) continue
      let chunk = m[2] ?? ''
      const nxt = chunk.indexOf(".from('")
      if (nxt > 0) chunk = chunk.slice(0, nxt)
      const filterRe =
        /\.(eq|neq|is|in|gt|gte|lt|lte|like|ilike|contains|order|not)\(\s*'(\w+)'/g
      for (const fm of chunk.matchAll(filterRe)) {
        const col = fm[2]!
        // 관계 필터(`orders.user_id`)는 점이 들어가 이 정규식에 안 걸린다.
        if (known.has(col)) continue
        const line = src.slice(0, m.index ?? 0).split('\n').length
        offenders.push(`${rel(file)}:${line} :: ${m[1]}.${col} 없음 (${fm[1]})`)
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'select·필터에 없는 컬럼이 있다 — 쿼리가 통째로 실패하고, error 를 안 받으면 ' +
      '"데이터 없음"처럼 보인다(영수증 404 · 건강 알림 0건 발송이 그 이유였다).\n' +
      offenders.join('\n'),
  )
})

test('★ 규칙16: 메일 링크는 앱 전용 경로를 가리키지 않는다', () => {
  /**
   * 메일은 대부분 **브라우저**에서 열린다(딥링크 미설정). 앱 전용 경로를 링크하면
   * `ft_app` 쿠키가 없어 `/app-required` 로 307 리다이렉트된다 — 고객은
   * "구독 관리하기" 를 눌렀는데 **앱 설치 안내**를 본다.
   *
   * 2026-07-31 실제로 그랬다: `subscription.ts` 의 CTA 2곳이
   * `/mypage/subscriptions`(앱 전용) 였다. 결제 실패 메일에서는 카드를 다시
   * 등록하러 온 사람이 등록 화면에 닿지 못했다.
   * (`personalization-cycle.ts` 는 이미 `/account/subscriptions` 를 쓰고 있었다 —
   *  그 파일이 관례였고 subscription.ts 가 예외였다.)
   *
   * ⚠️ 푸시(app/api/cron/**)는 **반대**다 — 앱 안에서 열리므로 /mypage/* 가 맞다.
   * 그래서 검사 범위를 `lib/email/**` 로 한정한다.
   *
   * 앱 전용 목록은 **proxy.ts 를 실제로 읽어** 대조한다. 손으로 적으면 목록이
   * 바뀔 때 조용히 낡는다(오늘 /mypage/delete 를 그 목록에서 뺐다).
   */
  const proxy = read(join(ROOT, 'proxy.ts'))
  const block = /APP_ONLY_PREFIXES[^=]*=\s*\[([\s\S]*?)\n\]/.exec(proxy)
  assert.ok(block?.[1], 'proxy.ts 에서 APP_ONLY_PREFIXES 를 못 찾았다')
  const appOnly = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]!)
  assert.ok(appOnly.length > 0, '앱 전용 prefix 목록이 비어 있다')

  // 웹도 들어갈 수 있는 예외(정확 매치 + 하위 경로).
  const webAllowed = [
    ...(/MYPAGE_WEB_ALLOWED[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(proxy)?.[1] ?? '')
      .matchAll(/'([^']+)'/g),
  ].map((m) => m[1]!)

  /**
   * 의도된 예외 — 앱 설치 안내가 **목적지로서 맞는** 경우.
   *
   * `/dogs/*`(기록·분석·복약 등 풀 케어)는 R84-2 에서 의도적으로 app-only 로
   * 되돌렸다: 모바일-first v3 화면이라 데스크톱 웹에서 어색하고, 웹 사용자는
   * PWA 안내로 보낸다는 제품 결정이다(proxy.ts 주석). 웹 대응물인
   * `/account/dogs` 는 **읽기전용 간략 목록**이라 "전체 분석 리포트" CTA 의
   * 목적지가 될 수 없다 — 거기로 보내면 오히려 더 큰 거짓말이 된다.
   * 그래서 이 경우 /app-required 가 정직한 목적지다.
   *
   * 반대로 `/mypage/subscriptions`·`/mypage/notifications` 는 **웹에서 닿을 수
   * 있는 실물 화면이 있는데도** 앱 전용 경로를 쓴 것이라 버그였다.
   */
  const INTENDED_APP_ONLY = ['/dogs']

  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'lib/email'))) {
    const src = read(file)
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      // 주석 안의 설명은 대상 아님 — 실제 링크만.
      if (/^\s*(\*|\/\/)/.test(line)) continue
      for (const m of line.matchAll(/(?:SITE_URL[)}\s]*)(\/[A-Za-z0-9_\-/[\]${}.]*)/g)) {
        const path = (m[1] ?? '').replace(/\$\{[^}]*\}/g, 'X')
        if (webAllowed.some((w) => path === w || path.startsWith(`${w}/`))) continue
        if (
          INTENDED_APP_ONLY.some((p) => path === p || path.startsWith(`${p}/`))
        ) {
          continue
        }
        const hit = appOnly.find((p) => path === p || path.startsWith(`${p}/`))
        if (hit) offenders.push(`${rel(file)}:${i + 1} :: ${path} (앱 전용 ${hit})`)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '메일 링크가 앱 전용 경로를 가리킨다 — 브라우저로 열면 앱 설치 안내로 튕긴다. ' +
      '웹 경로(/account/*)를 쓸 것. 푸시는 반대이니 이 규칙 밖이다.\n' +
      offenders.join('\n'),
  )
})

test('★ 규칙15: 잠긴 표(orders)를 쿠키 클라이언트로 쓰지 않는다', () => {
  /**
   * 2026-07-31 — `orders` 의 컬럼 UPDATE 권한을 회수했다(20260731000000).
   * 그 순간, 쿠키 클라이언트로 orders 를 쓰던 코드는 **전부 조용히 죽는다**:
   *  · `/api/payments/confirm` — 결제 승인 저장
   *  · `/api/orders/[id]/cancel` — 취소·환불 후 주문 상태
   *  · `/api/admin/orders/[id]/status` — 관리자 배송 상태 변경
   * 같은 날 카드 등록이 정확히 그렇게 죽어 있었다(규칙13). 잠금과 호출부는
   * 반드시 같이 본다 — 그래서 표 단위로도 한 번 더 건다.
   *
   * ★ 판정은 **수신자 변수**로 한다. 처음엔 "파일에 createAdminClient 가 있으면
   * 통과"로 썼는데, 검산해 보니 **오늘 찾은 버그를 하나도 못 잡았다** —
   * confirm·cancel 둘 다 다른 용도로 admin 을 이미 import 하고 있었고, 문제는
   * orders 를 쓰는 그 한 줄이 `supabase`(쿠키)였다는 것이다.
   * 그래서 `X.from('orders').update(` 의 X 가 createAdminClient 에서 왔는지를 본다.
   */
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app'))
    .concat(walk(join(ROOT, 'lib')))
    .concat(walk(join(ROOT, 'components')))) {
    const src = read(file)
    // ★게이트도 따옴표 중립이어야 한다 (2026-08-08). 아래 정규식은 쌍따옴표를
    //  허용하도록 넓혔는데 이 조기 return 이 작은따옴표만 봐서, 넓힌 게
    //  무효였다 — 카나리아로 확인했다(쌍따옴표 위반이 초록으로 통과).
    if (!/\.from\(\s*['"]orders['"]/.test(src)) continue
    const re = /(\w+)\s*\n?\s*\)?\s*\.from\(\s*['"]orders['"]\s*\)\s*\.(update|delete|upsert)\(/g
    for (const m of src.matchAll(re)) {
      const recv = m[1]!
      const line = src.slice(0, m.index ?? 0).split('\n').length
      const lineText = src.split('\n')[line - 1] ?? ''
      // 주석·docstring 안의 예시는 제외.
      if (/^\s*(\*|\/\/)/.test(lineText)) continue
      /**
       * 수신자가 admin 에서 왔나. **한 단계 캐스팅까지 따라간다** —
       * 이 저장소는 스키마 드리프트 때문에
       * `const untyped = supabase as unknown as {...}` 패턴을 자주 쓴다.
       * 그걸 못 따라가면 admin 인데도 오탐으로 잡힌다(실제로 그랬다).
       */
      const resolve = (name: string, depth = 0): boolean => {
        if (name === 'admin') return true
        if (depth > 2) return false
        if (
          new RegExp(
            `(const|let)\\s+${name}\\s*=[\\s\\S]{0,120}?createAdminClient`,
          ).test(src)
        ) {
          return true
        }
        // `const X = Y as unknown as ...` / `const X = Y as any` → Y 를 따라간다.
        // (2026-08-05: `as any` 형태를 못 따라가 refund-retry 의 adminTyped 가
        //  오탐으로 잡혔다 — 실제로는 createAdminClient() 별칭이다.)
        const alias = new RegExp(
          `(?:const|let)\\s+${name}\\s*=\\s*\\(?\\s*(\\w+)\\s+as\\s+(?:unknown|any)`,
        ).exec(src)
        return alias?.[1] ? resolve(alias[1], depth + 1) : false
      }
      if (!resolve(recv)) {
        offenders.push(`${rel(file)}:${line} :: ${recv}.from('orders').${m[2]}`)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'orders 는 컬럼 UPDATE 권한이 회수돼 있다 — service_role 로만 쓸 수 있다. ' +
      '쿠키 클라이언트로 쓰면 권한 오류로 조용히 실패한다.\n' + offenders.join('\n'),
  )
})

test('★ 규칙13: 화이트리스트 밖 칸을 쓰는 UPDATE 는 service_role 로 한다', () => {
  /**
   * 2026-07-31 — 이 규칙이 없어서 **프로덕션 카드 등록이 조용히 죽어 있었다.**
   *
   * 20260730000000 이 `subscriptions` UPDATE 를 4칸으로 잠갔는데
   * (status · next_delivery_date · reminder_enabled · last_failed_charge_reason)
   * `/api/payments/billing-issue` 가 **로그인 클라이언트**로 billing_key 등 9칸을
   * 쓰고 있었다. 권한 오류로 통째로 실패했고, error 를 안 받아 `ok:true` 를
   * 돌려줬다 → 고객은 "카드 등록 완료"를 보는데 billing_key 가 없어 영원히
   * 청구되지 않는다(토스엔 빌링키가 있고 우리만 모르는 상태).
   * 같은 사고가 `/api/personalization/approve` 의 total_amount 갱신에도 있었다.
   *
   * 권한을 잠그면 **그 칸을 쓰던 코드가 조용히 죽는다.** 잠금과 호출부는 반드시
   * 같이 본다 — 그게 이 테스트다.
   */
  const ALLOWED = new Set([
    'status',
    'next_delivery_date',
    'reminder_enabled',
    'last_failed_charge_reason',
  ])
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app'))
    .concat(walk(join(ROOT, 'components')))
    .concat(walk(join(ROOT, 'lib')))) {
    const src = read(file)
    if (!src.includes("from('subscriptions')")) continue
    // 파일이 admin 클라이언트를 아예 안 만들면, 그 파일의 모든 쓰기는
    // 로그인 클라이언트다 — 화이트리스트 밖 칸을 쓰면 실패한다.
    if (src.includes('createAdminClient')) continue
    const re = /from\(\s*'subscriptions'\s*\)\s*\.update\(\s*\{([\s\S]*?)\}\s*\)/g
    for (const m of src.matchAll(re)) {
      const cols = [...(m[1] ?? '').matchAll(/(\w+)\s*:/g)].map((x) => x[1]!)
      const outside = cols.filter((c) => !ALLOWED.has(c))
      if (outside.length > 0) {
        const line = src.slice(0, m.index ?? 0).split('\n').length
        offenders.push(`${rel(file)}:${line} :: ${outside.join(', ')}`)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'subscriptions 의 잠긴 칸은 service_role 로만 쓸 수 있다 — 로그인 클라이언트로 ' +
      '쓰면 권한 오류로 **조용히 실패**한다(카드 등록이 실제로 그렇게 죽었다).\n' +
      offenders.join('\n'),
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
    const src = read(file)
    // ★파일 첫 바이트 비교는 취약하다 (2026-08-08 테스트 감사).
    //  주석 헤더가 앞에 오거나 쌍따옴표를 쓰면 규칙이 통째로 스킵된다 —
    //  실측으로 클라이언트 파일 181개 중 12개가 이미 검사 대상 밖이었다.
    if (!isUseClient(src)) continue
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
    const src = read(file)
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
  const src = read(join(ROOT, 'lib/push.ts'))
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
  const cfg = JSON.parse(read(join(ROOT, 'vercel.json'))) as {
    crons: Array<{ path: string; schedule: string }>
  }
  const offenders: string[] = []
  for (const c of cfg.crons) {
    const name = c.path.replace('/api/cron/', '')
    let src: string
    try {
      src = read(join(ROOT, 'app/api/cron', name, 'route.ts'))
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
    const src = read(file)
    // ★파일 첫 바이트 비교는 취약하다 (2026-08-08 테스트 감사).
    //  주석 헤더가 앞에 오거나 쌍따옴표를 쓰면 규칙이 통째로 스킵된다 —
    //  실측으로 클라이언트 파일 181개 중 12개가 이미 검사 대상 밖이었다.
    if (!isUseClient(src)) continue
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

test('★ 규칙17: 서버가 orders 를 셀 때 결제 상태로 거른다', () => {
  /**
   * # 왜
   * `orders` row 는 **결제 전에** 만들어진다. 청구 크론이 토스를 긁기 전에
   * `order_status:'pending' / payment_status:'pending'` 으로 먼저 insert 하고
   * (subscription-charge), 결제가 실패하면 그 행을 **지우지 않고** cancelled/failed
   * 로 표시만 한다. 고객 셀프 취소·order-expire 도 행을 남긴다.
   *
   * 그래서 필터 없이 세면 "주문 건수"가 아니라 "시도 건수"가 된다. 재제안 크론이
   * 정확히 그 상태였다: **카드가 세 번 거절당한 강아지도 "박스 3개 먹었다"** 가
   * 되어 새 처방을 제안했고, 그 제안이 금액을 바꾸면 동의 모달까지 떴다 —
   * 한 박스도 못 받은 사람에게.
   *
   * 저장소의 다른 집계는 전부 이미 걸렀다(lib/feeding-outcomes ·
   * api/analysis/structured · cron/daily-briefing). **한 곳만 빠져 있었다** —
   * 이 규칙은 새 관례를 만드는 게 아니라 이미 있는 관례가 새지 않게 하는 것이다.
   *
   * # 범위
   * 서버 업무 로직(app/api/** · lib/**)만. 화면의 "내 주문 N건" 같은 표시용
   * 카운트는 시도까지 보여주는 게 맞을 수 있어 제외한다 — 그건 돈·처방 판단을
   * 바꾸지 않는다.
   */
  /**
   * 배송 상태로만 거르는 게 **맞는** 집계. 그 상태값들(preparing·shipping·
   * delivered)은 결제가 끝난 뒤에만 붙으므로 payment_status 를 다시 볼 필요가 없다.
   * 위치가 바뀌면 규칙이 다시 잡는다 — 그때 여기도 같이 본다(그게 목적이다).
   */
  const ORDER_COUNT_SHIPPING_OK: Array<{ at: string; why: string }> = [
    {
      at: 'app/api/cron/daily-briefing/route.ts:92',
      why: "'발송했는데 7일째 배송중' 집계 — order_status='shipping' 자체가 결제 완료 이후 상태다 (2026-08-08 미발송 큐에 주석 3줄 추가로 이동, 재확인함)",
    },
  ]

  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app/api')).concat(walk(join(ROOT, 'lib')))) {
    const src = read(file)
    if (!src.includes("from('orders')")) continue
    // .from('orders').select(..., { count: 'exact' }) 뒤에 이어지는 필터 체인을 본다.
    const re = /\.from\(['"]orders['"]\)\s*\n?\s*\.select\([^\n]*count:\s*['"]exact['"]/g
    for (const m of src.matchAll(re)) {
      const start = (m.index ?? 0) + m[0].length
      // 체인이 끝날 때까지(= 다음 줄이 .필터 가 아닐 때까지) 모은다.
      const rest = src.slice(start).split('\n')
      const chain: string[] = []
      for (const ln of rest.slice(1)) {
        // 체인 중간의 주석·빈 줄은 건너뛴다. 이걸 빼먹었더니 스캐너가 **방금 고친
        // 재제안 크론을** 위반으로 잡았다 — 필터 바로 위에 왜 거르는지 적어 뒀기
        // 때문이다. "설명을 달면 규칙에 걸린다" 는 최악의 유인이다.
        if (/^\s*$/.test(ln) || /^\s*(\/\/|\/\*|\*)/.test(ln)) continue
        if (!/^\s*\.(eq|in|not|neq|gte|lte|gt|lt|is|or|filter|match)\(/.test(ln)) break
        chain.push(ln)
      }
      const text = chain.join('\n')
      /**
       * `payment_status` 를 **필수**로 본다. 처음엔 `order_status` 도 인정했는데,
       * 카나리아에서 payment_status 필터만 빼도 규칙이 통과했다 — `order_status`
       * 에는 `'pending'`(= 결제 전) 이 있어서 그것만으론 돈이 오갔는지 알 수 없다.
       * 규칙이 잡으려던 바로 그 상태를 규칙이 통과시키고 있었다.
       *
       * 배송 상태로만 거르는 정당한 집계(예: '발송했는데 7일째 배송중')는
       * ORDER_COUNT_SHIPPING_OK 에 이유와 함께 적는다 — 그 상태값들은 결제가
       * 끝난 뒤에만 붙으므로 payment_status 를 다시 볼 필요가 없다.
       */
      const line = src.slice(0, m.index ?? 0).split('\n').length
      const here = `${rel(file)}:${line}`
      if (ORDER_COUNT_SHIPPING_OK.some((x) => x.at === here)) continue
      if (!/payment_status/.test(text)) offenders.push(here)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'orders 를 세는데 payment_status·order_status 필터가 없다 — orders row 는 ' +
      '결제 전에 만들어지고 실패해도 남는다. 필터가 없으면 "시도 건수"를 세게 ' +
      '되어, 카드가 거절당한 고객이 "박스를 받은 고객"으로 집계된다.\n' +
      offenders.join('\n'),
  )
})

test('★ 규칙18: head:true 로 조회하고 data 를 읽지 않는다', () => {
  /**
   * # 왜
   * PostgREST 의 `head: true` 는 **본문을 보내지 않는다** — 개수는 `count` 로
   * 오고 `data` 는 항상 `null` 이다. 그런데 `data` 를 받아 길이를 재던 코드가
   * 있었다(push-lifecycle D+7).
   *
   * 거기에 `(x?.length ?? 0 > 0)` 이 겹쳤다. `??` 는 `>` 보다 **뒤에** 묶이므로
   * 이건 `x?.length ?? (0 > 0)` = `undefined ?? false` = **항상 false** 다.
   * 두 실수가 서로를 가려서, "이미 분석한 사람은 건너뛴다" 가 **한 번도 작동한
   * 적이 없었다** — 이미 무료 분석을 본 사람에게 "아직 분석을 못 보셨네요"
   * 광고 푸시가 나갔고, `skipped` 는 늘 0이라 지표로도 안 보였다.
   *
   * 행이 있었다면 `length` 가 1 이라 우연히 맞았을 것이다 — 그래서 조용히
   * 오래 살아남았다. 이런 건 눈으로 못 잡는다.
   */
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'lib')))) {
    const src = read(file)
    if (!src.includes('head: true')) continue
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!/head:\s*true/.test(lines[i] ?? '')) continue
      // 이 select 를 받는 구조분해는 보통 2~3줄 **위**에 있다.
      const head = lines.slice(Math.max(0, i - 4), i + 1).join('\n')
      const m = /const\s*\{([^}]*)\}\s*=\s*await/.exec(head)
      if (!m) continue
      const bound = m[1] ?? ''
      // `data` 를 받으면 위반. `count`·`error` 만 받는 것이 옳다.
      if (/\bdata\b/.test(bound)) {
        offenders.push(`${rel(file)}:${i + 1}`)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "head: true 는 본문을 안 준다 — data 는 항상 null 이다. 개수는 count 로 받을 것.\n" +
      offenders.join('\n'),
  )
})

test('★ 규칙19: `?? 0 > 0` 처럼 ?? 와 비교를 괄호 없이 섞지 않는다', () => {
  /**
   * `a ?? 0 > 0` 은 `a ?? (0 > 0)` 로 묶인다 — 읽는 사람이 기대하는
   * `(a ?? 0) > 0` 이 아니다. 실제로 D+7 광고 푸시의 건너뛰기 판정이 이것 때문에
   * 항상 false 였다. TypeScript 는 이걸 오류로 보지 않는다(양쪽 다 유효한 식이라
   * 타입도 맞는다). 그래서 테스트로 잡는다.
   */
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'lib')))) {
    const src = read(file)
    if (!src.includes('??')) continue
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      if (/^\s*(\*|\/\/)/.test(line)) continue
      // `?? <피연산자> <비교연산자>` — 괄호로 묶였으면 `) >` 형태라 안 걸린다.
      if (/\?\?\s*[\w.'"[\]]+\s*(===|!==|==|!=|>=|<=|>|<)/.test(line)) {
        offenders.push(`${rel(file)}:${i + 1} :: ${line.trim().slice(0, 90)}`)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '`??` 는 비교연산자보다 **뒤에** 묶인다 — `(a ?? 0) > 0` 로 괄호를 칠 것.\n' +
      offenders.join('\n'),
  )
})

test('★ 규칙20: auth.signUp 을 부르는 화면은 "세션 즉시 발급"을 처리한다', () => {
  /**
   * # 왜
   * Supabase 의 이메일 확인 설정에 따라 `signUp` 의 결과가 갈린다:
   *   · 확인 ON  → `data.session === null`  ("메일 보냈어요" 안내로 끝)
   *   · 확인 OFF → **세션을 바로 준다**      (이미 로그인된 상태)
   *
   * 웹 설문 가입(StartSurvey)이 뒤쪽을 안 다뤄서, 세션이 나오면 안내도 이동도
   * 없이 **폼 화면이 그대로 멈췄다.** 사용자는 반응이 없다고 느끼고 떠나고,
   * 설문 초안은 계정으로 안 옮겨간다 — 가입은 됐는데 결과가 사라진다.
   * 앱 경로(/start/join)엔 그 분기가 이미 있었다. 웹만 빠져 있었다.
   *
   * 이 설정은 **Supabase 대시보드에서 언제든 바뀔 수 있다** — 코드 변경 없이
   * 화면이 죽는다는 뜻이다. 그래서 두 경로 모두 두 갈래를 다 다뤄야 한다.
   */
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'components')))) {
    const src = read(file)
    if (!src.includes('auth.signUp(')) continue
    const code = stripComments(src)
    const at = code.indexOf('auth.signUp(')
    if (at < 0) continue
    const after = code.slice(at)
    /**
     * ★ **부정형만 있는 것**을 잡아야 한다 (카나리아로 두 번째에 알아냈다).
     *
     * 처음엔 `data.session` 이 등장하는지만 봤는데, 버그 코드가
     * `if (data.user && !data.session) setEmailSent(true)` 라서 그 문자열이
     * 들어 있었다 — **규칙이 잡으려던 바로 그 코드를 통과시켰다.**
     * `!data.session` 은 "세션이 없을 때"만 다룬 것이다. 세션이 **있을 때**를
     * 다뤘다는 증거는 부정 기호가 붙지 않은 `data.session` 이다.
     */
    const positive = /(^|[^!\w.])data\.session\b/m.test(after)
    if (!positive) {
      const line = src.slice(0, at).split('\n').length
      offenders.push(`${rel(file)}:${line}`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'signUp 후 data.session 이 있는 경우(이메일 확인 OFF)를 다루지 않으면 ' +
      '화면이 멈춘다 — 로그인은 됐는데 아무 일도 안 일어난다.\n' +
      offenders.join('\n'),
  )
})

test('★ 규칙21: 웹 전용 화면의 링크가 앱 전용 경로를 가리키지 않는다', () => {
  /**
   * # 왜
   * `/account/*` 는 **웹 사용자를 위해 따로 만든 화면**이다(app-only 게이트를
   * 우회하려고 존재한다). 그런데 그 안의 CTA 가 `/dogs/new`·`/dogs` 처럼 앱 전용
   * 경로를 가리키고 있었다 — 웹에서 "우리 아이 등록하기" 를 누르면 등록 폼이
   * 아니라 앱 설치 안내로 튕긴다. **버튼이 거짓말을 한다.**
   *
   * 목적지 자체는 틀리지 않았다(강아지 케어는 앱 전용이라는 제품 결정 R84-2).
   * 틀린 건 웹에서도 앱과 같은 문구·같은 링크를 쓴 것이다. 그래서 고친 방식은
   * `isApp ? 앱경로 : '/app-required?from=…'` 분기 + 문구 분기다.
   *
   * 이 규칙은 **분기 없이 그냥 앱 경로를 가리키는 것**만 잡는다 —
   * `isApp ?` 삼항 안에 있으면 통과시킨다.
   *
   * (메일은 규칙16 이 따로 본다. 푸시는 앱에서 열리므로 대상 아님.)
   */
  const proxy = read(join(ROOT, 'proxy.ts'))
  const block = /APP_ONLY_PREFIXES[^=]*=\s*\[([\s\S]*?)\n\]/.exec(proxy)
  assert.ok(block?.[1], 'proxy.ts 에서 APP_ONLY_PREFIXES 를 못 찾았다')
  const appOnly = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]!)

  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app/account'))) {
    const src = read(file)
    const lines = stripComments(src).split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      const m = /href=(?:"([^"]+)"|\{'([^']+)'\})/.exec(line)
      const path = m?.[1] ?? m?.[2]
      if (!path || !path.startsWith('/')) continue
      // isApp 분기 안이면 의도된 것 — 같은 줄이나 바로 위/아래에 삼항이 있다.
      const around = lines.slice(Math.max(0, i - 2), i + 3).join('\n')
      if (/isApp\s*\?/.test(around)) continue
      const hit = appOnly.find((p) => path === p || path.startsWith(`${p}/`))
      if (hit) offenders.push(`${rel(file)}:${i + 1} :: ${path} (앱 전용 ${hit})`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '/account/* 는 웹 사용자용 화면인데 링크가 앱 전용 경로를 가리킨다 — 누르면 ' +
      '앱 설치 안내로 튕긴다. `isApp ? 앱경로 : "/app-required?from=…"` 로 갈라라.\n' +
      offenders.join('\n'),
  )
})

test('★ 규칙22: 구독 신청 데이터는 cycle 1 을 고정하고 상담 게이트를 통과한다', () => {
  /**
   * # 왜
   * 이 로더(`lib/subscription/orderPageData.ts`)에는 **과거에 실제로 사고가 났던
   * 규칙 두 개**가 들어 있다. 앱·웹이 같이 쓰므로 여기가 무너지면 양쪽이 같이
   * 무너진다:
   *
   *  ① `.eq('cycle_number', 1)` — 최신 cycle 을 읽으면 진행 크론이 만들어 둔
   *     옛 cycle 2 를 집는다. 사장님 제보: "분명히 닭으로 추천받고 넘어갔는데
   *     최종 배송 정보에서는 오리랑 소를 받아." 분석·플랜은 compute 라우트가
   *     항상 cycle 1 을 read-or-create 하므로 "지금의 추천" = cycle 1 이다.
   *
   *  ② `needsConsultation` 게이트 — 판매 레시피가 전부 알레르기라 자동 추천이
   *     불가한 강아지가 **결제까지 갔다**(2026-07-24). 이 게이트가 빠지면
   *     알레르기 성분이 든 박스를 결제시키게 된다.
   *
   * 둘 다 "없어도 화면은 잘 뜬다" — 그래서 조용히 사라진다.
   */
  const src = stripComments(read(join(ROOT, 'lib/subscription/orderPageData.ts')))
  assert.match(
    src,
    /\.eq\(\s*'cycle_number'\s*,\s*1\s*\)/,
    '구독 신청은 cycle 1 고정이다 — 최신 cycle 을 읽으면 화면과 다른 레시피를 청구한다',
  )
  assert.match(
    src,
    /needsConsultation/,
    '알레르기 상담 게이트가 없다 — 자동 추천 불가 강아지가 결제로 넘어간다',
  )
})

test('★ 규칙23: 빌링 제공 수단은 카드 전용이다 (토스페이/계좌이체 재노출 금지)', () => {
  /**
   * 토스가 "자동결제(빌링)는 카드 등록 전용 — 계좌이체·간편결제 미지원"이라고
   * 확정(2026-08-11 사장님 확인). 그래서 고객에게 제공하는 결제수단은 카드
   * 하나여야 한다.
   *
   * 예전 규칙23 은 "토스페이 기본 켜짐이면 리허설 문서 문단이 있어야 한다"였고,
   * `defaultsOn` 이 거짓이면 `return` 으로 조용히 무단언했다(게이트 있는 규칙).
   * 정책이 카드 전용으로 굳었으니, 그 게이트를 없애고 **항상 단언**한다 —
   * 카드 외 수단이 제공 목록에 끼면 그 자리에서 깨진다. (게이트가 거짓 되면
   * 규칙이 썩는다는 교훈: AGENTS.md "if 안 단언은 썩는다".)
   */
  const offered = availableBillingMethods(billingMethodFlags()).map((m) => m.id)
  assert.deepEqual(
    offered,
    ['card'],
    '빌링 제공 수단이 카드 전용이 아니다 — 토스는 자동결제에 계좌이체·간편결제를 ' +
      '지원하지 않는다(2026-08-11 확정). 토스페이/계좌이체를 다시 노출하지 말 것.',
  )
})

test('★ 규칙24: fetch 가 없는 API 라우트를 부르지 않는다', () => {
  /**
   * # 왜
   * `fetch('/api/...')` 는 문자열이라 tsc 가 못 잡는다. 라우트를 옮기거나 지우면
   * 호출부는 그대로 남고, 404 를 받은 화면은 대개 "실패했어요" 한 줄만 띄운다 —
   * **기능이 죽었는데 원인이 안 보인다.** 실제로 D+30 광고 푸시가 없는 테이블을
   * 조회해 404 → 빈 배열 → 구독자에게도 광고가 나간 적이 있다(R85-E3).
   * 라우트도 같은 방식으로 조용히 어긋난다.
   *
   * 2026-07-31 전수 결과: 라우트 86개 / 깨진 호출 0건. **지금 초록인 것을 못 박는다.**
   */
  const routes: string[] = []
  const collect = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) collect(p)
      else if (name === 'route.ts' || name === 'route.tsx') {
        routes.push(rel(dir).replace(/^app/, ''))
      }
    }
  }
  collect(join(ROOT, 'app/api'))
  assert.ok(routes.length > 20, `API 라우트 파싱 실패 — ${routes.length}개`)

  const seg = (s: string) => s.split('/').filter(Boolean)
  const known = (call: string) =>
    routes.some((r) => {
      const a = seg(call)
      const b = seg(r)
      return (
        a.length === b.length &&
        a.every((x, i) => b[i]!.startsWith('[') || x === b[i])
      )
    })

  /**
   * 변수 세그먼트가 **실제로는 한 값뿐**이라 항상 실존 라우트로 풀리는 호출.
   * 스캐너는 `${provider}` 를 X 로 치환하므로 매칭에 실패한다.
   * 값이 늘어나면 그때 라우트도 같이 만들어야 하니, 여기 적어 두고 그때 확인한다.
   */
  const API_CALL_ALLOWED: Array<{ at: string; why: string }> = [
    {
      at: '/api/integrations/X/disconnect',
      why: "provider 타입이 'tractive' 하나뿐이라 항상 app/api/integrations/tractive/disconnect 로 풀린다 (provider 를 추가하면 라우트도 같이 만들 것)",
    },
  ]

  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'components')))) {
    const code = stripComments(read(file))
    for (const m of code.matchAll(/fetch\(\s*[`'"](\/api\/[^`'"?]+)/g)) {
      const call = (m[1] ?? '').replace(/\$\{[^}]*\}/g, 'X')
      if (API_CALL_ALLOWED.some((a) => a.at === call)) continue
      if (!known(call)) {
        const line = code.slice(0, m.index ?? 0).split('\n').length
        offenders.push(`${rel(file)}:${line} :: ${call}`)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'fetch 가 존재하지 않는 API 라우트를 부른다 — 404 를 받은 화면은 대개 ' +
      '"실패했어요" 만 띄워서 원인이 안 보인다.\n' + offenders.join('\n'),
  )
})

test('★ 규칙25: 재고를 되돌리려면 차감하는 코드가 있어야 한다', () => {
  /**
   * # 왜
   * `order-expire` 가 만료 주문의 재고를 `restore_stock` 으로 되돌린다. 그 전제는
   * "주문할 때 `reserve_order_stock` 으로 차감했다" 인데, **낱개 커머스가 폐지되며
   * 그 호출이 사라졌다.** 반면 구독 청구는 `order_items` 를 계속 만든다.
   * → 구독 주문이 pending 으로 남으면 **차감한 적 없는 재고가 늘어난다**(유령 증가).
   *   피킹 리스트가 품절을 못 잡고 어드민 재고가 거짓이 된다(2026-07-31 발견).
   *
   * 지금은 `subscription_id === null` 일 때만 복원하도록 막아 뒀다. 이 규칙은
   * **그 짝이 유지되는지**를 본다: 복원하는 코드가 있으면 차감하는 코드도 있어야
   * 하고, 없다면 복원이 조건 분기 안에 있어야 한다.
   */
  const src = stripComments(read(join(ROOT, 'app/api/cron/order-expire/route.ts')))
  if (!/restore_stock/.test(src)) return // 복원을 안 하면 볼 것이 없다

  /**
   * 저장소 어딘가에 예약(차감) **호출**이 있는가?
   *
   * ★ 이름이 등장하는지만 보면 안 된다 — 카나리아에서 이 규칙이 통과해 버렸다.
   *   `lib/supabase/types.ts` 는 **DB 함수 전체를 선언**하므로
   *   `reserve_order_stock: { Args… }` 가 늘 들어 있다. 그래서 "차감하는 코드가
   *   있다"가 항상 참이 되어 조기 return 했다 — **규칙이 잡으려던 상태를 규칙이
   *   통과시켰다**(오늘 세 번째로 같은 모양). 실제 `rpc(...)` 호출만 센다.
   */
  let reservesSomewhere = false
  for (const file of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'lib')))) {
    if (rel(file) === 'lib/supabase/types.ts') continue
    if (/rpc\(\s*['"]reserve_order_stock['"]/.test(stripComments(read(file)))) {
      reservesSomewhere = true
      break
    }
  }
  if (reservesSomewhere) return // 짝이 맞다 — 복원해도 된다

  assert.match(
    src,
    /reservedStock/,
    '재고를 차감하는 코드(reserve_order_stock)가 저장소에 없는데 order-expire 가 ' +
      '무조건 복원한다 — 차감한 적 없는 재고가 늘어난다. 예약했던 주문만 ' +
      '복원하도록 분기할 것(reservedStock).',
  )
})

test('★ 규칙26: 크론 주석의 KST 시각이 vercel.json 과 어긋나지 않는다', () => {
  /**
   * # 왜
   * 크론 파일 헤더가 "KST 04:00 에 돈다" 같은 시각을 적어 두는데, 스케줄을 옮길 때
   * **vercel.json 만 고치고 주석은 남는다.** 오늘만 두 건 나왔다:
   *  · account-purge — 주석 "KST 04:00 (UTC 19:00)" / 실제 `0 16 1 * *` = KST 01:00
   *  · refund-retry  — 주석 "15분 간격"          / 실제 하루 1회
   * 시각이 틀리면 "왜 안 나갔지" 를 엉뚱한 데서 찾는다. 실제로 복약 알림이
   * UTC/KST 시차 때문에 **08시 것만 나가고 나머지가 영영 미발송**이던 적이 있다.
   *
   * # 검사
   * 헤더(파일 앞 2600자)에서 `KST HH:MM` 을 뽑아, vercel.json 의 그 크론
   * 스케줄을 KST 로 환산한 값과 **하나라도 일치**하면 통과.
   * 여러 시각을 언급하는 파일(옛 값을 기록으로 남긴 경우)도 있으므로 "포함" 으로 본다.
   */
  const cfg = JSON.parse(read(join(ROOT, 'vercel.json'))) as {
    crons: Array<{ path: string; schedule: string }>
  }
  const offenders: string[] = []
  for (const c of cfg.crons) {
    const file = join(ROOT, `app${c.path}/route.ts`)
    let src: string
    try {
      src = read(file)
    } catch {
      continue
    }
    const head = stripComments(src).length === src.length ? '' : src.slice(0, 2600)
    if (!head) continue
    const parts = c.schedule.trim().split(/\s+/)
    const hour = parts[1] ?? ''
    if (!/^\d+$/.test(hour)) continue // 매시간·목록형은 대상 아님
    const min = (parts[0] ?? '0').padStart(2, '0')
    const kstHour = String((Number(hour) + 9) % 24).padStart(2, '0')
    const actual = `${kstHour}:${min}`

    const mentioned = [...head.matchAll(/KST\s*(\d{1,2}):(\d{2})/g)].map(
      (m) => `${m[1]!.padStart(2, '0')}:${m[2]}`,
    )
    if (mentioned.length === 0) continue // 시각을 안 적었으면 볼 것 없음
    if (!mentioned.includes(actual)) {
      offenders.push(
        `${c.path} :: 주석 ${mentioned.join('·')} / 실제 KST ${actual} (${c.schedule})`,
      )
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '크론 주석의 KST 시각이 vercel.json 과 다르다 — 시각이 틀리면 "왜 안 나갔지" 를 ' +
      '엉뚱한 데서 찾는다. vercel.json 이 정본이다.\n' + offenders.join('\n'),
  )
})

test('규칙 27 — WebMotion(GSAP)은 앱·어드민 라우트에 들어가면 안 된다', () => {
  /**
   * 2026-08-02. WebMotion 은 **웹(브라우저) 전용** 모션 오케스트레이터다.
   * 앱 화면에 들어가면 두 가지가 동시에 깨진다:
   *   (1) 웹/앱 분리 — 앱은 네이티브 관용구(바텀시트·계층 up-nav)를 쓴다.
   *       스크롤 핀·패럴랙스 같은 웹 랜딩 어휘가 섞이면 안 된다.
   *   (2) 번들 — GSAP 은 동적 import 라 "마운트한 페이지에서만" 내려간다는 게
   *       전제다. 앱 라우트가 import 하는 순간 그 전제가 깨진다.
   *
   * 3차에서 LandingMotion → WebMotion 으로 개명하며 랜딩 밖으로 나갔다. 이름이
   * 더 이상 "랜딩 전용"이라고 말해 주지 않으니, 경계는 테스트가 지킨다.
   */
  const BANNED_DIRS = [
    join(ROOT, 'app', '(main)'),      // 앱 PWA 라우트 — layout 이 AppChrome 강제
    join(ROOT, 'app', 'admin'),       // 어드민
    join(ROOT, 'app', 'dashboard'),   // 앱 전용 홈
    join(ROOT, 'components', 'v3'),   // 정의상 앱 전용 컴포넌트
  ]
  const IMPORTS_WEBMOTION = /from\s+['"][^'"]*WebMotion['"]/
  // 문자클래스 안의 / 는 이스케이프한다 — 안 하면 Node 의 TS 스트리퍼가
  // 정규식 리터럴이 거기서 끝난 줄 알고 파스 에러를 낸다(2026-08-02 실측).
  const USES_WEBMOTION = /<WebMotion[\s\/>]/
  const offenders: string[] = []
  for (const dir of BANNED_DIRS) {
    let files: string[]
    try {
      files = walk(dir)
    } catch {
      continue // 디렉터리가 없으면 볼 것 없음
    }
    for (const file of files) {
      if (!/\.tsx?$/.test(file)) continue
      const src = stripComments(read(file))
      if (IMPORTS_WEBMOTION.test(src) || USES_WEBMOTION.test(src)) {
        offenders.push(file.replace(ROOT, '').split(sep).join('/'))
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'WebMotion 은 웹 전용이다 — 앱/어드민 라우트에서 쓰면 웹·앱 분리가 깨지고 ' +
      `GSAP 이 앱 번들로 딸려 들어간다.\n${offenders.join('\n')}`,
  )
})


test('규칙 28 — 고객 화면에 개발용 더미/예시 문구가 나가면 안 된다', () => {
  /**
   * 2026-08-02 검수. /reviews 에 지어낸 고객 8명(보리·서울·골든리트리버 …)이
   * "먹어본 아이들이 이 자리에 모여요" 아래 슬라이더로 돌고 있었다. 코드 주석은
   * "실 데이터 연동 전 화면 확인용" — **개발용 더미가 그대로 고객에게** 나갔다.
   * 심지어 같은 페이지 윗 문단이 "지어낸 후기는 한 줄도 싣지 않아요" 였다.
   *
   * 작은 '테스트 예시' 배지를 달아 뒀지만, 배지는 변명이지 해명이 아니다 —
   * 화면에 보이는 건 고객 카드 8장이고, 실제 이용자가 아닌 사람을 이용자처럼
   * 보이게 하는 표시는 표시광고법에서 다툴 거리가 된다.
   *
   * 그래서 **렌더되는 텍스트**에서 이 문구들을 금지한다. 주석은 stripComments
   * 로 걷어내므로 지금 이 설명이나 코드 주석은 걸리지 않는다(규칙 20 에서
   * 내 주석이 내 규칙에 걸렸던 경험 반영).
   * 어드민은 제외 — 운영자가 보는 화면이라 예시 표기가 정당하다.
   */
  const BANNED = ['테스트 예시', '예시 데이터', '더미 데이터', '샘플 데이터', 'Lorem ipsum']
  const ADMIN = sep + 'admin' + sep
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'components')))) {
    if (!file.endsWith('.tsx')) continue
    if (file.includes(ADMIN)) continue
    if (file.includes('.test.')) continue
    const src = stripComments(read(file))
    for (const word of BANNED) {
      if (src.includes(word)) {
        offenders.push(file.replace(ROOT, '').split(sep).join('/') + ' :: ' + word)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '고객 화면에 개발용 더미/예시 문구가 남아 있다 — 배지를 달아도 화면에는 ' +
      '실제처럼 보인다. 실 데이터가 없으면 빈 자리가 더 정직하다. ' +
      offenders.join(' / '),
  )
})


test('규칙 29 — 웹이 들어오는 화면에서 앱 전용 라우트로 링크하면 안 된다', () => {
  /**
   * 2026-08-02 검수에서 같은 모양 두 건이 나왔다.
   *
   *  (1) /tools/raw-calculator · /tools/elimination-diet 이 "대시보드"(=/dashboard,
   *      앱 전용)로 돌아가는 링크를 단 채 **공개 웹에 열려 있었다.** 앱 화면으로
   *      만들어졌는데 APP_ONLY_PREFIXES 에 안 들어가 있었던 것.
   *  (2) /mypage/orders(웹도 들어오는 화면 — 환불 정책이 "마이페이지 > 주문내역"
   *      으로 안내한다)의 빈 상태 CTA "정기배송 시작하기" 가 /dogs(앱 전용)로
   *      가고 있었다. 웹 고객은 구독을 시작하는 대신 **앱 설치 벽**을 맞았다.
   *
   * 둘 다 "이 화면은 누가 보는가" 와 "이 링크는 누가 갈 수 있는가" 가 어긋난
   * 경우다. proxy.ts 의 APP_ONLY_PREFIXES 가 정본이고, 이 테스트는 그 목록과
   * 실제 링크가 맞는지 본다. 분기(isApp ? 앱경로 : 웹경로)는 정상으로 본다.
   */
  const proxySrc = read(join(ROOT, 'proxy.ts'))
  const listStart = proxySrc.indexOf('const APP_ONLY_PREFIXES')
  assert.ok(listStart > 0, 'proxy.ts 에서 APP_ONLY_PREFIXES 를 못 찾았다')
  // ★여는 대괄호를 `= [` 로 찾는다. 그냥 indexOf(']') 를 쓰면 타입 표기
  //   `readonly string[]` 의 대괄호에 먼저 걸려 41자짜리 빈 구간을 읽는다
  //   (2026-08-02 실측 — 아래 length 검사가 그걸 잡아냈다).
  const arrStart = proxySrc.indexOf('= [', listStart)
  assert.ok(arrStart > listStart, 'APP_ONLY_PREFIXES 배열 시작을 못 찾았다')
  const listBody = proxySrc.slice(arrStart, proxySrc.indexOf(']', arrStart))
  const appOnly = [...listBody.matchAll(/'(\/[a-z0-9/-]+)'/g)].map((m) => m[1] as string)
  assert.ok(appOnly.length >= 5, `APP_ONLY_PREFIXES 파싱 실패(${appOnly.length}개)`)

  const covered = (route: string) =>
    appOnly.some((p) => route === p || route.startsWith(p + '/'))

  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app'))) {
    if (!file.endsWith('page.tsx')) continue
    const rel = file.replace(ROOT, '').split(sep).join('/')
    if (rel.includes('/admin/')) continue
    if (rel.includes('/(main)/')) continue // 레이아웃이 이미 앱을 강제하는 그룹
    const route =
      '/' +
      rel
        .replace('/app/', '')
        .replace('/page.tsx', '')
        .split('/')
        .filter((seg) => seg && !(seg.startsWith('(') && seg.endsWith(')')))
        .join('/')
    if (covered(route)) continue // 이 화면 자체가 앱 전용이면 문제 없음
    const src = stripComments(read(file))
    for (const target of appOnly) {
      // 분기 링크(href={isApp ? ...})는 허용 — 하드코딩된 href 만 잡는다
      if (src.includes(`href="${target}"`) || src.includes(`href='${target}'`)) {
        offenders.push(`${rel} (${route}) → ${target}`)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '웹 방문자가 볼 수 있는 화면이 앱 전용 라우트로 링크한다 — 누르면 앱 설치 벽을 ' +
      '맞는다. isApp 분기로 웹 경로를 주거나, 그 화면 자체를 APP_ONLY_PREFIXES 에 ' +
      '넣어라. ' + offenders.join(' / '),
  )
})


test('규칙 30 — 앱 전용 라우트는 proxy matcher 에도 들어 있어야 한다', () => {
  /**
   * 2026-08-02. /tools 를 APP_ONLY_PREFIXES 에 넣었는데도 페이지가 **비로그인
   * 웹에서 그대로 200 으로 열렸다.** proxy 의 `config.matcher` 가 별도의
   * 허용목록이라, 거기 없는 경로는 미들웨어가 아예 실행되지 않기 때문이다.
   *
   * 무서운 건 그 사이 감사 테스트가 초록이었다는 것이다(규칙 29 는 prefix 목록만
   * 봤다). 브라우저로 실제 요청을 보내고서야 알았다 — **"테스트가 초록인데
   * 막히지 않는" 전형적인 헛통과.** 그래서 두 목록의 일치를 여기서 못 박는다.
   */
  const src = read(join(ROOT, 'proxy.ts'))

  const listStart = src.indexOf('const APP_ONLY_PREFIXES')
  const arrStart = src.indexOf('= [', listStart)
  assert.ok(arrStart > 0, 'APP_ONLY_PREFIXES 배열을 못 찾았다')
  const prefixes = [...src.slice(arrStart, src.indexOf(']', arrStart)).matchAll(/'([^']+)'/g)]
    .map((m) => m[1] as string)
    .filter((v) => v.startsWith('/'))
  assert.ok(prefixes.length >= 5, `APP_ONLY_PREFIXES 파싱 실패(${prefixes.length}개)`)

  const mStart = src.indexOf('matcher: [')
  assert.ok(mStart > 0, 'config.matcher 를 못 찾았다')
  const matcher = [...src.slice(mStart, src.indexOf(']', mStart)).matchAll(/'([^']+)'/g)]
    .map((m) => m[1] as string)
    .filter((v) => v.startsWith('/'))
  assert.ok(matcher.length >= 5, `matcher 파싱 실패(${matcher.length}개)`)

  /** matcher 항목이 이 prefix 로 시작하는 경로를 실제로 잡는가. */
  const matcherCovers = (prefix: string) =>
    matcher.some((m) => {
      const base = m.replace('/:path*', '')
      return base === prefix || prefix.startsWith(base + '/')
    })

  const uncovered = prefixes.filter((p) => !matcherCovers(p))
  assert.deepEqual(
    uncovered,
    [],
    'APP_ONLY_PREFIXES 에 있는데 proxy config.matcher 에 없다 — 미들웨어가 아예 ' +
      '실행되지 않아 가드가 조용히 무효가 된다(테스트는 초록인 채로). ' +
      uncovered.join(' / '),
  )
})


test('규칙 31 — 고객 문구에 "언제든 해지/일시정지" 과약속 금지', () => {
  /**
   * 사장님 2026-07-23 지시: "언제든 (해지/일시정지/조정) 할 수 있어요" 는 쓰지
   * 않는다. 마감을 명시하라("다음 결제 전까지"처럼). 사장님 말: "예전에 안
   * 쓰기로 했는데 메모리에 없어 놓쳤다."
   *
   * 그런데 2026-08-02 검수에서 **모든 웹 페이지 상단 배너**에 그대로 있었다
   * ("무료 분석 먼저, 결제는 그다음 · 언제든 해지"). 문서·메모리에만 적힌 규칙은
   * 이렇게 또 새어 나온다 — 그래서 테스트로 박는다.
   *
   * 마감의 정본:
   *   · 해지·일시정지 = **다음 결제 전**(일요일 아님). status 를 바꾸는 순간
   *     next_delivery_date 가 지워지고 청구 크론은 active 만 고른다.
   *   · 박스 구성 변경 = **일요일 마감**(월요일에 원료를 손질하므로).
   * 둘을 섞어 쓰지 말 것. lib/shipping-schedule 의 STOP_TIMING_COPY 참조.
   *
   * "언제든 재개/다시 시작", "수신동의는 언제든 철회" 등은 **금지 대상이 아니다** —
   * 멈추는 쪽(해지·일시정지)의 과약속만 잡는다.
   */
  // ★인접 문자열만 보면 샌다. 처음엔 '언제든 해지' 같은 붙은 형태만 잡았더니
  //   "언제든지 **정기배송을** 해지할 수 있습니다"(환불 정책)를 놓쳤다 — 규칙이
  //   초록인데 문구는 남아 있는 상태. 사이에 말이 끼어도 잡도록 창을 준다.
  //   줄바꿈도 넘어야 한다 — JSX 는 문장을 아무 데서나 접는다. 실제로
  //   "언제든지 정기배송을\n 해지할 수 있습니다"(환불 정책)가 \n 때문에 빠져나갔다.
  const BANNED_RE = /언제든지?[\s\S]{0,28}?(해지|일시정지)/
  // 뉴스레터·수신동의의 "언제든 구독 해지"는 **정당하다** — 광고성 정보 수신거부는
  // 실제로 언제든 가능해야 하고(정보통신망법), 여기서 막을 대상이 아니다.
  // 금지 대상은 **정기배송(제품 구독)** 쪽 과약속이다.
  const EXEMPT = ['newsletter', 'consent', 'Consent']
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app'))
    .concat(walk(join(ROOT, 'components')))
    .concat(walk(join(ROOT, 'lib')))) {
    if (!/\.tsx?$/.test(file)) continue
    if (file.includes('.test.')) continue
    if (EXEMPT.some((e) => file.includes(e))) continue
    const src = stripComments(read(file))
    const m = BANNED_RE.exec(src)
    if (m) {
      offenders.push(file.replace(ROOT, '').split(sep).join('/') + ' :: ' + m[0])
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '"언제든 해지" 류는 과약속이라 쓰지 않기로 했다(사장님 2026-07-23). ' +
      '마감을 명시할 것 — 해지는 "다음 결제 전까지", 구성 변경은 "일요일까지". ' +
      offenders.join(' / '),
  )
})


test('규칙 32 — 돈 경로의 Supabase 호출은 error 를 반드시 꺼낸다', () => {
  /**
   * AGENTS.md 1번 규칙("데이터 없음" != "실패")을 **돈 경로에서만** 기계로 지킨다.
   * 저장소 전체엔 `const { data } = await supabase...` 가 177 곳 있고 대부분은
   * 화면 조회라 실패해도 빈 목록으로 끝난다. 하지만 청구·결제·주문 취소에서는
   * 같은 실수가 **틀린 이유를 고객에게 말하고, 검문소를 조용히 끈다.**
   *
   * 2026-08-02 검수 실례(subscription-charge):
   *   · 배송지 조회가 error 를 안 꺼내서, DB 가 흔들리면 "배송지가 등록되지
   *     않아 결제를 진행할 수 없어요" 가 **주소가 멀쩡한 고객에게** 갔다.
   *     사장님 경보도 no_shipping_address 라 엉뚱한 곳을 보게 된다.
   *   · 금액 대조 기준(dog_formulas·products) 조회 실패도 null 이 되어
   *     **아무도 모르게 청구 검문소가 꺼졌다.**
   *
   * 범위를 좁게 잡은 건 의도다 — 전부를 막으면 규칙이 커서 꺼진다.
   */
  const MONEY_PATHS = [
    join(ROOT, 'app', 'api', 'cron', 'subscription-charge'),
    join(ROOT, 'app', 'api', 'payments'),
    join(ROOT, 'app', 'api', 'orders'),
    join(ROOT, 'app', 'api', 'subscriptions'),
    // ★2026-08-12 반증감사로 추가. 탈퇴 라우트의 '진행 중 주문 차단'이
    //   error 를 안 꺼내 **조회 실패 시 게이트가 열려 있었다** — 통과하면
    //   배송 중인 박스의 주소·수령인을 되돌릴 수 없이 익명화한다. 돈 경로가
    //   아니라고 빼 뒀던 자리에서 정확히 규칙1 사고가 났다.
    join(ROOT, 'app', 'api', 'account'),
  ]
  // ★`await` 의 **대상이 supabase 인지**를 규제식 안에서 확인한다.
  //   처음엔 `const { data } = await ` 만 잡고 "뒤 160자에 supabase 가 있으면
  //   Supabase 호출" 로 판정했는데, `const { total } = priceForFormula(...)` 같은
  //   무관한 코드가 8건 걸렸다 — 뒤쪽 다른 줄의 supabase 를 본 것이다.
  //   느슨한 규칙은 오탐을 내고, 오탐이 쌓이면 규칙 자체가 꺼진다.
  const NO_ERROR = /const\s*\{\s*data(\s*:\s*\w+)?\s*\}\s*=\s*await\s+supabase\b/g
  const NEWLINE = String.fromCharCode(10)
  const offenders: string[] = []
  for (const dir of MONEY_PATHS) {
    let files: string[]
    try {
      files = walk(dir)
    } catch {
      continue
    }
    for (const file of files) {
      if (!file.endsWith('.ts') || file.includes('.test.')) continue
      const src = stripComments(read(file))
      for (const m of src.matchAll(NO_ERROR)) {
        // auth.getUser() 는 예외 — 실패 시 user 가 null 이라 `if (!user)` 로 이미
        // 갈린다(에러와 미로그인의 처리가 같다: 401).
        if (src.slice(m.index!, m.index! + 120).includes('auth.getUser')) continue
        // ★줄 번호를 쓰지 않는다. 여기 src 는 stripComments 를 거친 문자열이라
        //   줄 번호가 실제 파일과 어긋난다 — 그걸 믿고 파일을 읽었다가 무관한
        //   코드를 보고 "오탐" 이라 잘못 판단할 뻔했다. 스니펫이 정확하다.
        const snippet = src
          .slice(m.index!, m.index! + 110)
          .split(NEWLINE)
          .map((l) => l.trim())
          .filter(Boolean)
          .join(' ')
        offenders.push(file.replace(ROOT, '').split(sep).join('/') + ' :: ' + snippet)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '돈 경로에서 Supabase error 를 안 꺼냈다 — 조회 실패가 "데이터 없음" 으로 ' +
      '둔갑해 고객에게 틀린 이유를 말하거나 검문소를 조용히 끈다. ' +
      offenders.join(' / '),
  )
})


test('규칙 33 — 휴대폰 검증은 lib/phone 정본만 (자체 정규식 금지)', () => {
  /**
   * 2026-08-03 검수. 사장님 계정으로 정기배송 신청 화면을 열었더니 배송
   * 연락처가 **`010-3887-885`(10자리)** 였다. 한 자리가 빠진 번호인데 저장돼
   * 있었고 결제 버튼도 안 막혔다. 냉동 배송은 기사님이 전화를 거는 배송이라
   * 연락 안 되는 번호는 곧 배송 실패다.
   *
   * 원인: 검증식이 `010` 뒤 7자리를 허용했다 — /^01[016789]\d{7,8}$/.
   * `010` 은 도입부터 11자리 고정이라 뒷자리 7자리 번호는 존재하지 않는다.
   * 7~8 자리를 허용해도 되는 건 옛 식별번호(011·016~019)뿐이다.
   *
   * 그리고 같은 규칙이 **네 곳에 따로** 있었고 넷 다 같은 구멍이었다
   * (주문 화면 · 서버 create 라우트 · 프로필 폼 · zod 스키마).
   * 고칠 곳이 하나여야 다음에 또 안 갈라진다.
   */
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app'))
    .concat(walk(join(ROOT, 'components')))
    .concat(walk(join(ROOT, 'lib')))) {
    if (!/\.tsx?$/.test(file)) continue
    if (file.includes('.test.')) continue
    const rel = file.replace(ROOT, '').split(sep).join('/')
    if (rel === '/lib/phone.ts') continue // 정본 자신
    const src = stripComments(read(file))
    // 식별번호 나열을 문자클래스로 들고 있으면 자체 검증식이다.
    if (/01\[0?1[0-9]*6789\]/.test(src) || src.includes('01[016789]') || src.includes('01[16789]')) {
      offenders.push(rel)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '휴대폰 검증 정규식을 직접 들고 있다 — lib/phone 의 isKoreanMobile 을 쓸 것. ' +
      '네 곳이 따로 있다가 넷 다 010 뒤 7자리를 통과시켰다. ' + offenders.join(' / '),
  )
})


test('규칙 34 — 고객에게 박스를 보여줄 땐 snapBox 로 스냅한다', () => {
  /**
   * 2026-08-03 사장님: "잠만 저 두번째 박스도 이상한데? 왜 또 네개 조합이야".
   *
   * `/dogs/[id]/formulas`("맞춤 박스 구성") 가 **원시 임상 비율**을 그대로
   * 그리고 있었다 — 오리50·한우30·치킨10·흑돼지10 처럼 4종이 떴다.
   * 실제로 담기는 박스는 **최대 2종**이다(boxComposition: 1종 100% / 2종 50:50,
   * 2위가 20% 미만이면 1종). 분석 카드와 플랜 화면은 이미 snapBoxLines 로
   * 스냅하는데 이 화면만 안 했다. 고객은 4종을 보고 2종을 받는다.
   *
   * 원시 비율은 "왜 이 단백질인가"의 **근거**일 뿐 배송·표시용이 아니다
   * (boxComposition.ts 첫 문단이 그렇게 못 박아 뒀는데도 새 화면이 그걸 몰랐다).
   *
   * 그래서: `formula.lineRatios` 를 **화면에 그리는** 파일은 반드시
   * boxComposition 을 import 해야 한다. 계산·저장 쪽(api·lib)은 대상이 아니다.
   */
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'components')))) {
    if (!file.endsWith('.tsx') || file.includes('.test.')) continue
    const rel = file.replace(ROOT, '').split(sep).join('/')
    if (rel.includes('/admin/')) continue // 운영자는 원시 비율을 봐야 한다
    const src = stripComments(read(file))
    if (!src.includes('lineRatios')) continue
    // 그리는 화면인지 — 비율을 % 로 찍거나 막대 폭에 쓰면 표시용이다.
    const renders =
      src.includes('lineRatios[line]') || src.includes('lineRatios[l]')
    if (!renders) continue
    if (src.includes('boxComposition')) continue
    offenders.push(rel)
  }
  assert.deepEqual(
    offenders,
    [],
    'formula.lineRatios 를 고객 화면에 그대로 그린다 — 실제 박스는 최대 2종이라 ' +
      '본 것과 받는 것이 달라진다. boxComposition 의 snapBoxLines/snapBoxRatios 를 ' +
      '거칠 것. ' + offenders.join(' / '),
  )
})


test('규칙 35 — 저장된 daily_grams 를 고객 화면에 그대로 쓰지 않는다', () => {
  /**
   * 2026-08-03, 사장님: "이건 재계산해서 덮어 / 옛 칼로리 밀도는 이제 없는 거야".
   *
   * `daily_grams` 는 `daily_kcal × lineRatios` 에서 나오는 **유도값**인데 DB 에
   * 따로 저장된다. 유도값을 저장하면 원본이 바뀔 때 갈라진다 — 실제로 갈라졌다:
   * 밀도 상수가 v4.0(1.3125)으로 고쳐진 건 2026-07-24 인데, 그 전에 저장된 행은
   * 옛 밀도(1.150·1.200·1.495)로 계산된 숫자를 그대로 들고 있었다.
   * 6행 전부 어긋나 있었고(백필 실측), 그중 하나는 오히려 **적게** 표시돼
   * 있었다(210g 저장 vs 240g 실제 — 그만큼 덜 먹이라고 말하고 있었다).
   *
   * 상수를 고치고 저장값을 백필해도, **읽는 쪽이 저장값을 믿으면 다음 번에 또**
   * 같은 일이 난다(사장님 v4.0 실측치 반영이 예정돼 있다). 그래서 고객 화면은
   * lib/personalization/dailyGrams 의 dailyGramsOf 로 **읽을 때 다시 센다.**
   * 저장 칸은 어드민·이력·백필용으로 남긴다.
   */
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'components')))) {
    if (!/\.tsx?$/.test(file) || file.includes('.test.')) continue
    const rel = file.replace(ROOT, '').split(sep).join('/')
    if (rel.includes('/admin/')) continue // 운영자는 저장값 자체를 볼 수 있어야 한다
    if (rel.includes('/api/')) continue // 계산·저장 쪽은 대상이 아니다
    const src = stripComments(read(file))
    if (!src.includes('daily_grams')) continue
    if (src.includes('dailyGramsOf')) continue
    offenders.push(rel)
  }
  assert.deepEqual(
    offenders,
    [],
    '저장된 daily_grams 를 고객 화면이 그대로 쓴다 — 그 값은 만들어질 당시 kcal ' +
      '밀도로 굳어 있어 레시피가 바뀌면 옛 숫자가 나온다. dailyGramsOf 로 다시 셀 것. ' +
      offenders.join(' / '),
  )
})

test('규칙36 — dog_formulas 쓰기는 service_role 로만 한다', () => {
  /**
   * # 왜
   * 2026-08-05 병렬 보안 감사에서 나온 **출시 블로커**다. subscriptions·
   * orders·profiles 를 컬럼 화이트리스트로 잠갔는데, 그 잠긴 칸에 들어갈 값을
   * 만들어내는 dog_formulas 는 고객이 REST 로 직접 UPDATE 할 수 있었다.
   * daily_kcal 이 청구액에 **선형 비례**하므로(boxPricing) `{"daily_kcal":1}`
   * 한 방으로 15만원짜리 박스가 3천원이 됐다. 청구 검문소는 같은 행을
   * 재계산하므로 stored == recomputed 로 통과해 알림조차 안 뜬다.
   *
   * 프로덕션 has_column_privilege 로 실측 확인했고(daily_kcal·formula·
   * approval_status 전부 true), 20260805000000 마이그레이션이 권한을 회수했다.
   * 권한을 회수했으니 **쿠키 클라이언트로 쓰면 그 순간 조용히 거부된다** —
   * 이 테스트는 그 짝을 지킨다(규칙13: 잠금과 호출부는 같이).
   */
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app', 'api'))) {
    if (!/\.ts$/.test(file) || file.includes('.test.')) continue
    const rel = file.replace(ROOT, '').split(sep).join('/')
    if (rel.includes('/cron/')) continue // 크론은 정의상 service_role
    const src = stripComments(read(file))
    // dog_formulas 에 쓰는 구문만 본다(select 는 대상 아님).
    const re =
      /(\w+(?:\(\))?)\s*\.from\(['"]dog_formulas['"]\)\s*\.(update|insert|upsert|delete)\(/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      const recv = m[1] ?? ''
      if (!/[Aa]dmin/.test(recv)) offenders.push(`${rel} (${recv}.${m[2]})`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'dog_formulas 를 쿠키 클라이언트로 쓴다 — 고객 UPDATE 권한은 회수됐으므로 ' +
      '이 쓰기는 조용히 거부된다. createAdminClient() 를 쓰고 소유권은 코드가 확인할 것. ' +
      offenders.join(' / '),
  )
})

test('규칙37 — 알림 dedup 앵커는 발송 제목과 같은 상수를 쓴다', () => {
  /**
   * # 왜
   * 2026-08-05 크론 감사에서 **3건이 동시에** 죽어 있었다. 전부 같은 병이다:
   * 브랜드 보이스 스윕으로 푸시 제목을 바꿀 때 dedup 조회의 ilike 패턴을 같이
   * 안 바꿔서, 14일 재발송 가드가 영원히 0건을 반환했다.
   *   · intervention-alerts — '체중 추세 경보' 로 찾는데 실제 제목은
   *     '체중 흐름을 살펴봤어요'. 저장소 전체에서 그 필터 한 줄이 유일한 등장이었다.
   *     경보 category 라 nudge 상한도 안 걸려 **매주 화요일 재발송**됐다.
   *   · weight-reminder — '체중 측정해보세요' vs '체중을 측정해보세요'.
   *     조사 '을' 한 글자 차이로 2주 1회가 매주가 됐다.
   *   · protein-rotation — '%단백질%rotation%' — "내부 영어 제거" 카피 정리 때
   *     앵커만 영어로 남았다.
   *
   * 문자열 리터럴을 ilike 에 직접 박으면 이 병이 재발한다. 제목과 앵커가 **같은
   * 상수**에서 나와야 한다 — 그러면 문구를 바꿀 때 한 곳만 바뀐다.
   */
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app', 'api', 'cron'))) {
    if (!/\.ts$/.test(file) || file.includes('.test.')) continue
    const rel = file.replace(ROOT, '').split(sep).join('/')
    const src = stripComments(read(file))
    // .ilike('title', '...') — 따옴표 리터럴이면 위반. 템플릿(`%${X}%`)은 통과.
    const re = /\.ilike\(\s*'title'\s*,\s*'([^']*)'/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) offenders.push(`${rel} ('${m[1]}')`)
  }
  assert.deepEqual(
    offenders,
    [],
    'dedup 조회가 제목 문자열을 직접 박았다 — 카피를 바꾸면 가드가 조용히 죽어 ' +
      '같은 알림이 매주 재발송된다. 제목 상수를 만들어 발송·조회가 함께 쓸 것. ' +
      offenders.join(' / '),
  )
})

test('규칙38 — 선택적 핸들러를 버튼에 꽂을 땐 없을 때 숨긴다(죽은 버튼 금지)', () => {
  /**
   * # 왜
   * 2026-08-05 사장님 제보: "분석화면 버튼중에 pdf공유하기라고 써져있어서".
   * 분석 화면의 **"결과 공유 · PDF · 링크"** 버튼이 죽어 있었다.
   *   CTAStack:  onShare?: () => void      … optional 선언
   *              <button onClick={onShare}>
   *   호출부:    <MagCTA p={magP} consultHref="/contact" />   ← onShare 안 넘김
   * 결과는 `onClick={undefined}` — 눌러도 **아무 일도 일어나지 않는다.**
   * optional 이라 타입 검사도 통과하고, 라벨은 "PDF · 링크"라고 적혀 있어서
   * **없는 기능을 광고하면서 무반응이기까지** 했다. 고객에게 무반응은 고장과
   * 구분되지 않는다.
   *
   * 올바른 패턴은 같은 저장소에 이미 있다 — survey/steps/Loading.tsx 는
   * `{err && onBack && (<button onClick={onBack}>…)}` 로, 핸들러가 없으면
   * 버튼 자체를 그리지 않는다. 그 패턴을 규칙으로 만든다.
   *
   * 필수로 만들 수 있으면 그게 낫다(CTAStack 은 reportHref 를 필수로 바꿨다).
   * 선택으로 둬야 한다면 없을 때 버튼을 숨겨라.
   */
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'components')))) {
    if (!/\.tsx$/.test(file) || file.includes('.test.')) continue
    const rel = file.replace(ROOT, '').split(sep).join('/')
    if (rel.includes('/admin/')) continue // 운영 화면은 대상 밖
    const src = stripComments(read(file))
    const optional = new Set(
      [...src.matchAll(/\b(on[A-Z]\w*)\?\s*:\s*\(/g)].map((m) => m[1] ?? ''),
    )
    for (const prop of optional) {
      if (!prop) continue
      if (!new RegExp(`onClick=\\{${prop}\\}`).test(src)) continue
      // 없을 때 숨기는 가드가 있으면 정상: `{onX && (` 또는 `onX ? (`
      const guarded =
        new RegExp(`${prop}\\s*&&`).test(src) ||
        new RegExp(`${prop}\\s*\\?\\s*\\(`).test(src)
      if (!guarded) offenders.push(`${rel} (${prop})`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '선택적 핸들러가 가드 없이 버튼에 꽂혔다 — 호출부가 안 넘기면 눌러도 아무 일도 ' +
      '안 나는 죽은 버튼이 되고 타입 검사도 통과한다. 필수 prop 으로 바꾸거나 ' +
      '핸들러가 없을 때 버튼을 그리지 말 것. ' +
      offenders.join(' / '),
  )
})

test('규칙39 — 크론의 Supabase 조회는 error 를 꺼내고 실제로 쓴다', () => {
  /**
   * # 왜
   * 2026-08-05 병렬 감사에서 크론 라우트 전체를 훑으니 **37곳**이 `const { data }`
   * 만 받고 있었다. 크론은 사람이 안 보는 곳에서 도는데, 조회 실패가 빈 배열로
   * 접히면 "대상 없음"이 되어 **아무 일도 안 한 것이 정상으로 집계**된다.
   * 실제로 드러난 것들:
   *   · ops-digest      — 세 집계가 접혀 이상 0건 → **메일 자체를 안 보냄**.
   *                       "Sentry 가 죽어도 이메일로는 도달한다"가 존재 이유인
   *                       크론이 자기 실패에 침묵했다.
   *   · daily-briefing  — 9개 카운트가 0으로 접혀 발송일 아침에
   *                       **"오늘 처리할 일이 없어요 ☀️"** 가 갔다.
   *   · subscription-charge 2-0 가드 — 캐스트 타입에 error 필드가 **아예 없어**
   *                       구조적으로 오류를 볼 수 없었다. 미확정 청구 조회가
   *                       실패하면 이중청구 백스톱이 조용히 열린다.
   *   · first-box-checkin — 기존 응답 조회가 접히면 재푸시 방지가 풀린다.
   *   · weight-reminder  — 마지막 기록 조회가 접히면 **방금 잰 보호자에게**
   *                       측정 알림이 간다.
   * AGENTS 규칙1("데이터 없음 ≠ 실패")의 크론 판이고, 규칙32(돈 경로)가
   * 커버하지 않던 영역이다.
   *
   * error 를 꺼내기만 하고 안 쓰면 같은 일이 난다 — eslint 의 no-unused-vars 가
   * 그건 잡으므로, 여기서는 **꺼냈는지**만 본다.
   */
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app', 'api', 'cron'))) {
    if (!/route\.ts$/.test(file)) continue
    const rel = file.replace(ROOT, '').split(sep).join('/')
    const src = stripComments(read(file))
    // data 뿐 아니라 **count 조회도** 본다(2026-08-05 회귀 감사).
    // 처음엔 `data` 로 시작하는 구조분해만 잡았는데, 알림 재발송을 막는
    // dedup 가드는 정작 `const { count: recent } = await …` 형태였다 —
    // 실패를 "안 보냈음"으로 읽으면 그 가드가 열려 같은 알림이 또 나간다.
    // 규칙이 가장 중요한 곳을 구조적으로 못 보고 있었다.
    for (const m of src.matchAll(
      /const\s*\{\s*((?:data|count)[^}]*)\}\s*=\s*\(?\s*await/g,
    )) {
      const inner = m[1] ?? ''
      if (inner.includes('error')) continue
      const line = src.slice(0, m.index).split(String.fromCharCode(10)).length
      offenders.push(`${rel}:${line}`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '크론이 Supabase 조회의 error 를 안 꺼냈다 — 실패가 빈 결과로 접혀 ' +
      '"대상 없음"이 되고, 아무 일도 안 한 것이 초록으로 집계된다. ' +
      offenders.join(' / '),
  )
})

test('규칙40 — 다크 테마를 켜는 경로가 없다(사장님이 없앤 기능)', () => {
  /**
   * # 왜
   * 2026-08-05 사장님: "다크모드 아예 없앴는데 뭔소리야". 확인해 보니 **절반만**
   * 없앤 상태였다:
   *   · OS 자동 추종(@media prefers-color-scheme: dark) → 주석 처리돼 꺼짐 ✅
   *   · `html[data-theme="dark"]` 규칙 47곳 → globals.css 에 그대로 살아 있음
   *   · 루트 layout 이 옛 localStorage `ft_theme` 을 읽어 그 속성을 박음
   * 즉 **옛날에 다크를 켰던 브라우저는 지금도 다크로 떴다.** 사장님이 아는
   * 사실과 코드가 어긋나 있었고, 그 자리 주석은 "이제 OS 설정을 자동 추종"
   * 이라고 주장했는데 정작 그 @media 는 꺼져 있었다(규칙4 그대로).
   *
   * CSS 47곳은 발동 경로가 없으면 죽은 코드다. 그래서 **켜는 쪽**을 지킨다 —
   * data-theme 을 박는 코드나 다크 themeColor 분기가 다시 생기면 빨간불.
   * 다크를 정말 되살릴 땐 이 테스트를 함께 지우면 된다(그게 리뷰 지점이다).
   */
  const offenders: string[] = []
  for (const dir of ['app', 'components', 'lib']) {
    for (const file of walk(join(ROOT, dir))) {
      if (!/\.tsx?$/.test(file) || file.includes('.test.')) continue
      const rel = file.replace(ROOT, '').split(sep).join('/')
      const src = stripComments(read(file))
      if (/setAttribute\(\s*['"]data-theme['"]/.test(src)) {
        offenders.push(`${rel} (data-theme 을 박는다)`)
      }
      if (/ft_theme/.test(src)) offenders.push(`${rel} (옛 ft_theme 을 읽는다)`)
      if (/prefers-color-scheme:\s*dark/.test(src)) {
        offenders.push(`${rel} (다크 themeColor 분기)`)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '다크 테마를 켜는 경로가 다시 생겼다 — 화면은 라이트 고정인데 일부 사용자만 ' +
      '다크로 보이거나 상태바만 어긋난다. ' +
      offenders.join(' / '),
  )
})

test('규칙41 — 고객 화면이 브라우저 영문 오류를 그대로 보여주지 않는다', () => {
  /**
   * # 왜
   * 2026-08-05 예외 UX 감사. 화면 **15곳**이 이렇게 적혀 있었다:
   *     catch (e) { setErr(e instanceof Error ? e.message : '한국어 폴백') }
   * 삼항이 뒤집혀 있다. 이 catch 에 도달하는 건 거의 항상 fetch 실패이고
   * 그건 TypeError = Error 인스턴스다 → 고객은 **`Failed to fetch`(크롬) /
   * `Load failed`(iOS 사파리)** 를 본다. 준비된 한국어는 영영 안 뜨는 죽은
   * 코드였고, 승인·주문취소·금액변경 동의 같은 **돈 화면**이 다 포함됐다.
   *
   * 서버가 주는 친절한 한국어는 그 위 `if (!res.ok)` 에서 이미 처리된다 —
   * catch 가 잡는 건 네트워크 끊김·JSON 파싱 실패뿐이다.
   * lib/error-message 의 `userFacingError(e, '폴백')` 이 정본: 한글이 있으면
   * 우리가 던진 것이라 보여주고, 아니면 폴백.
   * (어드민은 예외 — 운영자에겐 원본 메시지가 진단에 유용하다.)
   */
  const offenders: string[] = []
  for (const dir of ['app', 'components']) {
    for (const file of walk(join(ROOT, dir))) {
      if (!/\.tsx$/.test(file) || file.includes('.test.')) continue
      const rel = file.replace(ROOT, '').split(sep).join('/')
      if (rel.includes('/admin/')) continue
      const src = stripComments(read(file))
      for (const m of src.matchAll(
        /(\w+)\s+instanceof\s+Error\s*\?\s*\1\.message\s*:/g,
      )) {
        offenders.push(`${rel} (${m[1]})`)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '고객 화면이 Error.message 를 그대로 보여준다 — fetch 실패면 ' +
      '"Failed to fetch" 가 화면에 뜬다. userFacingError(e, 한국어폴백) 를 쓸 것. ' +
      offenders.join(' / '),
  )
})

test('규칙42 — 어드민이 "결제됨"을 paid 하나로 판정하지 않는다', () => {
  /**
   * # 왜
   * 2026-08-07 어드민 감사. 발송 큐 세 곳이 전부 `payment_status = 'paid'`
   * 만 셌다(대시보드 "발송할 주문" · 처리대기 "미발송 24시간+" ·
   * /admin/orders?status=preparing). 그런데 품절 1종을 부분 환불하면
   * 상태가 **'partially_refunded'** 가 된다 — **돈은 일부만 돌려주고 박스는
   * 여전히 보내야 하는 주문이 오늘 보낼 목록 세 군데에서 동시에 사라졌다.**
   *
   * 매출도 같은 이유로 어긋났다: 1,000원만 부분 환불해도 그 주문 10만원
   * **전체**가 매출에서 증발했다.
   *
   * 정본은 lib/commerce/paid-status 의 `PAID_STATUSES` 하나다. 같은 규칙이
   * 여러 파일에 흩어지면 갈라진다 — 이 저장소에서 이미 여러 번 겪었다
   * (전화번호 검증 4곳 · kcal 웹/앱 · needs_card 앱/웹).
   */
  /**
   * ★스캔 범위를 app/lib 전체로 (2026-08-08 적대적 재감사 #5).
   *
   * admin 두 디렉터리만 걷던 시절, **범위 밖에서 같은 버그 4개가 초록인 채**
   * 살아 있었다: daily-briefing(사장님 아침 브리핑의 미발송 큐 — 발송 누락의
   * 마지막 백스톱이 부분환불 주문을 못 봤다) · first-box-checkin ·
   * feeding-outcomes · analysis/structured. 규칙의 존재가 "커버됐다"는
   * 착각을 만들면 규칙이 없는 것보다 나쁘다 — 전체를 걷는다.
   *
   * 정당한 'paid' 단독 비교(웹훅 상태 전이 판정 등)는 `.eq()` 필터 형태가
   * 아니라 `===` 비교라 이 정규식에 안 걸린다. 필터로 'paid' 단독을 쓰는
   * 곳이 새로 생기면 사람이 한 번 보게 하는 것이 목적이다.
   */
  const offenders: string[] = []
  for (const dir of ['app', 'lib']) {
    for (const file of walk(join(ROOT, dir))) {
      if (!/\.tsx?$/.test(file) || file.includes('.test.')) continue
      const rel = file.replace(ROOT, '').split(sep).join('/')
      const src = stripComments(read(file))
      // .eq('payment_status', 'paid') / .eq('orders.payment_status', 'paid')
      // 여러 줄로 흩어진 형태도 잡는다(트레일링 콤마 포함).
      for (const m of src.matchAll(
        /\.eq\(\s*['"][\w.]*payment_status['"]\s*,\s*['"]paid['"]\s*,?\s*\)/g,
      )) {
        offenders.push(`${rel} (${m[0].replace(/\s+/g, ' ')})`)
      }
    }
  }

  /**
   * ★FSM 도 같이 본다 (2026-08-07, 첫 수정이 반쪽이었던 이유).
   *
   * 큐 필터만 넓히고 `lib/commerce/order-fsm.ts` 의 발송 게이트를 안 고쳐서,
   * 부분 환불 주문이 **보이기만 하고 발송은 못 하는** 상태가 됐다 —
   * 처리 대기 큐에서 절대 0 이 되지 않는 항목이 됐으니 전보다 나빴다.
   * 규칙이 app/admin 만 스캔해서 카나리아가 초록인 채로 통과했다.
   */
  const fsm = stripComments(read(join(ROOT, 'lib/commerce/order-fsm.ts')))
  if (/payment_status\s*!==\s*['"]paid['"]/.test(fsm)) {
    offenders.push(
      'lib/commerce/order-fsm.ts (발송 게이트가 payment_status 를 paid 하나로 ' +
        '비교한다 — 부분 환불 주문을 발송할 수 없다. isPaidStatus() 를 쓸 것)',
    )
  }
  assert.deepEqual(
    offenders,
    [],
    '어드민이 결제됨을 paid 하나로 판정한다 — 부분 환불된 주문이 발송 큐와 ' +
      '매출에서 통째로 사라진다. lib/commerce/paid-status 의 PAID_STATUSES 를 쓸 것. ' +
      offenders.join(' / '),
  )
})

test('규칙43 — 발송 처리에는 운송장이 필요하다', () => {
  /**
   * # 왜
   * 2026-08-07 어드민 감사. '주문 상태 관리' 패널이 carrier/trackingNumber
   * 없이 `orderStatus: 'shipping'` 을 던질 수 있었고, 상태 라우트는
   * `if (carrier !== undefined)` 일 때만 저장했다. 결과: 고객에게 **"배송이
   * 시작됐어요"** 푸시와 메일이 나가는데 운송장은 비어 있다. 게다가 그때는
   * 송장을 나중에 넣을 경로조차 없었다(`수정 기능은 곧 열려요`).
   *
   * 그래서 두 가지를 같이 박는다:
   *   ① 상태 라우트에 TRACKING_REQUIRED 가드
   *   ② 발송 후 정정용 PATCH /api/admin/orders/[id]/tracking
   * 둘 중 하나만 있으면 반쪽이다 — 가드만 있으면 오타를 못 고치고,
   * 정정만 있으면 빈 송장으로 알림이 먼저 나간다.
   */
  const statusRoute = read(
    join(ROOT, 'app/api/admin/orders/[id]/status/route.ts'),
  )
  assert.match(
    statusRoute,
    /TRACKING_REQUIRED/,
    '상태 라우트에서 송장 없는 발송 가드가 사라졌다 — 운송장 없이 ' +
      '"배송이 시작됐어요" 알림이 고객에게 나간다.',
  )

  const trackingRoute = read(
    join(ROOT, 'app/api/admin/orders/[id]/tracking/route.ts'),
  )
  assert.match(
    trackingRoute,
    /export async function PATCH/,
    '운송장 정정 엔드포인트가 없다 — 송장을 잘못 넣으면 ' +
      'shipping→preparing→재발송 말고 방법이 없고, 그러면 배송 시작 알림이 두 번 간다.',
  )
})

test('규칙44 — 고객 문구에 임상 약어를 그대로 쓰지 않는다', () => {
  /**
   * # 왜
   * 2026-08-07 문구 감사. `docs/voice-guidelines.md` 가 전문용어 금지를
   * 정해 뒀고 `lib/chatbot-system-prompt.ts` 는 AI 에게 BCS 를 쓰지 말라고
   * 지시하는데, **우리 하드코딩이 그대로 내보내고 있었다**:
   *   · lib/chat/proactive-nudges — "○○의 BCS 가 7/9 로…" (챗봇 선제 메시지)
   *   · components/analysis/magazine — "Daily Energy · MER"
   *   · components/web/fd/AppShowcase — "BCS 5/9", "체형 점수(BCS)와 … (MER)"
   *   · lib/email/templates/quarterly-report — "체형 평가(BCS)", "하루 에너지(MER)"
   *
   * 고객은 BCS·MER 이 무엇인지 모른다. 숫자만 보고 나쁜 뜻인지 좋은 뜻인지
   * 판단하려다 불안해진다.
   *
   * # 제외
   *  · admin — 운영자에겐 약어가 정확하고 짧다.
   *  · vet-report / app/vet — 수의사에게 보내는 자료다. 오히려 약어가 정본.
   *  · app/science — 방법론 공개 페이지. 계산식을 그대로 밝히는 게 목적이다.
   *  · 뉴스레터 — 용어를 풀어 설명하는 교육 콘텐츠(본문에서 정의한다).
   *  · 주석·변수명 — 코드가 무엇을 다루는지는 정확히 적어야 한다.
   */
  const BANNED = /\b(BCS|MER|Bristol|IRIS|DCM|IBD)\b/
  const EXEMPT = [
    '/admin/',
    '/vet-report',
    '/app/vet/',
    '/science/',
    'newsletter',
  ]
  /**
   * 스캔 범위 = **고객에게 렌더되는 표면**만.
   *
   * 계산 엔진(lib/personalization·lib/nutrition·lib/diet-simulation 등)의
   * 한국어 문자열은 내부 판정 근거·어드민 표시용이라 약어가 오히려 정확하다.
   * 그것까지 넣으면 규칙이 시끄러워져서 무시하게 된다 — 규칙은 지킬 수 있는
   * 범위로 좁게 시작한다. (엔진 라벨 정리는 별도 작업으로 남겼다.)
   */
  const offenders: string[] = []
  for (const dir of [
    'app/(main)',
    'app/start',
    'app/account',
    'components/v3',
    'components/web',
    'components/analysis',
    'lib/email',
    'lib/chat',
    'lib/v3-helpers',
  ]) {
    for (const file of walk(join(ROOT, dir))) {
      if (!/\.tsx?$/.test(file) || file.includes('.test.')) continue
      const rel = file.replace(ROOT, '').split(sep).join('/')
      if (EXEMPT.some((e) => rel.includes(e))) continue
      const src = stripComments(read(file))
      // 렌더되는 한국어 문자열 안에 약어가 섞인 경우만 — 한글이 같은 따옴표
      // 안에 함께 있으면 그건 고객에게 보여주는 문장이다.
      for (const m of src.matchAll(/'([^'\n]*[가-힣][^'\n]*)'|`([^`\n]*[가-힣][^`\n]*)`/g)) {
        const text = m[1] ?? m[2] ?? ''
        if (BANNED.test(text)) {
          offenders.push(`${rel} (${text.slice(0, 60)})`)
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '고객 문구에 임상 약어가 그대로 있다 — 고객은 BCS·MER 이 뭔지 모른다. ' +
      '한국어로 풀어 쓸 것(예: "체형이 9단계 중 7단계"). ' +
      offenders.join(' / '),
  )
})

test('규칙45 — 이메일이 발송일을 "도착"이라 부르지 않는다', () => {
  /**
   * # 왜
   * 2026-08-07 문구 감사. `next_delivery_date` 는 **발송일**이다
   * (lib/shipping-schedule: 화=발송, 수=문 앞 도착). 그런데 정기배송 리마인더
   * 메일이 그 날짜를 `"${dateLabel} 도착 예정"` 이라 썼다 — 하루를 앞당겨
   * 약속한 셈이고, 같은 메일 **제목이 "출발해요"** 라 자기모순이었다.
   *
   * 게다가 도착일은 지역마다 다르다(수도권 익일 · 그 외 48시간 · 도서산간
   * 하루 더). 우리는 고객 지역으로 도착일을 계산하지 않으므로 **단정할 근거가
   * 없다.** 아는 것(발송)은 단정하고 모르는 것(도착)은 범위로 말한다.
   *
   * 같은 감사에서 personalization-cycle 메일의
   * "박스가 도착하기 약 일주일 전에 정기 결제가 진행돼요" 도 사실이 아니었다
   * (청구는 발송일 **당일** — subscription-charge 의 `.lte(next_delivery_date, today)`).
   */
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'lib/email'))) {
    if (!/\.ts$/.test(file) || file.includes('.test.')) continue
    const rel = file.replace(ROOT, '').split(sep).join('/')
    const src = stripComments(read(file))
    if (/도착 예정/.test(src)) {
      offenders.push(`${rel} (발송일을 "도착 예정" 이라 부른다)`)
    }
    if (/도착하기 약 일주일 전에 정기 결제/.test(src)) {
      offenders.push(`${rel} (결제는 발송일 당일이다)`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '이메일이 발송일을 도착일처럼 말한다 — 하루 앞당겨 약속하는 것이고, ' +
      '도착일은 지역마다 달라 단정할 근거가 없다. ' +
      offenders.join(' / '),
  )
})

test('규칙46 — 구독 상태 라벨을 화면마다 따로 적지 않는다', () => {
  /**
   * # 왜
   * 2026-08-07 감사. `subscriptionState()` 로 **판정**은 한 곳에 모았는데
   * **라벨은 화면마다 ad-hoc** 이었다. 같은 구독이 화면을 옮기면 이름이 바뀐다:
   *
   *   상태          강아지 카드   구독 탭    마이페이지   웹
   *   active        진행중        구독 중    구독 중      구독 중
   *   card_failed   재등록 필요   결제 실패  결제 문제    재등록 필요
   *
   * 결제가 깨진 고객은 실제로 연달아 두 이름을 본다 — 실패 메일의 CTA 가
   * 규칙16 때문에 **의도적으로 웹**이고, 고객은 그 뒤 앱을 연다.
   *
   * 정본은 lib/subscription-state 의 `SUB_STATE_LABEL` 하나.
   * 색·배지 클래스는 화면 톤(app v3 / web FD)이 달라 각자 골라도 된다 —
   * **label 만** 정본을 쓴다.
   */
  const offenders: string[] = []
  for (const dir of ['app', 'components']) {
    for (const file of walk(join(ROOT, dir))) {
      if (!/\.tsx?$/.test(file) || file.includes('.test.')) continue
      const rel = file.replace(ROOT, '').split(sep).join('/')
      if (rel.includes('/admin/')) continue
      const src = stripComments(read(file))
      // Record<SubState, ...> 선언 **직후 블록 안**에 label 이 **문자열 리터럴**로
      // 적혀 있으면 라벨을 따로 쓴 것이다.
      // ★`label: SUB_STATE_LABEL[state]` 처럼 정본을 참조하는 건 정상 —
      //   파일 전체에서 `label:` 을 찾으면 그것까지 잡아 규칙이 과탐지한다
      //   (처음 그렇게 써서 정본을 **쓰는** 두 파일이 걸렸다).
      for (const m of src.matchAll(/Record<\s*SubState\s*,[\s\S]{0,600}?\n\}/g)) {
        if (/\blabel\s*:\s*['"`]/.test(m[0])) {
          offenders.push(`${rel} (Record<SubState, …> 안에 label 을 직접 적었다)`)
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '구독 상태 라벨을 화면에서 따로 적는다 — 같은 구독이 화면마다 다른 이름이 된다. ' +
      'lib/subscription-state 의 SUB_STATE_LABEL 을 쓸 것(색은 따로 골라도 된다). ' +
      offenders.join(' / '),
  )
})

test('규칙47 — 출시 체크리스트의 크론 표가 vercel.json 과 일치한다', () => {
  /**
   * # 왜
   * 2026-08-08 크론 감사. LAUNCH_CHECKLIST.md 의 크론 표가 통째로 옛것이었다:
   *  · 존재하지 않는 크론 5개(birthday-coupons·restock-alerts·review-prompts·
   *    cart-recovery·coupon-expiry)
   *  · subscription-charge 를 04:00 KST 라 적음 (실제 09:10)
   *  · "총 10 cron" (실제 29개)
   *
   * 출시 점검을 이 표대로 하면 **엉뚱한 걸 확인하게 된다** — 체크리스트가
   * 있다는 사실이 오히려 안심시킨다. 문서는 코드처럼 낡는다.
   *
   * 표의 서식까지 검사하진 않는다(그러면 문서를 못 고친다).
   * **경로 집합이 같은지**만 본다 — 없는 크론을 적거나, 있는 크론을 빠뜨리면
   * 빨간불.
   */
  const checklist = read(join(ROOT, 'LAUNCH_CHECKLIST.md'))
  const vercel = JSON.parse(read(join(ROOT, 'vercel.json'))) as {
    crons: Array<{ path: string }>
  }
  const real = new Set(vercel.crons.map((c) => c.path))

  // 체크리스트 안에서 언급된 크론 경로 전부.
  const mentioned = new Set<string>()
  for (const m of checklist.matchAll(/\/api\/cron\/[a-z0-9-]+/g)) {
    mentioned.add(m[0])
  }
  // 와일드카드 표기(/api/cron/*)는 경로가 아니다.
  mentioned.delete('/api/cron/')

  const ghosts = [...mentioned].filter((p) => !real.has(p)).sort()
  const missing = [...real].filter((p) => !mentioned.has(p)).sort()

  assert.deepEqual(
    { ghosts, missing },
    { ghosts: [], missing: [] },
    'LAUNCH_CHECKLIST.md 의 크론 표가 vercel.json 과 다르다 — ' +
      '없는 크론을 적었거나(ghosts) 있는 크론을 빠뜨렸다(missing). ' +
      '이 표대로 출시 점검하면 엉뚱한 걸 확인한다.',
  )
})

test('규칙48 — 빌링키 값을 브라우저로 내보내지 않는다', () => {
  /**
   * # 왜
   * 2026-08-08 보안 재감사. 구독을 조회하는 화면 **네 곳**이 `select('*')` 를
   * 썼다. 그중 `app/admin/subscriptions/page.tsx` 는 `'use client'` 라
   * **전 고객의 `billing_key`·`billing_customer_key` 가 어드민 브라우저의
   * 네트워크 응답과 메모리에 통째로 올라갔다.** 어드민 기기 침해·악성 확장·
   * XSS 하나면 전 고객 결제 자격증명이 한 번에 나간다.
   *
   * 그런데 그 화면들이 실제로 쓰는 건 전부 `!!billing_key` — 등록 여부
   * 불리언 하나다. 값이 필요 없다.
   *
   * 20260808000100 이 PostgREST 계산 컬럼 `has_billing_key` 를 만들었다.
   * 새 코드는 그걸 쓴다.
   *
   * # 이 규칙이 막는 두 가지
   *  ① `subscriptions` 를 `select('*')` — 별표는 앞으로 추가될 칸까지 전부
   *    내보낸다. 지금 안전해도 다음 마이그레이션에서 새는 구조다.
   *  ② select 문자열에 `billing_key` 를 명시적으로 넣는 것.
   *
   * # 제외
   *  · 서버 전용 경로(app/api/**, lib/**) — 청구·카드등록은 실제 키가 필요하다.
   *  · 마이그레이션·테스트.
   */
  const offenders: string[] = []
  for (const dir of ['app', 'components']) {
    for (const file of walk(join(ROOT, dir))) {
      if (!/\.tsx?$/.test(file) || file.includes('.test.')) continue
      const rel = file.replace(ROOT, '').split(sep).join('/')
      // 서버 전용 라우트는 실제 키를 다뤄야 한다.
      if (rel.startsWith('/app/api/')) continue
      const src = stripComments(read(file))
      if (!/\.from\(\s*['"]subscriptions['"]/.test(src)) continue

      // ① 별표 select
      if (
        /\.from\(\s*['"]subscriptions['"]\s*\)[\s\S]{0,200}?\.select\(\s*['"`]\s*\*/.test(
          src,
        )
      ) {
        offenders.push(`${rel} (subscriptions 를 select('*') 로 조회)`)
      }
      // ② `.select(...)` **안에** billing_key 를 명시한 것.
      //
      // ★필터는 값을 내보내지 않는다 — 처음엔 파일 전체에서 문자열을 찾게
      //  써서 `.not('billing_key','is',null)` · `.is('billing_key', null)` ·
      //  `.or('billing_key.not.is.null,…')` 같은 **조회 조건**까지 잡았다.
      //  그건 "카드가 있는 구독만 세라"는 뜻이지 키를 내려보내는 게 아니다.
      //  select 인자 영역만 본다.
      for (const m of src.matchAll(/\.select\(([\s\S]{0,600}?)\)\s*(?:\.|;|$)/g)) {
        const arg = m[1] ?? ''
        if (!/\bbilling_key\b/.test(arg)) continue
        // requires_billing_key_renewal · has_billing_key 는 키 값이 아니다.
        const stripped = arg
          .replace(/requires_billing_key_renewal/g, '')
          .replace(/has_billing_key/g, '')
        if (!/\bbilling_key\b/.test(stripped)) continue
        offenders.push(`${rel} (select 에 billing_key)`)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '빌링키 값이 브라우저로 나간다 — 결제 자격증명이고, 화면이 쓰는 건 ' +
      '등록 여부뿐이다. has_billing_key 계산 컬럼(20260808000100)을 쓸 것. ' +
      offenders.join(' / '),
  )
})

test('규칙49 — .or() 에 정화 안 한 사용자 입력을 넣지 않는다', () => {
  /**
   * # 왜
   * 2026-08-08 보안 재감사. supabase-js 는 `.ilike(col, value)` 의 **값 인자만**
   * escape 한다. `.or('email.ilike.%x%,name.ilike.%x%')` 는 **표현식 문자열**
   * 이라 그대로 파서에 들어간다 — 입력에 `,` `(` `)` `.` 가 있으면 **필터 절이
   * 주입**된다.
   *
   * 저장소가 이미 다섯 곳에서 정화하고 있었는데 두 곳만 빠져 있었다
   * (`app/admin/users` 완전 미escape, `app/admin/search-all` 은 LIKE
   * 와일드카드만). 정본은 `lib/supabase/or-filter` 의 `safeOrTerm()`.
   *
   * # 판정
   * `.or(...)` 인자 안에 **템플릿 보간(`${...}`)** 이 있는데 그 안에
   * `safeOrTerm` 이 없으면 위반. 서버가 만든 값(날짜·상수)도 보간이지만,
   * 그건 변수명으로 구분할 수 없으므로 **화이트리스트**로 명시한다 —
   * 화이트리스트에 없는 새 보간이 생기면 사람이 한 번 보게 하는 게 목적이다.
   */
  /**
   * 판정 방식 — **파일이 정본(safeOrTerm)을 쓰는가**.
   *
   * 처음엔 보간 변수명을 화이트리스트로 적었는데(`safeQ`·`like`·`escaped`…),
   * 그러면 이름을 바꾸는 순간 규칙이 오탐하고 **이미 정화된 코드까지** 잡는다
   * (실제로 그렇게 써서 정화하고 있던 세 파일이 걸렸다).
   *
   * 그래서 "이 파일의 `.or()` 에 보간이 있으면 그 파일이 safeOrTerm 을
   * import 하고 있어야 한다" 로 판정한다. 정화 방식이 갈리는 것 자체가
   * 이번 사고의 원인이었으므로(다섯 곳이 각자 다른 정규식), 정본 사용을
   * 강제하는 게 규칙의 목적에 맞는다.
   *
   * 서버가 만든 값만 보간하는 파일은 예외로 명시한다 — 사용자 입력이 아니다.
   */
  const SERVER_VALUE_ONLY = [
    '/app/admin/automation/page.tsx', // applied_from 날짜(서버 계산)
    '/app/api/cron/personalization-progression/route.ts',
    '/app/admin/personalization/picking-list/page.tsx', // 정규식 검증된 날짜
    '/app/api/cron/order-expire/route.ts',
    '/app/api/cron/subscription-charge/route.ts',
  ]
  const offenders: string[] = []
  for (const dir of ['app', 'lib', 'components']) {
    for (const file of walk(join(ROOT, dir))) {
      if (!/\.tsx?$/.test(file) || file.includes('.test.')) continue
      const rel = file.replace(ROOT, '').split(sep).join('/')
      if (SERVER_VALUE_ONLY.includes(rel)) continue
      const src = stripComments(read(file))
      const usesCanonical = /safeOrTerm/.test(src)
      for (const m of src.matchAll(/\.or\(\s*`([^`]*)`/g)) {
        const expr = m[1] ?? ''
        if (!expr.includes('${')) continue
        if (usesCanonical) continue
        offenders.push(`${rel} (${expr.slice(0, 70)})`)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '.or() 표현식에 정화 안 한 보간이 있다 — supabase-js 는 표현식 문자열을 ' +
      'escape 하지 않는다. lib/supabase/or-filter 의 safeOrTerm() 을 쓸 것. ' +
      offenders.join(' / '),
  )
})

test('규칙50 — SW 는 개인 정보 페이지 HTML 을 캐시하지 않는다', () => {
  /**
   * 2026-08-08 네이티브 감사. sw.js 의 AUTH_PATH_PREFIXES 는 "캐시 대신 매번
   * 네트워크"로 갈 개인 페이지 목록인데, /account(구독 금액·주소)·
   * /subscribe(결제수단)·/notifications(알림함)·/reports(건강 리포트)·
   * /chat(상담)이 빠져 있었다 — 공유 폰에서 옛 사용자의 화면이 새 사용자에게
   * 그대로 보일 수 있는 목록이다.
   *
   * # 판정
   * public/sw.js 의 AUTH_PATH_PREFIXES 배열 리터럴에 알려진 개인 라우트
   * 그룹이 전부 들어 있는지 확인한다. 새 개인 라우트 그룹을 만들면 이
   * 목록에도 추가하고 sw.js 에도 추가할 것 — 한쪽만 하면 이 테스트가 잡는다.
   */
  /**
   * ★주석을 먼저 걷어낸다 (2026-08-14 — 이 규칙의 카나리아가 잡아냈다).
   *
   * 목록에 항목을 추가하고 "빼면 빨간불이 뜨나" 검산하려고 그 줄을 **주석
   * 처리**했는데 규칙은 그대로 초록이었다. 따옴표만 보고 세는 바람에
   * `// '/start/done',` 도 "있다"로 셌기 때문이다. 즉 누가 항목을 지우는 대신
   * 주석 처리하면 이 규칙은 아무 말도 안 한다 — 이 파일이 stripComments 를
   * 만든 이유(규칙20)와 같은 병이 여기 남아 있었다.
   */
  const sw = stripComments(read(join(ROOT, 'public', 'sw.js')))
  const m = sw.match(/const AUTH_PATH_PREFIXES = \[([\s\S]*?)\]/)
  assert.ok(m, 'public/sw.js 에 AUTH_PATH_PREFIXES 배열이 있어야 한다')
  const listed = [...(m![1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1])
  const REQUIRED = [
    '/dashboard',
    '/mypage',
    '/dogs',
    '/cart',
    '/checkout',
    '/survey',
    '/admin',
    '/account',
    '/subscribe',
    '/notifications',
    '/reports',
    '/chat',
    // 2026-08-14 4라운드 감사 — 퍼널 끝 두 곳. sw.js 목록엔 있는데 여기엔 없던
    // '/vet/' 비대칭도 같이 정리했다(한쪽에만 있으면 지우는 회귀를 못 잡는다).
    '/vet/',
    '/start/done',
    '/photo-upload',
  ]
  const missing = REQUIRED.filter((p) => !listed.includes(p))
  assert.deepEqual(
    missing,
    [],
    'sw.js AUTH_PATH_PREFIXES 에 개인 페이지 프리픽스가 빠졌다(공유 폰에서 ' +
      '옛 사용자 HTML 노출): ' + missing.join(', '),
  )
})

test('규칙51 — 라벨 kcal 이 알고리즘 정본과 어긋나면 인쇄 경고가 뜬다', () => {
  /**
   * # 왜 (2026-08-12 4라운드 감사)
   * 프로덕션 products.nutrition_facts 의 kcal(오리150·흑돼지140·한우160)이 코드
   * 정본 skuModel v4.0(125·125·145)과 최대 20% 어긋나 있었다. 그 DB 값이 라벨의
   * **대사에너지**와 **급여표**에 그대로 인쇄되므로, 봉투는 '오리 246g' 인데 앱은
   * 같은 강아지에게 ~302g 을 지시하는 상태가 된다.
   *
   * 값 자체는 여기서 못 고친다 — 보장분석·kcal·급여표가 한 세트라, 실측 결과로
   * 한 커밋에 함께 갱신하는 것이 사장님 결정이다(성분 의뢰검사 대기).
   * 그래서 **틀린 라벨이 인쇄되는 것**만 막는다: 라벨 화면이 코드 정본과 대조해
   * 경고를 띄우는지 확인한다. 이 가드가 사라지면 조용히 인쇄될 수 있다.
   */
  const src = read(join(ROOT, 'app/admin/label/[sku]/page.tsx'))
  assert.match(
    src,
    /SKU_MODEL/,
    '라벨 페이지가 알고리즘 정본(skuModel)을 참조하지 않는다 — DB kcal 이 틀려도 ' +
      '그대로 인쇄된다',
  )
  assert.match(
    src,
    /인쇄하지 마세요/,
    'kcal 불일치 시 인쇄를 막는 경고 문구가 없다',
  )
})

test('규칙52 — 크론이 아무도 안 쓰는 컬럼에 걸려 조용히 0건이 되지 않는다', () => {
  /**
   * # 왜 (2026-08-14 4라운드 감사)
   * protein-rotation 이 `subscriptions.last_delivery_date` 로 대상을 걸렀는데,
   * 그 컬럼은 **저장소 전체에서 쓰기가 0건**이었다(화면 3곳이 select 만 했고,
   * 프로덕션 pg_proc 전수 조회에도 이 컬럼을 건드리는 함수·트리거가 없다).
   * 구독 9행 전부 NULL 이고, PostgREST 의 `gte` 는 NULL 행을 배제하므로
   * **후보가 언제나 0행**이었다. 그런데 그건 "대상 없음"과 모양이 같아서
   * 크론은 매주 초록이었다 — cron_health 6회 실행 전부 status='success'.
   *
   * 규칙1(오류 ≠ 빈 결과)의 사촌이다. 거기선 실패가 0건으로 접혔고, 여기선
   * **조건 자체가 영원히 거짓**이라 실패라는 사건이 아예 안 생긴다. 오류
   * 처리를 아무리 잘해도 안 잡힌다.
   *
   * # 판정
   * app/api/cron/**\/route.ts 의 날짜 필터(`.gte/.gt/.lte/.lt('*_at'|'*_date')`)를
   * 모으고, 각 컬럼에 **쓰는 곳이 하나라도 있는지** 확인한다. 인정하는 증거:
   *   · TS 객체 리터럴 대입   `col: 값`      (타입 선언 `col: string` 은 제외)
   *   · TS 프로퍼티 대입      `.col = 값`    (admin 주문 상태 변경이 이 형태)
   *   · SQL DEFAULT now()     (INSERT 시 DB 가 채운다)
   *   · SQL `set col =` / `NEW.col :=` (트리거·함수)
   *
   * 실측 검산: 이 규칙을 만든 시점의 크론 필터 컬럼 13개는 전부 통과하고,
   * 고장난 last_delivery_date 하나만 걸린다(초록/빨강 양쪽 확인).
   */
  const cronDir = join(ROOT, 'app', 'api', 'cron')
  const cronFiles = walk(cronDir).filter((p) => p.endsWith(`${sep}route.ts`))
  assert.ok(cronFiles.length > 5, `크론 route 를 못 찾았다(${cronFiles.length}개)`)

  // 크론이 날짜 컬럼으로 거는 필터를 모은다 (컬럼 → 그렇게 거는 파일들).
  const gates = new Map<string, string[]>()
  for (const f of cronFiles) {
    const src = stripComments(read(f))
    for (const m of src.matchAll(
      /\.(?:gte|gt|lte|lt)\(\s*'([a-z_]+(?:_at|_date))'/g,
    )) {
      const col = m[1]!
      gates.set(col, [...(gates.get(col) ?? []), f.slice(ROOT.length + 1)])
    }
  }
  assert.ok(gates.size > 5, `날짜 게이트를 못 찾았다(${gates.size}개) — 정규식이 썩었나`)

  // 저장소 전체 소스 (쓰기 증거 탐색용).
  const tsSrc = walk(ROOT)
    .map((p) => read(p))
    .join('\n')
  const sqlDir = join(ROOT, 'supabase')
  const sqlFiles: string[] = []
  const collectSql = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) collectSql(p)
      else if (name.endsWith('.sql')) sqlFiles.push(p)
    }
  }
  collectSql(sqlDir)
  const sqlSrc = sqlFiles.map((p) => read(p)).join('\n')

  const unwritten: string[] = []
  for (const [col, files] of gates) {
    /**
     * ⚠️ 정규식은 **String.raw** 로 쓴다. 일반 템플릿 리터럴에 `\s`·`\b` 를
     * 넣으면 TS 가 먼저 이스케이프로 먹어 `s`·백스페이스 문자가 된다 —
     * 그러면 규칙은 조용히 **아무것도 안 맞히고 전부 위반으로 보고**한다.
     * (이 규칙을 쓰다 실제로 밟았다. 셸 heredoc 이 `\\` 를 한 겹 벗겨서
     *  reference_shell_backslash_trap 과 같은 자리로 굴러떨어졌다.)
     * 백틱은 `\x60` 으로 넣는다 — String.raw 안에서는 `` \` `` 가 백슬래시를
     * 남겨 문자 클래스를 망친다.
     */
    const hasWriter =
      // `col: 값` — 타입 선언(`col: string | null`)은 부정 전방탐색으로 뺀다.
      new RegExp(
        String.raw`\b${col}\s*:\s*(?!(?:string|number|boolean|Date|unknown|any|null)\b)[A-Za-z_$'"\x60\[{(]`,
      ).test(tsSrc) ||
      // `.col = 값` (대입). `==`/`===` 비교는 뒤 문자로 배제.
      new RegExp(String.raw`\.${col}\s*=[^=]`).test(tsSrc) ||
      // DB DEFAULT now() — INSERT 때 DB 가 채운다.
      new RegExp(
        String.raw`\b${col}\b[^,;]{0,120}?\bdefault\s+(?:now\(\)|current_)`,
        'i',
      ).test(sqlSrc) ||
      // 트리거·함수의 쓰기.
      new RegExp(String.raw`\bset\b[^;]{0,400}?\b${col}\s*=`, 'is').test(sqlSrc) ||
      new RegExp(String.raw`\bNEW\.${col}\s*:?=`, 'i').test(sqlSrc)
    if (!hasWriter) unwritten.push(`${col} (${files.join(', ')})`)
  }

  assert.deepEqual(
    unwritten,
    [],
    '크론이 **아무도 쓰지 않는 컬럼**으로 대상을 거르고 있다 — 조건이 영원히 ' +
      '거짓이라 "대상 없음"으로 접혀 크론은 계속 초록이다:\n  ' +
      unwritten.join('\n  '),
  )
})

test('규칙53 — 로그인 화면이 비로그인 설문 퍼널(/start)로 보내지 않는다', () => {
  /**
   * # 왜 (2026-08-16 4라운드 감사)
   * /start 는 **비로그인 설문 → 결과 직전 가입** 퍼널이다. 이미 로그인한
   * 고객을 거기로 보내면: 설문을 처음부터 다 하고, 마지막에 /start/claim 이
   * "이미 강아지 있음"으로 판정해 **초안을 삭제**하고 홈으로 보낸다 —
   * 설문을 다 해도 결과가 사라지는 순환이다.
   *
   * 이 금지는 주석으로 **세 번** 명문화돼 있었다(mypage/orders ·
   * account/dogs · (main)/not-found). 그런데도 웹 구독 신청 실패 화면
   * (account/subscribe/EnsureFormula)의 유일한 CTA 가 /start 였다 —
   * 문서는 같은 날에도 어겨진다. 규칙은 테스트로만 산다.
   *
   * # 판정
   * 로그인 전제 라우트 그룹(app/account · app/(main) · app/mypage)의 소스에서
   * /start 정확 일치 링크·네비게이션을 금지한다. /start/claim 등 하위 경로는
   * 별개 판단이라 정확 일치만 본다. 주석은 stripComments 로 걷는다.
   */
  const AUTHED_DIRS = ['app/account', 'app/(main)', 'app/mypage']
  const offenders: string[] = []
  for (const dir of AUTHED_DIRS) {
    for (const f of walk(join(ROOT, dir))) {
      const src = stripComments(read(f))
      // href="/start" · href={'/start'} · href={`/start`} · push('/start') ·
      // replace("/start") — 뒤에 경로가 더 붙는 /start/... 는 제외(부정 전방탐색).
      const re = /(?:href=\{?|push\(|replace\()\s*['"`]\/start['"`?]/g
      if (re.test(src)) offenders.push(f.slice(ROOT.length + 1))
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '로그인 전제 화면이 비로그인 설문 퍼널(/start)로 보낸다 — 설문을 다 해도 ' +
      'claim 이 초안을 삭제하는 순환이 된다: ' + offenders.join(', '),
  )
})

test('규칙54 — 결제 웹훅이 결제↔주문 결합을 토스 재조회 orderId 로 검증한다', () => {
  /**
   * # 왜 (2026-08-19 5라운드 감사)
   * 웹훅은 body 의 orderId 로 주문을 찾고 토스 재조회로는 paymentKey 만
   * 대조했다 — "이 결제가 이 주문의 결제인가"(결합)는 아무도 안 봤다.
   * body.orderId 는 공격자가 쓰는 값이라, 같은 금액 주문 2개를 만들고 자기
   * paymentKey 로 두 번째 주문에 웹훅을 위조하면 결제 1회에 박스 2개가 나갔다.
   * 토스 재조회 응답의 payment.orderId(paymentKey 에 묶여 위조 불가)를 조회된
   * 주문과 대조해야 결합이 증명된다.
   *
   * # 판정
   * webhook 라우트가 payment.orderId 를 order.order_number(또는 UUID 폴백
   * order.id)와 대조하고, 불일치 시 상태 전이(switch) 전에 bail 하는지 확인한다.
   */
  const src = stripComments(read(join(ROOT, 'app/api/payments/webhook/route.ts')))
  assert.match(
    src,
    /payment\.orderId\s*!==\s*order\.order_number/,
    '웹훅이 토스 재조회 orderId 를 주문번호와 대조하지 않는다 — 결합 위조 가능',
  )
  // 대조가 amount check·switch 보다 앞에 있어야 위조가 상태를 못 바꾼다.
  const guardAt = src.indexOf('payment.orderId !== order.order_number')
  const switchAt = src.indexOf('switch (payment.status)')
  assert.ok(
    guardAt > 0 && guardAt < switchAt,
    '결합 검증이 상태 전이(switch) 뒤에 있다 — 위조가 이미 반영된 뒤라 늦다',
  )
})

test('규칙55 — 결제 웹훅 DONE 이 종결 상태(취소·실패)를 조용히 덮지 않는다', () => {
  /**
   * # 왜 (2026-08-19 5라운드 감사)
   * DONE 분기는 `.eq('id')` 만으로 무조건 paid 로 UPDATE 해, 그 사이 주문이
   * cancelled/failed 로 바뀌어도(예: order-expire 오만료) 덮어썼다 — 취소
   * 분기(:401)는 `.eq('payment_status', ...)` 0-row 가드가 있는데 비대칭이었다.
   * 결과: payment_status='paid' + order_status='cancelled' 로 굳어 발송 없는
   * 과금이 된다. 종결 상태는 사람이 봐야 하므로(환불/복구 판단) 조용히 덮지
   * 않고 fatal 로 남긴다.
   *
   * # 판정
   * DONE 분기에 종결 상태 차단(done_on_terminal 이벤트) + UPDATE 의 원자
   * payment_status 가드가 둘 다 있는지 확인한다.
   */
  const src = stripComments(read(join(ROOT, 'app/api/payments/webhook/route.ts')))
  assert.match(
    src,
    /order\.webhook\.done_on_terminal/,
    'DONE 분기에 종결-상태 충돌 알림이 없다 — 취소/실패를 조용히 paid 로 덮는다',
  )
  // DONE UPDATE 에도 원자 가드(.eq payment_status)가 있어야 한다. 취소 분기에
  // 이미 하나 있으므로 2개 이상이면 DONE 에도 추가된 것.
  const guards = [...src.matchAll(/\.eq\(\s*'payment_status'\s*,\s*order\.payment_status\s*\)/g)]
  assert.ok(
    guards.length >= 2,
    `payment_status 원자 가드가 ${guards.length}개 — DONE·취소 양쪽에 있어야 한다(≥2)`,
  )
})

test('규칙56 — 청구 크론이 TOSS_SECRET_KEY 부재를 고객 실패로 오분류하지 않는다', () => {
  /**
   * # 왜 (2026-08-19 5라운드 감사)
   * TOSS_SECRET_MISSING 은 permanent/transient 목록에 없어 'unknown' 으로
   * 분류돼 3-strike 를 탄다 — 키 오타 하나로 카드에 문제 없는 고객 전원의
   * failed_charge_count 가 오르고 3일이면 일시정지된다. 한 명이라도 건드리기
   * 전에 크론 시작에서 끊어야 한다(500 → 크론 빨간불, 고객 무손상).
   */
  const src = stripComments(
    read(join(ROOT, 'app/api/cron/subscription-charge/route.ts')),
  )
  // keyMode 기반 프리플라이트 — 부재(missing)뿐 아니라 형식 오류(unknown)까지
  // 첫 구독 전에 끊어야 한다. process.env.TOSS_SECRET_KEY 를 keyMode 에 통과시키고
  // missing/unknown 을 막는지 확인.
  assert.match(
    src,
    /keyMode\(process\.env\.TOSS_SECRET_KEY\)/,
    '청구 크론이 keyMode 로 프리플라이트하지 않는다 — 키 오타/부재 시 정상 고객 전원 3-strike',
  )
  assert.match(
    src,
    /secretMode === 'missing' \|\| secretMode === 'unknown'/,
    '프리플라이트가 부재(missing)만 막고 형식 오류(unknown)를 통과시킨다 — 오타 키가 3-strike 를 탄다',
  )
})

test('규칙57 — 모든 CSV export 가 정본 lib/csv 를 거친다 (수식 인젝션 방어)', () => {
  /**
   * # 왜 (2026-08-19 5라운드 감사)
   * lib/csv 의 escapeCell 은 OWASP CSV 수식 인젝션(선두 =,+,-,@,탭,CR)을 막는데,
   * 피킹리스트 export 만 이 헬퍼를 안 쓰고 자체 직렬화라 뚫려 있었다. 배송메모·
   * 강아지이름·수령인이 전부 고객 자유텍스트라, 고객이 `=IMPORTXML(...)` 를
   * 저장하면 사장님이 화요일 피킹리스트를 열 때 수식이 실행돼 인접 셀(다른 고객
   * PII)을 유출·피싱할 수 있었다.
   *
   * # 판정
   * CSV 를 만드는 클라이언트/서버 파일(Blob type text/csv 또는 .csv 다운로드)이
   * 자체 이스케이프(`replace(/"/g,'""')`)를 직접 쓰지 않고 lib/csv 를 import 하는지
   * 확인한다. 자체 직렬화 흔적이 있으면서 lib/csv 를 안 쓰는 파일을 잡는다.
   */
  const offenders: string[] = []
  for (const f of walk(ROOT)) {
    const rel = f.slice(ROOT.length + 1)
    const src = stripComments(read(f))
    // CSV 를 실제로 만드는 파일만 대상: text/csv Blob 또는 .csv 다운로드.
    const makesCsv =
      /text\/csv/.test(src) || /\.csv['"`]/.test(src) || /toCsvWithBom|toCsv\(/.test(src)
    if (!makesCsv) continue
    // lib/csv 자신은 제외. (경로 구분자 정규화 — split/join 으로 백슬래시 회피)
    if (rel.split(sep).join('/').endsWith('lib/csv.ts')) continue
    const usesCanonical = /from ['"]@\/lib\/csv['"]/.test(src)
    // 자체 직렬화 흔적: 손수 따옴표 이스케이프.
    const handRolled = /replace\(\/"\/g,\s*['"]""['"]\)/.test(src)
    if (!usesCanonical && (handRolled || /text\/csv/.test(src))) {
      offenders.push(rel)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'CSV export 가 정본 lib/csv 를 안 거친다 — 수식 인젝션 방어 누락 가능:\n  ' +
      offenders.join('\n  '),
  )
})

test('규칙58: 앱/웹 판정은 isAppRequest 정본을 거치고, UA 표식은 한 값이다', () => {
  /**
   * # 왜 (2026-08-22 — 사장님: "지금 그냥 웹으로 들어가지는데?")
   *
   * proxy.ts 의 세 게이트가 각자 `request.cookies.get('ft_app')` 를 직접
   * 읽었다. 네이티브 앱의 **첫 요청에는 쿠키가 없어서** 셋 다 어긋났다:
   * 첫 화면이 웹으로 렌더되고, 로그인돼 있어도 / → /dashboard 가 안 되고,
   * 앱 전용 라우트로 콜드 스타트하면 "앱을 설치하세요" 벽이 앱 안에서 떴다.
   *
   * 판정을 lib/app-context-request 로 모았으니, 직접 읽기가 다시 생기면
   * 조용히 갈라진다. 그리고 UA 표식은 capacitor.config.ts 와 lib 양쪽에
   * 값이 **복제**돼 있다(Capacitor CLI 가 @/ 별칭을 못 쓴다) — 복제는
   * 갈라지므로 여기서 일치를 강제한다.
   */
  const marker = read(join(ROOT, 'lib', 'app-context-request.ts')).match(
    /APP_USER_AGENT_MARKER\s*=\s*['"]([^'"]+)['"]/,
  )?.[1]
  assert.ok(marker, 'lib/app-context-request.ts 에서 APP_USER_AGENT_MARKER 를 못 찾았다')

  const capCfg = read(join(ROOT, 'capacitor.config.ts'))
  const appended = capCfg.match(/appendUserAgent:\s*['"]([^'"]+)['"]/)?.[1]
  assert.ok(appended, 'capacitor.config.ts 에 appendUserAgent 가 없다 — 네이티브 첫 요청이 웹으로 렌더된다')
  assert.equal(
    appended,
    marker,
    `UA 표식이 갈라졌다: capacitor.config.ts="${appended}" vs lib="${marker}". ` +
      '둘이 다르면 서버가 앱을 못 알아본다.',
  )

  // proxy.ts 는 ft_app 쿠키를 직접 읽지 않는다 (fromApp → isAppRequest 경유).
  const proxySrc = stripComments(read(join(ROOT, 'proxy.ts')))
  const direct = proxySrc.match(/cookies\.get\(\s*['"]ft_app['"]\s*\)/g) ?? []
  assert.equal(
    direct.length,
    1,
    `proxy.ts 가 ft_app 쿠키를 ${direct.length}곳에서 직접 읽는다 — fromApp() 하나만 읽어야 한다 ` +
      '(직접 읽으면 UA 표식을 놓쳐 네이티브 첫 요청이 웹으로 새어나간다)',
  )

  // ★저장소 전체 — .get('ft_app') 직접 읽기는 정본 두 파일 밖에선 금지.
  //
  // 처음엔 proxy.ts 만 검사했다. 그 좁은 범위가 바로 사고가 된 경로다:
  // proxy 는 고쳐서 라우팅은 통과되는데 **AuthAwareShell 이 여전히 쿠키만
  // 읽어서** v2 앱에서도 화면이 웹으로 떴다(사장님이 두 번째로 재현).
  // "판정을 정본으로 모았다"는 주장 자체를 저장소 전체에서 강제해야 한다.
  const FT_APP_READ_ALLOWED = new Set(['proxy.ts', 'lib/app-context.ts'])
  const readOffenders: string[] = []
  for (const f of walk(ROOT)) {
    const rel = f.slice(ROOT.length + 1).split(sep).join('/')
    if (FT_APP_READ_ALLOWED.has(rel)) continue
    const src = stripComments(read(f))
    if (/\.get\(\s*['"]ft_app['"]\s*\)/.test(src)) readOffenders.push(rel)
  }
  assert.deepEqual(
    readOffenders,
    [],
    'ft_app 쿠키를 직접 읽어 앱/웹을 판정하는 파일 — isAppContextServer()/isAppRequest 정본을 거쳐야 한다 ' +
      '(직접 읽으면 UA 표식을 놓쳐 네이티브 첫 화면이 웹으로 렌더된다):\n  ' +
      readOffenders.join('\n  '),
  )
})

test('규칙59: useIsStandalone 은 lib/standalone 정본에 위임한다 (복제 금지)', () => {
  /**
   * # 왜 (2026-08-22 — "앱인데 웹이 뜬다"의 마지막 조각)
   * lib/standalone.ts 는 2026-08-08 "Capacitor WebView 도 설치된 앱" 수정을
   * 받았는데, hooks/useIsStandalone.ts 가 같은 로직을 **복제**하면서 그 수정이
   * 빠졌다. 그래서 네이티브 첫 실행이 브라우저 방문으로 판정돼 OnboardingGate
   * 가 /welcome 으로 보내지 않았다. 훅은 정본을 import 해서 써야 한다 —
   * 정본이 고쳐지면 훅도 같이 고쳐지도록.
   */
  const src = stripComments(read(join(ROOT, 'hooks', 'useIsStandalone.ts')))
  assert.ok(
    /from ['"]@\/lib\/standalone['"]/.test(src),
    'hooks/useIsStandalone.ts 가 lib/standalone 정본을 import 하지 않는다',
  )
  assert.ok(
    /isStandaloneApp\(\)/.test(src),
    'hooks/useIsStandalone.ts 의 판정이 isStandaloneApp() 을 호출하지 않는다',
  )
  // 판정 로직 복제의 특징 신호: read 경로에서 navigator.standalone 을 직접 본다.
  assert.ok(
    !/navigator as Navigator & \{ standalone/.test(src),
    'hooks/useIsStandalone.ts 가 판정 로직을 다시 복제했다 — 정본에 위임할 것',
  )
})

test('규칙60: daum.Postcode 생성은 AddressSearchSheet 정본 한 곳에서만', () => {
  /**
   * # 왜 (2026-08-23 — 주소검색 5번 왕복의 원인)
   * 같은 주소검색이 공용 컴포넌트와 주문 화면(OrderClient)에 **두 벌** 있었다.
   * 앱에서 불능이라는 제보에 공용 쪽만 세 번 고쳤는데, 사장님이 밟는 화면은
   * 복제본이라 무엇을 고쳐도 증상이 그대로였다. 팝업(.open())은 WebView 에서
   * 구조적으로 불능(에뮬레이터 재현: "팝업을 열 수 없습니다")이므로, 위젯
   * 생성을 정본 한 파일로 강제한다 — 복제본이 다시 생기면 여기서 빨간불.
   */
  const CANON = 'components/AddressSearchSheet.tsx'
  const offenders: string[] = []
  for (const f of walk(ROOT)) {
    const rel = f.slice(ROOT.length + 1).split(sep).join('/')
    if (rel === CANON) continue
    const src = stripComments(read(f))
    if (/daum\s*\.\s*Postcode\s*\(|daum\.Postcode\b/.test(src) && /new\b/.test(src) && /Postcode\s*\(/.test(src)) {
      // 생성 흔적: new ...daum.Postcode( — 타입 선언·주석은 stripComments 로 제외됨
      if (/new[^;]{0,120}Postcode\s*\(/.test(src)) offenders.push(rel)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'daum.Postcode 를 정본 밖에서 생성한다 — 앱에서 주소검색이 조용히 죽는 복제 경로:\n  ' +
      offenders.join('\n  '),
  )
})

test('규칙61: adaptive 아이콘 레이어는 108dp 규격 크기 (생성기 버그 우회 검증)', async () => {
  /**
   * @capacitor/assets 가 adaptive foreground 를 레거시 48dp 크기로 뽑는 버그가
   * 있다 — xxxhdpi 가 432px 여야 하는데 192px 로 나와, 기기가 2.25배 확대해
   * 그리며 **모든 기기에서 아이콘이 흐릿**했다(2026-08-23, 사장님 3회 재현 끝에
   * 실측 확정). 아이콘은 scripts/gen-android-icons.mjs 로만 생성한다.
   * 누군가 cap:assets 를 다시 돌리면 이 테스트가 즉시 빨간불을 낸다.
   */
  const sharp = (await import('sharp')).default
  const expect: Record<string, number> = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 }
  const wrong: string[] = []
  for (const [d, px] of Object.entries(expect)) {
    const f = join(ROOT, 'android', 'app', 'src', 'main', 'res', `mipmap-${d}`, 'ic_launcher_foreground.png')
    const m = await sharp(f).metadata()
    if (m.width !== px || m.height !== px) wrong.push(`${d}: ${m.width}px (규격 ${px}px)`)
  }
  assert.deepEqual(wrong, [], 'adaptive foreground 크기가 규격 미달 — cap:assets 를 아이콘에 돌렸는가?\n  ' + wrong.join('\n  '))
})

test('★ 규칙62: /start 는 익명 전용 퍼널 — 로그인 사용자는 planHref 로 돌려보낸다', () => {
  /**
   * # 왜 (사장님 제보 2026-08-24)
   * 로그인하고 강아지까지 있는 계정으로 /start 에 들어갔더니 "새로 오셨어요?
   * 가입은 나중에 해도 괜찮아요" 가 떴다. 이 퍼널의 끝은 **가입 폼**이라
   * 로그인 사용자는 끝까지 가도 "이미 가입된 이메일이에요" 에서 막힌다 —
   * 동선 자체가 신규 전용인데 페이지가 로그인 상태를 안 봤다.
   *
   * CTA(planHref)는 이미 로그인 사용자를 /account/dogs·/dogs/new 로 보내지만,
   * 직접 진입(북마크·프로모 QR·뒤로가기)은 CTA 를 안 거친다. 그래서 페이지
   * 서버 컴포넌트가 직접 가드해야 한다. 목적지는 planHref 정본을 그대로 쓴다 —
   * 목적지 삼항을 여기 또 쓰면 규칙21 이 잡던 복제본 병이 도진다.
   */
  const src = stripComments(read(join(ROOT, 'app/start/page.tsx')))
  assert.match(
    src,
    /getSafeUser/,
    '/start 페이지가 로그인 상태를 읽지 않는다 — 로그인 사용자가 익명 가입 퍼널에 갇힌다',
  )
  assert.match(
    src,
    /redirect\(\s*planHref\(\s*true\s*,\s*isApp\s*\)\s*\)/,
    '/start 로그인 가드가 planHref 정본으로 리다이렉트하지 않는다 — 목적지를 ' +
      '직접 쓰면 앱/웹 경로 분기(규칙21 부류)가 또 갈라진다',
  )
})

test('규칙63: 카카오 네이티브 앱 키는 capacitor.config 와 Info.plist 가 같은 값', () => {
  /**
   * # 왜 (2026-08-26 카카오톡 앱 전환 로그인 도입)
   *
   * 같은 앱 키가 **두 파일에 복제**돼 있다:
   *   · capacitor.config.ts    → 카카오 SDK 초기화용 `app_key`
   *   · ios/App/App/Info.plist → 카카오톡이 앱으로 돌아올 주소 `kakao{앱키}`
   * Capacitor CLI 는 `@/` 별칭을 못 쓰고 Info.plist 는 XML 이라 값을 공유할 수단이
   * 없다 — 규칙58 의 UA 표식과 똑같은 사정이라 똑같이 테스트로 묶는다.
   *
   * 한쪽만 바뀌면 **카카오톡은 열리는데 앱으로 돌아오지 못한다.** 화면은 계속
   * '연결 중…' 이고 오류도 안 뜬다 — 사람이 가장 눈치채기 어려운 형태다.
   * (실제로 2026-08-25 에 audience 불일치로 같은 증상을 한 번 겪었다.)
   */
  const cap = read(join(ROOT, 'capacitor.config.ts'))
  const appKey = cap.match(
    // `[^}]` 는 줄바꿈도 포함하므로 dotAll(s) 플래그가 필요 없다
    // (넣으면 tsconfig target 때문에 TS1501 로 막힌다).
    /CapacitorKakaoLogin:\s*\{[^}]*?app_key:\s*['"]([^'"]+)['"]/,
  )?.[1]
  assert.ok(
    appKey,
    'capacitor.config.ts 에서 CapacitorKakaoLogin.app_key 를 못 찾았다 — ' +
      '카카오 SDK 가 초기화되지 않아 앱 로그인이 통째로 죽는다',
  )

  const plist = read(join(ROOT, 'ios', 'App', 'App', 'Info.plist'))
  const schemes = [...plist.matchAll(/<string>(kakao[0-9a-f]+)<\/string>/g)].map(
    (m) => m[1],
  )
  assert.ok(
    schemes.length > 0,
    'Info.plist 에 kakao URL scheme 이 없다 — 카카오톡이 열려도 앱으로 못 돌아온다',
  )
  assert.ok(
    schemes.includes('kakao' + appKey),
    '카카오 앱 키가 갈라졌다: capacitor.config="' +
      appKey +
      '" 이면 Info.plist 에 "kakao' +
      appKey +
      '" 이 있어야 하는데 실제는 ' +
      JSON.stringify(schemes) +
      ' — 카카오톡에서 앱으로 복귀가 안 된다',
  )
})
