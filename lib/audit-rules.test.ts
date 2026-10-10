import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
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
  // service_role 클라이언트를 **주입받는** 모듈(2026-09-28) — 파일 안에서 만들지 않는다. 대신 호출부가
  // admin 클라이언트를 넘기는지를 아래에서 본다(모듈 → 호출부).
  const INJECTED_ADMIN = new Map([['lib/payments/ambiguous-charges.ts', 'app/api/cron/subscription-charge/route.ts']])
  for (const file of walk(join(ROOT, 'app'))
    .concat(walk(join(ROOT, 'components')))
    .concat(walk(join(ROOT, 'lib')))) {
    const src = read(file)
    if (!src.includes("from('subscriptions')")) continue
    if (INJECTED_ADMIN.has(rel(file))) continue
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
  for (const [mod, caller] of INJECTED_ADMIN) {
    const c = stripComments(read(join(ROOT, ...caller.split('/'))))
    assert.ok(
      c.includes('createAdminClient()') && c.includes(`from '@/${mod.replace(/\.ts$/, '')}'`),
      `${mod}: 호출부(${caller})가 service_role 클라이언트를 넘기지 않는다 — 잠긴 칸 쓰기가 조용히 실패한다`,
    )
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
      at: 'app/api/cron/daily-briefing/route.ts:97',
      why: "'발송했는데 7일째 배송중' 집계 — order_status='shipping' 자체가 결제 완료 이후 상태다 (2026-08-08 미발송 큐에 주석 3줄 추가로 92 이동 · 2026-09-15 Sentry import 한 줄로 93 이동 · 2026-09-24 스케줄 주석 한 줄로 94 이동 · 2026-09-25 구조분해 두 줄(환불 최종실패·크론 실패) 추가로 96 이동 · 2026-09-26 규모 경보 import 한 줄로 97 이동, 다섯 다 같은 집계임을 재확인함)",
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
  // (트랙티브 연동 해제 '/api/integrations/X/disconnect' 가 있었다 — 2026-10-09 결정 18번으로 연동째 지웠다.)
  const API_CALL_ALLOWED: Array<{ at: string; why: string }> = []

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


test('규칙 31 — 고객 문구에 "언제든 해지/일시정지/조정" 과약속 금지', () => {
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
  // ★'조정'도 잡는다(2026-09-25 4차 점검). 사장님 지시 원문이 "해지/일시정지/조정"
  //   인데 정규식엔 앞 둘만 있어서, 체험단 전환 예고 푸시의 "언제든 정기배송 탭에서
  //   조정할 수 있어요"가 초록인 채로 나갔다.
  const BANNED_RE = /언제든지?[\s\S]{0,28}?(해지|일시정지|조정)/
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
    if (rel === '/lib/sentry-scrub.ts') continue // 검증이 아니라 오류 기록 속 번호를 찾아 가리는 검색식(2026-09-26 설정 파일에서 이사)
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
  // ★walk() 는 .ts/.tsx 만 모은다 — CSS 는 따로 걷는다(2026-09-23 카나리아에서 드러남:
  //   CSS 분기를 넣고도 빨간불이 안 났다. "if 안 단언은 썩는다").
  const walkCss = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next' || name === '.git' || name === '.claude') continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walkCss(p, out)
      else if (/\.css$/.test(name)) out.push(p)
    }
    return out
  }
  for (const dir of ['app', 'components', 'lib']) {
    for (const file of [...walk(join(ROOT, dir)), ...walkCss(join(ROOT, dir))]) {
      if (file.includes('.test.')) continue
      const isCss = /\.css$/.test(file)
      if (!isCss && !/\.tsx?$/.test(file)) continue
      const rel = file.replace(ROOT, '').split(sep).join('/')
      const src = stripComments(read(file))
      if (isCss) {
        // ★2026-09-23 점검: 다크를 켜는 가장 쉬운 길은 globals.css 에 주석 처리돼 남아 있는
        //   `@media (prefers-color-scheme: dark)` 를 되살리는 것인데, 이 규칙이 .tsx 만 봐서
        //   그 경우 초록불이 유지됐다. 주석을 벗긴 순간 빨간불이 나야 한다.
        if (/prefers-color-scheme:\s*dark/.test(src)) offenders.push(`${rel} (다크 미디어쿼리가 살아 있다)`)
        continue
      }
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
  // 앞 토큰 = 앱 표식, 뒤 토큰 = 네이티브 셸 세대(FtShell/N, 2026-10-08 — 규칙149).
  const [uaMarker, ...uaRest] = appended!.split(' ')
  assert.equal(
    uaMarker,
    marker,
    `UA 표식이 갈라졌다: capacitor.config.ts="${appended}" vs lib="${marker}". ` +
      '둘이 다르면 서버가 앱을 못 알아본다.',
  )
  assert.ok(uaRest.every((t) => /^FtShell\/\d+$/.test(t)), `UA 뒤 토큰은 셸 세대(FtShell/N)만 — "${uaRest.join(' ')}"`)

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

test('규칙64: iOS AppDelegate 의 손으로 넣은 배선 3종이 남아 있다', () => {
  /**
   * # 왜 (2026-08-26 자기검토)
   *
   * `AppDelegate.swift` 는 `npx cap add ios` 가 만드는 **템플릿 파일**이다.
   * 플랫폼을 다시 만들거나 덮어쓰면 아래가 통째로 사라지는데, **셋 다 사라져도
   * 빌드는 성공한다** — 그래서 사람이 알아채지 못한다.
   *
   *  ① APNs 토큰 전달 — 없으면 `@capacitor/push-notifications` 가 토큰을 영영
   *     못 받는다. 플러그인은 이 NotificationCenter 알림으로만 토큰을 받고
   *     ApplicationDelegateProxy 는 대신 해주지 않는다. 그런데 register() 는
   *     성공으로 끝나서 **알림 설정은 무한 로딩, 크론은 초록**(규칙8 형태).
   *     실제로 iOS 플랫폼 생성 직후 이 상태였다.
   *  ② 카카오 복귀 URL 처리 — 없으면 카카오톡은 열리는데 결과가 안 돌아온다.
   *  ③ 외부 페이지 탈출용 스와이프 — 없으면 카카오·토스 화면에서 못 빠져나온다
   *     (사장님 실기기 제보로 넣은 것).
   */
  const src = read(join(ROOT, 'ios', 'App', 'App', 'AppDelegate.swift'))

  assert.match(
    src,
    /capacitorDidRegisterForRemoteNotifications/,
    'AppDelegate 에 APNs 토큰 전달이 없다 — iOS 푸시가 토큰을 영영 못 받는데 ' +
      '등록은 성공으로 끝나 아무도 실패를 모른다(알림 설정 무한 로딩)',
  )
  assert.match(
    src,
    /capacitorDidFailToRegisterForRemoteNotifications/,
    'AppDelegate 에 APNs 등록 실패 전달이 없다 — 실패해도 계속 기다리기만 한다',
  )
  assert.match(
    src,
    /isKakaoTalkLoginUrl/,
    'AppDelegate 에 카카오 복귀 URL 처리가 없다 — 카카오톡은 열리는데 앱으로 결과가 안 온다',
  )
  assert.match(
    src,
    /allowsBackForwardNavigationGestures/,
    'AppDelegate 에 외부 페이지 탈출 제스처가 없다 — 카카오·토스 화면에 갇힌다',
  )
})

test('규칙65: 카카오 네이티브 로그인은 iOS 전용 — 안드로이드로 새면 안 된다', () => {
  /**
   * # 왜 (2026-08-26)
   *
   * `Capacitor.isNativePlatform()` 은 **안드로이드에서도 참**이다. 플랫폼 조건이
   * 빠지면 이미 스토어에 올라간 안드로이드 앱이 네이티브 경로를 타는데, 안드로이드
   * 쪽 설정(AuthCodeHandlerActivity·키 해시)을 하지 않았으므로 실패한다.
   * 그리고 안드로이드는 **웹 방식으로도 카카오톡 전환이 되므로** 애초에 필요 없다
   * (카카오가 모바일 웹 간편로그인을 안드로이드만 지원 — 이 기능이 iOS 전용인 이유).
   *
   * 이 한 줄이 사라지면 살아있는 안드로이드 앱의 로그인이 깨진다. 규칙으로 박는다.
   */
  const src = stripComments(read(join(ROOT, 'lib', 'auth', 'kakaoNative.ts')))
  assert.match(
    src,
    /getPlatform\(\)\s*===\s*['"]ios['"]/,
    'kakaoNative.ts 가 iOS 를 명시적으로 확인하지 않는다 — isNativePlatform() 만으로는 ' +
      '안드로이드도 통과해 스토어에 올라간 앱의 카카오 로그인이 깨진다',
  )
})

/** WebP 헤더에서 가로·세로만 읽는다 — 테스트에 이미지 라이브러리를 끌어오지 않으려고. */
function webpSize(file: string): { width: number; height: number } {
  const b = readFileSync(file)
  assert.equal(b.toString('ascii', 0, 4), 'RIFF', `${file}: RIFF 헤더가 아니다`)
  assert.equal(b.toString('ascii', 8, 12), 'WEBP', `${file}: WEBP 가 아니다`)
  const kind = b.toString('ascii', 12, 16)
  if (kind === 'VP8 ') {
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff }
  }
  if (kind === 'VP8X') {
    return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 }
  }
  throw new Error(`${file}: 아직 다루지 않는 WebP 종류 ${kind}`)
}

test('규칙66: 온보딩 스크린샷 자산은 SHOT_ASPECT 와 같은 비율이어야 한다', () => {
  /**
   * 2026-08-26 실측으로 생긴 규칙.
   *
   * 온보딩의 기기 프레임은 `aspect-ratio: SHOT_ASPECT` 로 폭을 만들고, 그 안의
   * 스크린샷은 `object-fit: cover` 다. 둘의 비율이 어긋나면 cover 가 그 차이를
   * **화면 좌우를 잘라서** 메운다 — 처음 만들 때 한쪽당 3.5% 씩 잘려 나가고
   * 있었고, 눈으로는 "좀 좁네" 정도라 못 잡았다.
   *
   * 자산을 다시 찍을 때 크롭 값(상태바 제거 높이 등)을 바꾸면 비율이 조용히
   * 달라진다. 그때 이 테스트가 깨져서 SHOT_ASPECT 도 같이 고치게 만든다.
   *
   * 덤으로 SLIDES 가 가리키는 파일이 실제로 있는지도 본다 — 파일명을 바꾸고
   * 코드를 안 고치면 온보딩에 빈 사각형이 뜬다.
   */
  const src = read(join(ROOT, 'components', 'Onboarding.tsx'))

  const aspect = src.match(/const SHOT_ASPECT = '(\d+)\s*\/\s*(\d+)'/)
  assert.ok(aspect, 'Onboarding.tsx 에서 SHOT_ASPECT 상수를 찾지 못했다')
  const expected = Number(aspect[1]) / Number(aspect[2])

  // SLIDES 가 실제로 참조하는 파일만 검사한다(안 쓰는 자산은 상관없다).
  const shots = [...src.matchAll(/shot:\s*'(\/onboarding\/[^']+)'/g)]
    .map((m) => m[1])
    .filter((s): s is string => !!s)
  // 장수는 5장(홈·분석·체중알림·보고서·구독). 체중 알림 장이 2026-09-08 에
  // 추가되면서 4→5 가 됐다. **체중 알림 장은 홈 자산을 재사용**하므로 shots 에
  // 같은 경로가 두 번 나온다 — 그래서 유일값이 아니라 등장 횟수를 센다.
  assert.equal(shots.length, 5, `온보딩 슬라이드가 5장이 아니다 (${shots.length}장)`)

  for (const shot of shots) {
    const file = join(ROOT, 'public', ...shot.split('/').filter(Boolean))
    assert.ok(existsSync(file), `${shot} 파일이 없다 — 온보딩에 빈 사각형이 뜬다`)
    const { width, height } = webpSize(file)
    const ratio = width / height
    assert.ok(
      Math.abs(ratio - expected) < 0.002,
      `${shot} 은 ${width}x${height} (비율 ${ratio.toFixed(4)}) 인데 ` +
        `SHOT_ASPECT 는 ${aspect[1]}/${aspect[2]} (${expected.toFixed(4)}) 다 — ` +
        'object-fit:cover 가 화면 좌우를 잘라낸다. 둘 중 하나를 맞춰라',
    )
  }

  // 배지 사진(원형)도 실제로 있어야 한다.
  for (const m of src.matchAll(/src:\s*'(\/(?:bowl|pkg)\/[^']+)'/g)) {
    const p = m[1]
    if (!p) continue
    assert.ok(
      existsSync(join(ROOT, 'public', ...p.split('/').filter(Boolean))),
      `배지 사진 ${p} 이 없다`,
    )
  }
})

test('규칙67: 고객 화면에 의약품 효능 오인 표현을 쓰지 않는다 (사료관리법 §13 / 표시광고법 §3)', () => {
  /**
   * 2026-09-01 출시 전 감사에서 실제로 걸린 것 — "체중관리·항염"(웹 레시피 3곳 렌더)과
   * "피부+관절 → 항염증"(앱 승인 화면·분석 카드)이 고객 화면에 그대로 나가고 있었다.
   *
   * 우리 약관이 스스로 약속한다 — app/legal/terms "의약품으로 오인할 수 있는 표현을
   * 사용하지 않으며". lib/nutrition.ts 도 같은 규칙을 주석으로 적어 뒀는데, 주석은
   * 다른 파일을 못 막는다. 그래서 테스트로 옮긴다.
   *
   * 근거·연구 인용은 **주석에 남겨도 된다**(stripComments 로 걸러낸다). 막는 것은
   * 고객에게 렌더되는 문자열이다.
   */
  const BANNED = /항염|소염|진통|통증\s*완화|염증\s*(?:완화|억제|개선)|면역력\s*(?:증진|강화)|(?:질병|질환)\s*(?:치료|개선)/

  // 고객이 실제로 보는 표면만. 어드민·내부 도구는 대상이 아니다.
  const SURFACES = [
    join(ROOT, 'app', '(main)'),
    join(ROOT, 'app', 'start'),
    join(ROOT, 'app', 'recipe'),
    join(ROOT, 'app', 'plans'),
    join(ROOT, 'components', 'web'),
    join(ROOT, 'components', 'analysis'),
  ]
  const FILES = [
    join(ROOT, 'lib', 'web-recipes.ts'),
    join(ROOT, 'lib', 'personalization', 'skuModel.ts'),
    join(ROOT, 'lib', 'personalization', 'firstBox.ts'),
  ]

  const targets: string[] = [...FILES.filter((f) => existsSync(f))]
  for (const dir of SURFACES) {
    if (!existsSync(dir)) continue
    for (const f of walk(dir)) {
      if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) targets.push(f)
    }
  }
  assert.ok(targets.length > 20, `검사 대상이 ${targets.length}개뿐 — 경로가 바뀌었는지 확인할 것`)

  const hits: string[] = []
  for (const file of targets) {
    const body = stripComments(read(file))
    for (const [i, lineText] of body.split('\n').entries()) {
      const m = lineText.match(BANNED)
      if (m) hits.push(`${file.replace(ROOT, '').replace(/\\/g, '/')}:${i + 1} :: ${m[0]}`)
    }
  }
  assert.deepEqual(
    hits,
    [],
    '고객 화면 문자열에 의약품 효능 오인 표현이 있다. 효능이 아니라 **무엇을 넣었는지**로 ' +
      '바꿔라(예: "항염" → "오메가-3 보강"). 연구 근거는 주석에 남기면 된다:\n' +
      hits.join('\n'),
  )
})

test('규칙73: 결제 웹훅의 고객 통지는 await 한다 — fire-and-forget 금지', () => {
  /**
   * 2026-09-01 감사 — 웹훅이 메일·푸시를 `.catch()` 만 달고 await 없이 쏘고 바로
   * 응답을 반환했다. 서버리스는 응답이 끝나면 인스턴스가 죽어 **미완료 promise 가
   * 통째로 사라진다.** 사장님이 토스 대시보드에서 환불하면 우리 DB 는 cancelled 로
   * 바뀌는데 고객에게는 아무 안내도 안 갔고, `.catch(()=>{})` 라 흔적도 없었다
   * (전자상거래법 §13 계약내용 변경 통지).
   *
   * 같은 문제를 청구 크론은 이미 await 로 고쳐 뒀는데(R83-6) 웹훅만 남아 있었다.
   * 형제 코드가 고친 함정은 형제 전체에 적용돼야 한다.
   */
  const file = join(ROOT, 'app', 'api', 'payments', 'webhook', 'route.ts')
  const body = stripComments(read(file))
  for (const fn of ['notifyOrderPlaced', 'notifyOrderCancelled', 'pushToUser']) {
    const calls = body.split(`${fn}(`).length - 1
    if (calls === 0) continue
    const awaited = body.split(`await ${fn}(`).length - 1
    assert.equal(
      awaited,
      calls,
      `웹훅의 ${fn} 호출 ${calls}건 중 ${awaited}건만 await 다 — ` +
        'await 없는 통지는 응답 반환과 함께 잘려 나가고, 안 나간 사실조차 안 남는다',
    )
  }
})

test('규칙72: 멱등키 앵커(charge_key_seq)는 증가만 한다 — 어디서도 리셋하지 않는다', () => {
  /**
   * 2026-09-01 감사 — 이 앵커의 전신은 `failed_charge_count` 였고, 카드 재등록
   * (billing-issue)이 그걸 0 으로 리셋했다. 그러면 접미사가 사라져 **이미 써버린
   * base 키로 되돌아가고**, 토스가 저장한 옛 거절(15일 보관)을 재생해 재등록한
   * 고객의 결제가 계속 실패했다 — 화면과 메일은 "다시 등록하면 자동으로 재개돼요"
   * 라고 약속하는데.
   *
   * 그래서 앵커를 전용 컬럼으로 분리했고, 그 컬럼의 유일한 불변식이 이것이다:
   * **오직 증가, 리셋 없음.** 누가 "재등록했으니 깨끗하게 0으로" 하고 싶어질
   * 자리라서 규칙으로 박는다.
   */
  const offenders: string[] = []
  for (const dir of [join(ROOT, 'app'), join(ROOT, 'lib')]) {
    for (const file of walk(dir)) {
      if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue
      const body = stripComments(read(file))
      if (!body.includes('charge_key_seq')) continue
      for (const [i, lineText] of body.split('\n').entries()) {
        if (!lineText.includes('charge_key_seq')) continue
        // 리셋·감소로 읽히는 대입만 잡는다. 타입 선언·select 문자열·증가는 통과.
        if (/charge_key_seq\s*[:=]\s*(0\b|null)/.test(lineText) || /charge_key_seq\s*[-]{2}/.test(lineText)) {
          offenders.push(`${file.replace(ROOT, '').replace(/\\/g, '/')}:${i + 1} :: ${lineText.trim()}`)
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'charge_key_seq 를 0/null 로 되돌리는 코드가 있다. 리셋하면 이미 쓴 멱등키를 ' +
      '다시 쓰게 되고, 토스가 저장한 옛 거절을 재생해 결제가 영영 실패한다:\n' +
      offenders.join('\n'),
  )

  // 증가 지점이 실제로 살아 있는지도 본다 — 규칙이 "없는 것"만 검사하면
  // 기능이 통째로 사라져도 초록이다.
  const cron = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')))
  assert.match(
    cron,
    /shouldAdvanceChargeKey\(/,
    '청구 크론이 shouldAdvanceChargeKey 로 앵커 증가를 판정하지 않는다 — ' +
      'unknown(결과 불명)에서 키가 갈아타면 같은 회차에 두 번 긁힌다',
  )
  assert.match(cron, /charge_key_seq\s*=\s*\(?sub\.charge_key_seq[^\n]*\+\s*1/, '앵커 증가 지점이 없다')
})

test('규칙71: 푸시를 보내면 처리방침에 FCM·APNs 국외 이전이 적혀 있어야 한다', () => {
  /**
   * 2026-09-01 감사 — 네이티브 푸시(FCM·APNs)를 실제로 보내는데 개인정보처리방침의
   * 위탁표에는 Google 이 '통계'로만, Apple 이 '로그인'으로만 적혀 있었다.
   * 푸시를 보내려면 **기기 토큰과 알림 본문**(반려견 이름이 들어갈 수 있다)이
   * 국외로 나간다 — 개인정보보호법 §28-8 국외 이전 고지 대상이다.
   *
   * 코드(보내는 것)와 문서(적어 둔 것)를 묶어 둔다. 푸시를 걷어내면 이 규칙도
   * 같이 지우면 되고, 남겨 두는 한 방침에서 지울 수 없다.
   */
  const native = join(ROOT, 'lib', 'push', 'native.ts')
  if (!existsSync(native)) return // 네이티브 푸시를 안 보내면 고지할 것도 없다.

  const sends = stripComments(read(native))
  const usesFcm = /FCM|fcm\.googleapis|firebase/i.test(sends)
  const usesApns = /APNs|apns|api\.push\.apple/i.test(sends)

  // ★주석은 반드시 걷어낸다. 처음엔 원문 그대로 검사했더니, 이 변경을 설명하려고
  //   달아 둔 JSX 주석의 "FCM" 글자를 보고 규칙이 통과했다(카나리아로 잡았다).
  //   고객에게 **보이는 문서**에 적혀 있어야 의미가 있다.
  const policy = stripComments(read(join(ROOT, 'app', 'legal', 'privacy', 'page.tsx')))
  if (usesFcm) {
    assert.match(
      policy,
      /Firebase Cloud Messaging|FCM/,
      '안드로이드 푸시(FCM)를 보내는데 처리방침에 기재가 없다 — 위탁표·국외이전표 둘 다',
    )
  }
  if (usesApns) {
    assert.match(
      policy,
      /Apple Push Notification|APNs/,
      'iOS 푸시(APNs)를 보내는데 처리방침에 기재가 없다 — 위탁표·국외이전표 둘 다',
    )
  }
  // 토큰이 나간다는 사실 자체가 적혀 있어야 한다(사업자 이름만으로는 부족).
  assert.match(
    policy,
    /푸시 토큰/,
    '국외 이전 항목에 "기기 푸시 토큰"이 없다 — 무엇이 나가는지가 고지의 핵심이다',
  )
})

test('규칙69: 광고성 알림은 야간(21~08시)에 나갈 수 없다 (정보통신망법 §50⑧)', () => {
  /**
   * 2026-09-01 감사 — 마케팅 발송 시각을 0~23 아무 때나 고를 수 있었고, 어드민 UI 는
   * 21 시를 "적절한 시각이에요"라고 안내까지 했다. 조용시간(push_preferences)은
   * **기본 NULL**(꺼짐)이라 방어가 되지 못했다.
   *
   * 방어는 두 겹이어야 한다:
   *   ① 설정이 야간을 아예 못 받는다 (automation-settings 의 범위 상수)
   *   ② 크론이 설정과 무관하게 야간을 막는다 — daily 강등 모드에선 시각 게이트가
   *      없어서 **크론 시각이 곧 발송 시각**이 되기 때문이다.
   */
  const settings = read(join(ROOT, 'lib', 'automation-settings.ts'))
  const minMatch = settings.match(/MARKETING_HOUR_MIN\s*=\s*(\d+)/)
  const maxMatch = settings.match(/MARKETING_HOUR_MAX\s*=\s*(\d+)/)
  assert.ok(minMatch && maxMatch, 'automation-settings 에 MARKETING_HOUR_MIN/MAX 가 없다')
  const min = Number(minMatch[1])
  const max = Number(maxMatch[1])
  assert.ok(min >= 8, `광고 발송 하한이 ${min} 시 — 08 시 이전은 야간이라 안 된다`)
  assert.ok(max <= 20, `광고 발송 상한이 ${max} 시 — 21 시부터는 야간이라 안 된다`)

  const body = stripComments(settings)
  assert.match(
    body,
    /marketing_push_hour\s*>=\s*MARKETING_HOUR_MIN/,
    'coerce 가 하한 상수를 안 쓴다 — 상수만 바꾸면 실제 검증이 안 따라온다',
  )
  assert.match(body, /marketing_push_hour\s*<=\s*MARKETING_HOUR_MAX/, 'coerce 가 상한 상수를 안 쓴다')

  // ② 크론의 하드 가드 — 설정과 무관하게 막아야 한다.
  const cron = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'push-lifecycle', 'route.ts')))
  assert.match(
    cron,
    /MARKETING_HOUR_MIN/,
    'push-lifecycle 에 야간 하드 가드가 없다 — daily 모드에선 크론 시각이 곧 발송 시각이다',
  )
  assert.match(cron, /MARKETING_HOUR_MAX/, 'push-lifecycle 야간 가드에 상한이 빠졌다')
})

test('규칙68: 결제 동선 화면은 약관·청약철회·처리방침 링크를 품는다 (전자상거래법 §13)', () => {
  /**
   * 2026-09-01 출시 전 감사 — 앱에는 이 링크가 **한 개도** 없었다.
   * AppChrome 이 앱 컨텍스트에서 SiteFooter 를 숨기는데(의도된 동작), 결제 화면들이
   * 그 푸터에 기대고 있었다. 웹 경로에는 있어서 눈으로는 안 보이는 결함이었다.
   *
   * 두 화면 모두 결제 직전이다 — 주문(카드 등록으로 넘어가는 CTA)과 카드 등록.
   */
  const SCREENS = [
    join(ROOT, 'app', '(main)', 'dogs', '[id]', 'order', 'OrderClient.tsx'),
    join(ROOT, 'app', 'subscribe', 'billing-auth', 'page.tsx'),
  ]
  const NEEDED = ['/legal/terms', '/legal/refund', '/legal/privacy']

  for (const file of SCREENS) {
    assert.ok(existsSync(file), `결제 화면 ${file} 이 없다 — 경로가 바뀌었으면 이 규칙도 고쳐라`)
    const body = stripComments(read(file))
    for (const href of NEEDED) {
      assert.ok(
        body.includes(href),
        `${file.replace(ROOT, '').replace(/\\/g, '/')} 에 ${href} 링크가 없다 — ` +
          '앱은 푸터가 없어서 결제 전에 약관·청약철회를 볼 방법이 사라진다',
      )
    }
  }
})

test('규칙70: APNs 발송은 node:http2 로만 — fetch 는 어떤 요청도 성공 못 한다', () => {
  /**
   * # 왜 (2026-09-01 실기기 첫 푸시 테스트에서 발견 — 두 번째 iOS 푸시 P0)
   *
   * **APNs 는 HTTP/2 전용**이다. Node 전역 fetch(undici)는 HTTP/1.1 이라
   * 모든 발송이 NETWORK_ERROR('Response does not match the HTTP/1.1 protocol')
   * 로 죽고, 화면에는 "0개 기기로 전송"만 남는다. 같은 키·토큰이 HTTP/2 로는
   * 200 + 실수신 — 재현으로 확정했다. FCM 은 HTTP/1.1 을 받아 안드로이드만
   * 멀쩡했으므로, 누가 "fetch 로 통일"하는 정리를 하면 iOS 만 조용히 죽는다.
   */
  const src = stripComments(read(join(ROOT, 'lib', 'push', 'native.ts')))
  assert.match(
    src,
    /from 'node:http2'/,
    'lib/push/native.ts 가 node:http2 를 안 쓴다 — APNs 는 HTTP/2 전용이라 fetch 로는 전멸한다',
  )
  const apnsSection = src.slice(0, src.indexOf('FCM'))
  assert.ok(
    !/fetch\s*\(/.test(apnsSection),
    'APNs 발송 경로에 fetch 가 다시 들어왔다 — HTTP/1.1 이라 모든 iOS 푸시가 죽는다',
  )
})

test('규칙74: apex→www 리다이렉트는 /.well-known/* 을 비켜간다 (App Links·Universal Links)', () => {
  /**
   * # 왜 (2026-09-01 실측)
   *
   * apex(`farmerstail.kr`) → www 리다이렉트를 **Vercel 도메인 설정**이 하고
   * 있었고, 그게 `/.well-known/*` 까지 넘겨서 안드로이드 App Links 검증이
   * apex 에서 실패했다:
   *   - `curl` : apex → 307, www → 200
   *   - 기기 : `pm get-app-links` 가 `farmerstail.kr: 1024`(실패),
   *            `www.farmerstail.kr: verified`
   *   - 실제 : `https://farmerstail.kr/dashboard` 는 앱이 안 열리고
   *            홈 화면에 머물렀다. www 는 앱이 열렸다.
   * 구글·애플 검증기는 **리다이렉트를 따라가지 않는다.** 그래서 도메인 레벨
   * 리다이렉트를 끄고, 앱 레벨에서 `/.well-known/*` 만 빼고 넘긴다.
   *
   * 이 규칙이 지키는 것 세 가지 — 하나라도 무너지면 조용히 옛 상태로 돌아간다:
   *   ① 예외가 사라지면 → App Links·Universal Links 가 다시 죽는다.
   *   ② 리다이렉트 자체가 사라지면 → apex 가 사이트를 통째로 중복 서빙한다(SEO).
   *   ③ has 의 host 가 www 까지 잡으면 → **무한 리다이렉트**로 사이트가 죽는다.
   *      (Next 는 has.value 를 `^...$` 로 앵커해 컴파일한다 —
   *       node_modules/next/dist/shared/lib/router/utils/prepare-destination.js)
   */
  const code = stripComments(read(join(ROOT, 'next.config.ts')))

  // ① 예외 — /.well-known/* 은 apex 에서도 그대로 서빙돼야 한다.
  //    패턴은 Next 자신이 trailingSlash 처리에 쓰는 형태(load-custom-routes.js)
  //    와 같다 — `(?:/.*)?` 가 있어야 슬래시 없는 `/.well-known` 도 제외된다.
  const catchAllSrc = String.raw`source: '/:path((?!\\.well-known(?:/.*)?).*)'`
  assert.ok(
    code.includes(catchAllSrc),
    'next.config.ts 의 apex 리다이렉트가 /.well-known 예외를 잃었거나 형태가 바뀌었다 — ' +
      '구글·애플 검증기는 리다이렉트를 안 따라가므로 App Links 가 다시 죽는다. ' +
      '패턴을 의도적으로 바꿨다면 이 문자열과 아래 성질 검사를 함께 갱신할 것',
  )
  // 그 패턴이 실제로 그 성질을 갖는지 — **소스에서 뽑은 실물 패턴**으로 검산.
  // (`:path` 의 파라미터 정규식은 앞 슬래시를 뗀 경로에 적용된다 — Next 실측.
  //  소스의 `\\.` 는 파일 텍스트에서 백슬래시 2개라 정규식으로 만들 때 1개로.)
  const srcInner = /source: '\/:path\(([^']+)\)'/.exec(code)?.[1]
  assert.ok(srcInner, 'catch-all 의 :path(...) 파라미터 패턴을 소스에서 못 뽑았다')
  const exclusion = new RegExp(`^${srcInner!.replace(/\\\\/g, '\\')}$`)
  for (const p of ['.well-known/assetlinks.json', '.well-known/apple-app-site-association', '.well-known']) {
    assert.ok(!exclusion.test(p), `제외 패턴이 '/${p}' 를 못 거른다 — 검증기가 308 을 받는다`)
  }
  assert.ok(exclusion.test('dashboard'), '제외 패턴이 일반 경로까지 걸러 리다이렉트가 전멸했다')

  // ② 리다이렉트 자체 — apex 를 출발지로 잡는 has 규칙이 2개(루트 + catch-all).
  //    catch-all 의 `:path` 는 빈 문자열도 잡아 루트 규칙은 기술적으로 중복이지만,
  //    가장 중요한 URL 의 처리를 패턴 해석에 맡기지 않으려고 명시해 둔다.
  const hostValues = [...code.matchAll(/type: 'host', value: '([^']+)'/g)].flatMap((m) =>
    m[1] ? [m[1]] : [],
  )
  assert.ok(
    hostValues.length >= 2,
    'apex→www 리다이렉트 규칙이 2개(루트 + 나머지 경로) 미만이다 — ' +
      'Vercel 도메인 리다이렉트를 끈 상태에서 이게 없으면 apex 가 사이트를 중복 서빙한다',
  )
  assert.ok(
    code.includes(`source: '/',`),
    'apex 루트(/) 리다이렉트 규칙이 없다 — 명시 규칙을 지웠으면 catch-all 이 루트를 잡는지 실측 후 이 단언도 같이 정리할 것',
  )

  // ③ 무한 리다이렉트 방지 — **성질**로 검사한다. Next 는 has.value 를
  //    `^...$` 로 앵커해 컴파일하지만(prepare-destination.js), 값 자체가
  //    `.*farmerstail\.kr` 나 `(.*\.)?farmerstail\.kr` 면 앵커가 있어도
  //    www 에 매치되어 apex→www→www… 무한 루프다. 철자 검사('www' 포함 여부)는
  //    그 두 표기를 통과시키므로 실제 매칭으로 검산한다.
  for (const v of hostValues) {
    const anchored = new RegExp(`^${v.replace(/\\\\/g, '\\')}$`)
    assert.ok(
      anchored.test('farmerstail.kr'),
      `has.host '${v}' 가 apex 에 매치되지 않는다 — 리다이렉트가 발화하지 않아 apex 가 중복 서빙된다`,
    )
    assert.ok(
      !anchored.test('www.farmerstail.kr'),
      `has.host '${v}' 가 www 에도 매치된다 — apex→www→www… 무한 루프로 사이트 전체가 죽는다`,
    )
  }
  // 목적지는 전부 www 절대 URL 이어야 한다 — apex 로 되돌리면 그 자체가 루프다.
  const destinations = [...code.matchAll(/destination: '([^']+)'/g)].flatMap((m) =>
    m[1] ? [m[1]] : [],
  )
  for (const d of destinations.filter((d) => d.startsWith('http'))) {
    assert.ok(
      d.startsWith('https://www.farmerstail.kr'),
      `redirects() 의 절대 목적지 '${d}' 가 www 정본이 아니다`,
    )
  }

  // 예외가 지키려는 실물이 실제로 있어야 의미가 있다.
  for (const p of [
    join(ROOT, 'app', '.well-known', 'assetlinks.json', 'route.ts'),
    join(ROOT, 'app', '.well-known', 'apple-app-site-association', 'route.ts'),
  ]) {
    assert.ok(
      existsSync(p),
      `${rel(p)} 가 없다 — 리다이렉트 예외만 남고 검증 파일이 사라지면 404 다`,
    )
  }
})

test('규칙75: 런타임 코드에 apex(https://farmerstail.kr) 하드코딩 금지 — 정본 호스트는 www 하나', () => {
  /**
   * # 왜 (2026-09-01 apex 전환 감사)
   *
   * `lib/email/index.ts` 두 곳의 env 폴백만 `https://farmerstail.kr`(apex)였고
   * 나머지 저장소 전부(canonical·sitemap·robots·OG·QR·메일 layout)는 www 였다.
   * 그 apex 값으로 **List-Unsubscribe 헤더**가 만들어졌다 — 메일 제공자의
   * 원클릭 수신거부 에이전트는 리다이렉트 추종이 보장되지 않아, 같은 메일
   * 안에서 본문 링크(www)는 되는데 헤더(apex)는 안 되는 상태가 될 수 있었다.
   * apex 가 App Links 대상 호스트가 된 뒤로는 "어느 폴백이냐"가 곧 "브라우저가
   * 열리냐 앱이 열리냐"의 차이이기도 하다.
   *
   * 절대 URL 이 필요하면 `NEXT_PUBLIC_SITE_URL` 을 읽고, 폴백은 www 로 —
   * 메일 쪽은 lib/email/layout.ts 의 `SITE_URL` 을 재사용한다.
   * (호스트 이름 비교(`=== 'farmerstail.kr'`)나 next.config 의 리다이렉트
   * 출발지는 스킴이 없어 이 검사에 안 걸린다 — 정확히 의도된 구분이다.)
   */
  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app'))
    .concat(walk(join(ROOT, 'lib')))
    .concat(walk(join(ROOT, 'components')))) {
    if (!/\.(ts|tsx)$/.test(file) || file.includes('.test.')) continue
    const src = stripCommentsKeepLines(read(file))
    src.split('\n').forEach((line, i) => {
      if (/https:\/\/farmerstail\.kr/.test(line)) offenders.push(`${rel(file)}:${i + 1}`)
    })
  }
  assert.deepEqual(
    offenders,
    [],
    `apex 하드코딩이 다시 생겼다 — www 정본(NEXT_PUBLIC_SITE_URL 폴백 포함)으로 바꿀 것:\n${offenders.join('\n')}`,
  )
})

test('규칙76: 토스 웹훅 CANCELED 가드는 refunded 종결 상태를 skip 해야 한다 — 원장 이중 기록 방지', () => {
  /**
   * # 왜 (2026-09-05 실측)
   *
   * admin 전액환불(partial-cancel 라우트)은 payment_status='refunded' 로
   * 종결하는데, 웹훅의 종결 가드가 'cancelled' 만 봐서 뒤따라온 토스
   * CANCELED 웹훅이 ① refunded 주문을 cancelled 로 덮어쓰고 ② 원장에 같은
   * 환불을 한 번 더 기록했다. 결제원장·매출리포트의 환불 합계가 정확히
   * 2배(65,400 = 32,700×2)로 부풀던 원인. 부분취소는 금액 기반 멱등
   * (refunded_amount >= 토스 cancels 합)으로 같은 구멍을 막는다.
   */
  const src = stripCommentsKeepLines(
    read(join(ROOT, 'app', 'api', 'payments', 'webhook', 'route.ts')),
  )
  assert.ok(
    /payment_status\s*===\s*'cancelled'\s*\|\|\s*order\.payment_status\s*===\s*'refunded'/.test(
      src,
    ),
    "웹훅 CANCELED 종결 가드에 'refunded' 가 빠졌다 — admin 전액환불 직후 웹훅이 원장에 환불을 이중 기록한다",
  )
  assert.ok(
    /refunded_amount[\s\S]{0,120}>=\s*refundedTotal/.test(src),
    '부분취소 금액 기반 멱등(refunded_amount >= 토스 누적 환불액 skip)이 사라졌다',
  )
})

test('규칙77: 원장 집계(finance·reports)는 환불 event_type 화이트리스트 + 부호 합산이어야 한다', () => {
  /**
   * # 왜 (2026-09-05, 규칙76과 한 세트)
   *
   * 부호(amount<0)만 보면 정보성·정정 이벤트까지 환불에 섞인다. 그리고 과거
   * 오기입은 반대 기입(+금액, 회계식 reversal)으로 상쇄하는데, 절대값
   * 합산이면 정정이 반영되지 않고 환불이 계속 부풀어 보인다. 그래서:
   *   · 환불 합계 = refunded 계열 3종의 **부호 합산**(-sum)
   *   · 매출 합계 = event_type 'paid' 만
   */
  const finance = stripCommentsKeepLines(
    read(join(ROOT, 'app', 'admin', 'finance', 'page.tsx')),
  )
  assert.ok(
    /REFUND_TYPES\.has\(e\.event_type\)/.test(finance) &&
      /\+=\s*-e\.amount/.test(finance),
    'finance 집계가 event_type 화이트리스트 + 부호 합산이 아니다',
  )
  assert.ok(
    /e\.event_type\s*===\s*'paid'/.test(finance),
    "finance 매출 집계가 event_type 'paid' 필터를 잃었다",
  )
  const reports = stripCommentsKeepLines(
    read(join(ROOT, 'app', 'admin', 'reports', 'page.tsx')),
  )
  assert.ok(
    /\.in\('event_type',\s*\['refunded',\s*'partial_refunded',\s*'cron_refund_queue'\]\)/.test(
      reports,
    ),
    'reports 환불 쿼리가 event_type 화이트리스트를 잃었다',
  )
  assert.ok(
    /reduce\(\(s,\s*e\)\s*=>\s*s\s*-\s*\(e\.amount\s*\?\?\s*0\)/.test(reports),
    'reports 환불 합산이 부호 합산(-sum)이 아니다 — 정정 기입이 상쇄되지 않는다',
  )
})

test('규칙78: 앱 홈 진입은 푸시 토큰을 자동 등록해야 한다 — 설정 화면 토글만으로는 아무도 안 켠다', () => {
  /**
   * # 왜 (2026-09-15 사장님 제보: "앱 깔았는데 알림이 한 번도 안 울렸다")
   * 토큰 등록 함수를 부르는 곳이 알림 설정 화면의 토글 ON **하나뿐**이었다.
   * 앱을 깔고 로그인해도 아무도 그 화면에 가지 않았고, 사용자 12명 전원 토큰 0 —
   * 결제·배송·운영 브리핑이 3주간 `sent_count: 0` 으로 기록만 남았다.
   * 등록 API 주석에는 "첫 실행 시 호출"이라 적혀 있었지만 그 코드는 없었다.
   * 주석이 주장하는 동작은 grep 으로 실물을 확인한다(AGENTS.md 규칙4).
   *
   * # 무엇을 잠그나
   * ① 홈(dashboard)이 자동 등록 컴포넌트를 렌더한다.
   * ② 자동 등록은 **사용자가 껐다는 표시(opt-out)를 먼저 본다** — 없으면 토글
   *    OFF 를 다음 홈 진입이 뒤집어 "껐는데 계속 온다"가 된다.
   * ③ 토글 OFF 가 그 표시를 남기고, ON 이 지운다.
   */
  const home = stripComments(read(join(ROOT, 'app', '(main)', 'dashboard', 'page.tsx')))
  assert.match(home, /<PushAutoRegister\s*\/>/, '홈이 PushAutoRegister 를 렌더하지 않는다 — 토큰이 다시 아무에게도 안 남는다')

  const cap = stripComments(read(join(ROOT, 'lib', 'capacitor.ts')))
  const fn = cap.slice(cap.indexOf('export async function autoRegisterNativePush'))
  assert.ok(fn.length > 0, 'autoRegisterNativePush 가 없다')
  const optOutIdx = fn.indexOf('hasPushOptOut')
  const registerIdx = fn.indexOf('registerAndSyncNativePush')
  assert.ok(optOutIdx > 0 && registerIdx > 0 && optOutIdx < registerIdx,
    '자동 등록이 opt-out 확인 없이(또는 등록 뒤에) 토큰을 만든다 — 사용자가 끈 걸 뒤집는다')

  const settings = stripComments(read(join(ROOT, 'app', '(main)', 'mypage', 'notifications', 'NotificationSettingsClient.tsx')))
  // ★분기별로 본다(2026-09-16) — 파일 어디에든 두 호출이 있으면 통과하던 단언은
  //   enable/disable 을 서로 바꿔 꽂아도 초록이었다.
  const iEnable = settings.indexOf('async function enable(')
  const iDisable = settings.indexOf('async function disable(')
  assert.ok(iEnable > 0 && iDisable > iEnable, '알림 설정 화면에 enable()/disable() 이 이 순서로 없다 — 규칙의 분기 판정을 갱신할 것')
  const enableBody = settings.slice(iEnable, iDisable)
  const disableBody = settings.slice(iDisable)
  assert.match(enableBody, /clearPushOptOut\(\)/, '토글 ON(enable) 이 opt-out 표시를 지우지 않는다')
  assert.doesNotMatch(enableBody, /markPushOptOut\(\)/, '토글 ON(enable) 이 opt-out 표시를 남긴다 — 켰는데 다음 홈에서 자동 등록이 안 된다')
  assert.match(disableBody, /markPushOptOut\(\)/, '토글 OFF(disable) 가 opt-out 표시를 남기지 않는다 — "껐는데 계속 온다"')
  assert.doesNotMatch(disableBody, /clearPushOptOut\(\)/, '토글 OFF(disable) 가 opt-out 표시를 지운다')
})

test('규칙79: 운영 브리핑 크론은 실제 발송 0건을 실패로 끝내야 한다 — "수신자 0명" 방어만으론 부족', () => {
  /**
   * # 왜 (2026-09-15)
   * 이 크론엔 이미 "관리자 0명이면 500" 방어가 있었다(관리자 판정이 깨졌던 사고).
   * 그런데 관리자는 1명 있고 **그 계정에 푸시 토큰이 없어** sent=0 인 경우는
   * 초록으로 빠져나갔고, 2026-09-03 부터 13일간 매일 허공에 쐈다. 같은 병을
   * 한 층 앞에서만 막은 것이다. 방어를 세우면 그 다음 단계도 같은 모양인지 본다.
   *
   * 잠그는 것: sent === 0 이면 ok:false + 500. 사장님 메일까지 가도록 Sentry 도.
   */
  // 관리자에게 푸시를 보내는 크론 전부 — admin_user_ids 로 수신자를 고르고 pushToUser 를 부르는 것.
  // 2026-09-15 검수에서 quality-check-reminder 도 같은 구멍이 있었다(매월 1일이라 아직 안 터졌을 뿐).
  const cronDir = join(ROOT, 'app', 'api', 'cron')
  const adminPushCrons = readdirSync(cronDir).filter((d) => {
    const f = join(cronDir, d, 'route.ts')
    if (!existsSync(f)) return false
    const s = stripComments(read(f))
    return s.includes("rpc('admin_user_ids')") && s.includes('pushToUser(')
  })
  assert.ok(adminPushCrons.includes('daily-briefing'), '규칙의 탐지 조건이 daily-briefing 을 못 찾는다 — 조건을 갱신할 것')
  for (const name of adminPushCrons) {
    const src = stripComments(read(join(cronDir, name, 'route.ts')))
    const guard = src.indexOf('sent === 0')
    assert.ok(guard > 0, `${name}: sent === 0 판정이 없다 — 관리자 토큰이 없으면 초록으로 허공에 쏜다`)
    const after = src.slice(guard, guard + 900)
    assert.match(after, /no_push_targets/, `${name}: sent=0 이 실패 사유(no_push_targets)로 안 나간다`)
    assert.match(after, /status:\s*500/, `${name}: sent=0 인데 200 으로 끝난다 — 크론이 초록으로 집계된다`)
    assert.match(after, /Sentry\.captureMessage/, `${name}: sent=0 이 Sentry 로 안 나간다 — 사장님이 모른다`)
  }
})

test('규칙80: 라이브 어드민 셸에는 고객 화면(/dashboard)으로 돌아가는 링크가 있어야 한다', () => {
  /**
   * # 왜 (2026-09-15 사장님 제보: "관리자 화면에서 나가기 버튼이 사라졌다")
   * 2026-09-04 어드민 개편에서 수제 AdminShell → shadcn AdminShellNext 로 셸을
   * 갈아끼우면서, 구 셸 드로어 하단의 "← 일반 화면으로" 링크를 옮기지 않았다.
   * 앱에는 주소창이 없다 — 폰 앱으로 어드민에 들어온 사장님은 그 링크 말고는
   * 고객 화면으로 돌아갈 길이 없다. 39개 화면을 다 옮기고도 탈출구 하나를
   * 빠뜨렸고, 열흘간 아무도 몰랐다.
   *
   * # 무엇을 잠그나
   * layout 이 실제로 렌더하는 셸 파일을 따라가서 거기에 /dashboard 링크가 있는지
   * 본다. 구 셸 파일에 남아 있는 링크는 세지 않는다 — 라이브가 아니니까.
   */
  const layout = read(join(ROOT, 'app', 'admin', 'layout.tsx'))
  const m = layout.match(/from\s+'@\/components\/((?:admin|adminui)\/[\w-]*[Ss]hell[\w-]*)'/)
  assert.ok(m, 'admin/layout.tsx 에서 셸 컴포넌트 import 를 못 찾았다 — 규칙의 경로 패턴을 갱신할 것')
  const shellRel = m![1] ?? ''
  const shellPath = join(ROOT, 'components', ...shellRel.split('/')) + '.tsx'
  assert.ok(existsSync(shellPath), `셸 파일이 없다: ${shellPath}`)
  const shell = stripComments(read(shellPath))
  assert.match(
    shell,
    // href="/" 도 허용(2026-09-16): 앱은 proxy 가 세션 유무로 /dashboard·/welcome 으로,
    // 웹은 홈으로 보낸다. /dashboard 직링크는 데스크톱 관리자를 /app-required 로 보냈다.
    /href=["']\/(dashboard)?["']/,
    `라이브 어드민 셸(${shellRel})에 /dashboard 로 돌아가는 링크가 없다 — 앱에서 어드민에 들어오면 못 나온다`,
  )
})

test('규칙81: 가입 환영 메일은 홈 첫 진입에서 발화돼야 한다 — 템플릿만 있고 호출처 없던 것', () => {
  /**
   * # 왜 (2026-09-15 검수)
   * notifyWelcome 템플릿은 있는데 부르는 코드가 없어 서비스 시작부터 한 통도
   * 안 나갔다. 7월에 "/api/auth/welcome-email 을 부르는 client 가 없다"며
   * API 를 지웠는데, 고쳐야 할 것은 호출처였다 — 푸시 자동 등록(규칙78)과
   * 같은 모양. 프로필은 auth 트리거가 만들어 "가입 직후" 지점이 앱 코드에
   * 없으므로 홈에서 잡는다.
   *
   * 잠그는 것: ① notifyWelcome 호출처가 lib/email 밖에 존재 ② 홈이
   * sendWelcomeEmailOnce 를 부름 ③ 선점(is null 조건 UPDATE)이 발송보다 앞.
   */
  const callers = walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'lib')))
    .filter((f) => !f.includes(join('lib', 'email')))
    .filter((f) => stripComments(read(f)).includes('notifyWelcome('))
  assert.ok(callers.length > 0, 'notifyWelcome 을 부르는 곳이 없다 — 환영 메일이 또 죽었다')

  const home = stripComments(read(join(ROOT, 'app', '(main)', 'dashboard', 'page.tsx')))
  assert.match(home, /sendWelcomeEmailOnce\(/, '홈이 환영 메일을 발화하지 않는다')

  const w = stripComments(read(join(ROOT, 'lib', 'welcome-email.ts')))
  const claim = w.indexOf(".is('welcome_email_sent_at', null)")
  const send = w.indexOf('notifyWelcome(')
  assert.ok(claim > 0 && send > 0 && claim < send,
    '환영 메일이 선점(welcome_email_sent_at is null 조건 UPDATE) 없이 나간다 — 두 탭이면 두 통')
})

test('규칙82: 서비스워커는 외부 도메인을 건드리지 않고, 실패 응답을 캐시하지 않는다', () => {
  /**
   * # 왜 (2026-09-16 전수 점검)
   * sw.js 주석은 "외부 도메인 요청은 캐시하지 않음"이라 적혀 있었는데 실제 검사는
   * supabase/toss 문자열뿐이었다. gtag·clarity·kakao SDK 가 script 분기로 들어가
   * **응답 상태를 보지 않고** opaque 로 캐시됐고, Clarity 의 400(Invalid project id)
   * 이 그대로 캐시돼 다음 배포까지 매 페이지 400 을 먹였다. 같은 경로로 우리 자산의
   * 404/500 도 배포 전까지 고정된다.
   *
   * 잠그는 것: ① fetch 핸들러에 origin 가드 ② cache.put 마다 바로 앞에 response.ok 게이트.
   */
  // stripComments 는 sw.js 의 '/_next/static/*' 같은 문자열 속 `/*` 를 주석 시작으로 오인해
  // 핸들러 본문을 통째로 지운다 — 원문으로 본다. 아래 정규식은 코드 토큰만 잡는다.
  const sw = read(join(ROOT, 'public', 'sw.js'))
  const fetchHandler = sw.slice(sw.indexOf("addEventListener('fetch'"))
  assert.ok(fetchHandler.length > 100, 'sw.js 에 fetch 핸들러가 없다')
  assert.match(
    fetchHandler,
    /new URL\(request\.url\)\.origin !== self\.location\.origin/,
    'SW fetch 핸들러에 외부 도메인 패스스루(origin 가드)가 없다 — 외부 SDK 응답이 opaque 로 캐시된다',
  )
  const puts = [...fetchHandler.matchAll(/cache\.put\(/g)]
  assert.ok(puts.length >= 2, `fetch 핸들러의 cache.put 이 ${puts.length}개 — 네비게이션·정적자원 두 분기가 있어야 한다`)
  for (const m of puts) {
    const before = fetchHandler.slice(Math.max(0, m.index - 260), m.index)
    assert.match(before, /if \(response\.ok\)/, `cache.put 앞에 response.ok 게이트가 없다 (offset ${m.index}) — 4xx/5xx 가 배포 전까지 캐시된다`)
  }
})


test('규칙83: 앱 하단 탭은 앱에서만·몰입 화면 밖에서만 그리고, 강아지 탭에 구독이 다시 들어오지 않는다', () => {
  /**
   * # 왜 (2026-09-21 시니어 사용성 기획 1단계)
   * 6/17 에 뺐던 하단 탭을 되살렸다 — 어르신이 프로필 상단 탭이 눌리는 줄 모르고,
   * 정기배송 카드는 두 화면 반 아래였다. 되살리면서 지켜야 할 세 가지:
   *  ① 웹엔 절대 안 나온다(웹/앱 절대 분리) — useIsAppContext 로 가드.
   *  ② 설문·체크인 등 몰입 화면에선 숨긴다 — AppChrome 이 focusMode 를 넘기고,
   *     CSS 도 data-focus 로 이중 잠금(하이드레이션 타이밍 무관).
   *  ③ 강아지 프로필 상단 탭에 '구독' 이 다시 들어오면 같은 목적지가 두 군데 —
   *     하단 탭 하나로 둔다.
   */
  const bar = stripComments(read(join(ROOT, 'components', 'app', 'BottomTabBar.tsx')))
  assert.match(bar, /useIsAppContext\(\)/, '하단 탭이 앱 판정(useIsAppContext) 없이 그려진다 — 웹에 앱 탭이 뜬다')
  assert.match(bar, /if \(hidden \|\| !isApp\) return null/, '하단 탭이 hidden/!isApp 에서 null 을 반환하지 않는다')
  for (const label of ['홈', '우리 아이', '정기배송', '내 정보']) {
    assert.ok(bar.includes(`'${label}'`), `하단 탭에 '${label}' 라벨이 없다`)
  }
  // 가운데 발바닥은 글자 없이 원만(사장님 2026-09-22) — 접근성 이름은 aria-label 로.
  assert.match(bar, /aria-label="기록하기"/, '가운데 발바닥 버튼에 접근성 이름(기록하기)이 없다')

  const chrome = stripComments(read(join(ROOT, 'components', 'AppChrome.tsx')))
  assert.match(chrome, /hidden=\{(focusMode|tabBarHidden)\}/, 'AppChrome 이 하단 탭에 focusMode/tabBarHidden 을 넘기지 않는다 — 설문 화면에 탭이 뜬다')
  assert.doesNotMatch(chrome, /PawFab/, '우하단 발바닥 FAB 가 남아 있다 — 하단 탭 가운데 "기록" 으로 흡수했다')

  const css = read(join(ROOT, 'app', 'globals.css'))
  assert.match(css, /\[data-focus\] nav\[aria-label='주 메뉴'\]/, 'focus 모드 CSS 가 하단 탭(주 메뉴)을 안 숨긴다')
  assert.match(css, /--ft-tabbar-h:\s*\d+px/, '--ft-tabbar-h 가 없다 — sticky CTA 가 탭에 가려진다')

  const dogTabs = stripComments(read(join(ROOT, 'components', 'dogs', 'DogTabsNav.tsx')))
  assert.doesNotMatch(dogTabs, /\/subscription`/, '강아지 상단 탭에 구독이 다시 들어왔다 — 하단 탭과 중복')
  assert.match(dogTabs, /grid-cols-3/, '강아지 상단 탭이 3칸이 아니다')
})


test('규칙84: 아래 탭은 떠 있는 알약 — 네이티브 앱에선 홈바 구간 바로 위(간격 0)에 앉고, 그 구간 색(네이티브)은 앱 바탕(흰색)과 같다', () => {
  /**
   * # 왜 (2026-09-22 사장님 아이폰 스크린샷 → 2026-10-10 토스식)
   * iOS 는 contentInset 'always' 라 상태바·홈바 safe-area 구간을 웹이 아니라 네이티브가
   * capacitor.config 의 backgroundColor 로 칠하고, 그 구간으로는 웹 내용이 안 내려간다. 9/22 엔 꽉 찬 탭바(종이색)
   * 아래 홈바 구간(크림)이 다른 색 띠로 보였다 — "맨 아래로 내리면 저런 바가 왜 생기냐, 색도 다르다".
   * 10/10 사장님이 토스식(떠 있는 둥근 탭)을 골랐다. 이제 홈바 구간과 맞닿는 건 탭이 아니라 앱 바탕이다:
   *  ① 네이티브 색 = --ft-native-bg = 앱 바탕(흰색) — 알약 양옆·아래가 한 장으로 이어진다.
   *  ② 네이티브 앱에선 알약을 그 구간 바로 위(간격 0, html.ft-native)에 앉힌다. 간격을 두면 알약 밑으로 내용이
   *     한 줄 비치다가 홈바 구간 경계에서 칼같이 잘린다(토스처럼 탭 아래로 내용이 흐르는 건 아이폰 앱에선 안 된다).
   *  ③ --ft-tabbar-h(본문 아래 여백·토스트·입력창이 탭 위에 서는 기준) = 알약 높이 + 간격.
   */
  const cap = read(join(ROOT, 'capacitor.config.ts'))
  const nativeColors = [...cap.matchAll(/backgroundColor:\s*['"](#[0-9a-fA-F]{6})['"]/g)].map((m) => (m[1] ?? '').toUpperCase())
  assert.ok(nativeColors.length > 0, 'capacitor.config.ts 에 backgroundColor 가 없다')
  assert.ok(new Set(nativeColors).size === 1, `capacitor.config.ts 의 backgroundColor 가 서로 다르다: ${[...new Set(nativeColors)].join(', ')}`)

  const css = read(join(ROOT, 'app', 'globals.css'))
  const m = css.match(/--ft-native-bg:\s*(#[0-9a-fA-F]{6})/)
  assert.ok(m, 'globals.css 에 --ft-native-bg 가 없다')
  const cssColor = (m?.[1] ?? '').toUpperCase()
  const nativeColor = nativeColors[0] ?? ''
  assert.equal(cssColor, nativeColor, `--ft-native-bg(${cssColor}) 와 capacitor backgroundColor(${nativeColor}) 가 다르다 — 상태바·홈바 구간에 색 띠가 생긴다`)
  // ① 앱 바탕 = 네이티브 색 — 알약 양옆으로 보이는 바탕이 홈바 구간과 이어진다.
  const pageBg = css.match(/html:has\(\[data-ft-chrome="app"\]\) body \{[^}]*background: var\(--app-page-bg, (#[0-9A-Fa-f]{6})\)/)?.[1]
  assert.equal(pageBg?.toUpperCase(), nativeColor, `앱 바탕(${pageBg})이 네이티브 홈바 구간 색(${nativeColor})과 다르다 — 떠 있는 탭 아래에 색 띠가 생긴다`)

  // ② 떠 있는 알약: 양옆 안쪽·완전 둥금·바닥 간격 변수.
  const bar = stripComments(read(join(ROOT, 'components', 'app', 'BottomTabBar.tsx')))
  const nav = bar.match(/<nav\s+aria-label="주 메뉴"[\s\S]*?>\s*\{LEFT/)?.[0] ?? ''
  assert.ok(nav, '아래 탭(nav 주 메뉴)을 못 찾았다')
  assert.match(nav, /left: 20,\s*right: 20,/, '아래 탭이 양옆 20 안쪽으로 떠 있지 않다(꽉 찬 바로 돌아갔다)')
  assert.match(nav, /borderRadius: 999/, '아래 탭이 둥근 알약이 아니다')
  assert.match(nav, /bottom: 'calc\(var\(--ft-tabbar-gap, 8px\) \+ env\(safe-area-inset-bottom\)\)'/, '아래 탭 바닥 간격이 --ft-tabbar-gap 을 안 쓴다 — 네이티브 앱에서 홈바 구간 위에 틈이 생긴다')
  const pillH = Number(bar.match(/const PILL_H = (\d+)/)?.[1])
  assert.ok(pillH >= 56 && pillH <= 68, `알약 높이(${pillH})가 이상하다`)
  assert.match(nav, /height: PILL_H/, '아래 탭 높이가 PILL_H 가 아니다')

  // ③ 높이 변수 = 알약 + 간격(웹 기본·네이티브 앱 둘 다).
  const base = css.match(/\[data-ft-chrome="app"\] \{[\s\S]*?--ft-tabbar-gap:\s*(\d+)px;\s*--ft-tabbar-h:\s*(\d+)px;/)
  assert.ok(base, '앱 틀 기본 --ft-tabbar-gap·--ft-tabbar-h 를 못 찾았다')
  assert.equal(Number(base?.[2]), pillH + Number(base?.[1]), `--ft-tabbar-h(${base?.[2]})가 알약 ${pillH} + 간격 ${base?.[1]} 과 다르다 — 마지막 줄·토스트가 탭에 가려진다`)
  const native = css.match(/html\.ft-native \[data-ft-chrome="app"\] \{\s*--ft-tabbar-gap:\s*0px;\s*--ft-tabbar-h:\s*(\d+)px;/)
  assert.ok(native, '네이티브 앱(html.ft-native)에서 탭 바닥 간격이 0 이 아니다 — 알약 밑으로 내용이 비치다 잘린다')
  assert.equal(Number(native?.[1]), pillH, `네이티브 앱 --ft-tabbar-h(${native?.[1]})가 알약 높이 ${pillH} 와 다르다`)
  const layoutSrc = read(join(ROOT, 'app', 'layout.tsx'))
  assert.match(layoutSrc, /if\(c\)\{h\.classList\.add\('ft-native'\);/, 'head 스크립트가 네이티브 앱에 ft-native 를 안 붙인다')
  // 업데이트 안내(앱 틀 밖이라 숫자)도 알약 위 12.
  const notice = stripComments(read(join(ROOT, 'components', 'NativeUpdateNotice.tsx')))
  assert.ok(notice.includes(`+ ${pillH + 12}px)`), `업데이트 안내가 떠 있는 탭(${pillH}) 위 12 에 서지 않는다`)
})


test('규칙85: 앱 화면의 머리말(kicker·Mono·eyebrow)에 영어만 있는 문구가 없어야 한다', () => {
  /**
   * # 왜 (2026-09-22 시니어 사용성 2단계)
   * "NOW FEATURING · DOG PROFILE · SUBSCRIPTION · BODY · WSAVA · MADE FOR · WEEK 2" — 장식으로
   * 넣은 영어 대문자 머리말이 부모님 세대에겐 "뭔가 못 읽는 게 있다"는 불안이 됐다.
   * 앱 화면의 kicker(.kicker/.s-kicker/.ck-kicker/.adj-kicker)·Mono 자식·eyebrow 는
   * 한글(또는 숫자·기호)이어야 한다. 그리고 그 클래스들의 CSS 에 uppercase·모노 자간이
   * 남아 있으면 한글이 "우 리 아 이"처럼 벌어진다(프로필에서 실제 발생) — 같이 잠근다.
   */
  const targets = [
    'components/v3/home/GreetingSection.tsx',
    'components/v3/home/ActiveDogCard.tsx',
    'components/v3/home/MyDogsSection.tsx',
    'components/v3/home/ThisWeekSection.tsx',
    'components/v3/home/EmptyHomeNoDogs.tsx',
    'components/v3/dog/WeightInputSheet.tsx',
    'components/analysis/AdjustSheet.tsx',
    'components/analysis/magazine/BoxMixCard.tsx',
    'components/analysis/magazine/DailyEnergyCard.tsx',
    'app/(main)/dashboard/page.tsx',
    'app/(main)/chat/page.tsx',
    'app/(main)/reports/page.tsx',
    'app/(main)/notifications/AlertsClient.tsx',
    'app/(main)/dogs/page.tsx',
    'app/(main)/dogs/[id]/DogDetailClient.tsx',
    'app/(main)/dogs/[id]/_components/SubscriptionCard.tsx',
    'app/(main)/dogs/[id]/_components/CurrentFormulaCard.tsx',
    'app/(main)/dogs/[id]/analyses/page.tsx',
    'app/(main)/dogs/[id]/diary/DiaryClient.tsx',
    'app/(main)/dogs/[id]/edit/EditDogClient.tsx',
    'app/(main)/dogs/[id]/health-care/page.tsx',
    'app/(main)/dogs/[id]/health/HealthLogClient.tsx',
    'app/(main)/dogs/[id]/reminders/RemindersClient.tsx',
    'app/(main)/dogs/[id]/vaccinations/VaccinationsClient.tsx',
    'app/(main)/dogs/[id]/vet-report/page.tsx',
    'app/(main)/dogs/[id]/plan/PlanClient.tsx',
    'app/(main)/dogs/[id]/checkin/CheckinClient.tsx',
    'app/(main)/dogs/[id]/survey/SurveyClient.tsx',
    'app/(main)/dogs/[id]/survey/steps/Allergy.tsx',
    'app/(main)/dogs/[id]/survey/steps/Body.tsx',
    'app/(main)/dogs/[id]/survey/steps/Diet.tsx',
    'app/(main)/dogs/[id]/survey/steps/Loading.tsx',
    'app/(main)/dogs/[id]/survey/steps/Status.tsx',
    'app/(main)/dogs/[id]/survey/steps/Stool.tsx',
    'app/(main)/mypage/MypageClient.tsx',
    'app/(main)/mypage/subscriptions/page.tsx',
    'app/(main)/mypage/accuracy/page.tsx',
    'app/(main)/mypage/addresses/AddressesClient.tsx',
    'app/(main)/mypage/certificate/[dogId]/CertificateClient.tsx',
    'app/(main)/mypage/consent/ConsentSettingsClient.tsx',
    'app/(main)/mypage/membership/page.tsx',
    'app/(main)/mypage/notifications/NotificationSettingsClient.tsx',
    'app/(main)/mypage/notifications/PreferencesPanel.tsx',
    'app/(main)/mypage/privacy/page.tsx',
  ]
  const englishOnly = /^[A-Za-z][A-Za-z &·.\-]*$/
  for (const rel of targets) {
    const src = stripComments(read(join(ROOT, ...rel.split('/'))))
    const hits: string[] = []
    for (const m of src.matchAll(/className="(?:s-|ck-|adj-)?kicker[^"]*"[^>]*>\s*([^<{]+?)\s*</g)) {
      if (englishOnly.test(m[1]!.trim())) hits.push(m[1]!.trim())
    }
    for (const m of src.matchAll(/<Mono[^>]*>\s*([^<{]+?)\s*<\/Mono>/g)) {
      if (englishOnly.test(m[1]!.trim())) hits.push(m[1]!.trim())
    }
    for (const m of src.matchAll(/\b(?:kicker|eyebrow)="([^"]+)"/g)) {
      if (englishOnly.test(m[1]!.trim())) hits.push(m[1]!.trim())
    }
    assert.deepEqual(hits, [], `${rel}: 영어만 있는 머리말 — ${hits.join(' / ')}`)
  }
  const dash = stripComments(read(join(ROOT, 'app', '(main)', 'dashboard', 'page.tsx')))
  assert.doesNotMatch(dash, /\['S', 'M', 'T', 'W', 'T', 'F', 'S'\]/, '홈 주간 달력 요일이 영문 약자다')

  // 한글 머리말 클래스의 CSS — uppercase·모노·넓은 자간이 다시 들어오면 한글이 벌어진다.
  const cssTargets: Array<[string, RegExp]> = [
    ['app/globals.css', /\[data-ft-chrome="app"\] \.kicker \{([^}]*)\}/g],
    ['app/(main)/dogs/[id]/survey/survey.css', /\.s-kicker \{([^}]*)\}/g],
    ['app/(main)/dogs/[id]/checkin/checkin.css', /\.ck-kicker \{([^}]*)\}/g],
    ['components/analysis/adjust-sheet.css', /\.adj-kicker \{([^}]*)\}/g],
  ]
  for (const [rel, re] of cssTargets) {
    const css = stripComments(read(join(ROOT, ...rel.split('/'))))
    const blocks = [...css.matchAll(re)].map((m) => m[1] ?? '')
    assert.ok(blocks.length >= 1, `${rel}: kicker 규칙이 없다`)
    for (const b of blocks) {
      assert.doesNotMatch(b, /text-transform:\s*uppercase/, `${rel}: 한글 머리말에 uppercase`)
      assert.doesNotMatch(b, /font-mono|Plex Mono|JetBrains Mono/, `${rel}: 한글 머리말에 모노 폰트`)
      const ls = b.match(/letter-spacing:\s*(-?[\d.]+)(em|px)?/)
      assert.ok(ls, `${rel}: 한글 머리말 규칙에 letter-spacing 이 없다`)
      assert.ok(parseFloat(ls![1]!) <= 0.02, `${rel}: 한글 머리말 자간이 넓다(${ls![0]})`)
    }
  }
  // 앱 스코프 .kicker 는 하나만 — 두 개면 뒤의 것이 앞을 덮어써서 프로필 "우 리 아 이"가 재발한다.
  const g = stripComments(read(join(ROOT, 'app', 'globals.css')))
  assert.equal([...g.matchAll(/\[data-ft-chrome="app"\] \.kicker \{/g)].length, 1, 'globals.css 의 [data-ft-chrome="app"] .kicker 규칙이 하나가 아니다')
})

test('규칙86: 앱 설문은 화면당 질문 하나 — 글자 12px 이상·대문자 변환 없음·큰 버튼·흐름은 lib/survey/flow 가 정본', () => {
  /**
   * # 왜 (2026-09-22 시니어 사용성 3단계)
   * 사장님 제보: 부모님 세대가 설문 글씨가 작고(선택 뱃지 9px·힌트 12.5px) 흐름이 어색하다
   * (한 화면에 질문 3~5개). 결정: 화면당 질문 하나, 선택지는 큰 세로 버튼, 아래 큰 '다음' 하나.
   * 이 규칙은 그 결정이 CSS·컴포넌트에서 조용히 되돌아가는 것을 막는다.
   *   - survey.css 의 모든 font-size ≥ 12px (뱃지·단위 최소), 본문/버튼은 각 규칙에서 16/17.
   *   - text-transform: uppercase 없음 (한글 머리말·태그).
   *   - 큰 버튼: .s-optbtn / .s-next-full / .s-gate-* 는 min-height ≥ 56px.
   *   - SurveyClient 는 화면 순서를 직접 갖지 않고 lib/survey/flow 를 쓴다(테스트된 순수 로직).
   *   - "STEP 03 / 07" 같은 영문 카운터 문구가 다시 들어오지 않는다.
   */
  const cssPath = join(ROOT, 'app', '(main)', 'dogs', '[id]', 'survey', 'survey.css')
  const css = stripComments(read(cssPath))
  const sizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => parseFloat(m[1] ?? '0'))
  assert.ok(sizes.length > 20, 'survey.css 에서 font-size 를 못 읽었다')
  const small = sizes.filter((v) => v < 12)
  assert.deepEqual(small, [], `survey.css 에 12px 미만 글자: ${small.join(', ')}`)
  assert.doesNotMatch(css, /text-transform:\s*uppercase/, 'survey.css 에 대문자 변환 — 한글 머리말이 벌어진다')
  for (const sel of ['.s-optbtn', '.s-next-btn.s-next-full', '.s-gate-primary, .s-gate-secondary']) {
    const i = css.indexOf(sel + ' {')
    assert.ok(i >= 0, `survey.css 에 ${sel} 규칙이 없다`)
    const block = css.slice(i, css.indexOf('}', i))
    const mh = block.match(/min-height:\s*(\d+)px/)
    assert.ok(mh && Number(mh[1]) >= 56, `${sel} 의 min-height 가 56px 미만(${mh?.[1] ?? '없음'}) — 어르신 터치 크기`)
  }

  const client = stripComments(
    read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'survey', 'SurveyClient.tsx')),
  )
  assert.match(client, /from '@\/lib\/survey\/flow'/, 'SurveyClient 가 lib/survey/flow 를 쓰지 않는다')
  assert.doesNotMatch(client, /const STEPS\s*=/, 'SurveyClient 에 화면 순서 상수가 되살아났다 — flow.ts 가 정본')
  assert.doesNotMatch(client, /STEP\s*\{/, '영문 STEP 카운터가 되살아났다')
  assert.match(client, /<GateScreen/, '선택 묶음 관문(GateScreen)이 없다 — "건너뛰고 결과 보기" 구조')
  // 관문에서 건너뛴 4개를 나중에 답하는 길 — 결과 화면 카드(?refine=1) ↔ 설문 page 시드 ↔ answers 플래그.
  assert.match(client, /optionalSkipped:\s*optChoice === 'skip'/, 'answers.optionalSkipped 플래그가 빠졌다 — 결과 화면 카드가 영원히 안 뜬다')
  const analysisView = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'analysis', 'AnalysisView.tsx')))
  assert.match(analysisView, /survey\?refine=1/, '결과 화면에 "정확도 올리기"(?refine=1) 진입점이 없다')
  const surveyPage = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'survey', 'page.tsx')))
  assert.match(surveyPage, /seedFromSurvey\(/, '설문 page 가 ?refine=1 시드(seedFromSurvey)를 넘기지 않는다')

  // 화면 컴포넌트: 각 *Screen 은 ScreenShell(질문 하나) 하나만 그린다. 옛 default export
  // (한 파일 = 한 스텝에 질문 여러 개) 로 돌아가지 않았는지.
  const stepsDir = join(ROOT, 'app', '(main)', 'dogs', '[id]', 'survey', 'steps')
  for (const f of ['Body.tsx', 'Stool.tsx', 'Diet.tsx', 'Allergy.tsx', 'Status.tsx', 'Pregnancy.tsx', 'Preferences.tsx']) {
    const src = stripComments(read(join(stepsDir, f)))
    assert.doesNotMatch(src, /export default function/, `${f}: default export 스텝 컴포넌트가 되살아났다`)
    const fns = [...src.matchAll(/export function (\w+Screen)\(/g)].map((m) => m[1])
    assert.ok(fns.length >= 1, `${f}: *Screen 컴포넌트가 없다`)
    for (const fn of fns) {
      const start = src.indexOf(`export function ${fn}(`)
      const next = src.slice(start + 1).search(/\nexport function /)
      const body = next >= 0 ? src.slice(start, start + 1 + next) : src.slice(start)
      const h1s = (body.match(/<ScreenShell/g) ?? []).length + (body.match(/<h1/g) ?? []).length
      assert.equal(h1s, 1, `${f}/${fn}: 화면에 큰 질문(h1)이 ${h1s}개 — 화면당 질문 하나`)
    }
  }
})

test('규칙87: 온보딩 여정 카드의 "체중 기록하기"는 프로필 안에서 그 자리 동작이어야 한다 (자기 자신 링크 금지)', () => {
  /**
   * # 왜 (2026-09-23 사장님 제보 — 땅콩이 프로필)
   * GracePeriodBanner 는 2026-07-24 홈 → 프로필 개요 최상단으로 옮겨졌는데, 3주차 CTA 의
   * 목적지 `/dogs/{id}` 는 홈 시절 그대로였다. 프로필에서 누르면 자기 자신으로 가는
   * 링크라 아무 일도 안 일어났다 — "눌렀는데 반응이 없다"는 어르신에게 앱이 고장난 것과 같다.
   * 카드는 action 을 표시하고, 프로필은 onAction 으로 그 자리의 체중 모달을 연다.
   */
  const banner = stripComments(read(join(ROOT, 'components', 'dashboard', 'GracePeriodBanner.tsx')))
  assert.match(banner, /label:\s*'체중 기록하기'[^\n]*action:\s*'weight'/, '3주차 CTA 에 action: weight 표시가 없다')
  assert.match(banner, /onAction\?:/, 'GracePeriodBanner 에 onAction prop 이 없다')
  assert.match(banner, /onClick=\{\(\) => onAction\(/, '카드가 onAction 을 호출하는 버튼을 그리지 않는다')
  const detail = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'DogDetailClient.tsx')))
  const i = detail.indexOf('<GracePeriodBanner')
  assert.ok(i >= 0, 'DogDetailClient 에 GracePeriodBanner 가 없다')
  const usage = detail.slice(i, detail.indexOf('/>', i))
  assert.match(usage, /onAction=/, '프로필이 GracePeriodBanner 에 onAction 을 넘기지 않는다 — 체중 기록하기가 다시 죽는다')
  assert.match(usage, /setShowWeightModal\(true\)/, 'onAction 이 체중 모달을 열지 않는다')
})

test('규칙88: 결제 퍼널(/plan·/order)은 하단 탭을 숨기고, 하단 고정 요소는 --ft-tabbar-h 로 탭 위에 선다', () => {
  /**
   * # 왜 (2026-09-23 에뮬레이터 실측)
   * 2026-09-21 하단 탭을 되살리자 플랜 화면의 "플랜 담기" 바와 주문 화면의 "결제" 바
   * (둘 다 position:fixed; bottom:0; z-40)가 탭 아래 깔려 버튼이 통째로 가려졌다 —
   * 첫 결제에서 돈이 새는 자리가 이틀간 그대로였다. 결제 퍼널은 탭 없이(헤더만),
   * 그 밖의 하단 고정 요소(토스트·채팅 입력창)는 숫자 대신 --ft-tabbar-h 로 탭 위에 선다.
   */
  const chrome = stripComments(read(join(ROOT, 'components', 'AppChrome.tsx')))
  assert.match(chrome, /const CHECKOUT_RE = \/\\\/dogs\\\/\[\^\/\]\+\\\/\(plan\|order\)/, 'AppChrome 에 결제 퍼널 판별(CHECKOUT_RE)이 없다')
  assert.match(chrome, /const checkout = CHECKOUT_RE\.test\(pathname\)/, '결제 퍼널 판정(checkout)이 없다')
  assert.match(chrome, /const tabBarHidden = focusMode \|\| checkout/, '탭바 숨김이 결제 퍼널을 포함하지 않는다')
  assert.match(chrome, /hidden=\{tabBarHidden\}/, 'BottomTabBar 에 tabBarHidden 을 넘기지 않는다 — 플랜 담기/결제 버튼이 탭에 가려진다')
  // 2026-10-09: 주문 영수증(시안 M09)도 탭이 없는 화면이라 같은 갈래(focusMode || receipt) — 규칙168 이 receipt 쪽을 본다.
  assert.match(chrome, /focusMode(?:\s*\|\|\s*receipt)?\s*\?\s*'pb-\[env\(safe-area-inset-bottom\)\]'/, 'main 하단 패딩이 몰입 화면과 같이 움직이지 않는다')
  // 결제 퍼널은 탭 대신 결제 바가 떠 있다 — 여백 0 이면 마지막 줄이 바 밑에 가려진다(9/23 실측).
  assert.match(chrome, /checkout\s*\?\s*'pb-\[calc\(var\(--ft-paybar-h/, '결제 퍼널 본문 여백이 결제 바 높이(--ft-paybar-h)를 쓰지 않는다')
  assert.match(read(join(ROOT, 'app', 'globals.css')), /--ft-paybar-h:\s*\d+px/, 'globals.css 에 --ft-paybar-h 가 없다')

  const bar = stripComments(read(join(ROOT, 'components', 'app', 'BottomTabBar.tsx')))
  assert.match(bar, /\/subscription\/\.test\(p\)/, '강아지별 정기배송(/dogs/:id/subscription)이 정기배송 탭으로 잡히지 않는다')
  assert.match(bar, /p\.startsWith\('\/notifications'\)/, '알림 설정 화면에서 내 정보 탭이 꺼진다')

  const toast = stripComments(read(join(ROOT, 'components', 'ui', 'Toast.tsx')))
  assert.match(toast, /var\(--ft-tabbar-h/, '토스트 오프셋이 탭바 변수를 쓰지 않는다')
  for (const rel of ['app/(main)/chat/ChatClient.tsx', 'app/(main)/mypage/cs/CsThreadClient.tsx']) {
    const src = stripComments(read(join(ROOT, ...rel.split('/'))))
    assert.doesNotMatch(src, /bottom-\[calc\(\d+px\+env/, `${rel}: 하단 고정 입력창이 숫자 오프셋을 쓴다 — --ft-tabbar-h 로`)
  }

  const proxy = read(join(ROOT, 'proxy.ts'))
  const block = /APP_ONLY_PREFIXES[^=]*=\s*\[([\s\S]*?)\n\]/.exec(proxy)
  const appOnly = [...(block?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]!)
  for (const p of ['/chat', '/reports', '/notifications', '/mypage/membership']) {
    assert.ok(appOnly.includes(p), `proxy APP_ONLY_PREFIXES 에 ${p} 가 없다 — (main) 앱 화면이 웹에 새어 나온다`)
  }
})

test('규칙89: 어드민 "설문 기록"(/admin/surveys) — 두 내비에 등록, 목록·상세 페이지 존재, 모든 조회가 error 를 꺼낸다', () => {
  /**
   * # 왜 (2026-09-24 사장님)
   * 고객이 "이게 맞는지 모르겠다"며 분석 캡처를 보냈는데 어드민엔 그 고객이 설문에 뭐라고
   * 답했는지 볼 화면이 없었다(DB 를 직접 열어야 했다). 이 화면은 캡처 대응·체험단 운영의
   * 기본 창이라, 내비에서 빠지거나 조회 실패를 "설문 없음"으로 위장하면 다시 눈먼 상태가 된다.
   */
  const shell = stripComments(read(join(ROOT, 'components', 'adminui', 'admin-shell-next.tsx')))
  const nav = stripComments(read(join(ROOT, 'components', 'admin', 'AdminNav.tsx')))
  assert.match(shell, /href:\s*'\/admin\/surveys'/, '데스크톱 어드민 내비에 설문 기록이 없다')
  assert.match(nav, /href:\s*'\/admin\/surveys'/, '모바일 어드민 내비에 설문 기록이 없다')
  for (const rel of ['app/admin/surveys/page.tsx', 'app/admin/surveys/[id]/page.tsx', 'app/admin/surveys/_data.ts', 'lib/survey/labels.ts']) {
    assert.ok(existsSync(join(ROOT, ...rel.split('/'))), `${rel} 가 없다`)
  }
  const data = stripComments(read(join(ROOT, 'app', 'admin', 'surveys', '_data.ts')))
  // 규칙1: `{ data } = await` 처럼 error 를 버리는 조회가 없어야 한다.
  assert.doesNotMatch(data, /const \{ data \} = await/, '설문 기록 조회가 error 를 버린다 — 실패가 "설문 없음"으로 위장된다')
  assert.match(data, /if \(res\.error\) return \{ ok: false/, '보조 조회(강아지·보호자·분석·처방·구독) 실패를 화면에 알리지 않는다')
  const list = stripComments(read(join(ROOT, 'app', 'admin', 'surveys', 'page.tsx')))
  assert.match(list, /isAdmin\(/, '설문 기록 목록이 관리자 판정 없이 열린다')
  assert.match(list, /describeBox\(/, '목록에 추천 박스가 빠졌다 — 사장님 요구("추천 박스까지")')
  const detail = stripComments(read(join(ROOT, 'app', 'admin', 'surveys', '[id]', 'page.tsx')))
  assert.match(detail, /isAdmin\(/, '설문 상세가 관리자 판정 없이 열린다')
  assert.match(detail, /describeSurvey\(/, '상세에 답변 한글 변환이 빠졌다')

  // 2026-09-24 사장님(같은 날 두 번째 제보): 땅콩 카드가 "치킨 70% · 흑돼지 30%" — "우리 30% 는 없다".
  // 원인은 엔진 초안(formula.v3.layerA.picks)을 그대로 그린 것. 실제 저장 박스(lineRatios)는
  // 치킨 100% 였고 고객 화면은 전부 snapBoxLines(lineRatios) 를 본다. 어드민도 같은 함수를 써야
  // 사장님과 고객이 같은 박스를 본다 — 초안 비율이 표시 박스로 흘러드는 코드를 잠근다.
  const labels = stripComments(read(join(ROOT, 'lib', 'survey', 'labels.ts')))
  assert.match(labels, /from '\.\.\/personalization\/boxComposition\.ts'/, '어드민 박스 표시가 고객 카드와 같은 스냅 규칙(boxComposition.snapBoxLines)을 안 쓴다')
  assert.match(labels, /snapBoxLines\(ratios\)/, '표시 박스가 lineRatios 를 snapBoxLines 로 스냅하지 않는다')
  assert.doesNotMatch(labels, /picks\.push\(\{[^}]*\bratio,/, '엔진 초안(layerA.picks)의 비율이 그대로 표시 박스에 들어간다 — 70/30 이 사장님 화면에 뜬다')
  assert.doesNotMatch(labels, /ratio >= 0\.3/, '박스 스냅 임계를 따로 구현했다 — boxComposition.SECOND_LINE_MIN 하나만 정본')

  // 2026-10-01 사장님 "두 개 다 설문이 같은데 값이 달라"(로아): 간식 답만 다른 두 설문 카드에
  // 두 번째 설문의 박스가 둘 다 붙었다. 처방은 강아지 단위라 설문과 짝지을 때 다음 설문을 경계로.
  assert.match(data, /pickSurveyFormula\(list, createdMs, nextMs\)/, '설문 카드가 다음 설문 경계 없이 처방을 고른다 — 다음 설문의 박스가 이 설문 것처럼 뜬다')
  assert.match(labels, /nextSurveyMs - 60_000/, 'pickSurveyFormula 에 다음 설문 상한이 없다')
  assert.match(list, /formulaSource === 'previous'/, '이전 설문의 처방을 라벨 없이 이 설문 박스처럼 보인다')
  assert.match(labels, /chips\.push\(`간식 \$\{snack\}`\)/, '설문 칩에 간식이 없다 — g/일만 다른 두 설문이 같아 보인다')
})

test('규칙90: 처방 근거 문구(reasoning) 에 영문 라인명·라인 비율% 금지 — 고객 재제안 화면에 그대로 나간다', () => {
  /**
   * # 왜 (2026-09-24 사장님 "우리 30% 는 없다")
   * reasoning.action/chipLabel/trigger 는 고객 재제안 화면(ApproveClient '왜 이렇게 제안했어요')과
   * 어드민 설문 기록에 그대로 렌더된다. "Weight 40% → 50%"·"Chicken 70% / Pork 30%" 같은 문구는
   * 임상 룰의 **내부 라인 비율**이라 실제 박스(1종 100% / 2종 50:50)와 맞지 않고, 영문 라인명은
   * 고객 문구 규칙(한글·비율% 금지)에 어긋난다. 이름은 nameKo, 비율은 방향("올렸어요")만.
   * 실행 스윕은 lib/personalization/reasonCopy.test.ts — 여긴 템플릿 소스를 직접 잠근다.
   */
  const ENGLISH_LINE = /\b(Weight|Joint|Skin|Premium|Basic|Chicken|Duck|Pork|Beef|Salmon)\b/
  // 줄 단위 검사 — 따옴표 짝 맞추기는 `Hill\'s` 같은 아포스트로피에 흔들린다(처음 시도에서 3건씩 번갈아 잡힘).
  // 근거 문구는 ① `action:`/`chipLabel:`/`trigger:` 줄, ② 따옴표로 시작하는 이어지는 문자열 줄에만 있다.
  const REASON_LINE = /^\s*(action|chipLabel|trigger):|^\s*['"`]/
  // 2026-09-24 실측: firstBox 223줄 · nextBox 36줄 · skuMap 8줄. 크게 줄면 추출이 깨진 것.
  const MIN_LINES: Record<string, number> = { 'lib/personalization/firstBox.ts': 150, 'lib/personalization/nextBox.ts': 25, 'lib/personalization/skuMap.ts': 5 }
  for (const rel of Object.keys(MIN_LINES)) {
    const lines = stripComments(read(join(ROOT, ...rel.split('/')))).split(/\r?\n/)
    const reasonLines = lines.filter((l) => REASON_LINE.test(l))
    assert.ok(reasonLines.length >= MIN_LINES[rel]!, `${rel}: 근거 문구 줄이 ${reasonLines.length}개뿐 — 검사 대상 추출이 깨졌다(카나리아)`)
    const english = reasonLines.filter((l) => ENGLISH_LINE.test(l))
    assert.deepEqual(english, [], `${rel}: 근거 문구에 영문 라인/레시피명 — ${english.map((l) => l.trim().slice(0, 80)).join(' | ')}`)
    // 라인 비율 표기: "X% → Y%", "≥30%", "라인 N%", "메인 N%" 류. 칼로리·영양소 %(간식 5%, 지방 ≤14% DM)는 허용.
    const pct = reasonLines.filter((l) => /%\s*→|→\s*\$\{[^}]*\}%|≥\s*\d+%|라인 \$\{|메인 \$\{[^}]*\}%|\d+%\s*(→|위주|\(단일)/.test(l))
    assert.deepEqual(pct, [], `${rel}: 근거 문구에 라인 비율%가 남아 있다 — ${pct.map((l) => l.trim().slice(0, 80)).join(' | ')}`)
    // 설문 키를 그대로 붙이는 것도 금지 — "선호 단백질: beef, salmon, pork, lamb" 가 trigger 로 새어 나갔다(사장님 "SALMON 이 왜 이렇게 보여").
    const rawKeys = reasonLines.filter((l) => /preferredProteins\.join|allergies\.join\(/.test(l))
    assert.deepEqual(rawKeys, [], `${rel}: 설문 키 배열을 그대로 문구에 붙인다 — 한글 이름으로: ${rawKeys.map((l) => l.trim().slice(0, 80)).join(' | ')}`)
    // 영문 표시명(FOOD_LINE_META[x].name / meta.name)을 고객 문구 템플릿에 쓰지 않는다 — nameKo 만.
    const name = reasonLines.filter((l) => /\.name\}/.test(l))
    assert.deepEqual(name, [], `${rel}: 근거 문구 템플릿이 영문 name 을 쓴다 — nameKo 로: ${name.map((l) => l.trim().slice(0, 80)).join(' | ')}`)
  }
})

test('규칙91: 콜드 스타트 링크(getLaunchUrl)는 shouldHandleLaunchUrl 로 한 번만 처리한다', () => {
  /**
   * # 왜 (2026-09-24 에뮬레이터 실측)
   * 안드로이드 getLaunchUrl() 은 프로세스가 사는 동안 같은 값을 돌려주고, 이걸 읽는
   * NativeShellBridge 는 문서를 새로 불러올 때마다 다시 마운트된다. 가드 없이 go() 하면
   * 링크로 앱을 연 사용자가 새로고침·'다시 시도'·카카오 로그인 복귀·토스 카드 등록 복귀
   * (결제키 저장 화면)마다 처음 링크로 끌려간다. getLaunchUrl 을 부르는 모든 곳이
   * 같은 가드를 거치게 잠근다.
   */
  const callers = walk(join(ROOT, 'components'))
    .concat(walk(join(ROOT, 'app')), walk(join(ROOT, 'lib')))
    .filter((f) => !/\.test\.tsx?$/.test(f))
    .filter((f) => /getLaunchUrl\s*\(/.test(stripComments(read(f))))
  assert.ok(callers.length >= 1, 'getLaunchUrl 호출처를 못 찾았다 — 검사 대상 추출이 깨졌다(카나리아)')
  for (const f of callers) {
    const src = stripComments(read(f))
    assert.match(src, /shouldHandleLaunchUrl\(/, `${f}: getLaunchUrl 결과를 shouldHandleLaunchUrl 없이 쓴다 — 새로고침마다 처음 링크로 끌려간다`)
  }
})

test('규칙92: 인증 전 로그인은 원인을 알리고, 인증 메일을 다시 받을 수 있다', () => {
  /**
   * # 왜 (2026-09-24 출시 전 점검)
   * 로그인 화면이 email_not_confirmed 를 "이메일 또는 비밀번호가 올바르지 않아요"로 보여 줬고,
   * 재발송 수단이 제품 어디에도 없었다. 9/10 실제 고객이 3분간 9번 막히다 '비밀번호 찾기'로
   * 우회했다(인증 로그). 로그인 화면과 가입 직후 "메일 보냈어요" 두 화면에 재발송을 잠근다.
   */
  const login = stripComments(read(join(ROOT, 'app', '(auth)', 'login', 'page.tsx')))
  assert.match(login, /isEmailNotConfirmed\(error\)/, '로그인 화면이 인증 전 오류를 따로 가르지 않는다 — 비밀번호 오류로 보인다')
  assert.match(login, /<ResendConfirmationButton/, '로그인 화면에 인증 메일 재발송이 없다')
  for (const rel of ['app/start/join/page.tsx', 'app/start/StartSurvey.tsx']) {
    const src = stripComments(read(join(ROOT, ...rel.split('/'))))
    assert.match(src, /<ResendConfirmationButton/, `${rel}: "메일 보냈어요" 화면에 재발송이 없다`)
  }
  const btn = stripComments(read(join(ROOT, 'components', 'auth', 'ResendConfirmationButton.tsx')))
  assert.match(btn, /auth\.resend\(\{ type: 'signup'/, '재발송 버튼이 가입 인증 메일을 다시 보내지 않는다')
})

test('규칙93: 설문·체크인·첫 박스 기록 INSERT 는 강아지 권한을 보고, 이메일 변경은 알림 주소로 동기화된다', () => {
  /**
   * # 왜 (2026-09-24 보안 점검)
   * surveys·dog_checkins·feeding_outcomes 의 INSERT 정책이 user_id 만 봐서 남의 강아지에 설문을
   * 넣을 수 있었다 — 그 설문이 다음 박스 처방·알레르기 게이트에 쓰인다. 마이그레이션 파일에서
   * 각 표의 **마지막** INSERT 정책 정의가 has_dog_role 을 포함하는지 본다(원격 DB 는 MCP 로 적용).
   * 그리고 auth.users 이메일 변경 → profiles.email 트리거가 있어야 한다(모든 발송이 profiles.email).
   */
  const dir = join(ROOT, 'supabase', 'migrations')
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  assert.ok(files.length > 50, `마이그레이션 ${files.length}개뿐 — 경로가 깨졌다(카나리아)`)
  for (const table of ['surveys', 'dog_checkins', 'feeding_outcomes']) {
    let last: string | null = null
    for (const f of files) {
      const sql = read(join(dir, f)).replace(/--[^\n]*/g, '')
      const re = new RegExp(String.raw`create policy[^;]*?on (?:public\.)?` + table + String.raw`\s+for insert[^;]*;`, 'gi')
      for (const m of sql.match(re) ?? []) last = `${f}: ${m}`
    }
    assert.ok(last, `${table}: INSERT 정책 정의를 마이그레이션에서 못 찾았다(카나리아)`)
    assert.match(last!, /has_dog_role\(\s*dog_id/i, `${table}: 마지막 INSERT 정책이 강아지 권한을 안 본다 — ${last!.slice(0, 160)}`)
  }
  const all = files.map((f) => read(join(dir, f)).replace(/--[^\n]*/g, '')).join('\n')
  assert.match(all, /after update of email on auth\.users[\s\S]{0,120}sync_profile_email_from_auth/i, '이메일 변경 → profiles.email 동기화 트리거가 없다 — 알림이 옛 주소로 간다')
})

test('규칙94: AI 호출 경로는 사용자별 하루 한도를 걸고 Anthropic 원문 오류를 고객에게 주지 않는다 · 문의 자동답장은 입력을 인용하지 않는다 · 웹 푸시는 푸시 서비스 주소에만', () => {
  /**
   * # 왜 (2026-09-24 보안 점검)
   * - AI: 쿨다운이 고객이 지울 수 있는 analyses 값으로만 판정돼 한 명이 무한히 AI 를 부를 수
   *   있었고, 실패 시 Anthropic 영문 원문이 고객 화면으로 나갔다.
   * - 문의: 로그인 없이 아무 주소로, 입력한 이름·내용을 인용한 메일을 보낼 수 있었다(피싱 중계).
   * - 푸시: 임의 URL 을 구독 주소로 넣으면 서버가 그 호스트로 요청했다(SSRF).
   */
  // 관리자 전용 경로(app/api/admin — 블로그 초안 등)는 고객이 부를 수 없어 제외.
  const aiRoutes = walk(join(ROOT, 'app', 'api'))
    .filter((f) => !/[\\/]app[\\/]api[\\/]admin[\\/]/.test(f))
    .filter((f) => /api\.anthropic\.com\/v1\/messages/.test(read(f)))
  assert.ok(aiRoutes.length >= 3, `Anthropic 을 부르는 라우트를 ${aiRoutes.length}개밖에 못 찾았다(카나리아)`)
  for (const f of aiRoutes) {
    const src = stripComments(read(f))
    assert.match(src, /checkAiUserDailyLimit\(/, `${f}: 사용자별 하루 AI 한도가 없다`)
    assert.doesNotMatch(src, /message:\s*(?:data|err)\.error\?\.message/, `${f}: Anthropic 원문 오류를 고객에게 돌려준다`)
  }
  const contact = stripComments(read(join(ROOT, 'app', 'api', 'contact', 'route.ts')))
  const userMail = contact.slice(contact.indexOf('function renderUserEmail'))
  assert.ok(userMail.length > 100, 'renderUserEmail 을 못 찾았다(카나리아)')
  assert.doesNotMatch(userMail, /escapeHtml\((?:name|message)\)/, '문의 자동답장이 입력한 이름·내용을 인용한다 — 아무 주소로 피싱 문구를 보낼 수 있다')
  const schemas = stripComments(read(join(ROOT, 'lib', 'api', 'schemas.ts')))
  assert.match(schemas, /refine\(isAllowedPushEndpoint/, '웹 푸시 구독 스키마가 푸시 서비스 주소를 검사하지 않는다')
  const push = stripComments(read(join(ROOT, 'lib', 'push.ts')))
  assert.match(push, /if \(!isAllowedPushEndpoint\(row\.endpoint\)\)/, '발송 직전 푸시 주소 검사가 없다 — DB 직접 삽입으로 우회된다')
})

test('규칙96: 청구가 쓰는 할인 사유 값은 전부 orders CHECK 에 있고, 고객 화면용 한글 이름이 있다', () => {
  /**
   * # 왜 (2026-09-24 출시 전 점검)
   * 체험단(f358b347)이 discount_reason 에 'trial_cheap'·'trial_half' 를 쓰기 시작했는데 orders 의
   * CHECK 는 ('tier','promotion','none') 뿐이었다 → 체험단 청구가 주문 insert 에서 전부 실패
   * (돈은 안 나가고 박스도 안 나감, 매일 반복). 코드의 사유 값 · DB 허용값 · 화면 이름 셋을 잠근다.
   */
  const discountSrc = stripComments(read(join(ROOT, 'lib', 'discount.ts')))
  const autoSrc = stripComments(read(join(ROOT, 'lib', 'payments', 'auto-discount.ts')))
  const typeLine = discountSrc.match(/export type DiscountReason\s*=\s*([^\n]+)/)
  assert.ok(typeLine, 'DiscountReason 타입을 못 찾았다(카나리아)')
  const used = new Set<string>([...typeLine![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!))
  for (const m of autoSrc.matchAll(/reason:\s*[^\n]*/g)) {
    // `trial.phase === 'cheap' ? ...` 의 비교값은 사유가 아니다 — 비교 대상 문자열을 먼저 지운다.
    const assigned = m[0].replace(/[!=]==\s*'[a-z_]+'/g, '')
    for (const v of assigned.matchAll(/'([a-z_]+)'/g)) used.add(v[1]!)
  }
  assert.ok(used.has('trial_cheap') && used.has('tier'), `사유 값 추출이 깨졌다(카나리아): ${[...used].join(',')}`)

  const dir = join(ROOT, 'supabase', 'migrations')
  let lastDef: string | null = null
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    const sql = read(join(dir, f)).replace(/--[^\n]*/g, '')
    const m = sql.match(/add constraint orders_discount_reason_check[\s\S]*?;/i)
    if (m) lastDef = m[0]
  }
  assert.ok(lastDef, 'orders_discount_reason_check 정의를 마이그레이션에서 못 찾았다(카나리아)')
  const allowed = new Set([...lastDef!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!))
  const missing = [...used].filter((v) => !allowed.has(v))
  assert.deepEqual(missing, [], `DB CHECK 가 허용하지 않는 할인 사유를 청구가 쓴다 → 주문 insert 실패: ${missing.join(',')}`)

  const labelSrc = read(join(ROOT, 'lib', 'commerce', 'discount-reason.ts'))
  const noLabel = [...used].filter((v) => v !== 'none' && !new RegExp(`\\b${v}:`).test(labelSrc))
  assert.deepEqual(noLabel, [], `고객 화면 할인 이름이 없는 사유 — 영수증에 내부 코드가 찍힌다: ${noLabel.join(',')}`)
})

test('규칙97: 앱 네이티브 흐름 — intent: 링크 처리 · 모달/결제 화면 하드웨어 뒤로가기 · 결제창 복귀 로딩 해제 · 안드로이드 알림 채널', () => {
  /**
   * # 왜 (2026-09-24 출시 전 점검, 에뮬레이터 실측)
   * - 안드로이드는 `intent://` 링크를 받을 앱이 없어 항상 무반응 → 카카오 웹 로그인의 "카카오톡으로
   *   로그인"·카드사 앱 전환이 죽어 있었다(9/10 실고객 카카오 4회 무응답). MainActivity 가 직접 푼다.
   * - div 모달 11곳이 하드웨어 뒤로가기를 안 받아 작성 중 일기가 날아가고 홈 튜토리얼에서 앱이 꺼졌다.
   * - 카드 등록 완료/실패 화면에서 뒤로 가면 토스 창·등록 화면으로 돌아가 이중 등록을 부른다.
   * - 토스 창에서 스와이프로 돌아오면 등록·결제 버튼이 "진행 중"에 굳었다.
   * - 서버는 FCM channel_id 'default' 로 보내는데 그 채널을 만드는 코드가 없었다(헤드업 안 뜸).
   */
  const main = read(join(ROOT, 'android', 'app', 'src', 'main', 'java', 'com', 'farmerstail', 'app', 'MainActivity.java'))
  assert.match(main, /"intent"\.equalsIgnoreCase\(url\.getScheme\(\)\)/, 'MainActivity 가 intent: 링크를 처리하지 않는다 — 안드로이드에서 무반응')
  assert.match(main, /Intent\.parseUri\([^)]*Intent\.URI_INTENT_SCHEME\)/, 'intent: 를 Intent.parseUri 로 풀지 않는다')
  assert.match(main, /setComponent\(null\)[\s\S]{0,80}setSelector\(null\)/, 'intent: 를 열 때 컴포넌트·셀렉터를 지우지 않는다(보안)')

  const modal = stripComments(read(join(ROOT, 'lib', 'ui', 'useModalA11y.ts')))
  assert.match(modal, /addEventListener\(NATIVE_BACK_EVENT/, 'useModalA11y 가 하드웨어 뒤로가기를 받지 않는다 — div 모달이 뒤로가기로 안 닫힌다')
  for (const rel of ['app/subscribe/billing-success/page.tsx', 'app/subscribe/billing-fail/page.tsx']) {
    assert.match(stripComments(read(join(ROOT, ...rel.split('/')))), /addEventListener\(NATIVE_BACK_EVENT/, `${rel}: 뒤로가기가 토스 창으로 되돌아간다`)
  }
  for (const rel of ['app/subscribe/billing-auth/page.tsx', 'app/(main)/dogs/[id]/order/OrderClient.tsx']) {
    assert.match(stripComments(read(join(ROOT, ...rel.split('/')))), /useResetLoadingOnRestore\(/, `${rel}: 결제창에서 돌아오면 버튼이 진행 중에 굳는다`)
  }

  const nativePush = stripComments(read(join(ROOT, 'lib', 'push', 'native.ts')))
  const channel = nativePush.match(/channel_id:\s*'([^']+)'/)
  assert.ok(channel, 'FCM channel_id 를 못 찾았다(카나리아)')
  const cap = stripComments(read(join(ROOT, 'lib', 'capacitor.ts')))
  assert.match(cap, new RegExp(`createChannel\\(\\{\\s*id:\\s*'${channel![1]}'`), `서버가 쓰는 채널 '${channel![1]}' 을 앱이 만들지 않는다 — 알림이 폴백 채널로 떨어진다`)
  const auto = cap.slice(cap.indexOf('export async function autoRegisterNativePush'))
  assert.match(auto.slice(0, 600), /ensureAndroidNotificationChannel\(\)/, '이미 등록된 기기에서도 채널을 보장하지 않는다 — 기존 사용자는 채널이 영영 안 생긴다')

  const bridge = stripComments(read(join(ROOT, 'components', 'NativeShellBridge.tsx')))
  assert.match(bridge, /kakaoChannelAppUrl\(/, '앱에서 카카오 채널 링크가 WebView 안에 열린다 — 카카오톡으로 넘어가지 못한다')
})

test('규칙95: 돈 경로의 DB 쓰기는 결과(error)를 본다 — 맨 await 로 update/insert 금지', () => {
  /**
   * # 왜 (2026-09-24 출시 전 점검)
   * 규칙32·39 는 `const { data } =` 형태만 잡아서, `await supabase.from(x).update(...)` 처럼 결과를
   * 통째로 버리는 쓰기는 빠져나갔다. 실제로: 카드 거절 시 구독 행 갱신(재시도·정지·멱등키)을 안 봐서
   * 실패해도 크론이 초록이었고, 결제 확인의 환불 대기열 insert 는 try/catch 로 감쌌지만 insert 는
   * throw 하지 않아 "돈은 나갔는데 대기열도 알림도 없는" 경로였다. 돈 경로 파일에 한해 잠근다.
   */
  const MONEY = [
    'app/api/cron/subscription-charge/route.ts',
    'app/api/cron/refund-retry/route.ts',
    'app/api/payments/webhook/route.ts',
    'app/api/payments/confirm/route.ts',
    'app/api/payments/billing-issue/route.ts',
    'app/api/orders/[id]/cancel/route.ts',
    'app/api/subscriptions/create/route.ts',
    // 2026-09-25 3차 점검 — 관리자 부분환불(환불 원장·재고 복원)도 돈 경로다.
    'app/api/admin/orders/[id]/partial-cancel/route.ts',
  ]
  const offenders: string[] = []
  // ★문장 끝까지 본다(2026-09-25). 예전 창(6줄)은 다중행 타입 캐스트 뒤의 `.update(` 를
  //   못 봤고(청구 성공 행 갱신), 식별자 목록에 `adminTyped` 가 없어 환불 재시도 큐 갱신
  //   4곳이 통째로 빠졌다. 들여쓰기가 더 깊거나 `.`·`)`·`}` 로 시작하는 줄을 같은 문장으로 친다.
  const indentOf = (l: string) => l.length - l.trimStart().length
  for (const rel of MONEY) {
    const lines = stripComments(read(join(ROOT, ...rel.split('/')))).split('\n')
    lines.forEach((l, i) => {
      if (!/^\s*await \(?\s*(supabase|admin|adminTyped|untyped|ordersAdmin)\b/.test(l)) return
      const base = indentOf(l)
      let j = i + 1
      while (j < lines.length) {
        const t = lines[j]!.trimStart()
        if (t === '') break
        if (indentOf(lines[j]!) > base || /^[.)}\]]/.test(t)) {
          j++
          continue
        }
        break
      }
      const stmt = lines.slice(i, j).join(' ')
      if (/\.(update|insert|upsert|delete)\(/.test(stmt)) offenders.push(`${rel}:${i + 1} ${l.trim().slice(0, 60)}`)
    })
    // Promise.all 로 쓰기를 묶고 결과를 버리는 형태도 같다.
    lines.forEach((l, i) => {
      if (/^\s*await Promise\.all\(\[/.test(l) && /\.(update|insert|upsert)\(/.test(lines.slice(i, i + 25).join(' '))) {
        offenders.push(`${rel}:${i + 1} await Promise.all([...쓰기]) — 결과를 변수로 받아 error 를 볼 것`)
      }
    })
  }
  assert.deepEqual(offenders, [], `결과를 버리는 돈 경로 쓰기:\n${offenders.join('\n')}`)
})

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09-25 출시 전 점검 3차 (탐색 3: 고객 여정 · 발송·운영 · 라이브 DB) — 규칙98~103
// ─────────────────────────────────────────────────────────────────────────────

test('규칙98: 배송조회(tracker.delivery)는 키를 싣고, 인증 실패를 초록으로 삼키지 않으며, 상류 영어 문장을 고객에게 보이지 않는다', () => {
  /**
   * tracker.delivery 가 키 필수로 바뀌어 모든 조회가 "Authorization header is missing." 을
   * 받았다(실측). 크론은 그 오류를 '아직 조회 안 됨'으로 건너뛰고 200 을 돌려줘 자동
   * 배송완료가 한 번도 안 됐는데 초록이었고, 고객 배송조회 화면엔 그 영어 문장이 떴다.
   */
  const poll = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'tracking-poll', 'route.ts')))
  const pub = stripComments(read(join(ROOT, 'app', 'api', 'tracking', 'route.ts')))
  for (const [name, body] of [['tracking-poll', poll], ['api/tracking', pub]] as const) {
    assert.ok(body.includes('trackerAuthHeader('), `${name}: 인증 헤더를 만들지 않는다`)
    assert.ok(/Authorization:\s*authHeader/.test(body), `${name}: fetch 에 Authorization 을 싣지 않는다`)
    assert.ok(body.includes('isTrackerAuthError('), `${name}: 인증 실패를 '송장 없음'과 구분하지 않는다`)
  }
  assert.ok(
    /TRACKER_NOT_CONFIGURED[\s\S]*?status:\s*500/.test(poll) && /TRACKER_AUTH_REJECTED[\s\S]*?status:\s*500/.test(poll),
    'tracking-poll: 키 없음·키 거절을 5xx(=cron_health error)로 올려야 한다',
  )
  assert.ok(!/json\.errors\[0\]\?\.message\s*\?\?/.test(pub), 'api/tracking: 상류 오류 원문을 고객 메시지로 넘긴다')
  const env = read(join(ROOT, 'lib', 'env.ts'))
  for (const k of ['DELIVERY_TRACKER_CLIENT_ID', 'DELIVERY_TRACKER_CLIENT_SECRET']) {
    assert.ok((env.split(k).length - 1) >= 2, `lib/env.ts: ${k} 가 스키마·런타임 맵 양쪽에 있어야 한다`)
  }
})

test('규칙99: 박스 라벨 주소 = 청구 주소(단일 함수) · 결제 증거 없는 박스는 라벨·조리에서 빠진다', () => {
  /**
   * 피킹 리스트 라벨이 subscriptions.address(가입 때 굳은 값)를 찍어, 이사한 고객은
   * 청구·주문은 새 주소, 박스는 옛 주소로 나갔다. 또 '청구 지연'(빨간 배지)과
   * '청구 시각이 지났는데 미청구'는 발송 금지 판정에서 빠져 라벨이 인쇄됐다.
   * 신청서 주소는 마지막 대안 — 기본 배송지·프로필이 비면 결제가 매일 건너뛰어졌다.
   */
  const pick = stripComments(
    read(join(ROOT, 'app', 'admin', 'personalization', 'picking-list', 'page.tsx')),
  )
  assert.ok(pick.includes('pickShippingTarget('), '피킹 리스트가 청구와 같은 배송지 함수를 안 쓴다')
  assert.ok(!/recipientName:\s*sub\.recipient_name/.test(pick), '라벨 수령인을 가입 스냅샷에서 읽는다')
  assert.ok(!/\[sub\.address,\s*sub\.address_detail\]/.test(pick), '라벨 주소를 가입 스냅샷에서 읽는다')
  for (const k of ['overdueNotCharged:', 'notChargedAfterRun:', 'chargeRunPassed(']) {
    assert.ok(pick.includes(k), `피킹 리스트에 ${k} 판정이 없다 — 결제 전 박스가 라벨·조리에 들어간다`)
  }
  const block = stripComments(read(join(ROOT, 'lib', 'admin', 'ship-block.ts')))
  for (const k of ["'overdue_not_charged'", "'not_charged_after_run'"]) {
    assert.ok(block.includes(k), `ship-block 에 ${k} 사유가 없다`)
  }
  const charge = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')))
  assert.ok(charge.includes('pickShippingTarget('), '청구 크론이 배송지 정본 함수를 안 쓴다')
  assert.ok(
    /resolveShippingTarget\(supabase,\s*sub\.user_id,\s*sub\)/.test(charge),
    '청구 크론이 신청서 주소(마지막 대안)를 넘기지 않는다 — 저장 체크를 끈 신규 고객이 매일 건너뛰어진다',
  )
})

test('규칙100: 운영 브리핑·대시보드 — 실패한 자동작업을 보고, 발송일엔 청구 성공분만 박스로 세고, 환불 대기는 환불 큐에서 센다', () => {
  /**
   * 화요일 청구 크론이 500 이어도 09:40 브리핑은 "오늘 발송 5박스"라고 했다 — 워치독은 기록
   * '존재'만 봤고, 박스 수는 청구 실패분(날짜가 안 밀린 구독)까지 더했다. 환불 대기는 아무도
   * 'pending' 으로 쓰지 않는 refunds 를 세어 영원히 0 이었다(막힌 환불은 payment_refund_queue).
   */
  const brief = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'daily-briefing', 'route.ts')))
  assert.ok(/from\('cron_health'\)[\s\S]{0,120}\.eq\('status',\s*'error'\)/.test(brief), '브리핑이 실패한 자동작업(cron_health error)을 안 본다')
  // (2026-10-02) 옛 단언 `!/n\(todayBoxes\)\s*\+/` 는 코드가 nOf(...) 로 바뀐 뒤 아무것도 못 잡았다(카나리아 확인).
  assert.match(brief, /if \(isShipDay\) \{\s*if \(paidForShip > 0\) items\.push\(`📦 오늘 발송 \$\{paidForShip\}박스`\)/, '발송일 박스 수가 결제된 박스만이 아니다')
  assert.doesNotMatch(brief, /오늘 발송 \$\{[^}]*(toCharge|notCharged)/, '발송일 박스 수에 청구 안 된 구독을 더한다')
  assert.ok(!/from\('refunds'\)[\s\S]{0,120}'pending'/.test(brief), "브리핑이 refunds.status='pending'(항상 0)을 센다")
  assert.ok(brief.includes("from('payment_refund_queue')"), '브리핑이 환불 큐를 안 센다')
  const dash = stripComments(read(join(ROOT, 'app', 'admin', 'page.tsx')))
  assert.ok(!/from\('refunds'\)[\s\S]{0,120}'pending'/.test(dash), "대시보드가 refunds.status='pending'(항상 0)을 센다")
})

test('규칙101: 고객에게 가는 금액·시각·통지는 실제와 같다 — 사전고지 금액 · 재시도 시각 · 관리자 발송 알림 await · 프로모션 조회 오류', () => {
  // ① 정기결제 사전고지는 청구와 같은 함수(resolveAutoDiscount)로 금액을 만든다.
  const rem = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-reminders', 'route.ts')))
  assert.ok(rem.includes('resolveAutoDiscount('), '사전고지가 청구 금액 함수를 안 쓴다 — 체험단·등급 할인 전 금액을 알린다')
  assert.ok(!/chargeAmount:\s*sub\.total_amount/.test(rem), '사전고지 메일에 할인 전 금액을 넣는다')
  assert.ok(!/sub\.total_amount\.toLocaleString\(\)/.test(rem), '사전고지 푸시에 할인 전 금액을 넣는다')
  // ② '내일 다시 시도'가 정말 내일이도록 — 실패+24h 는 몇 초 차로 이틀 뒤가 됐다.
  const charge = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')))
  assert.ok(!/Date\.now\(\)\s*\+\s*RETRY_COOLDOWN_MS/.test(charge), '재시도 시각을 실패+24h 로 잡는다(다음 날 크론이 못 집는다)')
  assert.ok(charge.includes('nextRetryAtAfter('), '재시도 시각 정본(nextRetryAtAfter)을 안 쓴다')
  // ③ 관리자 발송·배송완료·송장 변경 알림은 await (규칙73 형제 — 응답 뒤 잘린다).
  for (const f of ['status', 'tracking']) {
    const body = stripComments(read(join(ROOT, 'app', 'api', 'admin', 'orders', '[id]', f, 'route.ts')))
    const bare = body.split('\n').filter((l) => /^\s*(pushToUser|notifyOrder\w+)\(/.test(l))
    assert.deepEqual(bare, [], `admin/orders/[id]/${f}: await 없는 고객 통지 — ${bare.join(' | ')}`)
  }
  // ④ 프로모션 조회는 error 를 꺼낸다 — rpc 는 throw 하지 않아 try/catch 가 한 번도 안 돌았다.
  const disc = stripComments(read(join(ROOT, 'lib', 'payments', 'auto-discount.ts')))
  assert.ok(/error:\s*promoErr[\s\S]{0,400}rpc\('pending_promotion_rate'/.test(disc), 'pending_promotion_rate 의 error 를 안 꺼낸다')
})

test('규칙102: 구독 중인 강아지의 적용 중 처방은 재설문 재계산이 안전 사유 없이 덮지 않는다', () => {
  /**
   * compute 가 stale cycle 1 을 무조건 덮어, 구독자가 재설문하면 피킹 리스트는 새 레시피를
   * 포장하고 청구는 옛 금액·옛 품목이었다(동의 없음). adjust 라우트는 이미 막고 있었다.
   * 판정 정본: lib/personalization/subscribed-recompute (새 알레르기 충돌·상담 필요만 덮는다).
   */
  const body = stripComments(read(join(ROOT, 'app', 'api', 'personalization', 'compute', 'route.ts')))
  const decideAt = body.indexOf('subscribedRecomputeDecision(')
  const upsertAt = body.indexOf(".from('dog_formulas').upsert(")
  assert.ok(decideAt > 0, 'compute 가 구독 중 재계산 판정을 안 한다')
  assert.ok(upsertAt > 0 && decideAt < upsertAt, '구독 판정이 cycle 1 upsert 보다 먼저 와야 한다')
  assert.ok(/subscribedLocked:\s*true/.test(body), '덮지 않을 때 화면에 알리는 신호(subscribedLocked)가 없다')
})

test('규칙103: DB 함수 — 수의사 공유는 익명으로 읽고 dogs 에 없는 컬럼을 고르지 않는다 · 이벤트 할인은 첫 주문만 · 새 SQL 의 결제됨은 부분환불 포함', () => {
  const vet = stripComments(read(join(ROOT, 'app', 'vet', '[token]', 'page.tsx')))
  assert.ok(!vet.includes("from '@/lib/supabase/server'"), '수의사 공유 페이지가 로그인 쿠키 클라이언트를 쓴다(로그인한 사람이 열면 트리거에 막힘)')
  assert.ok(/\{\s*data,\s*error\s*\}\s*=\s*await supabase\.rpc\('fetch_vet_share'/.test(vet), 'fetch_vet_share 의 error 를 안 꺼낸다')

  const migDir = join(ROOT, 'supabase', 'migrations')
  const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
  const latestDef = (fn: string): { file: string; sql: string } | null => {
    for (let i = files.length - 1; i >= 0; i--) {
      const sql = read(join(migDir, files[i]!))
      const at = sql.search(new RegExp(`FUNCTION\\s+public\\.${fn}\\s*\\(`, 'i'))
      if (at >= 0) return { file: files[i]!, sql: sql.slice(at, sql.indexOf('$function$;', at) + 1 || undefined) }
    }
    return null
  }
  const vetFn = latestDef('fetch_vet_share')
  assert.ok(vetFn, 'fetch_vet_share 정의를 못 찾음')
  const dogsSelect = vetFn!.sql.match(/SELECT([\s\S]*?)INTO v_dog FROM public\.dogs/i)?.[1] ?? ''
  assert.ok(dogsSelect.length > 0, `${vetFn!.file}: dogs SELECT 를 못 찾음`)
  assert.ok(!/chronic_conditions/.test(dogsSelect), `${vetFn!.file}: dogs 에 없는 chronic_conditions 를 고른다(모든 링크가 42703 으로 죽었다)`)

  const claim = latestDef('claim_promotion')
  assert.ok(claim && claim.sql.includes("'not_first_order'"), '최신 claim_promotion 에 첫 주문 제한이 없다 — 기존 구독자가 신규가입 이벤트 할인을 받는다')

  const offenders = files
    .filter((f) => f >= '20260925')
    // 주석(--)은 뺀다 — 설명에 옛 판정을 인용하면 걸리는 함정(규칙17 과 같은 뿌리).
    .filter((f) => /payment_status\s*=\s*'paid'/.test(read(join(migDir, f)).replace(/--[^\n]*/g, '')))
  assert.deepEqual(offenders, [], `새 마이그레이션이 결제됨을 'paid' 하나로 판정 — PAID_STATUSES(paid·partially_refunded)를 쓸 것: ${offenders.join(', ')}`)
})

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09-25 출시 전 점검 4차 (탐색 3: iOS 앱 / 법적 고지 대 실제 / 알림·메일 전수) — 규칙104~108
// ─────────────────────────────────────────────────────────────────────────────

test('규칙104: 고객 화면 설명은 박스에 없는 성분을 넣었다고 말하지 않는다 (유산균·글루코사민·코코넛오일 등)', () => {
  /**
   * 분석 화면 '꼭 확인하세요' 설명(risk-flags desc)이 "유산균도 함께 넣었어요", "글루코사민·오메가-3를
   * 더했어요", "코코넛오일을 더했어요"라고 했는데 판매 레시피 4종 어디에도 그 원료가 없다(DB 실측).
   * 실제 고객이 봤다. 표시광고법 거짓 표시 + 보호자가 따로 먹이던 보조제를 끊을 위험.
   * 보조제는 '수의사와 상의' 권유로만 쓴다(firstBox reasoning 의 '… 보조 권장' 은 권유라 허용).
   */
  const body = stripComments(read(join(ROOT, 'lib', 'nutrition', 'risk-flags.ts')))
  const NOT_IN_BOX = /유산균|프로바이오틱|글루코사민|콘드로이틴|초록입홍합|코코넛|MCT/
  const offenders = body
    .split('\n')
    .filter((l) => /^\s*(desc|label):/.test(l) && NOT_IN_BOX.test(l))
    .map((l) => l.trim().slice(0, 80))
  assert.deepEqual(offenders, [], `박스에 없는 성분을 고객 설명에 쓴다:\n${offenders.join('\n')}`)
})

test('규칙105: 광고 푸시는 발송 관문에서 야간(21~08시) 차단 · 제목 (광고) · 본문 수신거부 방법 — 기록 본문은 원문', () => {
  const push = stripComments(read(join(ROOT, 'lib', 'push.ts')))
  assert.ok(
    /category === 'marketing' && !isMarketingSendHour\(currentKstHour\(\)\)/.test(push),
    'pushToUser 가 광고 푸시 야간 차단을 안 한다(어드민 캠페인이 밤에 나갔다)',
  )
  assert.ok(push.includes('stampMarketingPayload(payload)'), '광고 표기 정본(stampMarketingPayload)을 안 쓴다')
  assert.ok(!/`\[광고\] \$\{/.test(push), "옛 '[광고]' 표기를 직접 붙인다 — 법정 표기는 '(광고)'")
  assert.ok(
    /from\('push_log'\)\.insert\(\{[\s\S]{0,300}body: payload\.body/.test(push),
    'push_log 에 수신거부 줄이 붙은 본문을 저장한다 — 본문으로 중복을 거르는 크론의 재발송 가드가 풀린다',
  )
  const pm = read(join(ROOT, 'lib', 'push-marketing.ts'))
  assert.ok(pm.includes("AD_LABEL = '(광고)'") && pm.includes('수신거부'), 'push-marketing 정본 표기가 바뀌었다')
  const camp = stripComments(read(join(ROOT, 'app', 'api', 'admin', 'push-campaigns', 'route.ts')))
  assert.ok(camp.includes('isMarketingSendHour(currentKstHour())'), '어드민 캠페인이 야간 발송을 막지 않는다')
})

test('규칙106: 광고 수신 동의도 거부도 처리결과를 알린다 (정보통신망법 §50⑦ — 14일 내)', () => {
  /** 예전엔 거부(철회)만 통지했고 가입 동의·마이페이지 켜기·앱 푸시 켜기는 아무것도 안 보냈다. */
  const route = stripComments(read(join(ROOT, 'app', 'api', 'consent', 'unsubscribe-ack', 'route.ts')))
  assert.ok(route.includes('notifyConsentResult('), '통지 라우트가 동의 결과를 안 보낸다')
  for (const rel of [
    ['app', '(main)', 'mypage', 'consent', 'ConsentSettingsClient.tsx'],
    ['app', 'account', 'notifications', 'ConsentWebClient.tsx'],
  ]) {
    const b = stripComments(read(join(ROOT, ...rel)))
    assert.ok(/JSON\.stringify\(\{ channel, granted: next \}\)/.test(b), `${rel.join('/')}: 켜기(동의)도 통지해야 한다`)
    assert.ok(!/if \(!next\) \{\s*void fetch\('\/api\/consent\/unsubscribe-ack'/.test(b), `${rel.join('/')}: 거부일 때만 통지한다`)
  }
  const signup = stripComments(read(join(ROOT, 'lib', 'auth', 'applySignupProfile.ts')))
  assert.ok(/unsubscribe-ack[\s\S]{0,200}granted: true/.test(signup), '가입 때 받은 광고 동의를 통지하지 않는다')
  const prefs = stripComments(read(join(ROOT, 'app', 'api', 'push', 'preferences', 'route.ts')))
  assert.ok(prefs.includes('notifyConsentResult('), '앱 푸시 광고 동의 변경을 통지하지 않는다')
  const welcome = stripComments(read(join(ROOT, 'lib', 'email', 'templates', 'orders.ts')))
  const w = welcome.slice(welcome.indexOf('export function renderWelcome'))
  assert.ok(!/할인/.test(w.slice(0, w.indexOf('renderLayout('))), '가입 환영 메일(모든 가입자, 거래 안내)에 할인 권유가 있다 — 광고성')
})

test('규칙107: 고객 알림·메일은 사실대로, 끝까지 — await · 결과 반환 · 금액 내역 · 첫 박스만 · 승인 대기는 확인 요청', () => {
  // ① 서버리스 라우트의 고객 통지는 await (규칙73·101 을 app/api 전체로). 화살표 반환(=> 다음 줄)은 호출부가 await.
  const bare: string[] = []
  for (const f of walk(join(ROOT, 'app', 'api'))) {
    const lines = stripComments(read(f)).split('\n')
    lines.forEach((l, i) => {
      if (!/^\s*(pushToUser|notify[A-Z]\w*)\(/.test(l)) return
      let k = i - 1
      while (k >= 0 && lines[k]!.trim() === '') k--
      const prev = (lines[k] ?? '').trim()
      // 화살표 반환(=>)·인자 자리(()·배열 원소([ 또는 앞 원소 끝 ,) — Promise.all([...]) 안의 호출은
      // 바깥 await 가 기다린다(2026-09-26 확장 — 체험단 세션이 병렬 발송을 순차로 바꿔야 했던 오탐).
      if (/=>$|\($|\[$|,$|return$/.test(prev)) return
      bare.push(`${rel(f)}:${i + 1} ${l.trim().slice(0, 50)}`)
    })
  }
  assert.deepEqual(bare, [], `await 없는 고객 통지(응답 뒤 잘린다):\n${bare.join('\n')}`)

  // ② 주문 메일 함수는 결과를 돌려준다 — undefined 면 호출부 실패 판정이 늘 참이었다.
  const email = read(join(ROOT, 'lib', 'email', 'index.ts'))
  for (const fn of ['notifyOrderShipped', 'notifyOrderDelivered', 'notifyOrderCancelled', 'notifyVirtualAccountWaiting']) {
    const at = email.indexOf(`export async function ${fn}(`)
    const seg = email.slice(at, email.indexOf('export async function', at + 10))
    assert.ok(seg.includes('return sendEmail('), `${fn} 가 결과를 반환하지 않는다`)
    assert.ok(seg.includes("reason: 'no_recipient'"), `${fn} 가 수신자 없음을 조용히 끝낸다`)
  }

  // ③ 취소 메일은 결제된 금액이 있을 때만 환불을 약속한다.
  const orders = read(join(ROOT, 'lib', 'email', 'templates', 'orders.ts'))
  assert.ok(orders.includes('결제된 금액이 없어'), '미결제 주문 취소에도 "환불돼요"를 약속한다')
  // ④ 정기결제 주문 메일은 상품 금액·할인·총액 내역을 싣는다(품목 합 ≠ 결제 금액이던 것).
  const charge = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')))
  assert.ok(/subtotal: trustedSubtotal,[\s\S]{0,200}discountReasonLabel\(discountReason\)/.test(charge), '주문 메일에 금액 내역을 안 넘긴다')
  // ⑤ 실패 메일 사유는 한국어 요약 — 토스·네트워크 원문(영어)을 고객에게 보내지 않는다.
  // 고객에게 보이는 칸(메일 사유·정기배송 화면 last_failed_charge_reason·주문 cancel_reason)에 원문 금지.
  assert.ok(!/(^|\s)(reason|last_failed_charge_reason|cancel_reason): result\.error\?\.message/m.test(charge), '고객에게 보이는 결제 실패 사유에 원문 오류를 넣는다')
  assert.ok(charge.includes('isOutcomeUnknownCode('), '결과를 모르는 실패(타임아웃)를 "실패"로 알린다')
  // ⑥ 첫 박스 체크인은 구독의 첫 결제 주문에만.
  const fb = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'first-box-checkin', 'route.ts')))
  assert.ok(/\.lt\('created_at', order\.created_at\)/.test(fb), '첫 박스가 아니어도 "첫 박스 한 주" 푸시가 간다')
  // ⑦ 승인 대기 제안은 확인 요청 메일(금액 변경 포함) — "준비됐어요"로 보내지 않는다.
  const prog = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'personalization-progression', 'route.ts')))
  assert.ok(prog.includes('notifyPersonalizationApprovalNeeded('), '승인·동의 필요 제안을 메일로 알리지 않는다(웹 구독자는 모른다)')
  assert.ok(!/!\(requiresApproval && diff\.priceChanged\) && !shippedAllergenLeak/.test(prog), '금액 변경 제안 메일을 빼는 옛 조건이 남아 있다')
  const cyc = read(join(ROOT, 'lib', 'email', 'templates', 'personalization-cycle.ts'))
  assert.ok(!/\$\{input\.cycleNumber\}번째/.test(cyc), '회차 번호를 박스 번호로 부른다(회차 1 = 박스 3)')
  // ⑧ 분기 리포트에 'BCS 6/9' 원문을 내보내지 않는다.
  const q = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'quarterly-report', 'route.ts')))
  assert.ok(!/bcsLabel: r\.bcs_label/.test(q), "분기 리포트 메일에 'BCS 6/9' 원문이 나간다")
  // ⑨ 사전고지 푸시 중복 거르기는 구독 단위(같은 날 둘째 강아지 금액이 빠지던 것).
  const rem = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-reminders', 'route.ts')))
  assert.ok(/\.eq\('url', `\/mypage\/subscriptions\?focus=\$\{sub\.id\}`\)/.test(rem), '사전고지 푸시 dedup 이 구독 단위가 아니다')
})

test('규칙108: iOS 앱 — 카카오가 있는 가입 화면엔 애플도 · 실행 중 연 링크 재적용 금지 · 거짓 "저장했어요" 금지 · 사진 저장 권한 문구', () => {
  // ① 가이드라인 4.8 — KakaoLoginButton 을 렌더하는 파일은 AppleLoginButton 도 렌더한다.
  const missing: string[] = []
  for (const f of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'components')))) {
    if (!f.endsWith('.tsx')) continue
    const b = read(f)
    if (b.includes('<KakaoLoginButton') && !b.includes('<AppleLoginButton')) missing.push(rel(f))
  }
  assert.deepEqual(missing, [], `카카오만 있고 애플이 없는 가입·로그인 화면(4.8 거절 사유):\n${missing.join('\n')}`)
  // ② appUrlOpen 으로 처리한 링크를 기록한다 — iOS getLaunchUrl 은 '마지막으로 앱을 연 URL'.
  const bridge = stripComments(read(join(ROOT, 'components', 'NativeShellBridge.tsx')))
  assert.ok(/addListener\('appUrlOpen'[\s\S]{0,200}markLaunchUrlHandled\(/.test(bridge), '실행 중 연 링크가 다음 전체 로드에서 다시 적용된다')
  // ③ 이미지 저장은 결과로 말한다 — 앱에서 <a download> 는 무반응인데 "저장했어요"가 떴다.
  for (const relp of [
    ['app', '(main)', 'reports', 'ReportExportButton.tsx'],
    ['app', '(main)', 'mypage', 'certificate', '[dogId]', 'CertificateClient.tsx'],
  ]) {
    const b = stripComments(read(join(ROOT, ...relp)))
    assert.ok(b.includes('saveCanvasImage('), `${relp.join('/')}: 앱에서도 동작하는 저장 정본을 안 쓴다`)
  }
  const cert = stripComments(read(join(ROOT, 'app', '(main)', 'mypage', 'certificate', '[dogId]', 'CertificateClient.tsx')))
  assert.ok(/result === 'downloaded'\) toast\.success\('이미지를 저장했어요'\)/.test(cert), '저장 결과와 무관하게 "저장했어요"를 띄운다')
  // ④ iOS 는 사진첩 쓰기 권한 문구가 없으면 저장 순간 앱이 종료된다.
  const plist = read(join(ROOT, 'ios', 'App', 'App', 'Info.plist'))
  assert.ok(plist.includes('<key>NSPhotoLibraryAddUsageDescription</key>'), 'Info.plist 에 NSPhotoLibraryAddUsageDescription 이 없다')
})

test('규칙109: 체험단 가격 전환 예고는 푸시+메일 이중화·금액 명시', () => {
  /**
   * 2026-09-25 4차 점검: 전환 예고가 푸시 한 통뿐이었다 — 웹 가입자·OS 알림
   * 꺼짐이면 도달 0건(push_subscriptions 웹푸시 0행 실측)인데 sent 도 안 봤고,
   * 본문엔 금액 없이 "반값/정상가"라는 말만 있었다(전상법 2025-02 정기결제
   * 증액 고지 취지 미달). 세 가지를 소스에 박는다:
   *   (a) 메일 병행(notifyTrialPriceChange) — 멱등키 trial-notice:{user}:{phase}
   *   (b) 예고 금액은 resolveAutoDiscount 숫자(화면·청구와 같은 함수)
   *   (c) 두 채널 다 실패하면 businessEvent 로 사람에게 — 조용한 무고지 금지
   */
  const src = stripComments(
    read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')),
  )
  assert.match(src, /notifyTrialPriceChange\(/, '전환 예고 메일 병행이 사라졌다')
  assert.match(
    src,
    /trial_notice_unreached/,
    '푸시·메일 둘 다 실패 시 businessEvent 감시가 사라졌다',
  )
  assert.match(
    src,
    /'다음 박스 가격 안내'[\s\S]{0,600}category: 'order'/,
    "전환 예고 푸시에 category: 'order' 가 없다 — 거래 통지는 push_preferences 의 order 플래그를 태운다",
  )
  assert.match(
    src,
    /nextPricing\.chargeAmount\.toLocaleString/,
    '예고 본문의 금액(resolveAutoDiscount 숫자)이 사라졌다 — "반값/정상가" 말만으로는 고지가 아니다',
  )

  // (d) 도장 화면은 **실제** 어드민 내비(admin-shell-next)에 있어야 한다.
  //     2026-09-26: 죽은 파일(components/admin/AdminNav.tsx — 9/4 개편 뒤 미사용)에만
  //     넣고 "배포됐다"고 두 번 보고했다. 사장님 화면엔 이틀간 없었다.
  const shell = stripComments(
    read(join(ROOT, 'components', 'adminui', 'admin-shell-next.tsx')),
  )
  assert.match(
    shell,
    /href:\s*'\/admin\/trials'/,
    '체험단(서포터즈) 도장 화면이 실제 어드민 내비(admin-shell-next NAV_GROUPS)에 없다',
  )
  const layout = stripComments(read(join(ROOT, 'app', 'admin', 'layout.tsx')))
  assert.match(
    layout,
    /components\/adminui\/admin-shell-next/,
    '어드민 layout 이 admin-shell-next 를 안 쓴다 — 내비 정본이 바뀌었으면 이 규칙과 AdminNav.tsx 경고 주석을 같이 고칠 것',
  )

  // (e) 환불된 서포터즈 박스는 회차를 돌려준다(사장님 2026-09-26) — 경로가 여럿이라
  //     코드가 아니라 orders.payment_status 트리거가 정본. 마이그레이션이 사라지면 안 된다.
  const mig = read(join(ROOT, 'supabase', 'migrations', '20260926180000_restore_trial_round_on_refund.sql'))
  assert.match(mig, /create trigger trg_orders_restore_trial_round/i, '회차 복원 트리거가 사라졌다')
  assert.match(mig, /before update of payment_status on public\.orders/i, '트리거가 payment_status 전이에 안 걸린다')
  assert.match(mig, /trial_round_restored_at/, '주문당 1회 멱등 마커가 사라졌다')
})

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09-26 출시 전 점검 5차 (탐색 3: 웹 퍼널·가격 고지·분석 동의 / 데이터 수명주기 / 어드민 도구) — 규칙110~116
// ─────────────────────────────────────────────────────────────────────────────

test('규칙110: DB 레이트리밋 카운터는 service_role 로 센다 — 쿠키 클라이언트는 RPC 권한이 없어 늘 fail-open', () => {
  /**
   * incr_rate_limit_counter 는 authenticated 에 EXECUTE 가 없다. 1차 점검에서 넣은 AI 사용자별
   * 하루 한도와 결제확인 한도가 쿠키 클라이언트를 넘겨 **한 번도 동작하지 않았다**
   * (rate_limit_counters 0행 실측). 규칙94 는 호출 존재만 봐서 못 잡았다.
   */
  const offenders: string[] = []
  for (const f of walk(join(ROOT, 'app', 'api'))) {
    const b = stripComments(read(f))
    if (/rateLimitDB\(\{\s*supabase,/.test(b)) offenders.push(rel(f))
  }
  assert.deepEqual(offenders, [], `rateLimitDB 에 쿠키 클라이언트(supabase)를 넘긴다:\n${offenders.join('\n')}`)
  const ai = stripComments(read(join(ROOT, 'lib', 'anthropic-usage.ts')))
  const fn = ai.slice(ai.indexOf('export async function checkAiUserDailyLimit'))
  assert.ok(/createAdminClient\(\)/.test(fn.slice(0, 800)), 'checkAiUserDailyLimit 가 service_role 로 세지 않는다')
  assert.ok(fn.slice(0, 1200).includes('if (result.degraded)'), 'DB 한도가 fail-open 으로 떨어져도 알리지 않는다')
})

test('규칙111: 어드민 상품 수정 폼은 DB 배열·JSON 칸을 폼 문자열로 바꿔 시작한다 (판매 중 4종이 저장 불가였다)', () => {
  const form = stripComments(read(join(ROOT, 'app', 'admin', 'products', 'ProductForm.tsx')))
  assert.ok(form.includes('toFormShape(initialData)'), '수정 폼이 DB 행(text[]·jsonb)을 그대로 쓴다 — .split is not a function')
  assert.ok(/nutritionBlank && hadNutrition/.test(form), '영양성분 칸을 비우면 38종 영양소가 null 로 덮인다')
})

test('규칙112: 정기결제 동의 화면은 실제 첫 결제·반복 금액을 말하고, 없는 동의 절차를 약속하지 않는다', () => {
  /**
   * 주문 화면은 '결제하기'를 누르면 곧바로 카드 등록 창이 열린다 — 정기결제 동의의 마지막 자리인데
   * 구독가(할인 전)만 보였다. 카드 등록 화면은 이벤트 첫 박스가를 "2주마다"로 말하고
   * "금액이 바뀌면 동의를 받는다"고 약속했지만 이벤트→정상가 전환엔 동의 절차가 없다.
   */
  const order = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'order', 'OrderClient.tsx')))
  assert.ok(order.includes('/api/subscriptions/price-preview'), '주문 화면이 실제 결제 금액을 서버에 묻지 않는다')
  assert.ok(order.includes('firstCharge.toLocaleString()'), '주문 화면 결제 바가 실제 첫 결제 금액을 쓰지 않는다')
  const preview = stripComments(read(join(ROOT, 'app', 'api', 'subscriptions', 'price-preview', 'route.ts')))
  assert.ok(preview.includes('resolveAutoDiscount(') && preview.includes('recurringOnly: true'), '미리보기가 청구와 같은 함수로 첫 결제·반복 금액을 내지 않는다')
  const auth = read(join(ROOT, 'app', 'subscribe', 'billing-auth', 'page.tsx'))
  assert.ok(!auth.includes('결제일에 금액이 바뀌면 미리 알려드리고 동의를 받아요'), '없는 동의 절차를 약속한다(이벤트→정상가 전환엔 동의 게이트가 없다)')
  assert.ok(stripComments(auth).includes('hasOneTimeDiscount('), '한정 할인(이벤트·서포터즈)을 "2주마다" 금액으로 보여 준다')
})

test('규칙113: 분석·광고 도구는 동의한 뒤에만 불러온다 (Basic Consent Mode) · 세부 설정 기본값은 꺼짐', () => {
  /** Advanced Consent Mode 라 동의 전·'필수만' 뒤에도 GA 가 page_view(쿼리 포함 URL)를 보냈다(실측). */
  const scripts = stripComments(read(join(ROOT, 'components', 'AnalyticsScripts.tsx')))
  assert.ok(/GA_ID && analytics &&/.test(scripts), 'GA 스크립트를 분석 동의 없이 불러온다')
  assert.ok(/CLARITY_ID && analytics &&/.test(scripts), 'Clarity 를 분석 동의 없이 불러온다')
  assert.ok(/PIXEL_ID && marketing &&/.test(scripts), 'Meta Pixel 을 광고 동의 없이 불러온다')
  const an = stripComments(read(join(ROOT, 'lib', 'analytics.ts')))
  assert.ok(/readConsent\(\)\?\.analytics !== true\) return/.test(an), 'GA 이벤트가 분석 동의를 확인하지 않는다')
  assert.ok(/readConsent\(\)\?\.marketing !== true\) return/.test(an), '픽셀 이벤트가 광고 동의를 확인하지 않는다')
  const banner = stripComments(read(join(ROOT, 'components', 'CookieConsent.tsx')))
  assert.ok(/useState\(false\)[\s\S]{0,80}useState\(false\)/.test(banner), '쿠키 세부 설정의 분석·광고가 켜진 채 시작한다')
})

test('규칙114: 사진·개인 데이터 파기는 실제로 지운다 — 서버 삭제 · 강아지 삭제 시 사진 · 목록 오류 보고 · 빠진 표', () => {
  const photos = stripComments(read(join(ROOT, 'lib', 'dogPhotos.ts')))
  assert.ok(photos.includes("fetch('/api/dog-photos/remove'"), '사진 삭제를 브라우저 storage.remove 로 한다(SELECT 정책이 없어 0건 삭제)')
  assert.ok(!/storage\s*\.from\(DOG_AVATARS_BUCKET\)\s*\.remove\(/.test(photos), '브라우저에서 직접 storage.remove 를 부른다')
  const purge = stripComments(read(join(ROOT, 'lib', 'storage', 'purgeUserStorage.ts')))
  assert.ok(/if \(error\) throw new Error/.test(purge), '스토리지 목록 오류를 빈 목록(=성공)으로 접는다')
  assert.ok(/offset/.test(purge), '1,000개 넘는 폴더를 끝까지 읽지 않는다')
  const upload = stripComments(read(join(ROOT, 'app', 'api', 'photo-upload', '[token]', 'route.ts')))
  assert.ok(upload.includes('`${ownerId}/photo-requests/'), '친구 업로드 사진이 주인 폴더 밖에 저장된다(탈퇴 파기에서 빠진다)')
  const detail = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'DogDetailClient.tsx')))
  assert.ok(detail.includes('/purge-photos'), '강아지를 지워도 사진이 남는다')
  const del = stripComments(read(join(ROOT, 'app', 'api', 'account', 'delete', 'route.ts')))
  for (const t of ['kibble_requests', 'source_waitlist', 'meta_learning_events', 'dog_members']) {
    assert.ok(del.includes(`from('${t}')`), `탈퇴가 ${t} 를 지우거나 익명화하지 않는다`)
  }
  // 세 설정 파일의 스크러버는 2026-09-26 lib/sentry-scrub 하나로 모였다(규칙131) — 이메일 가림은 거기서 본다.
  assert.ok(read(join(ROOT, 'lib', 'sentry-scrub.ts')).includes(".replace(EMAIL, '[이메일]')"), 'lib/sentry-scrub: Sentry 가 이메일을 가리지 않는다(주석은 가린다고 했다)')
  for (const f of ['instrumentation-client.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts']) {
    assert.ok(stripComments(read(join(ROOT, f))).includes("from '@/lib/sentry-scrub'"), `${f}: 공용 스크러버를 안 쓴다(이메일이 안 가려진다)`)
  }
})

test('규칙115: 로그인 없이 부르는 메일·조회 API 는 받는 주소·본인 주문 기준으로 막는다', () => {
  const nl = stripComments(read(join(ROOT, 'app', 'api', 'newsletter', 'route.ts')))
  assert.ok((nl.match(/await withinRecipientCap\(/g) ?? []).length >= 2, '뉴스레터 확인 메일에 받는 주소 기준 하루 상한이 없다')
  const ct = stripComments(read(join(ROOT, 'app', 'api', 'contact', 'route.ts')))
  assert.ok(ct.includes("bucket: 'contact-ack-to'"), '문의 자동답장에 받는 주소 기준 상한이 없다')
  const tr = stripComments(read(join(ROOT, 'app', 'api', 'tracking', 'route.ts')))
  assert.ok(/auth\.getUser\(\)[\s\S]{0,400}\.from\('orders'\)[\s\S]{0,200}\.eq\('tracking_number', trackingNumber\)/.test(tr), '배송조회 프록시가 로그인·본인 주문 확인 없이 사장님 키를 쓴다')
})

test('규칙116: 어드민 숫자는 실제와 맞는다 — 환불 대기·CSV 시각·코호트 분모·배송 캘린더·월 예상·문의 처리·프로모션 기록', () => {
  const refunds = stripComments(read(join(ROOT, 'app', 'admin', 'refunds', 'page.tsx')))
  assert.ok(!/from\('refunds'\)[\s\S]{0,120}'pending'/.test(refunds), "환불 페이지 '처리 대기'가 늘 0인 refunds.pending 을 센다")
  assert.ok(refunds.includes("from('payment_refund_queue')"), '환불 페이지가 막힌 환불(환불 큐)을 안 본다')
  const csv = stripComments(read(join(ROOT, 'app', 'api', 'admin', 'orders', 'export', 'route.ts')))
  assert.ok(/9 \* 60 \* 60 \* 1000/.test(csv) && /T00:00:00\+09:00/.test(csv), '주문 CSV 가 UTC 로 찍힌다')
  const cohort = stripComments(read(join(ROOT, 'app', 'admin', 'cohort', 'page.tsx')))
  assert.ok(/\.not\('paid_at', 'is', null\)/.test(cohort), '코호트 환불율 분모에서 환불된 주문이 빠진다')
  const cal = stripComments(read(join(ROOT, 'app', 'admin', 'subscriptions', 'calendar', 'page.tsx')))
  assert.ok(cal.includes('addDaysKst(d, 14)') && cal.includes('todayKstIsoDate()'), '배송 캘린더가 격주 회차를 안 그리거나 UTC 날짜를 쓴다')
  const dash = stripComments(read(join(ROOT, 'app', 'admin', 'page.tsx')))
  assert.ok(dash.includes('trialPricing(') && !/sum \+ \(s\.total_amount \?\? 0\) \* 2/.test(dash), "대시보드 '월 예상'이 서포터즈·등급 할인을 무시한다")
  const thread = stripComments(read(join(ROOT, 'app', 'admin', 'users', '[id]', 'message', 'page.tsx')))
  assert.ok(!/update\(\{ read_at:/.test(thread), "문의 스레드를 열기만 해도 '답 안 한 문의'에서 빠진다")
  const promo = stripComments(read(join(ROOT, 'app', 'api', 'admin', 'promotions', 'route.ts')))
  assert.ok((promo.match(/recordAdminAction\(/g) ?? []).length >= 2, '프로모션 생성·수정(할인율)이 감사 기록을 남기지 않는다')
})

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09-26 출시 전 점검 6차 — 규칙117~
// ─────────────────────────────────────────────────────────────────────────────

test('규칙117: 어드민 화면이 브라우저에서 직접 쓰는 표는 DB 감사 트리거가 기록한다 (새 화면이 새 표를 쓰면 빨간불)', () => {
  /**
   * 구독 상태·상품 가격/재고·추천 알고리즘·자동화 스위치를 어드민 화면이 브라우저 클라이언트로 바로 써서
   * recordAdminAction 이 한 번도 불리지 않았다(5차 I4). 화면을 서버 라우트로 옮기는 대신
   * audit_admin_row_change 트리거(20260926100000)가 관리자 요청만 골라 admin_audit_log 에 남긴다.
   * 트리거 목록은 마이그레이션에서 읽는다 — 코드와 DB 가 같은 목록을 본다.
   * 콘텐츠 표(FAQ·파트너·블로그)는 돈·운영과 무관해 감사 대상에서 뺐다.
   */
  const mig = read(join(ROOT, 'supabase', 'migrations', '20260926100000_admin_change_audit_triggers.sql'))
  const audited = new Set([...mig.matchAll(/create trigger audit_admin_change [^;]*? on public\.(\w+)/g)].map((m) => m[1]!))
  assert.ok(audited.has('subscriptions') && audited.has('products'), '감사 트리거 목록을 읽지 못했다')
  assert.ok(mig.includes("- 'billing_key' - 'billing_customer_key'"), '감사 기록에 결제 키 칸이 실린다')
  assert.ok(/if v_uid is null then\s+return null;/.test(mig), '크론·서버 요청까지 is_admin 조회를 한다(청구 크론 행마다)')
  const CONTENT_ONLY = new Set(['faqs', 'partners', 'blog_posts', 'blog_categories'])
  const dirs = [join(ROOT, 'app', 'admin'), join(ROOT, 'components', 'admin'), join(ROOT, 'components', 'adminui')]
  const unaudited: string[] = []
  for (const d of dirs) {
    for (const f of walk(d)) {
      const src = read(f)
      if (!/^\s*['"]use client['"]/.test(src)) continue
      const b = stripComments(src)
      const froms = [...b.matchAll(/\.from\('(\w+)'\)/g)]
      froms.forEach((m, i) => {
        const end = i + 1 < froms.length ? froms[i + 1]!.index! : b.length
        const seg = b.slice(m.index!, Math.min(end, m.index! + 400))
        if (!/\.(update|insert|delete|upsert)\(/.test(seg)) return
        const t = m[1]!
        if (!audited.has(t) && !CONTENT_ONLY.has(t)) unaudited.push(`${rel(f)} → ${t}`)
      })
    }
  }
  assert.deepEqual(unaudited, [], `감사 트리거 없는 표를 어드민 화면이 직접 쓴다 — 트리거를 추가하거나 서버 라우트+recordAdminAction 으로:\n${unaudited.join('\n')}`)
})

test('규칙118: 사람이 KST 로 적은 날짜·시각은 KST 로 읽는다 — 프로모션 기간 · 생일 나이 · 생일 D-day', () => {
  // ① 프로모션 datetime-local(오프셋 없음)을 서버(UTC)가 new Date 로 읽어 9시간 늦게 열고 닫았다(purin2024 실측).
  const promo = stripComments(read(join(ROOT, 'app', 'api', 'admin', 'promotions', 'route.ts')))
  assert.ok(!/new Date\(body\.(startsAt|endsAt)\)/.test(promo), '프로모션 기간을 서버 로컬(UTC)로 읽는다')
  assert.ok(promo.includes('parseKstLocalDateTime(body.startsAt)') && promo.includes('parseKstLocalDateTime(body.endsAt)'), '프로모션 기간 파싱이 KST 헬퍼를 안 쓴다')
  const promoUi = stripComments(read(join(ROOT, 'app', 'admin', 'promotions', 'PromotionsClient.tsx')))
  assert.ok(/timeZone: 'Asia\/Seoul'/.test(promoUi), '프로모션 기간 표시가 브라우저 시간대를 따른다')
  // ② 생일 나이는 정본(달력 기준) — days/365.25 내림은 두 번째 생일에 "1살"이라 했다.
  const age = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'dog-age-update', 'route.ts')))
  assert.ok(age.includes('deriveAgeFromBirth(') && !/365\.25/.test(age), '생일 나이를 365.25 나눗셈으로 센다')
  assert.ok(/\.range\(from, from \+ PAGE - 1\)/.test(age), '강아지 1,000마리 넘으면 뒤쪽은 나이·생일 알림이 영영 안 간다')
  // ③ AI 코멘트의 생일 D-day 는 KST 로 민 시각으로.
  const st = stripComments(read(join(ROOT, 'app', 'api', 'analysis', 'structured', 'route.ts')))
  assert.ok(/birthdayInfo\(dog\.birth_date \?\? null, nowKstMs\(\)\)/.test(st), '생일 D-day 를 UTC 날짜로 센다(KST 00~09시 하루 틀림)')
})

test('규칙119: 새 처방은 다음 박스부터 — 그날 결제된 박스는 옛 처방으로 포장 · 카운트·체크인·카드도 같은 기준', () => {
  /**
   * 박스 3 발송일 10:10 크론·당일 승인이 applied_from=오늘로 넣어, 이미 옛 처방·옛 금액으로
   * 결제된 그날 박스가 피킹에서 새 처방으로 나왔고, 카운트가 그 박스를 새 회차 1번째로 셌다.
   */
  const cyc = read(join(ROOT, 'lib', 'personalization', 'cycle.ts'))
  assert.ok(cyc.includes('export function newFormulaAppliedFrom('), '새 처방 시작점 정본이 없다')
  const prog = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'personalization-progression', 'route.ts')))
  assert.ok(prog.includes('newFormulaAppliedFrom(today, billing?.nextDeliveryDate)'), '재제안 크론이 새 처방을 오늘부터 적용한다')
  assert.ok(!/requiresApproval \? null : today\b/.test(prog), '재제안 크론에 applied_from=today 가 남아 있다')
  const ap = stripComments(read(join(ROOT, 'app', 'api', 'personalization', 'approve', 'route.ts')))
  assert.ok(ap.includes('newFormulaAppliedFrom(today, box?.nextDeliveryDate)'), '승인이 새 처방을 오늘부터 적용한다')
  assert.ok(!/const today = now\.toISOString\(\)\.slice\(0, 10\)/.test(ap), '승인 날짜가 UTC 다(수요일 새벽 승인이 화요일로 찍힌다)')
  const pick = stripComments(read(join(ROOT, 'app', 'admin', 'personalization', 'picking-list', 'page.tsx')))
  assert.ok(/f\.applied_from && f\.applied_from\.slice\(0, 10\) > shipDate\) continue/.test(pick), '피킹이 아직 시작 전인 처방으로 오늘 박스를 싼다')
  assert.ok(/if \(formulasErr \|\| dogsErr\)/.test(pick), '처방 조회 실패를 "처방 없음"으로 접어 빈 팩을 싼다')
  const card = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', '_components', 'CurrentFormulaCard.tsx')))
  assert.ok(!/setHours\(0, 0, 0, 0\)/.test(card) && card.includes('diffDaysKst('), '처방 카드가 기기 자정과 UTC 날짜를 섞는다')
  assert.ok(!card.includes('다음 박스 D-') && !/cycle_number\}번째 박스/.test(card), '처방 카드가 회차를 박스 번호로·종료일을 다음 박스로 말한다')
})

test('규칙120: 환불은 한 번만 적는다 — 큐 재시도·즉시환불 실패·고객 취소가 다른 경로의 환불·발송을 덮지 않는다', () => {
  const rr = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'refund-retry', 'route.ts')))
  const settle = rr.slice(rr.indexOf('async function settleRefunded('))
  assert.ok(/\.lt\('amount', 0\)/.test(settle) && settle.includes('ledgerAlreadyCovers'), '환불 큐 마무리가 이미 적힌 환불을 안 보고 원장에 또 적는다')
  assert.ok(/\.not\('payment_status', 'in', '\("cancelled","refunded"\)'\)/.test(settle), "환불 큐 마무리가 'refunded' 주문을 'cancelled' 로 덮는다")
  const ch = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')))
  assert.ok(/payment_status: 'paid',\s*payment_key: result\.paymentKey,\s*paid_at: successIso,\s*\}\)\s*\.eq\('id', orderRow\.id\)\s*\.eq\('payment_status', 'pending'\)/.test(ch), "즉시환불 실패 분기가 웹훅이 쓴 'cancelled' 를 'paid' 로 되돌린다")
  const cancel = stripComments(read(join(ROOT, 'app', 'api', 'orders', '[id]', 'cancel', 'route.ts')))
  assert.ok(/\.in\('order_status', \['pending', 'preparing'\]\)/.test(cancel), '고객 취소가 그 사이 발송된 주문을 취소로 덮는다')
  assert.ok(cancel.includes('order.cancel.refunded_but_state_changed'), '환불은 됐는데 상태가 바뀐 취소를 "이미 처리됨"으로 조용히 끝낸다')
})

test('규칙121: 건너뛰기는 청구와 겨루지 않는다 — 청구 선점·고객 건너뛰기 모두 본 날짜 그대로일 때만', () => {
  const ch = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')))
  assert.ok(/\.eq\('status', 'active'\)\s*\.eq\('next_delivery_date', sub\.next_delivery_date\)\s*(?:\.eq\('billing_key', sub\.billing_key\)\s*)?\.select\('id'\)/.test(ch), '청구 선점이 status 만 봐서 방금 미룬 박스도 결제한다')
  const app = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'subscription', 'DogSubscriptionClient.tsx')))
  assert.ok(app.includes("q.eq('next_delivery_date', seen)") && app.includes('moveNextDate(sub.id,'), '앱 건너뛰기가 화면이 본 날짜를 확인하지 않는다')
  const web = stripComments(read(join(ROOT, 'app', 'account', 'subscriptions', 'SubscriptionsWebClient.tsx')))
  assert.ok(web.includes("q.eq('next_delivery_date', seenNext)"), '웹 건너뛰기가 화면이 본 날짜를 확인하지 않는다')
  assert.ok(/timeZone: 'Asia\/Seoul',\s*month: 'long'/.test(web), '웹 발송일 표시가 기기 시간대를 따른다(해외에서 월요일로)')
})

test('규칙122: 처리 한도는 조용히 넘치지 않는다 — 청구 크론 밀림 경보 · 아침 브리핑 규모 경보', () => {
  const ch = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')))
  assert.ok(ch.includes('TIME_BUDGET_MS') && ch.includes("'subscription.charge.backlog'"), '청구 크론이 다 못 처리한 구독을 알리지 않는다(박스가 한 주 밀린다)')
  assert.ok(/\.order\('next_delivery_date', \{ ascending: true \}\)\s*\.order\('id'/.test(ch), '청구 대상 정렬이 없어 상한에 걸리면 임의로 잘린다')
  const br = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'daily-briefing', 'route.ts')))
  assert.ok(br.includes('scaleWarnings('), '아침 브리핑이 처리 한도 접근을 알리지 않는다')
})

test('규칙123: /link 콘텐츠는 어드민(/admin/link)이 정본 — 실제 내비 등록 · 관리자 관문 · 기간 판정 테스트 · 저장 후 재생성', () => {
  /**
   * 2026-09-26 사장님: 커버 사진·이벤트/모집 배너(기간)·하루 사진을 어드민에서 올리고,
   * 기간이 끝난 배너는 14일 회색 "기간 종료" 뒤 자동 숨김. 이 구조가 무너지는 방식:
   *   (a) 어드민 내비(실제 파일 admin-shell-next)에서 빠져 URL 로만 도달
   *   (b) API 가 관리자 관문 없이 열림(공개 페이지 콘텐츠를 아무나 바꾼다)
   *   (c) 저장 후 revalidatePath 가 빠져 /link 가 5분 뒤에야 바뀜 → "저장했는데 안 보인다"
   *   (d) 기간 판정 순수 함수의 테스트가 사라짐
   */
  const shell = stripComments(read(join(ROOT, 'components', 'adminui', 'admin-shell-next.tsx')))
  assert.match(shell, /href:\s*'\/admin\/link'/, '링크 페이지 관리가 실제 어드민 내비에 없다')

  const page = stripComments(read(join(ROOT, 'app', 'admin', 'link', 'page.tsx')))
  assert.match(page, /isAdmin\(/, '/admin/link 가 관리자 판정 없이 열린다')

  const apiDir = join(ROOT, 'app', 'api', 'admin', 'link')
  const routes = walk(apiDir).filter((f) => /route\.ts$/.test(f))
  assert.ok(routes.length >= 3, `/api/admin/link 라우트가 부족하다(${routes.length})`)
  for (const f of routes) {
    const src = stripComments(read(f))
    assert.match(src, /requireAdmin\(\)/, `${rel(f)}: 관리자 관문(requireAdmin) 없이 열린다`)
    if (/settings|banners/.test(f)) {
      assert.match(src, /revalidatePath\('\/link'\)/, `${rel(f)}: 저장 후 /link 재생성이 빠졌다`)
    }
  }

  const link = stripComments(read(join(ROOT, 'app', 'link', 'page.tsx')))
  assert.match(link, /loadLinkContent\(/, '/link 가 어드민 저장값(loadLinkContent)을 안 읽는다')
  assert.match(link, /export const revalidate = \d+/, '/link 가 ISR 이 아니다 — 기간 전환이 자동 반영되지 않는다')
  assert.ok(existsSync(join(ROOT, 'lib', 'link-content', 'status.test.ts')), '기간 판정 테스트가 없다')
})

test('규칙124: 링크 미리보기는 로고 한 장 · 앱 다운로드는 스토어 공식 배지 (사장님 2026-09-26)', () => {
  /**
   * 글자 카드 미리보기가 메신저 정사각형 자르기에서 ':테일' 조각으로 보였고(사장님 "못생겼다"),
   * /link 앱 밴드는 직접 그린 알약 버튼이었다("실제 쟤네가 제공하는 걸로"). 둘 다 한 곳으로 모은다.
   */
  const og = stripComments(read(join(ROOT, 'app', 'og', 'route.tsx')))
  assert.ok(og.includes('logoOgImage()') && !/searchParams/.test(og), '/og 가 페이지별 글자 카드를 다시 그린다')
  const root = stripComments(read(join(ROOT, 'app', 'opengraph-image.tsx')))
  assert.ok(root.includes('logoOgImage()'), '사이트 기본 미리보기가 로고 카드가 아니다')
  assert.ok(!existsSync(join(ROOT, 'app', 'og', 'dog', 'route.tsx')), '/og/dog(쓰지 않는데 임의 URL 을 가져오던 카드)가 돌아왔다')
  const card = read(join(ROOT, 'lib', 'og', 'logo-card.tsx'))
  assert.ok(card.includes("join(process.cwd(), 'public', 'logo-stamp.png')"), '로고 카드가 도장 로고를 읽지 않는다')
  const link = stripComments(read(join(ROOT, 'app', 'link', 'page.tsx')))
  assert.ok(link.includes('src="/badge-googleplay-ko.png"') && link.includes('src="/badge-appstore-ko.svg"'), '/link 앱 다운로드가 공식 배지가 아니다')
  assert.ok(!/function (PlayStoreIcon|AppleIcon)\(/.test(link), '/link 에 직접 그린 스토어 아이콘이 남아 있다')
})

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09-26 출시 전 점검 7차 (실패 화면 UX / 입력 검증·신규 라우트 / 제품 사실 일관성) — 규칙125~127
// ─────────────────────────────────────────────────────────────────────────────

test('규칙125: 실패하면 고객에게 사실대로·다시 할 길과 함께 — 빈 화면·멈춘 버튼·거짓 성공·원문 오류 금지', () => {
  // ① 오류 화면 '다시 시도' = retry(서버에서 다시 불러옴). reset 은 같은 오류를 다시 그린다.
  for (const f of ['app/error.tsx', 'app/(main)/error.tsx', 'app/admin/error.tsx', 'app/checkout/error.tsx']) {
    const b = stripComments(read(join(ROOT, ...f.split('/'))))
    assert.ok(!/onClick[:=]\s*\{?\s*reset\b/.test(b) && /\bretry\b/.test(b), `${f}: 다시 시도가 reset(재요청 없음)이다`)
  }
  // ② 주문 결제 — 서버 거절·네트워크 실패도 토스트(문구 자리는 폼 아래라 고정 버튼 누른 눈엔 무반응)
  const order = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'order', 'OrderClient.tsx')))
  assert.ok(!/setErr\(payload\?\.message/.test(order) && !/setErr\(userFacingError\(e/.test(order), '주문 서버 거절·네트워크 실패를 화면 밖 문구로만 알린다')
  // ③ 카드 등록 — 취소된 신청은 '다시 신청하기'(같은 신청으로 무한 재시도 금지)
  const bs = stripComments(read(join(ROOT, 'app', 'subscribe', 'billing-success', 'page.tsx')))
  assert.ok(/SUBSCRIPTION_CANCELLED'[\s\S]{0,80}'gone'/.test(bs), '취소된 신청에 다시 시도(무한 반복)를 내민다')
  // ④ 조회 실패 ≠ 없음 — 앱 홈·주문 화면·처방 캐시
  const dash = stripComments(read(join(ROOT, 'app', '(main)', 'dashboard', 'page.tsx')))
  // 2026-10-09 앱 새 디자인: 홈 배치를 HomeView(그리기만 — 점검 화면이 예시 값으로 같은 배치를 그린다)로 나눴다.
  //   판정(조회 실패)은 홈이 loadFailed 로 넘기고, 0마리 자리에서 HomeView 가 실패면 다시 불러오기를 그린다.
  const homeView = stripComments(read(join(ROOT, 'components', 'v3', 'home', 'HomeView.tsx')))
  assert.ok(
    /loadFailed: !!snapshotErr/.test(dash) && /model\.loadFailed \? <HomeLoadFailed/.test(homeView),
    '앱 홈이 조회 실패를 "첫 아이를 등록해주세요"로 그린다',
  )
  const opd = stripComments(read(join(ROOT, 'lib', 'subscription', 'orderPageData.ts')))
  assert.ok(/if \(dogErr \|\| formulaErr \|\| profErr\)/.test(opd) && /if \(prodErr\) throw/.test(opd), '주문 화면이 조회 실패를 빈 화면으로 그린다')
  const fc = stripComments(read(join(ROOT, 'lib', 'personalization', 'formulaCache.ts')))
  assert.ok(/if \(res\.ok \|\| isPermanentComputeFailure\(body\)\)/.test(fc), '처방 계산 일시 실패를 30초 캐시해 다시 시도를 막는다')
  // ⑤ 멈춘 버튼·사라지는 글
  const del = stripComments(read(join(ROOT, 'app', 'mypage', 'delete', 'DeleteAccountForm.tsx')))
  assert.ok(/try \{\s*res = await fetch\('\/api\/account\/delete'/.test(del), '탈퇴 버튼이 연결 끊김에 영원히 처리 중으로 멈춘다')
  const cs = stripComments(read(join(ROOT, 'app', '(main)', 'mypage', 'cs', 'CsThreadClient.tsx')))
  assert.ok(cs.includes('setInput((cur) => (cur.trim() ? cur : text))'), '문의 전송 실패 시 쓴 글이 사라진다')
  const chat = stripComments(read(join(ROOT, 'app', '(main)', 'chat', 'ChatClient.tsx')))
  assert.ok(chat.includes('streamError = obj.error') && !/throw new Error\(obj\.error\)/.test(chat), 'AI 상담 스트림 오류를 삼켜 빈 말풍선만 남긴다')
  // ⑥ 원문·다른 사건으로 말하기
  const join_ = read(join(ROOT, 'app', 'start', 'join', 'page.tsx'))
  assert.ok(join_.indexOf("s.includes('rate')") < join_.indexOf("s.includes('email') && s.includes('invalid')"), '가입: 발송 한도를 이메일 형식 오류로 안내한다')
  const login = stripComments(read(join(ROOT, 'app', '(auth)', 'login', 'page.tsx')))
  assert.ok(login.includes("'AuthRetryableFetchError'"), '로그인: 연결 끊김을 "비밀번호가 틀렸다"로 말한다')
  for (const f of ['app/(main)/mypage/MypageClient.tsx', 'components/account/LogoutButton.tsx']) {
    assert.ok(read(join(ROOT, ...f.split('/'))).includes("signOut({ scope: 'local' })"), `${f}: 로그아웃 실패를 성공한 척한다`)
  }
  const pw = stripComments(read(join(ROOT, 'components', 'account', 'PasswordChangeButton.tsx')))
  assert.ok(!/setError\(authErr\.message\)/.test(pw), '비밀번호 재설정 메일 오류 원문(영어)을 보여 준다')
  const ap = stripComments(read(join(ROOT, 'app', 'api', 'personalization', 'approve', 'route.ts')))
  assert.ok(!/이미 \$\{status\} 상태입니다/.test(ap), "승인 응답에 상태값 원문('declined')이 나간다")
  const modal = stripComments(read(join(ROOT, 'app', 'account', 'subscriptions', 'PriceChangeConsentModal.tsx')))
  assert.ok(/res\.status === 409/.test(modal), '이미 처리된 제안에 동의 모달이 닫히지 않는다')
  // ⑦ 앱 오프라인 첫 화면 — 빈 베이지 화면 대신 안내·다시 시도
  assert.ok(/errorPath: 'error\.html'/.test(read(join(ROOT, 'capacitor.config.ts'))) && existsSync(join(ROOT, 'scripts', 'capacitor-error.html')) && read(join(ROOT, 'scripts', 'cap-webdir.mjs')).includes("copyFileSync('scripts/capacitor-error.html', 'capacitor-web/error.html')"), '앱이 오프라인에서 빈 화면만 띄운다(errorPath·원본·복사 중 하나가 빠졌다 — capacitor-web 은 gitignore 임시 폴더)')
})

test('규칙126: AI·결제 외부 오류는 한국어로, 사용량은 빠짐없이 — OCR·챗봇·카드 등록', () => {
  const ocr = stripComments(read(join(ROOT, 'lib', 'vision', 'parseMedicalRecord.ts')))
  assert.ok(!/message: err\.error\?\.message/.test(ocr) && !/message: err instanceof Error \? err\.message/.test(ocr), '진료기록 OCR 이 Anthropic·네트워크 원문을 고객에게 보낸다')
  const ocrRoute = stripComments(read(join(ROOT, 'app', 'api', 'health', 'ocr', 'route.ts')))
  assert.ok(ocrRoute.includes("'anthropic.health_ocr.failed'"), 'OCR 실패(크레딧 소진 등)가 사장님께 안 간다')
  for (const f of ['app/api/chatbot/route.ts', 'app/api/chatbot/stream/route.ts']) {
    const b = stripComments(read(join(ROOT, ...f.split('/'))))
    assert.ok(b.includes("recordAnthropicUsage('chatbot'"), `${f}: 챗봇 호출이 전역 하루 상한에 안 잡힌다`)
  }
  const stream = stripComments(read(join(ROOT, 'app', 'api', 'chatbot', 'stream', 'route.ts')))
  assert.ok(!/error: String\(e\)/.test(stream), '챗봇 스트림 오류 원문을 고객에게 보낸다')
  const toss = stripComments(read(join(ROOT, 'lib', 'payments', 'toss.ts')))
  const issue = toss.slice(toss.indexOf('export async function issueBillingKey'), toss.indexOf('export async function', toss.indexOf('export async function issueBillingKey') + 10))
  assert.ok(!/message: err instanceof Error \? err\.message/.test(issue), "카드 등록 실패에 토스 통신 원문('fetch failed' 등)을 보여 준다")
})

test('규칙127: 제품 사실은 확정본대로 · 이벤트 코드 목록 비공개 · 새 처방 시작은 다음 박스 이내', () => {
  // ① 사장님 확정 사실(v4.0 2026-07-18·배합표 2026-08-25)과 반대인 문구 금지
  const detail = read(join(ROOT, 'lib', 'recipe-detail.ts'))
  assert.ok(!/열량 밀도(가|를) (4종 가운데 )?가장 가(벼|볍)/.test(detail), "닭 = '열량 가장 가벼움'(v4.0 닭 130 > 오리·돼지 125)")
  assert.ok(!/안심 부위|가장 기름기 적은 부위인 안심/.test(detail), "돼지 부위 = 뒷다리살(안심 아님, 2026-08-25)")
  assert.ok(!/name: '강황',\s*role: '커큐민/.test(detail) && !/name: '강황',\s*note:\s*'커큐민이 든 노란 향신 뿌리예요\. 관절과 노화/.test(detail), '강황을 닭 전용 컨셉 토핑으로 소개한다(4종 공통)')
  assert.ok(!/저칼로리/.test(stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'analysis', 'AnalysisView.tsx')))), "닭 '저칼로리' 태그")
  assert.ok(!/저지방으로 손질/.test(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'plan', 'PlanClient.tsx'))), "한우 '저지방'(4종 중 지방 최다)")
  assert.ok(!/concept: '체중관리·오메가3'/.test(read(join(ROOT, 'lib', 'web-recipes.ts'))), "닭 '오메가3'(닭 EPA+DHA 최저)")
  assert.ok(!/상세 배합비와 영양 성적서는/.test(read(join(ROOT, 'components', 'web', 'fd', 'FdRecipeSheet.tsx'))), '앱에 없는 배합비·성적서를 약속한다')
  const qr = stripComments(read(join(ROOT, 'app', 'recipe', '[protein]', 'page.tsx')))
  assert.ok(qr.includes('fullIngredientNames(PROTEIN_LINE[key])') && !/숨긴 재료가 없어요/.test(qr), "봉투 QR 이 절반만 적고 '모든 것'이라 한다")
  // ② 이벤트 코드는 비로그인 목록 조회 금지(선착순 자리 선점)
  const mig = read(join(ROOT, 'supabase', 'migrations', '20260926110000_promotions_read_admin_only.sql'))
  assert.ok(/drop policy if exists promotions_read_open/.test(mig) && /using \(public\.is_admin\(\)\)/.test(mig), '진행 중 이벤트 코드를 누구나 목록으로 받는다')
  // ③ 새 처방 시작 상한 — 고객이 쓰는 next_delivery_date 를 먼 미래로 바꾸면 영원히 시작 안 됨
  const cyc = stripComments(read(join(ROOT, 'lib', 'personalization', 'cycle.ts')))
  // 2026-10-01: 상한을 먼저 걸고(first), 조리가 시작된 박스면 그다음 박스로 넘긴다(규칙153 일정 변경).
  // 11차 A#12: 상한은 이 구독의 2주 주기 날짜로(next 에서 14일씩 거슬러 오늘+14 이상 첫 날).
  assert.ok(/if \(next > capRaw\) \{[\s\S]{0,200}first = plusDays\(next, -DELIVERY_INTERVAL_DAYS \* Math\.floor\(diff \/ DELIVERY_INTERVAL_DAYS\)\)/.test(cyc), '새 처방 시작일에 상한이 없다(청구는 새 금액·포장은 옛 처방)')
})

test('규칙128: 보관·알레르기 안내는 라벨·실제 원료대로 (사장님 승인 2026-09-26 — FAQ DB 는 마이그 20260926120000)', () => {
  /**
   * 라이브 FAQ(DB)·코드 폴백·/plans 가 ① "냉동 12개월·해동 후 냉장 7일"(라벨은 냉동 180일·3일)
   * ② "원료가 든 레시피는 자동 제외, 실수로 섞일 일 없다"(연어유·난각분말은 4종 공통이라 생선·계란은 안 빠진다)
   * 라고 했다. DB 는 테스트가 못 보니 코드 쪽 폴백·문구를 잠근다(폴백이 틀리면 DB 장애 때 틀린 안내가 나간다).
   */
  const faq = read(join(ROOT, 'app', 'faq', 'page.tsx'))
  assert.ok(!/12개월까지 보관/.test(faq) && !/7일 이내 급여/.test(faq), 'FAQ 폴백 보관기한이 라벨(냉동 180일·해동 후 3일)과 다르다')
  assert.ok(faq.includes('제조일로부터 냉동 180일'), 'FAQ 폴백에 라벨 유통기한이 없다')
  assert.ok(!/실수로 섞여 들어갈 일이 없습니다/.test(faq), "FAQ 폴백이 생선·계란까지 '자동 제외'를 약속한다")
  assert.ok(/연어유[\s\S]{0,400}카카오톡으로 편하게 문의/.test(faq), 'FAQ 폴백 알레르기 답에 공통 원료 안내·카카오톡 문의가 없다')
  // 웹 갈래는 2026-10-10 웹 리뉴얼로 StoreFaq(인라인 white-space: pre-line)를 쓴다 — 앱 갈래 + StoreFaq 둘 다 문단을 지킨다.
  const storeFaq = read(join(ROOT, 'components', 'store', 'StoreFaq.tsx'))
  assert.ok(faq.includes('whitespace-pre-line') && faq.includes('<StoreFaq') && storeFaq.includes("whiteSpace: 'pre-line'"), 'FAQ 답변의 문단 나눔이 한 줄로 뭉친다')
  const plans = read(join(ROOT, 'app', 'plans', 'page.tsx'))
  assert.ok(!/해당 원료가 포함된 레시피는 자동으로 제외/.test(plans), "/plans 가 생선·계란까지 '자동 제외'를 약속한다")
  const mig = read(join(ROOT, 'supabase', 'migrations', '20260926120000_content_faq_blog_facts.sql'))
  assert.ok(mig.includes('제조일로부터 냉동 180일') && mig.includes('카카오톡으로 편하게 문의'), 'FAQ·블로그 정정 마이그레이션이 비었다')
})

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09-26 출시 전 점검 8차 (개인정보 과다 노출 / 다견·가족·계정 조합 / 구버전 앱 호환·앱 속도) — 규칙129~131
// ─────────────────────────────────────────────────────────────────────────────

test('규칙129: 본문 글꼴은 부분 글꼴(524KB) — 우리 문구의 한글은 전부 그 안에 있다', () => {
  /**
   * 전체 Pretendard(2.06MB)를 모든 화면이 가장 먼저 받았다(앱 첫 실행 전송량의 약 83%). KS X 1001 2,350자 +
   * 기호만 담은 부분 글꼴로 바꿨다(scripts/pretendard-subset.py). 우리 문구가 그 밖의 음절을 쓰면 그 글자만
   * 다른 글꼴로 보이므로, 새 음절은 scripts/pretendard-subset-extras.json 에 넣고 다시 만든다.
   */
  const layout = read(join(ROOT, 'app', 'layout.tsx'))
  assert.ok(/src: "\.\/fonts\/PretendardVariable-ksx\.woff2"/.test(layout), '본문 글꼴이 부분 글꼴이 아니다(2MB 전체를 preload)')
  const ksx = new Set<string>()
  const dec = new TextDecoder('euc-kr')
  for (let lead = 0xb0; lead <= 0xc8; lead++) {
    for (let trail = 0xa1; trail <= 0xfe; trail++) {
      const ch = dec.decode(new Uint8Array([lead, trail]))
      const cp = ch.codePointAt(0) ?? 0
      if (cp >= 0xac00 && cp <= 0xd7a3) ksx.add(ch)
    }
  }
  assert.equal(ksx.size, 2350, 'KS X 1001 한글 표를 못 만들었다')
  const extras = new Set<string>(JSON.parse(read(join(ROOT, 'scripts', 'pretendard-subset-extras.json'))).extras)
  const missing: string[] = []
  for (const dir of ['app', 'components', 'lib']) {
    for (const f of walk(join(ROOT, dir))) {
      if (f.endsWith('.test.ts')) continue
      // 주석은 화면에 안 나온다 — 빼고 본다. 정규식의 '가-힣' 범위 표기도 글자가 아니다.
      const src = stripComments(read(f)).replace(/가[-–]힣/g, '')
      for (const ch of src) {
        const cp = ch.codePointAt(0) ?? 0
        if (cp >= 0xac00 && cp <= 0xd7a3 && !ksx.has(ch) && !extras.has(ch)) missing.push(`${rel(f)}: ${ch}`)
      }
    }
  }
  assert.deepEqual([...new Set(missing)], [], `부분 글꼴에 없는 음절을 문구에 쓴다 — extras 에 넣고 python scripts/pretendard-subset.py:\n${[...new Set(missing)].join('\n')}`)
})

test('규칙130: 옛 앱 버전을 지킨다 — 네이티브에 기대는 웹 기능은 빌드 번호로 · 업데이트 안내 · 스플래시 1회 · 공유 기기 푸시', () => {
  // ① iOS 이미지 저장 — 사진 추가 권한 문구가 없는 빌드에서 공유 시트 '이미지 저장'은 앱을 종료시킨다.
  const save = stripComments(read(join(ROOT, 'lib', 'save-image.ts')))
  assert.ok(/buildAtLeast\(info\.build, NATIVE_FEATURE_MIN_BUILD\.iosPhotoAdd\)/.test(save), 'iOS 이미지 저장이 빌드 번호를 안 본다(옛 빌드에서 앱 종료)')
  const nb = read(join(ROOT, 'lib', 'native-build.ts'))
  const minPhoto = Number(nb.match(/iosPhotoAdd: (\d+)/)?.[1])
  const pbx = read(join(ROOT, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'))
  const builds = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((m) => Number(m[1]))
  assert.ok(builds.length > 0 && builds.every((b) => b >= minPhoto), `다음 iOS 빌드 번호(${builds})가 사진 권한 게이트(${minPhoto})보다 낮다 — 새 빌드에서도 저장이 막힌다`)
  assert.ok(read(join(ROOT, 'ios', 'App', 'App', 'Info.plist')).includes('NSPhotoLibraryAddUsageDescription'), 'Info.plist 에 사진 추가 권한 문구가 없다')
  // ② 옛 버전 사용자에게 업데이트 안내(환경변수로 켬)
  const layout = read(join(ROOT, 'app', 'layout.tsx'))
  assert.ok(layout.includes('<NativeUpdateNotice />'), '옛 앱 버전에 업데이트 안내가 없다')
  // ③ 스플래시는 앱 실행당 한 번
  assert.ok(layout.includes("sessionStorage.getItem('ft_splash_shown')") && read(join(ROOT, 'app', 'globals.css')).includes('html.ft-splash-skip .ft-splash'), '전체 로드마다 2.1초 스플래시가 다시 덮는다')
  // ④ 같은 기기의 이전 사용자 토큰 정리(가족 폰에서 남의 결제·복약 알림)
  const reg = stripComments(read(join(ROOT, 'app', 'api', 'push', 'native-register', 'route.ts')))
  assert.ok(/\.eq\('device_id', deviceId\)\.neq\('user_id', user\.id\)/.test(reg) && /\.eq\('token', token\)\.neq\('user_id', user\.id\)/.test(reg), '같은 기기·토큰의 이전 사용자 행을 안 지운다')
})

test('규칙131: 한 마리·한 사람 가정을 깨지 않는다 · 열람권 주소를 흘리지 않는다', () => {
  // ① 라벨 전화 = 주소와 같은 출처
  const ch = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')))
  assert.ok(/recipient_phone: ship\.phone,/.test(ch) && !/recipient_phone: sub\.recipient_phone \?\? ship\.phone/.test(ch), '라벨 전화만 신청서 값이다(주소는 기본 배송지)')
  // ② 결제된 박스가 준비 중이면 강아지 삭제 금지(처방이 cascade 로 사라져 빈 팩)
  const mig = read(join(ROOT, 'supabase', 'migrations', '20260926130000_block_dog_delete_with_open_paid_order.sql'))
  assert.ok(mig.includes("errcode = 'FT101'") && /order_status in \('pending', 'preparing'\)/.test(mig), '결제된 준비 중 박스가 있어도 강아지를 지운다')
  assert.ok(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'DogDetailClient.tsx')).includes("=== 'FT101'"), '강아지 삭제 화면이 FT101 을 안내하지 않는다')
  // ③ 환불 사유는 그 박스의 강아지에
  const cancel = stripComments(read(join(ROOT, 'app', 'api', 'orders', '[id]', 'cancel', 'route.ts')))
  assert.ok(/from\('subscriptions'\)\s*\.select\('dog_id'\)/.test(cancel), "환불 사유를 계정의 아무 강아지에 적는다")
  // ④ 둘째 강아지 설문 — '강아지가 한 마리라도 있으면' 버리지 않는다
  for (const f of ['lib/auth/applyAutosignupDraft.ts', 'lib/auth/createDogFromDraft.ts']) {
    const b = stripComments(read(join(ROOT, ...f.split('/'))))
    assert.ok(/\.eq\('name', \(dog\.name \|\| ''\)\.trim\(\)\)/.test(b), `${f}: 멱등 가드가 '강아지 아무나'라 둘째 강아지 설문을 버린다`)
  }
  const claim = stripComments(read(join(ROOT, 'app', 'start', 'claim', 'page.tsx')))
  assert.ok(/count && count > 0 && !hasCompleteDraft/.test(claim), '카카오·애플 로그인이 기존 회원의 둘째 강아지 설문을 말없이 지운다')
  // ⑤ 열람권 주소(/vet/·/photo-upload/)는 분석·광고·오류 도구로 안 간다
  assert.ok(stripComments(read(join(ROOT, 'components', 'AnalyticsScripts.tsx'))).includes('isTokenBearerPath('), '토큰 주소에서도 분석·광고 도구를 싣는다')
  assert.ok(stripComments(read(join(ROOT, 'components', 'CookieConsent.tsx'))).includes('isTokenBearerPath('), '토큰 주소에서도 쿠키 배너(→동의→분석)를 띄운다')
  // Sentry 스크러버는 lib/sentry-scrub 하나(순환 안전). 설정 파일마다 복사해 둔 재귀 walk 를 트랜잭션에 붙였더니
  // 트랜잭션에 실려 오는 Scope(순환 객체)에서 RangeError 로 전부 터졌다(2026-09-26 Sentry FARMERSTAIL-APP-13).
  // 동작 자체는 lib/sentry-scrub.test.ts 가 실제 SDK 파이프라인으로 검사한다 — 여기선 복사본이 돌아오는 것을 막는다.
  for (const f of ['instrumentation-client.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts']) {
    const b = stripComments(read(join(ROOT, f)))
    assert.ok(b.includes("from '@/lib/sentry-scrub'"), `${f}: 공용 스크러버(lib/sentry-scrub)를 안 쓴다`)
    assert.ok(!/const walk\s*=/.test(b) && !/function scrub/.test(b), `${f}: 설정 파일 안에 자체 스크러버가 돌아왔다(순환에서 터진 그 코드)`)
    if (f !== 'sentry.edge.config.ts') {
      assert.ok(/beforeSendTransaction\(event\) \{\s*return scrubSentryEvent\(event\)/.test(b), `${f}: Sentry 트랜잭션이 토큰 주소를 가리지 않는다`)
    }
  }
  const scrubLib = stripComments(read(join(ROOT, 'lib', 'sentry-scrub.ts')))
  assert.ok(
    scrubLib.includes('redactTokenPaths(') && scrubLib.includes('SDK_INTERNAL_KEYS.has(k)') && scrubLib.includes('new WeakMap'),
    'lib/sentry-scrub 가 토큰 가림 · SDK 내부 칸(sdkProcessingMetadata) 건너뛰기 · 순환 안전 중 하나를 잃었다',
  )
  // ⑥ 개인 메일이 박힌 공개 시안 페이지 금지
  assert.ok(!existsSync(join(ROOT, 'app', 'dev', 'admin-preview', 'page.tsx')), '사장님 개인 메일이 박힌 공개 시안 페이지가 돌아왔다')
})

test('규칙132: 이웃 할인(첫 박스 1회 지정 할인)은 판정·소진·되돌림·CHECK 가 한 벌이다', () => {
  /**
   * 사장님 2026-09-27 "지인·쓰레드 유입에게 첫 박스만 할인율 골라서" → 이름 '이웃 할인'.
   * 체험단 때 겪은 사고(orders CHECK 가 새 사유를 거부해 청구 전멸, 규칙96)와 "소진을
   * 청구 전에 표시해 실패 시 할인 증발"(결제감사 #3)을 같은 자리에서 잠근다.
   */
  const resolver = stripComments(read(join(ROOT, 'lib', 'payments', 'auto-discount.ts')))
  assert.match(resolver, /from\('neighbor_discounts'\)/, '판정이 이웃 할인을 안 본다')
  assert.match(resolver, /\.is\('redeemed_order_id', null\)/, '이미 쓴 이웃 할인이 다시 적용된다')
  // skipOneTime = recurringOnly || 앞선 구독 있음(규칙135) — 반복 금액·두 번째 구독 미리보기엔 1회 할인 제외.
  assert.match(resolver, /const skipOneTime = recurringOnly \|\|/, 'skipOneTime 이 recurringOnly 를 포함하지 않는다')
  assert.match(resolver, /if \(!skipOneTime\) \{[\s\S]{0,200}neighbor_discounts/, '반복 금액 미리보기(recurringOnly)에 1회 할인이 섞인다')
  assert.match(resolver, /pickWithNeighbor\(/, '더 큰 쪽 하나만 규칙(pickWithNeighbor)이 빠졌다')

  const cron = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')))
  assert.match(cron, /if \(neighborClaimed\)[\s\S]{0,600}\.is\('redeemed_order_id', null\)[\s\S]{0,200}\.select\('user_id'\)/, '이웃 할인 소진이 CAS(.is null)+행 확인이 아니다')
  assert.match(cron, /neighbor_mark_failed/, '소진 0행/실패가 무음이다')
  // 소진은 '청구 후 재확인 → 자동환불' 분기 **뒤**에 — 앞이면 환불된 박스가 할인을 먹는다.
  assert.ok(cron.indexOf('if (neighborClaimed)') > cron.indexOf('청구 후 상태 재확인'), '이웃 할인 소진이 환불 재확인보다 앞에 있다')

  const mig = read(join(ROOT, 'supabase', 'migrations', '20260927090000_neighbor_discounts.sql'))
  assert.match(mig, /'trial_half', 'neighbor'\]/, 'orders.discount_reason CHECK 에 neighbor 가 없다 — 청구가 전멸한다')
  assert.match(mig, /create trigger trg_orders_reclaim_neighbor_discount/i, '환불 시 되돌림 트리거가 없다')

  const shell = stripComments(read(join(ROOT, 'components', 'adminui', 'admin-shell-next.tsx')))
  assert.match(shell, /href:\s*'\/admin\/neighbors'/, '이웃 할인 화면이 실제 어드민 내비에 없다')
  const api = stripComments(read(join(ROOT, 'app', 'api', 'admin', 'neighbors', 'route.ts')))
  assert.match(api, /requireAdmin\(\)/, '이웃 할인 API 가 관리자 관문 없이 열린다')
  assert.match(api, /NEIGHBOR_RATES/, '할인율이 선택지(NEIGHBOR_RATES) 검증 없이 들어간다')
})

test('규칙133: 알림톡 — 보내기 전에 자리 잡기(한 번만) · 절대 throw 안 함 · 승인 전 템플릿은 안 보냄 · 웹훅 토큰 · 탈퇴 익명화', () => {
  /**
   * 2026-09-28 알림톡 1단계 기반. 솔라피엔 멱등키가 없어 크론 재시도·웹훅 재전송이면 같은 안내가
   * 두 번 나간다 → message_log unique 로 "먼저 자리 잡고 보내기". 호출 지점이 청구·환불 같은 돈
   * 경로라 발송 실패가 결제 기록을 끊으면 안 된다(throw 금지). 웹훅은 로그인 없는 공개 주소라
   * 토큰 없이 열리면 누구나 발송 상태를 조작한다.
   */
  const mig = read(join(ROOT, 'supabase', 'migrations', '20260928100000_message_log.sql'))
  assert.match(mig, /constraint message_log_once unique \(event_type, source_id, channel\)/, 'message_log 한 번만 제약이 없다')
  assert.match(mig, /revoke all on table public\.message_log from anon, authenticated/, 'message_log 가 고객에게 열려 있다')

  const src = stripComments(read(join(ROOT, 'lib', 'notify', 'alimtalk.ts')))
  const insertAt = src.indexOf(".from('message_log')")
  const sendAt = src.indexOf('svc.send(')
  assert.ok(insertAt > 0 && sendAt > insertAt, '발송 기록 자리 잡기가 전송보다 앞에 있어야 한다(중복 발송 방지)')
  assert.match(src, /'23505'[\s\S]{0,80}duplicate/, '같은 이벤트 재요청(unique 충돌)을 건너뛰지 않는다')
  assert.match(src, /if \(!template\.solapiTemplateId\) return/, '승인 전 템플릿(ID 없음)을 보내려 한다')
  assert.doesNotMatch(src, /\bthrow\b/, 'sendAlimtalk 가 throw 한다 — 돈 경로 호출부가 끊긴다')

  const hook = stripComments(read(join(ROOT, 'app', 'api', 'webhooks', 'solapi', 'route.ts')))
  assert.match(hook, /timingSafeEqual/, '웹훅 토큰을 시간 일정 비교로 검증하지 않는다')
  assert.match(hook, /status: 401/, '토큰 실패를 401 로 막지 않는다')
  assert.match(hook, /status: 500/, 'DB 오류를 200 으로 삼킨다 — 재전송이 끊긴다(AGENTS.md 1번)')

  const del = stripComments(read(join(ROOT, 'app', 'api', 'account', 'delete', 'route.ts')))
  assert.ok(del.includes("from('message_log')"), '탈퇴가 알림톡 발송 기록을 익명화하지 않는다')

  const shell = stripComments(read(join(ROOT, 'components', 'adminui', 'admin-shell-next.tsx')))
  assert.match(shell, /href:\s*'\/admin\/messages'/, '알림톡 화면이 실제 어드민 내비에 없다')
})

test('규칙134: 돈이 걸린 어드민 도장(서포터즈·이웃 할인) — 기존 결제 고객 차단 · 확인창 · 후보 이력 표시 · 감사 기록', () => {
  /**
   * 2026-09-28 출시점검 9차(어드민 위험 동작): 부분 이름 검색 10줄 중 잘못 누르면 확인 없이 즉시
   * 등록됐고, 서버가 결제 이력을 안 봐서 기존 구독자에게 붙으면 다음 결제부터 100원×4→반값×4
   * (약 19.6만 원) 또는 최대 50% 할인이 나갔다. 떼면 남은 회차 흔적도 없었다(떼고 다시 찍으면 4+4 초기화).
   */
  const trials = stripComments(read(join(ROOT, 'app', 'api', 'admin', 'trials', 'route.ts')))
  const neighbors = stripComments(read(join(ROOT, 'app', 'api', 'admin', 'neighbors', 'route.ts')))
  assert.match(trials, /hasPaidBox\(admin, body\.userId\)[\s\S]{0,400}body\.force !== true/, '서포터즈 도장이 결제 이력 고객을 force 없이 받는다')
  assert.match(neighbors, /hasPaidBox\(admin, body\.userId\)[\s\S]{0,400}NOT_FIRST_BOX/, '이웃 할인이 결제 이력 고객에게 붙는다')
  for (const [name, src] of [['trials', trials], ['neighbors', neighbors]] as const) {
    assert.match(src, /customerHistories\(/, `${name}: 후보 검색이 구독 상태·결제 이력을 안 보여준다`)
    const audits = src.match(/recordAdminAction\(/g) ?? []
    assert.ok(audits.length >= 2, `${name}: 붙이기·떼기 감사 기록이 없다(${audits.length})`)
  }

  const resolver = stripComments(read(join(ROOT, 'lib', 'payments', 'auto-discount.ts')))
  assert.match(resolver, /hasPaidBox\(supabase, userId\)/, '청구 판정이 이웃 할인의 "첫 박스"를 강제하지 않는다')

  const tc = stripComments(read(join(ROOT, 'app', 'admin', 'trials', 'TrialsClient.tsx')))
  const nc = stripComments(read(join(ROOT, 'app', 'admin', 'neighbors', 'NeighborsClient.tsx')))
  assert.match(tc, /async function stamp\([\s\S]{0,200}window\.confirm/, '서포터즈 도장 찍기에 확인창이 없다')
  assert.match(tc, /HAS_PAID_HISTORY[\s\S]{0,200}window\.confirm/, '결제 이력 고객 재확인이 없다')
  assert.match(nc, /async function give\([\s\S]{0,300}window\.confirm/, '이웃 할인 붙이기에 확인창이 없다')
  assert.match(tc, /취소하지 못했어요/, '도장 취소 실패가 화면에 안 나온다')
})
// ─────────────────────────────────────────────────────────────────────────────
// 2026-09-28 출시 전 점검 9차 (알림 문구 정합 / 어드민 위험 동작 / 결제 실패 복구) — 규칙140~
// ─────────────────────────────────────────────────────────────────────────────

test('규칙140: 같은 돈이 두 번 움직이지 않는다 — 부분환불 재탭 · 재개 · 늦은 성공 · 재등록 · 결과 불명 · 카드 교체 경합', () => {
  // ① 부분환불 — 멱등키는 '화면이 본' 누적 환불액으로, 서버 값과 다르면 토스 전에 409
  const pc = stripComments(read(join(ROOT, 'app', 'api', 'admin', 'orders', '[id]', 'partial-cancel', 'route.ts')))
  assert.ok(/'Idempotency-Key': `partial-cancel-\$\{order\.id\}-\$\{expectedRefundedAmount\}-\$\{cancelAmount\}`/.test(pc), '부분환불 멱등키가 서버가 새로 읽은 값으로 만들어진다(응답 유실 뒤 재탭 = 이중 환불)')
  const conflictAt = pc.indexOf("'REFUND_STATE_CHANGED'")
  const tossAt = pc.indexOf('/cancel`')
  assert.ok(conflictAt > 0 && tossAt > 0 && conflictAt < tossAt, '누적 환불액 불일치 검사가 토스 호출보다 앞에 없다')
  assert.ok(read(join(ROOT, 'app', 'admin', 'orders', '[id]', 'PartialCancelPanel.tsx')).includes('expectedRefundedAmount: refundedAmount'), '환불 패널이 자기가 본 누적 환불액을 보내지 않는다')
  // ② 재개 — 아직 오지 않은 원래 배송일을 앞당기지 않는다(관리자·앱·웹 3곳)
  for (const f of ['app/admin/subscriptions/page.tsx', 'app/(main)/dogs/[id]/subscription/DogSubscriptionClient.tsx', 'app/account/subscriptions/SubscriptionsWebClient.tsx']) {
    const b = stripComments(read(join(ROOT, ...f.split('/'))))
    assert.ok(b.includes('resumeShipDate('), `${f}: 재개가 원래 배송일을 무시하고 다음 화요일로 덮는다(1주 만에 또 결제)`)
  }
  // ③ 늦은 성공 — 그 박스가 나가는 화요일 + 14
  const ch = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')))
  assert.ok(/function nextDeliveryDate\([^)]*\)[^{]*\{\s*return nextChargeDateAfterSuccess\(/.test(ch), '청구 성공 뒤 다음 청구일이 예정일+14 그대로다(T+13 성공 → 다음 날 또 청구)')
  // ④ 카드 재등록 — 지난 날짜면 다음 발송 화요일로
  const bi = stripComments(read(join(ROOT, 'app', 'api', 'payments', 'billing-issue', 'route.ts')))
  // 2026-10-01: '지난 날짜' = 결제일(조리 직전 토요일 / 서포터즈 발송일) 기준 — chargeDateFor.
  // 2026-10-02: 결제 시점을 한 번 조회해(chargeTiming) 첫 박스 마감에도 쓴다 — 서포터즈 일요일·일반 금요일(규칙157).
  // 2026-10-06 10차 A: 판정은 정본 keepShipDateOnCardRegister(일요일 09:10 전은 제때) — 고지 화면(billing-terms)도 같은 함수.
  assert.ok(/!keepShipDateOnCardRegister\(cur\.next_delivery_date, chargeTiming \?\? 'ship_day'\)\s*\)\s*\{\s*firstDeliveryIso = nextShipDate\(undefined, chargeTiming \?\? 'before_cooking'\)/.test(bi), '재등록 시 결제일이 지난 회차를 그대로 둬 조리가 끝난 박스를 늦게 청구한다')
  assert.match(stripComments(read(join(ROOT, 'app', 'api', 'subscriptions', 'billing-terms', 'route.ts'))), /keepShipDateOnCardRegister\(row\.next_delivery_date, timing \?\? 'ship_day'\)/, '정기결제 고지 화면이 재등록 판정과 다른 날짜(지난 결제일)를 고지한다')
  // ⑤ 결과 불명 — 매 실행 맨 앞에서 토스 주문번호 조회로 확정, 모르면 그 구독 청구 금지
  const verifyAt = ch.indexOf('await verifyAmbiguousCharges(supabase')
  // 2026-10-01: 조회는 사흘 앞 발송분까지(토요일 결제) — 결제일 판정은 구독별(규칙153).
  const targetsAt = ch.indexOf(".lte('next_delivery_date', addDaysKst(today, CHARGE_BEFORE_SHIP_DAYS))")
  assert.ok(verifyAt > 0 && targetsAt > 0 && verifyAt < targetsAt, '결과 불명 확정이 청구 대상 조회보다 먼저 돌지 않는다')
  assert.ok(ch.includes('ambiguity.unresolvedSubIds.has(sub.id)'), '결과를 모르는 구독을 청구 루프가 건너뛰지 않는다')
  assert.ok(stripComments(read(join(ROOT, 'lib', 'payments', 'toss.ts'))).includes('`/payments/orders/${encodeURIComponent(orderId)}`'), '토스 주문번호 조회 API 가 없다')
  assert.ok(existsSync(join(ROOT, 'supabase', 'migrations', '20260928120000_subscription_charges_toss_verified_at.sql')), '결과 확인 표시 칸 마이그레이션이 사라졌다')
  // ⑥ 선점에 빌링키 — 배치 조회 뒤 재등록된 카드를 옛 키로 긁지 않는다
  assert.ok(/\.eq\('next_delivery_date', sub\.next_delivery_date\)\s*\.eq\('billing_key', sub\.billing_key\)/.test(ch), '청구 선점이 빌링키를 확인하지 않는다(재등록 경합)')
  // ⑦ 우리 설정 오류(틀린 운영키)는 고객 실패가 아니다 — 알림 없이, 인증 계열이면 실행 중단
  assert.ok(ch.includes('isMerchantConfigError(errorCode)') && ch.includes('merchantAbort = true'), '틀린 운영키가 전 고객 결제 실패·3회 정지로 번진다')
  // ⑧ 확정 거절(잔액부족) 재시도 상한
  assert.ok(/isDefinitiveDecline\(errorCode\)\)\s*\{[\s\S]{0,200}?shouldPause = nextFailedCount >= MAX_FAILED/.test(ch), '잔액부족 재시도에 상한이 없다(매일 청구·알림 무한)')
})

test('규칙141: 관리자 한 번의 오터치가 되돌릴 수 없게 번지지 않고, 고객에게 가는 말은 실제와 같다', () => {
  // ① 송장 없이 '준비 중 → 배송 완료' 금지
  const st = stripComments(read(join(ROOT, 'app', 'api', 'admin', 'orders', '[id]', 'status', 'route.ts')))
  assert.ok(st.includes("code: 'SHIP_FIRST'") && /order\.order_status === 'preparing' && !order\.shipped_at/.test(st), '송장 없이 배송 완료(되돌릴 수 없는 종결·고객 알림)로 넘어간다')
  // ② 구독 해지·정지 확인창에 대상과 결과
  const subs = read(join(ROOT, 'app', 'admin', 'subscriptions', 'page.tsx'))
  assert.ok(subs.includes('다시 켤 수 없어요') && /newStatus === 'paused' &&\s*!confirm\(/.test(subs), '해지·정지 확인창이 누구의 구독인지·되돌릴 수 없는지를 말하지 않는다')
  // ③ 프로모션 끄기 가짜 성공 금지 · 만들기 확인 · 0행 = 404
  const pc = stripComments(read(join(ROOT, 'app', 'admin', 'promotions', 'PromotionsClient.tsx')))
  assert.ok(/if \(!res\.ok\) \{\s*revert\(\)/.test(pc), '프로모션 켜기·끄기가 서버 실패를 무시한다(화면만 꺼짐)')
  assert.ok(pc.includes('pct > 50 && !window.confirm('), '프로모션 할인율 50% 초과에 재확인이 없다(9→90 오타)')
  const pr = stripComments(read(join(ROOT, 'app', 'api', 'admin', 'promotions', 'route.ts')))
  assert.ok(/\.update\(\{ active: body\.active \}\)\s*\.eq\('id', body\.id\)\s*\.select\('id'\)/.test(pr), '프로모션 PATCH 가 0행을 성공으로 답한다')
  // ④ 일괄 광고 푸시 확인창에 대상
  assert.ok(read(join(ROOT, 'app', 'admin', 'push-campaigns', 'CampaignBuilder.tsx')).includes('· 대상: ${seg?.label'), '일괄 푸시 확인창에 대상이 없다')
  // ⑤ 배송완료 크론 — 결제된 주문만 · CAS(알림 중복·환불 주문에 '배송 완료' 금지)
  const tp = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'tracking-poll', 'route.ts')))
  assert.ok(tp.includes(".in('payment_status', [...PAID_STATUSES])"), '전액 환불한 주문에도 "배송이 완료됐어요"가 간다')
  assert.ok(/order_status: 'delivered',[\s\S]{0,120}?\.eq\('id', ord\.id\)\s*\.eq\('order_status', 'shipping'\)\s*\.is\('delivered_at', null\)\s*\.select\('id'\)/.test(tp), '배송완료 저장이 CAS 가 아니다(관리자와 겹치면 알림 두 번)')
  // ⑥ 문구 — 실제 일과 같게
  const prog = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'personalization-progression', 'route.ts')))
  assert.ok(!prog.includes('이번 박스는 ${recipeName(next)}예요') && !prog.includes('2주 결제가 ${won('), '처방 알림이 "이번 박스"·"2주 결제(할인 전 금액)"라고 말한다')
  assert.ok(!read(join(ROOT, 'app', 'account', 'subscriptions', 'SubscriptionsWebClient.tsx')).includes('정기배송 관리에서 되돌릴 수 있어요'), '없는 되돌리기 기능을 약속한다')
  assert.ok(!read(join(ROOT, 'lib', 'email', 'templates', 'orders.ts')).includes('상품 준비가 시작되면 다시 알려드릴게요'), '보내지 않는 "준비 시작" 알림을 약속한다')
  assert.ok(!read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')).includes('결제 전에 메일로 다시 안내드려요'), '알림을 끈 고객에겐 안 가는 사전고지 메일을 약속한다')
  // ⑦ 알림 설정을 지키는 생일 푸시 · 전제가 맞는 단백질 푸시
  assert.ok(stripComments(read(join(ROOT, 'app', 'api', 'cron', 'dog-age-update', 'route.ts'))).includes("{ category: 'health' }"), '생일 푸시가 알림 설정·조용 시간을 무시한다')
  assert.ok(stripComments(read(join(ROOT, 'app', 'api', 'cron', 'protein-rotation', 'route.ts'))).includes('snapBoxLines(lineRatios).length !== 1'), '두 가지 레시피 박스에도 "한 가지 단백질만" 푸시가 간다')
  // ⑧ 영수증 — 결제된 주문만, 환불 반영
  const rc = stripComments(read(join(ROOT, 'app', 'mypage', 'orders', '[id]', 'receipt', 'page.tsx')))
  // 2026-10-10 웹 리뉴얼: 그리기는 ReceiptWebView(웹)·ReceiptAppView(앱) — 둘 다 환불 줄을 그리고, page.tsx 가 환불액을 넘긴다.
  const rcWeb = stripComments(read(join(ROOT, 'app', 'mypage', 'orders', '[id]', 'receipt', 'ReceiptWebView.tsx')))
  const rcApp = stripComments(read(join(ROOT, 'app', 'mypage', 'orders', '[id]', 'receipt', 'ReceiptAppView.tsx')))
  assert.ok(rc.includes("['paid', 'partially_refunded', 'refunded'].includes(o.payment_status)) notFound()") && /\n\s+refunded,\n/.test(rc) && rcWeb.includes('실제 결제 금액') && rcApp.includes('실제 결제 금액'), '결제 실패 주문도 영수증이 나오고, 환불이 영수증에 없다')
  // ⑨ 강아지 화면의 결제 예정 금액 = 청구와 같은 함수
  for (const f of ['app/(main)/dogs/[id]/subscription/page.tsx', 'app/(main)/dogs/[id]/page.tsx']) {
    assert.ok(stripComments(read(join(ROOT, ...f.split('/')))).includes('resolveAutoDiscount('), `${f}: 결제 예정 금액이 청구와 다른 계산(서포터즈만)이다`)
  }
})

test('규칙135: 여러 구독 미리보기 — 1회성 할인·서포터즈 회차는 사용자 단위, 청구 순서 첫 구독만 받는다', () => {
  /**
   * 2026-09-28 출시점검 9차: 이벤트 50% 고객이 두 마리를 같은 화요일에 시작하면 두 구독 모두
   * "42,850원 예정"으로 사전 고지됐는데 실제로는 먼저 청구되는 하나만 할인(소진은 청구 성공 뒤).
   * 미리보기는 subscriptionId 를 넘겨 청구 순서상 앞선 구독만큼 당겨 계산하고,
   * 청구 크론은 넘기지 않는다(실시간 상태로 판정 — 이미 맞다).
   */
  const resolver = stripComments(read(join(ROOT, 'lib', 'payments', 'auto-discount.ts')))
  assert.match(resolver, /advanceTrialState\(await getTrialState\(userId\), ahead\)/, '서포터즈 회차를 앞선 구독만큼 당기지 않는다')
  assert.match(resolver, /const skipOneTime = recurringOnly \|\| ahead > 0/, '두 번째 이후 구독 미리보기에 1회성 할인이 들어간다')
  assert.match(resolver, /\.order\('next_delivery_date', \{ ascending: true \}\)\s*\.order\('id'/, '청구 순서(next_delivery_date, id) 기준이 아니다')

  for (const rel of [
    ['app', '(main)', 'dogs', '[id]', 'page.tsx'],
    ['app', '(main)', 'dogs', '[id]', 'subscription', 'page.tsx'],
    ['app', '(main)', 'mypage', 'subscriptions', 'page.tsx'],
    ['app', 'api', 'cron', 'subscription-reminders', 'route.ts'],
  ]) {
    const src = stripComments(read(join(ROOT, ...rel)))
    assert.match(src, /resolveAutoDiscount\(\{[^}]*subscriptionId:/, `${rel.join('/')}: 구독별 미리보기가 청구 순서를 모른다`)
  }
  const cron = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')))
  assert.doesNotMatch(cron, /resolveAutoDiscount\(\{[^}]*subscriptionId:/, '청구 크론이 미리보기 옵션을 쓴다 — 실제 청구는 실시간 상태로')
  assert.doesNotMatch(cron, /resolveAutoDiscount\(\{[^}]*aheadCount:/, '청구 크론이 미리보기 옵션(aheadCount)을 쓴다')

  // 카드 등록(정기결제 동의) — 청구 순서에 아직 없는 구독이라 다른 활성·일시정지 구독을 모두 앞선다고
  // 보고 보수적으로 고지(고지액 ≥ 실제 청구액). 화면은 서버가 준 할인 종류·반복 금액을 **버리지 않는다** —
  // 좁은 상태 타입이 그 둘을 버려서 '첫 박스만 할인' 안내가 한 번도 안 떴다(2026-09-28).
  const terms = stripComments(read(join(ROOT, 'app', 'api', 'subscriptions', 'billing-terms', 'route.ts')))
  assert.match(terms, /\.in\('status', \['active', 'paused'\]\)[\s\S]{0,300}aheadCount: others/, '동의 화면 금액이 다른 구독을 고려하지 않는다')
  const auth = stripComments(read(join(ROOT, 'app', 'subscribe', 'billing-auth', 'page.tsx')))
  assert.match(auth, /useState<BillingTerms>\(null\)/, '동의 화면 상태가 BillingTerms 전체를 담지 않는다')
  assert.match(auth, /discountKind: data\.discountKind[\s\S]{0,120}recurringAmount: data\.recurringAmount/, '동의 화면이 할인 종류·반복 금액을 버린다 — 첫 박스 할인가가 2주마다로 보인다')
})

test('규칙142: 크는 자견에게 체중 증가를 이유로 급여량 감량을 제안하지 않는다', () => {
  /**
   * # 왜 (2026-10-01 자견 계수 점검)
   * 체중 재측정 크론은 BCS 5 를 '유지' 목표로 보고 4주에 +2% 넘게 늘면 −10% 를 제안·기록했다.
   * 월령을 보지 않아서, 1.5→2.0kg 정상 성장한 4개월 말티푸에게 "236→212kcal 로 조정" 푸시가
   * 가고 다음 회차 기준 kcal 이 깎인 채 승인 대기에 올라갈 수 있었다(체중 기록이 쌓이면 발동).
   */
  const rw = stripComments(read(join(ROOT, 'lib', 'calorie-v2', 'reweigh.ts')))
  assert.match(rw, /if \(i\.isGrowing\) \{\s*return \{\s*action: 'hold'/, '재측정 판정이 성장기 자견을 걸러내지 않는다')
  const cron = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'weight-change-detect', 'route.ts')))
  assert.match(cron, /\.select\('id, user_id, name, age_value, age_unit'\)/, '체중 크론이 강아지 월령을 읽지 않는다')
  assert.match(cron, /\.select\('bcs_score, stage'\)/, '체중 크론이 분석 당시 생애주기를 읽지 않는다')
  assert.match(cron, /decideReweigh\(\{[\s\S]{0,160}isGrowing,/, '체중 크론이 성장기 여부를 판정에 넘기지 않는다')
})

test('규칙143: 자견 칼로리는 가정견 자견 식(Klein 2019)이다 — 사육장 기준 NRC 130 식·토이 이중 하향으로 돌아가지 않는다', () => {
  /**
   * # 왜 (2026-10-01 사장님 "계수 잘못된 거 아니냐" → 확정 "몰래 바꿔, 우리 오류")
   * NRC 2006 성장식의 앞 상수 130 은 사육장 활동견 기준이라 가정견 자견을 과대추정했다
   * (7개월 웨스티 펀치 785kcal ↔ 가정견 실측 식 695 · AAHA 2.0×RER 685). 스펙 문서(M6·T4)에는
   * 옛 식이 "130 확인" 가드로 남아 있어, 문서를 보고 되돌리기 쉽다.
   */
  const nu = stripComments(read(join(ROOT, 'lib', 'nutrition.ts')))
  assert.match(nu, /\(254\.1 - 135\.0 \* p\) \* Math\.pow\(w, 0\.75\)/, '자견 kcal 이 Klein 가정견 식이 아니다')
  assert.doesNotMatch(nu, /130 \* Math\.pow\(w, 0\.75\) \* 3\.2/, '사육장 기준 NRC 130 성장식으로 돌아갔다 — 가정견 자견 과대추정')
  assert.doesNotMatch(nu, /toyOverestimate\) der \*=/, '가정견 실측식에 토이 −15% 를 겹쳐 과소급여한다')
  // 고객 분석 화면에 그대로 나가는 근거 줄 — 전문용어·비율% 금지(브랜드 보이스)
  assert.doesNotMatch(nu, /label: `성장기[^`]*(%|NRC|정확식|간이 근사)/, '자견 근거 줄에 전문용어·%가 고객에게 나간다')
})

test('규칙144: 보호자에게 "다 자라면 몇 kg" 를 묻지 않는다 — 자견 성장은 성장곡선 추정 한 곳에서', () => {
  /**
   * # 왜 (2026-10-01 사장님 "이런 화면이 있는지도 몰랐어 … 보호자가 대체 어케 알아")
   * 앱 설문이 18개월 미만 자견 보호자에게 예상 성견 체중을 물었고(안내문은 '칼슘', 예시 '30kg',
   * 검증 없음), 그 답이 자견 칼로리 전체를 좌우했다(웨스티에 20kg 오입력 → 1,214kcal).
   * 지금은 FEDIAF 2025 성장곡선(lib/growth-curve.ts)으로 나이·체중에서 추정한다. 분석(nutrition)과
   * 처방(compute 의 대형견 자견 규칙)이 같은 추정을 봐야 한다.
   */
  const flow = stripComments(read(join(ROOT, 'lib', 'survey', 'flow.ts')))
  assert.doesNotMatch(flow, /key: 'adultWeight'|\| 'adultWeight'/, '설문에 "다 자라면 몇 kg" 화면이 돌아왔다')
  const sc = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'survey', 'SurveyClient.tsx')))
  assert.match(sc, /expectedAdultWeight: null,\s*ageWeeks: ageWeeksFromBirth\(/, '설문 분석이 보호자 답을 성견체중으로 쓰거나 생일 주령을 안 넘긴다')
  assert.match(sc, /expected_adult_weight_kg: null,/, '설문이 예상 성견체중을 다시 저장한다')
  assert.doesNotMatch(sc, /AdultWeightScreen/, '설문에 예상 성견체중 화면이 남아 있다')
  const nu = stripComments(read(join(ROOT, 'lib', 'nutrition.ts')))
  assert.match(nu, /estimateGrowth\(w0, ageWeeks\)/, '자견 칼로리가 성장곡선 추정을 쓰지 않는다')
  assert.doesNotMatch(nu, /if \(m < 4\) factor = 3\.0/, '월령 계단 폴백(×3.0/2.5/2.0 — 한 달에 −20% 절벽)으로 돌아갔다')
  const cr = stripComments(read(join(ROOT, 'app', 'api', 'personalization', 'compute', 'route.ts')))
  assert.match(cr, /expectedAdultWeightKg:\s*ageMonths < 24[\s\S]{0,120}estimateGrowth\(/, '처방의 대형견 자견 규칙이 분석과 다른 성견체중(보호자 답)을 본다')
})

test('규칙145: 분석 화면 화식 비율 카드의 "추천" 배지가 카드 글자를 덮지 않는다', () => {
  /**
   * # 왜 (2026-10-01 사장님 캡처 "UI 깨짐")
   * 배지가 top:-7px 로 7px 만 밖에 있고 나머지는 카드 안(위 여백 10px)에 들어가, 시니어용 글자
   * 키움 뒤 '곁들임'을 덮었다. 배지는 윗선 한가운데(translate -50%)에 걸치고, 카드 위 여백은
   * 배지 절반보다 넉넉해야 한다(12px 글자 배지 높이 ≈19px → 절반 ≈10px).
   */
  const css = stripComments(read(join(ROOT, 'components', 'analysis', 'recommendation.css')))
  const badge = css.match(/\.fb-tierc-badge \{([^}]*)\}/)?.[1] ?? ''
  assert.match(badge, /top: 0;/, '추천 배지가 카드 윗선에 걸치지 않는다')
  assert.match(badge, /transform: translate\(-50%, -50%\)/, '추천 배지가 윗선 한가운데에 걸치지 않는다 — 카드 안 글자를 덮는다')
  for (const sel of ['\\.fb-tierc', "\\.fb-tierc\\[data-sel='true'\\]"]) {
    const body = css.match(new RegExp(`${sel} \\{([^}]*)\\}`))?.[1] ?? ''
    const top = Number(body.match(/padding: (\d+)px/)?.[1] ?? 0)
    assert.ok(top >= 16, `${sel} 위 여백 ${top}px — 배지 절반(≈10px)+여유보다 작다`)
  }
  // 같은 날 두 번째 캡처: '완전 화 / 식' — 안드로이드 앱은 휴대폰 글자 크기 설정을 따라 커져
  // (어르신 다수) 좁은 칸에서 글자 중간이 끊겼다. 카드 전체를 단어 단위 줄바꿈으로.
  const totals = css.match(/\.fb-totals \{([^}]*)\}/)?.[1] ?? ''
  assert.match(totals, /word-break: keep-all;/, "화식 비율 카드 글자가 단어 중간에서 끊긴다('완전 화 / 식')")
})

test('규칙146: 체험단 도장을 찍으면 보호자에게 앱 알림이 가고, 누르면 분석 페이지 플랜 고르기로 간다', () => {
  /**
   * # 왜 (2026-10-01 사장님)
   * "체험단 도장 찍으면 알림 날라갈 수 있게 … 지금 바로 카드 등록" · "알림 들어가면 바로 분석페이지에
   * 플랜 선택하는 화면으로". 도장만 찍히고 고객이 모르면 카드를 등록하지 않아 첫 박스가 안 나간다.
   * 추천 박스는 페이지가 뜬 뒤 따로 불러와 해시(#)로는 못 내려간다 — ?focus=plan 을 카드가 직접 처리.
   */
  const route = stripComments(read(join(ROOT, 'app', 'api', 'admin', 'trials', 'route.ts')))
  assert.match(route, /recordAdminAction[\s\S]{0,400}notifyTrialStamp\(admin, body\.userId,/, '도장을 찍어도 고객에게 알림이 가지 않는다')
  assert.match(route, /push: \{ sent: push\.sent, label: trialPushLabel\(push\) \}/, '알림이 갔는지 관리자 화면이 모른다(못 가면 직접 연락해야 한다)')
  const notify = stripComments(read(join(ROOT, 'lib', 'payments', 'trial-notify.ts')))
  assert.match(notify, /`\/dogs\/\$\{analyzed\.id\}\/analysis\?focus=plan`/, '도장 알림이 분석 페이지 플랜 고르기로 가지 않는다')
  assert.match(notify, /\{ category: 'order' \}/, "도장 알림 분류가 'order'(서비스 안내)가 아니다 — marketing 이면 야간 차단·기본 거부로 거의 안 간다")
  const box = stripComments(read(join(ROOT, 'components', 'analysis', 'RecommendationBox.tsx')))
  assert.match(box, /get\('focus'\) !== PLAN_FOCUS_PARAM\) return\s*rootRef\.current\?\.scrollIntoView/, '?focus=plan 으로 들어와도 플랜 고르기 카드로 내려가지 않는다')
  assert.match(box, /const PLAN_FOCUS_PARAM = 'plan'/, '플랜 고르기 주소 값이 알림 링크(?focus=plan)와 다르다')
})

test('규칙147: 서포터즈 금액은 실제 결제 금액으로 — 어드민은 확실히 구분되고, 고객 화면은 기간·총액으로 말한다', () => {
  /**
   * # 왜 (2026-10-01 사장님)
   * 어드민 구독 목록 '회당 금액'이 서포터즈 고객도 정가(51,500원)로 떠서 실제 결제(100원)와 달랐다
   * ("확실하게 구분감 있게"). 고객 정기배송 화면은 서포터즈 카드가 결제 카드에 붙어 겹쳐 보였고
   * "4번 남았어요"처럼 회차로 말했다 — 사장님 원칙은 "56일치 밥이 총 400원"(기간·총액).
   */
  const admin = stripComments(read(join(ROOT, 'app', 'admin', 'subscriptions', 'page.tsx')))
  assert.match(admin, /const supporter = supporterViews\(subs, trials\)/, '어드민 구독 목록이 서포터즈 실제 결제 금액을 계산하지 않는다')
  assert.match(admin, /<AmountCell sub=\{sub\} supporter=\{supporter\} \/>/, '어드민 금액 칸이 서포터즈를 정가로 보인다')
  assert.match(admin, /\{ value: 'supporters', label: '서포터즈' \}/, '어드민에 서포터즈만 보는 탭이 없다')
  assert.match(admin, /서포터즈 정보를 불러오지 못했어요/, '서포터즈 조회 실패를 화면이 숨긴다(정가로 보이는데 알리지 않음)')
  const view = stripComments(read(join(ROOT, 'lib', 'payments', 'trial-display.ts')))
  assert.match(view, /trialPricing\(state, s\.total_amount\)/, '서포터즈 표시 금액이 청구와 같은 판정(trialPricing)이 아니다')
  const app = stripComments(read(join(ROOT, 'app', '(main)', 'mypage', 'subscriptions', 'page.tsx')))
  // 2026-10-09 앱 새 디자인: 그리기는 SubscriptionsSummaryView(판정은 페이지 그대로)로 옮겼다 — 문구는 거기서 본다.
  const appView = stripComments(read(join(ROOT, 'components', 'v3', 'subs', 'SubscriptionsSummaryView.tsx')))
  assert.doesNotMatch(app + appView, /번 남았어요/, '고객 정기배송 화면이 서포터즈 혜택을 회차로 말한다 — 기간·총액으로')
  assert.match(appView, /일치 밥이 총 \$\{/, '고객 정기배송 화면이 서포터즈 혜택을 기간·총액으로 말하지 않는다')
  // 10/1 B안(이 화면만 둥근 12)은 앱 전체 모서리 4px 통일(앱 새 디자인 'A 포스터' — 사장님 확정)로 대체됐다.
  assert.doesNotMatch(appView, /V3Radius\.md/, '정기배송 화면 카드가 새 디자인 모서리(4px)가 아니다 — 앱 전체 통일')
})

test('규칙148: 처방 근거에 연어는 절대 안 나오고, 알레르기 레시피는 대체 대상도·문구도 아니다 — 저장 직전 최종 정리', () => {
  /**
   * # 왜 (2026-10-01 사장님 "연어라는 멘트 나오면 안 되는 거 알지? 아예 전부 안 나오게" · "오리 알러지인데 왜 오리가")
   * 오리 알레르기견 펀치 분석 화면 근거에 '연어 → 오리'·'연어 비슷한 단백질 주의'·'위장 민감 · 오리 위주'가 떴다.
   * 판매 안 하는 연어 몫을 알레르기를 안 보고 오리로 옮겼고(대체 단계), 위장 민감 룰은 기본 중심을 막힌 오리로
   * 잡았다. 재제안은 옛 대응표(오리→치킨)로 '잘 먹는 치킨'을 냈다. 실행 스윕은 reasonCopy.test.ts.
   */
  const route = stripComments(read(join(ROOT, 'app', 'api', 'personalization', 'compute', 'route.ts')))
  assert.match(route, /gateAvailability\(formula\.lineRatios[\s\S]{0,260}blockedLines: allergyBlockedLines/, '처방 저장 경로의 대체 단계가 알레르기 레시피로 옮길 수 있다')
  assert.match(route, /formula\.reasoning = finalizeReasoning\(formula\.reasoning, formula\.lineRatios, \{ blockedLines: allergyBlockedLines \}\)/, '첫 박스 접기 뒤 근거 최종 정리(연어·막힌 레시피·박스에 없는 약속)가 없다')
  const first = stripComments(read(join(ROOT, 'lib', 'personalization', 'firstBox.ts')))
  // avoid = 알레르기(blocked) + 질환으로 뺀 레시피(규칙152 가 정의를 잠근다) — 알레르기를 포함한다.
  assert.match(first, /blockedLines: (blocked|avoid),/, 'firstBox 대체 단계에 알레르기 차단 목록이 없다')
  assert.match(first, /const avoid = new Set<FoodLine>\(\[\.\.\.blocked,/, 'firstBox 대체 단계의 차단 목록이 알레르기를 포함하지 않는다')
  const next = stripComments(read(join(ROOT, 'lib', 'personalization', 'nextBox.ts')))
  assert.match(next, /return PROTEIN_TO_LINE\[protein\] \?\? null/, '재제안이 정본 단백질↔레시피 대응표를 쓰지 않는다(옛 표: 오리→치킨)')
  assert.match(next, /finalizeReasoning\(reasoning, gated\.lineRatios, \{ blockedLines: blocked \}\)/, '재제안 근거 최종 정리가 없다')
  const gate = stripComments(read(join(ROOT, 'lib', 'personalization', 'skuMap.ts')))
  assert.doesNotMatch(gate, /연어 레시피는 준비 중이라/, "대체 단계가 임상 칩에 '연어 레시피는 준비 중' 을 덧붙인다")
  const fin = stripComments(read(join(ROOT, 'lib', 'personalization', 'reasoning-final.ts')))
  assert.match(fin, /UNSOLD_RECIPE_WORDS: readonly string\[\] = \['연어'\]/, '판매하지 않는 레시피 목록에서 연어가 빠졌다')
})

test('규칙149: 앱 첫 화면은 한 번처럼 — 웹 로딩 화면이 폰 화면과 같은 바탕·같은 도장·같은 자리로 이어지고 폰 화면을 웹이 걷는다', () => {
  /**
   * # 왜 (2026-10-01 사장님 "앱 처음 들어가면 이렇게 뜨는 거 굳이 두 번 떠야 하냐 … 위아래 색이 배경색이랑 다른 누런색")
   * 네이티브 스플래시(크림 #F5F0E6·큰 로고)가 걷히면 웹 로딩 화면(var(--bg)·210px 로고·커지며 등장)이 다른 화면처럼
   * 한 번 더 떴고, 상태바(네이티브 크림)만 누렇게 띠로 남았다. 배경색은 capacitor.config 와 같은 값이어야 하고,
   * 로고는 네이티브 이미지 실측(폭 = 화면 높이의 36.5%)대로, 등장 모션 없이 이어받는다.
   */
  const cap = read(join(ROOT, 'capacitor.config.ts'))
  const splashBg = cap.match(/SplashScreen:\s*\{[\s\S]*?backgroundColor:\s*'(#[0-9A-Fa-f]{6})'/)?.[1]
  const statusBg = cap.match(/StatusBar:\s*\{[\s\S]*?backgroundColor:\s*'(#[0-9A-Fa-f]{6})'/)?.[1]
  assert.ok(splashBg && statusBg, 'capacitor.config 에서 스플래시·상태바 배경색을 못 찾았다')
  const css = stripComments(read(join(ROOT, 'app', 'globals.css')))
  const block = css.match(/\.ft-splash \{([^}]*)\}/)?.[1] ?? ''
  assert.ok(block.toUpperCase().includes(`BACKGROUND: ${splashBg!.toUpperCase()}`), `웹 로딩 화면 배경이 네이티브 스플래시(${splashBg})와 다르다 — 두 번 뜨는 것처럼 보인다`)
  assert.equal(splashBg!.toUpperCase(), statusBg!.toUpperCase(), '상태바 배경이 스플래시와 달라 위에 띠가 생긴다')
  assert.doesNotMatch(css, /ft-splash-logo/, '로고 등장 모션이 돌아왔다 — 네이티브가 걷힐 때 로고가 다시 등장한다')

  /**
   * ★2026-10-08 (사장님 "앱 들어가면 로딩이 두 번 뜨는데 왜 그래") — 위 맞춤은 iOS·옛 안드로이드(글자 로고 풀스크린)
   * 기준이었다. 안드로이드 12+ 는 OS 가 **앱 아이콘(도장)** 을 띄우므로 웹(글자 로고)과 그림이 달랐고, 두 화면이
   * 각자 타이머(1.5초·1.8초)로 걷혔다(에뮬레이터 녹화로 확인). 이제 셋 다 같은 도장이고 웹이 폰 화면을 걷는다.
   */
  // ① 같은 도장·같은 크기: 웹 그림 칸 132(도장 126) = 안드로이드 레이어 목록 132dp = 안드로이드 12+ 아이콘
  //    (앱 아이콘 앞면을 쓴 적응형, 여백 22% — 에뮬레이터 녹화로 폰 도장 118px · 웹 117px 실측).
  //    비트맵에 dp 여백을 준 그림은 시스템이 108dp 칸에 놓고 키워 도장이 점처럼 작아졌고, 앱 아이콘 여백(16.7%)
  //    그대로는 1.19배 컸다(2026-10-08 실측). 여백을 바꾸면 녹화로 다시 재고 여기 숫자도 고칠 것.
  const splashSrc = read(join(ROOT, 'components', 'AppSplash.tsx'))
  const box = Number(splashSrc.match(/export const SPLASH_STAMP_BOX = (\d+)/)?.[1])
  assert.equal(box, 132, '웹 도장 칸이 132가 아니다 — 안드로이드 12+ 아이콘 도장(실측 지름 126dp)과 크기가 어긋난다')
  const res = join(ROOT, 'android', 'app', 'src', 'main', 'res')
  const layer = read(join(res, 'drawable', 'splash.xml'))
  assert.match(layer, new RegExp(`android:width="${box}dp"[\\s\\S]*android:height="${box}dp"[\\s\\S]*android:gravity="center"`), '옛 방식 폰 화면(drawable/splash)의 도장 크기가 웹과 다르다')
  const launcherFg = read(join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml')).match(/<foreground>\s*<inset android:drawable="([^"]+)" android:inset="([^"]+)"/)
  const splashIcon = read(join(res, 'drawable-v26', 'splash_icon.xml'))
  assert.ok(launcherFg && splashIcon.includes('<adaptive-icon') && splashIcon.includes(`<inset android:drawable="${launcherFg[1]}" android:inset="22%"`), '안드로이드 12+ 스플래시 아이콘이 앱 아이콘 앞면·여백 22% 의 적응형이 아니다 — 폰 화면 도장 크기가 웹(126dp)과 어긋난다')
  assert.match(splashIcon, /<background android:drawable="@color\/ft_splash_bg"/, '스플래시 아이콘 뒷면이 스플래시 바탕색이 아니다 — 바탕 위에 옅은 원이 비친다')
  assert.match(splashSrc, /requestVideoFrameCallback/, '꼬리 영상을 실제 장면이 그려지기 전에 보이게 한다 — 안드로이드 웹뷰에서 빈 영상 칸이 도장을 가린다')
  const pngLeft = readdirSync(res).filter((d) => d.startsWith('drawable') && existsSync(join(res, d, 'splash.png')))
  assert.deepEqual(pngLeft, [], `splash.png 가 다시 생겼다(${pngLeft.join(', ')}) — drawable/splash.xml(도장)을 가리고 글자 로고가 뜬다(npm run cap:assets 뒤 지울 것)`)
  // ② 같은 바탕 = 앱 종이색(--paper). 사장님 10/8 "저 크림색 배경이 맞아? 우리 앱 기본 배경색이랑 다른데" —
  //    크림(#F5F0E6)은 앱 바탕(#F7F5F0)보다 누래서 로딩이 걷힐 때 색이 바뀌고 상태바가 띠로 남았다.
  const paper = css.match(/\[data-ft-chrome="app"\] \{[\s\S]*?--paper:\s*(#[0-9A-Fa-f]{6})/)?.[1]
  assert.equal(splashBg!.toUpperCase(), paper?.toUpperCase(), `폰 화면·로딩 바탕(${splashBg})이 앱 종이색(${paper})과 다르다 — 로딩이 걷힐 때 바탕색이 바뀐다`)
  assert.equal(splashSrc.match(/export const APP_PAPER = '(#[0-9A-Fa-f]{6})'/)?.[1]?.toUpperCase(), splashBg!.toUpperCase(), 'AppSplash 의 APP_PAPER(안드로이드 상태바를 바로 칠하는 색)가 스플래시 색과 다르다')
  // 옛 아이폰 셸(네이티브가 아직 크림) 보호 — head 스크립트가 붙이는 이름과 CSS 가 같은 이름이어야 탭바가 홈바 색을 따라간다.
  const layoutSrc = read(join(ROOT, 'app', 'layout.tsx'))
  assert.ok(layoutSrc.includes("h.classList.add('ft-old-shell-ios')") && css.includes('html.ft-old-shell-ios [data-ft-chrome="app"]'), '옛 아이폰 셸 표시(ft-old-shell-ios)가 head 스크립트와 CSS 에서 어긋났다')
  // 안드로이드 색 자원 · 매니페스트 · iOS 런치 화면 · 웹 모두 스플래시 색.
  const colorXml = read(join(res, 'values', 'ft_splash.xml'))
  assert.ok(colorXml.toUpperCase().includes(`>${splashBg!.toUpperCase()}<`), '안드로이드 폰 화면 바탕색이 스플래시 색과 다르다')
  const styles = read(join(res, 'values', 'styles.xml'))
  assert.match(styles, /windowSplashScreenBackground">@color\/ft_splash_bg</, '안드로이드 12+ 폰 화면 바탕이 색 자원을 안 쓴다')
  assert.match(styles, /windowSplashScreenAnimatedIcon">@drawable\/splash_icon</, '안드로이드 12+ 폰 화면 아이콘이 도장(splash_icon)이 아니다')
  const manifest = JSON.parse(read(join(ROOT, 'public', 'manifest.json'))) as { background_color?: string }
  assert.equal(manifest.background_color?.toUpperCase(), splashBg!.toUpperCase(), '설치형 PWA 시작 화면 바탕이 스플래시 색과 다르다')
  const story = read(join(ROOT, 'ios', 'App', 'App', 'Base.lproj', 'LaunchScreen.storyboard'))
  const rgb = story.match(/<color key="backgroundColor" red="([\d.]+)" green="([\d.]+)" blue="([\d.]+)"/)
  assert.ok(rgb, 'iOS 런치 화면 바탕색을 못 찾았다')
  const iosHex = '#' + [rgb![1], rgb![2], rgb![3]].map((v) => Math.round(Number(v) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
  assert.equal(iosHex, splashBg!.toUpperCase(), 'iOS 런치 화면 바탕색이 스플래시 색과 다르다')
  // ③ 한 번만: 폰 화면은 웹이 걷고(타이머는 안전망), 걷힐 때 0.3~0.8초 페이드 — 안드로이드 12+ 는 그동안 바탕만 흐려지고
  //    도장은 남아 있다가 끝에 사라져, 웹뷰가 첫 장면을 그리기까지의 빈 틈(실측 ~0.6초)을 덮는다. 0 이면 시스템
  //    기본 페이드로 도장까지 흐려져 빈 화면이 비쳤다(에뮬레이터 녹화 실측).
  const sp = cap.match(/SplashScreen:\s*\{([\s\S]*?)\n {4}\},/)?.[1] ?? ''
  const fadeMs = Number(sp.match(/launchFadeOutDuration: (\d+)/)?.[1])
  assert.ok(fadeMs >= 300 && fadeMs <= 800, `폰 화면 페이드(${fadeMs}ms)가 0.3~0.8초 밖이다 — 짧으면 빈 화면이 비치고 길면 도장 두 개가 겹친다`)
  assert.match(styles, /parent="Theme\.SplashScreen\.IconBackground"/, '폰 화면 테마가 IconBackground 가 아니다 — 아이콘 뒷면 색이 안 넘어가 도장 크기 규칙이 달라진다')
  assert.match(styles, /windowSplashScreenIconBackgroundColor">@color\/ft_splash_bg</, '폰 화면 아이콘 뒷면 색이 스플래시 색이 아니다')
  const showMs = Number(sp.match(/launchShowDuration: (\d+)/)?.[1])
  assert.ok(showMs >= 3000, `폰 화면 타이머(${showMs}ms)가 짧다 — 웹이 걷기 전에 먼저 걷혀 사이에 빈 화면이 낀다`)
  assert.match(splashSrc, /call\('SplashScreen','hide',ios\?\{fadeOutDuration:0\}:\{\}\)/, '웹 로딩 화면이 폰 화면을 걷지 않거나, 아이폰에서 겹쳐 사라지는 효과가 켜졌다 — 옛 글자 로고와 도장이 겹쳐 보인다')
  // ⑤ 아이폰(사장님 10/8 아이폰 화면): 앱이 다시 띄우는 폰 화면은 웹뷰 맨 위에 화면 크기로 붙어 중심이 웹뷰 기준 화면높이/2 —
  //    상태바를 빼면 그만큼 어긋난다. 옛 아이폰 앱은 런치 화면이 크림 바탕이라 로딩 바탕도 크림으로 잇는다.
  //    ★2026-10-10 그림은 옛 아이폰 앱도 꼬리 흔드는 도장(사장님 "로딩도 도장 꼬리 흔드는 걸로") — 예전엔 런치 화면의
  //    글자 로고를 그대로 이어 보여서, 옛 앱을 쓰는 사장님 폰엔 새 로딩이 안 보였다.
  assert.match(splashSrc, /if\(ios\)\{place\(0\)/, '아이폰 도장 자리에서 상태바를 뺀다 — 폰 화면(웹뷰 기준 화면높이/2)과 어긋난다')
  assert.match(css, /html\.ft-old-shell-ios \.ft-splash \{\s*background: #F5F0E6;/, '옛 아이폰 앱 로딩 바탕이 그 앱 폰 화면(크림)과 다르다')
  assert.match(splashSrc, /var pic=el\.querySelector\('\.ft-splash__still'\)/, '로딩 그림을 셸에 따라 다른 것(글자 로고 등)으로 고른다 — 모든 앱이 도장이어야 한다')
  assert.doesNotMatch(splashSrc, /ft-splash__mark/, '옛 아이폰 앱 로딩에 글자 로고가 남아 있다 — 꼬리 흔드는 도장으로 바꿨다')
  assert.doesNotMatch(css, /\.ft-splash__stamp \{\s*display: none/, '어떤 셸에서 로딩 도장을 숨긴다')
  assert.doesNotMatch(splashSrc, /var calm=oldIos/, '옛 아이폰 앱에서 꼬리 영상을 끈다')
  assert.match(splashSrc, /call\('StatusBar','getInfo'\)/, '도장 자리를 상태바 높이로 맞추지 않는다 — 폰 화면 도장과 어긋나 튄다')
  // ④ 절대 안 남는다: JS 가 죽어도 CSS 가 걷는다.
  assert.match(css, /html\.ft-standalone \.ft-splash \{[^}]*animation: ft-splash-fallback 0\.45s ease [1-8]s forwards/, '웹 로딩 화면의 비상 걷힘(CSS)이 없다 — 스크립트가 실패하면 화면이 안 걷힌다')
})

test('규칙150: 자견은 매달 자동으로 다시 계산되고 알림은 한 달에 한 번 — 자동 갱신은 설문으로 세지 않고, 고객이 그 표식을 못 쓴다', () => {
  /**
   * # 왜 (2026-10-01 사장님 "자동으로 한 달씩 지나면서 계산해 … 무게가 얼마나 달라졌는지 귀찮지 않게 한 달에 한 번 정도만")
   * 자견 칼로리는 설문한 날의 체중·나이에 고정돼, 4개월에 설문한 강아지가 10개월이 돼도 4개월 몫을 먹었다.
   * dog-age-update 크론이 30일마다 다시 계산해 분석 행(source growth_auto)을 넣고 알림을 한 번 보낸다.
   *  · 자동 갱신 행은 '설문'이 아니다 — 재설문 월 3회 한도·직전 설문 비교·리포트·퍼널·어드민 설문 카드는 설문만 센다.
   *  · 같은 달 체중 알림이 겹치지 않게 체중 측정 리마인더·체중 변화 알림은 성장기 강아지를 뺀다.
   *  · 추정 체중 행의 mer 은 등록 체중보다 큰 체중 기준이라 처방 타당성 검사는 그 행의 체중을 쓴다 — 그 칸을
   *    고객이 쓰면 검사가 비켜서므로(규칙2) DB 트리거가 고객 역할의 쓰기를 되돌린다.
   */
  const cron = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'dog-age-update', 'route.ts')))
  assert.match(cron, /await runMonthlyGrowth\(/, '나이 갱신 크론이 자견 월간 재계산을 부르지 않는다')
  const monthly = stripComments(read(join(ROOT, 'lib', 'growth', 'monthly.ts')))
  assert.match(monthly, /export const GROWTH_RECOMPUTE_DAYS = 30\b/, '자견 재계산 주기가 한 달(30일)이 아니다')
  assert.match(monthly, /source: 'growth_auto',/, '자동 갱신 분석 행에 표식(source growth_auto)이 없다 — 설문과 구분이 안 된다')
  assert.doesNotMatch(monthly, /%|언제든/, '월간 성장 알림 문구에 비율%·"언제든"이 들어갔다(브랜드 보이스)')
  const run = stripComments(read(join(ROOT, 'lib', 'growth', 'run.ts')))
  assert.match(run, /if \(insErr\) \{[\s\S]{0,260}continue[\s\S]{0,200}pushToUser\(/, '분석 행 저장이 실패해도 알림이 나간다 — 다음 날 또 보내게 된다(행이 "이번 달 처리함" 표식)')
  assert.match(run, /\{ category: 'health' \}/, '월간 성장 알림이 건강 알림 설정·조용 시간을 따르지 않는다')

  const surveyPage = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'survey', 'page.tsx')))
  assert.equal((surveyPage.match(/\.eq\('source', 'survey'\)/g) ?? []).length, 2, '재설문 화면이 자동 갱신을 설문으로 센다(월 3회 한도·직전 설문 비교)')
  for (const p of [
    ['app', '(main)', 'reports', 'page.tsx'],
    ['app', 'admin', 'surveys', '_data.ts'],
    ['app', 'admin', 'funnel', 'page.tsx'],
    ['app', '(main)', 'dogs', '[id]', 'year-in-review', 'page.tsx'],
  ]) {
    assert.match(stripComments(read(join(ROOT, ...p))), /\.eq\('source', 'survey'\)/, `${p.join('/')} 가 자견 자동 갱신을 설문 분석으로 센다`)
  }
  const history = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'analyses', 'page.tsx')))
  assert.match(history, /a\.source === 'growth_auto'/, '분석 이력에서 자동 갱신 기록이 설문 결과와 구분되지 않는다')

  const detect = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'weight-change-detect', 'route.ts')))
  assert.match(detect, /if \(isGrowing\) \{\s*skippedGrowing \+= 1\s*continue/, '체중 변화 알림이 성장기 강아지에게도 간다 — 월간 성장 알림과 겹친다')
  const reminder = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'weight-reminder', 'route.ts')))
  assert.match(reminder, /stageFromKR\(latestStage\.get\(t\.id\) \?\? null\) !== 'puppy'/, '체중 측정 리마인더가 성장기 강아지에게도 간다 — 월간 성장 알림과 겹친다')

  const compute = stripComments(read(join(ROOT, 'app', 'api', 'personalization', 'compute', 'route.ts')))
  assert.equal((compute.match(/isPlausibleMer\(analysis\.mer, plausibilityWeightKg\(dog\.weight, analysis\)\)/g) ?? []).length, 2, '처방 타당성 검사가 자동 갱신 행의 (추정) 체중을 안 본다 — 체중을 몇 달 안 잰 자견의 플랜 화면이 막힌다')
  const sanity = stripComments(read(join(ROOT, 'lib', 'personalization', 'merSanity.ts')))
  assert.match(sanity, /if \(analysis\?\.source !== 'growth_auto'\) return dogW/, '등록 체중이 아닌 체중을 자동 갱신 행 밖에서도 믿는다')
  const lock = read(join(ROOT, 'supabase', 'migrations', '20261001180000_analyses_lock_server_columns.sql'))
  const lockSql = lock.replace(/--.*$/gm, '')
  assert.match(lockSql, /if current_user in \('authenticated', 'anon'\) then/, '고객 역할의 source·weight_kg 쓰기를 되돌리는 트리거가 없다 — 타당성 검사가 고객 값으로 비켜선다')
  assert.match(lockSql, /before insert or update on public\.analyses/, '잠금 트리거가 INSERT·UPDATE 둘 다를 덮지 않는다')
  assert.doesNotMatch(lockSql, /security definer/i, '잠금 트리거가 DEFINER 면 current_user 가 소유자라 잠금이 풀린다')
})

test('규칙151: 어드민은 구독 상태를 정본 판정으로 보여주고, 출시 보류 레시피(연어)는 실제로 쓰일 때만 경고한다', () => {
  /**
   * # 왜 (2026-10-01 사장님 "얘는 근데 왜 다음 배송일자가 안 떠" · "여기에 연어 오류 화면 계속 뜬다")
   * 플랜만 고르고 카드 등록을 안 끝낸 서포터즈(피카) 구독이 어드민에 초록 '구독 중'으로 떠서 배송일이 빈 이유가
   * 안 보였다 — 배송일은 카드 등록 때 잡힌다. status 칸만 보면 카드 축을 놓친다(lib/subscription-state).
   * 박스 패킹 화면은 판매 보류인 연어(skuModel deferred)를 매주 '상품 등록이 빠진 레시피'로 빨갛게 띄워 진짜 경고를 묻었다.
   */
  const subs = stripComments(read(join(ROOT, 'app', 'admin', 'subscriptions', 'page.tsx')))
  assert.match(subs, /const STATUS_BADGE: Record<SubState,/, '어드민 상태 배지가 정본 상태(SubState)가 아니라 status 칸 기준이다')
  assert.match(subs, /needs_card: \{ label: '카드 등록 전'/, "카드 미등록 구독이 '카드 등록 전'으로 구분되지 않는다")
  assert.match(subs, /return subscriptionState\(\{/, '어드민이 상태를 정본 판정(subscriptionState)으로 내지 않는다')
  assert.doesNotMatch(subs, /<StatusBadge status=/, '상태 배지가 아직 status 칸만 받는 곳이 있다')
  assert.match(subs, /failed_charge_count, ' \+/, '상태 판정에 필요한 청구 실패 횟수를 조회하지 않는다')
  assert.match(subs, /sub\.status === 'active' && stateOf\(sub\) !== 'needs_card' && \(/, '카드 등록 전 구독에 일시정지 버튼이 나온다(유령 일시정지)')
  const pick = stripComments(read(join(ROOT, 'app', 'admin', 'personalization', 'picking-list', 'page.tsx')))
  assert.match(pick, /!productsAll\[sl\] && \(!deferredSlugs\.has\(sl\) \|\| usedLineSlugs\.has\(sl\)\)/, '패킹 화면이 출시 보류 레시피를 매주 경고하거나, 보류라고 실제 쓰는 박스까지 경고에서 뺀다')
  assert.match(pick, /\.filter\(\(s\) => s\.deferred\)/, '보류 레시피 목록이 skuModel(deferred) 정본에서 나오지 않는다')
})

test('규칙152: 처방 근거는 최종 박스에 있는 레시피만 말하고, 질환으로 뺀 레시피는 뒤 룰이 다시 넣지 못한다', () => {
  /**
   * # 왜 (2026-10-01 사장님 "'베이스: 치킨' 칩도 지워. 앞으로도 이런 헷갈리는 일 없게")
   * 피카(오리 100% 박스) 근거에 '맞춤 베이스 · 베이스 레시피: 치킨'이 떴다 — 임상 룰이 여러 레시피 비율을 옮기며 남긴
   * 설명이 첫 박스를 한 가지로 접은 뒤에도 남았다(조합 9,261개 중 64종). 같은 스윕에서 신장 3단계·간·요로결석 노견이
   * 마른 체형이면 '한우는 뺐어요' 뒤에 체형 룰이 한우를 다시 올려 박스가 한우 100% 가 되는 처방 버그가 나왔다.
   * 실행 스윕·피카 재현은 lib/personalization/reasonCopy.test.ts '근거 칩 ↔ 최종 박스'.
   */
  const fin = stripComments(read(join(ROOT, 'lib', 'personalization', 'reasoning-final.ts')))
  assert.match(fin, /return namedSoldLines\(c\)\.every\(\(l\) => inBox\.has\(l\) \|\| excluded\.has\(l\)\)/, '최종 근거가 박스에 없는 레시피 이름을 거르지 않는다')
  assert.match(fin, /for \(const l of excluded\) if \(inBox\.has\(l\)\) return false/, "'뺐다'는 레시피가 박스에 들어가 있어도 근거가 남는다")
  assert.match(fin, /if \(r\.withoutRecipe\) \{/, '레시피 문장이 빠질 때 안전 안내만 남기는 경로가 없다')
  const first = stripComments(read(join(ROOT, 'lib', 'personalization', 'firstBox.ts')))
  assert.match(first, /const avoid = new Set<FoodLine>\(\[\.\.\.blocked, \.\.\.clinicallyExcludedLines\(input\)\]\)/, '첫 박스가 질환으로 뺀 레시피를 막지 않는다')
  for (const re of [/applyGiSensitivity\(lineRatios, input, reasoning, avoid\)/, /quantizeAndNormalize\(lineRatios, avoid\)/, /blockedLines: avoid,/, /pickPreferredFirstBoxLine\(\s*gated\.lineRatios,\s*avoid,/]) {
    assert.match(first, re, `첫 박스 마지막 단계(${re.source.slice(0, 40)})가 질환으로 뺀 레시피를 다시 쓸 수 있다`)
  }
  for (const id of ['chronic-diabetes', 'chronic-cardiac', 'bcs-refeeding-risk', 'chronic-epi', 'chronic-hypothyroid', 'chronic-cushings', 'chronic-musculoskeletal', 'chronic-long-term-steroid', 'age-puppy-large-breed']) {
    assert.match(first, new RegExp(String.raw`ruleId: '${id}',[\s\S]{0,120}withoutRecipe:`), `${id} 의 안전 안내가 레시피 문장과 함께 사라질 수 있다`)
  }
  const next = stripComments(read(join(ROOT, 'lib', 'personalization', 'nextBox.ts')))
  assert.match(next, /\.\.\.clinicallyExcludedLines\(surveyInput\),/, '재제안이 질환으로 뺀 레시피를 막지 않는다')
  const clin = stripComments(read(join(ROOT, 'lib', 'personalization', 'clinical-exclusions.ts')))
  assert.match(clin, /if \(stage === 4\) \{\s*out\.add\('premium'\)\s*out\.add\('weight'\)/, '신장 4단계 제외 목록이 질환 룰과 다르다')
  assert.match(clin, /else if \(stage !== 1 && stage !== 2\) \{\s*out\.add\('premium'\)/, '신장 1·2단계(단백질 정상)를 빼거나 3단계·미진단을 놓친다')
})

test('규칙153: 토·일 조리 → 화 발송 — 결제일은 구독마다(일반 = 토요일 조리 직전, 서포터즈 체험 구간 = 발송일)', () => {
  /**
   * # 왜 (2026-10-01 사장님 "상식적으로 하루 만에 다 만들고 발송하는 게 말이 안 돼")
   * 예전엔 화요일 하루에 결제·조리·포장·발송을 다 했다(next_delivery_date = 결제일 = 발송일). 이제 토·일 조리 →
   * 월 포장 → 화 발송이고, 결제는 조리 직전 토요일 아침(사장님 선택). 서포터즈는 100원·반값 구간 동안 원래 약속한
   * 화요일 결제를 지키고, 정상가부터 토요일로 넘어간다 — 그 전까지 서포터즈에게 알리지 않는다(사장님).
   * next_delivery_date 는 계속 **발송일**이다. 결제일은 lib/shipping-schedule chargeDateFor 한 곳에서만 나온다.
   */
  const sched = stripComments(read(join(ROOT, 'lib', 'shipping-schedule.ts')))
  assert.match(sched, /const LEAD_DAYS = 4\b/, '첫 박스 마감이 금요일 밤(LEAD 4)이 아니다 — 토요일 조리 전에 박스가 확정돼야 한다')
  assert.match(sched, /export const CHARGE_BEFORE_SHIP_DAYS = 3\b/, '조리 직전 결제가 발송 3일 전 토요일이 아니다')
  assert.match(sched, /trial\.cheap_remaining > 0 \|\| trial\.half_remaining > 0\) \? 'ship_day' : 'before_cooking'/, '서포터즈 체험 구간 판정(발송일 결제)이 정본에서 빠졌다')
  // 공통 주간 리듬엔 '결제'를 적지 않는다 — 서포터즈(화요일 결제) 화면에서 거짓이 된다.
  const week = sched.match(/export const SHIP_WEEK: ShipDay\[\] = \[([\s\S]*?)\]/)?.[1] ?? ''
  assert.ok(week.length > 0, 'SHIP_WEEK 를 못 찾았다')
  assert.doesNotMatch(week, /결제/, '공통 주간 리듬에 결제 시점을 적었다 — 결제일은 고객마다 다르다(chargeDateFor)')
  assert.match(week, /\{ dow: 6, ko: '토', what: '조리' \}/, '주간 리듬에 토요일 조리가 없다')

  const cron = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')))
  assert.match(cron, /\.lte\('next_delivery_date', addDaysKst\(today, CHARGE_BEFORE_SHIP_DAYS\)\)/, '청구 크론이 사흘 앞 발송분(토요일 결제)을 읽지 않는다')
  assert.match(cron, /chargeDateFor\(x\.next_delivery_date, timingOf\(x\)\)/, '청구 크론이 구독별 결제일로 거르지 않는다')
  assert.match(cron, /if \(due > today\) \{\s*notDue\+\+/, '결제일이 아직인 구독(서포터즈 화요일분)을 토요일에 긁는다')
  assert.match(cron, /nextDeliveryDate\(sub\.next_delivery_date, today, timingOf\(sub\)\)/, '늦은 성공 판정이 결제 시점(조리 직전 = 일요일 마감)을 안 본다')
  assert.match(cron, /chargeDateFor\(nextShip, nextPhase === 'full' \? 'before_cooking' : 'ship_day'\)/, '서포터즈 정상가 전환 안내가 바뀌는 결제일(토요일)을 알리지 않는다')

  const block = stripComments(read(join(ROOT, 'lib', 'admin', 'ship-block.ts')))
  assert.match(block, /export function chargeRunPassed\(chargeDate: string, now: Date\)/, '발송 금지 판정의 청구 시각 기준이 결제일이 아니다')
  const pick = stripComments(read(join(ROOT, 'app', 'admin', 'personalization', 'picking-list', 'page.tsx')))
  assert.match(pick, /chargeRunPassed\(chargeDateFor\(shipDate, timingOf\(sub\.user_id\)\), nowForCharge\)/, '피킹 리스트가 구독별 결제일로 "청구 시각 지남·미청구" 를 판정하지 않는다 — 토요일 미결제 박스가 조리된다')
  assert.doesNotMatch(pick, /오늘 아침 청구 완료/, '토요일 결제분을 화요일에 "오늘 아침 청구 완료"라고 말한다')

  const dogSub = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'subscription', 'DogSubscriptionClient.tsx')))
  assert.match(dogSub, /const chargeIso = nextShip && timing \? chargeDateFor\(nextShip, timing\) : null/, '정기배송 화면이 발송일을 결제일로 보여준다(결제 시점을 모르면 결제일을 말하지 않는다)')
})

test('규칙154: 결제된 박스는 그대로 나간다 — 발송일은 결제 시각 기준 정본 하나, 결제 뒤 미루기·정지에도 이번 박스를 늦게 말하지 않는다', () => {
  /**
   * # 왜 (2026-10-02)
   * 사장님 "결제 후 해지 = 그대로 발송, 자동 환불 없음". 토요일에 결제된 뒤 고객이 '2주 미루기'를 누르면
   * next_delivery_date 가 +14 더 밀리는데, 화면은 이번 박스 발송일을 next − 14 로 세서 **이미 결제돼 사흘 뒤
   * 나갈 박스를 2주 늦게 나간다고** 말했다. 어드민 3곳은 결제일 기준으로 따로 계산했다(같은 함수 복사 3벌).
   * → lib/shipping-schedule paidBoxShipIso 하나로 모으고, 결제된 박스 주문의 paid_at 을 모든 화면이 넘긴다.
   */
  const sched = stripComments(read(join(ROOT, 'lib', 'shipping-schedule.ts')))
  assert.match(sched, /export function paidBoxShipIso\(nextDeliveryDate: string \| null, paidAtIso: string\): string/, '결제된 박스 발송일 정본이 없다')
  assert.match(sched, /bumped >= firstShip && bumped <= addDaysKst\(firstShip, 7\)/, '정본이 결제일 기준 첫 화요일 범위로 next − 14 를 검증하지 않는다 — 결제 뒤 미루기에 2주 늦게 말한다')
  assert.match(sched, /i\.paidAt \? paidBoxShipIso\(i\.nextDeliveryDate, i\.paidAt\)/, '화면용 박스 판정이 결제 시각을 받아도 쓰지 않는다')

  // 결제된 박스가 있는 화면은 전부 결제 시각을 넘긴다(어드민 제외 — 어드민은 정본을 직접 부른다).
  const callers: Array<[string[], RegExp]> = [
    [['app', '(main)', 'dashboard', 'page.tsx'], /paidAt: paidPreparing \? \(paidPreparing\.paid_at \?\? paidPreparing\.created_at\) : null/],
    [['app', '(main)', 'dashboard', 'page.tsx'], /paidBoxShipIso\(sub\?\.next_delivery_date \?\? null, o\.paid_at \?\? o\.created_at\)/],
    [['app', '(main)', 'dogs', '[id]', '_components', 'SubscriptionCard.tsx'], /paidAt: hints\.paid_preparing_at \?\? null/],
    [['app', '(main)', 'dogs', '[id]', 'page.tsx'], /paid_preparing_at: paidPreparing\.get\(s\.id\) \?\? null/],
    [['app', '(main)', 'dogs', '[id]', 'subscription', 'DogSubscriptionClient.tsx'], /paidBoxShipIso\(nextShip, paidAt\)/],
    [['app', 'account', 'subscriptions', 'SubscriptionsWebClient.tsx'], /paidAt: paidPreparingAt\[sub\.id\] \?\? null/],
    [['app', 'account', 'subscriptions', 'SubscriptionsWebClient.tsx'], /paidAt: paidPreparingAt\[s\.id\] \?\? null/],
  ]
  for (const [parts, re] of callers) {
    assert.match(stripComments(read(join(ROOT, ...parts))), re, `${parts.join('/')} 가 결제된 박스 발송일을 결제 시각 없이 센다`)
  }
  // 새 화면이 결제된 박스를 판정하면서 paidAt 을 빠뜨리지 않게 — 어드민 밖 describeUpcomingBox 호출 전수.
  const appFiles = walk(join(ROOT, 'app')).filter((f) => /\.tsx?$/.test(f) && !f.includes(`${sep}admin${sep}`) && !f.includes(`${sep}api${sep}`))
  let seen = 0
  for (const f of appFiles) {
    const src = stripComments(read(f))
    for (const m of src.matchAll(/describeUpcomingBox\(\{([\s\S]*?)\}\)/g)) {
      seen++
      const body = m[1] ?? ''
      if (/hasPaidPreparingOrder:/.test(body) && !/hasPaidPreparingOrder: false/.test(body)) {
        assert.match(body, /paidAt:/, `${f} — 결제된 박스를 판정하면서 결제 시각(paidAt)을 안 넘긴다`)
      }
    }
  }
  assert.ok(seen >= 4, `describeUpcomingBox 호출을 ${seen}개만 찾았다 — 검사가 헛돈다`)

  // 같은 판정의 복사본 금지 — 고치면 한 곳만 고쳐진다.
  for (const f of walk(join(ROOT, 'app')).filter((x) => /\.tsx?$/.test(x))) {
    assert.doesNotMatch(read(f), /function paidBoxShipIso\(/, `${f} 에 결제된 박스 발송일 계산 복사본이 있다 — lib/shipping-schedule 정본을 쓴다`)
  }

  // 결제된 박스는 고객이 직접 취소 못 하고(1:1 문의 → 사장님 수동 환불), 미루기·정지 안내도 '이번 박스는 그대로'.
  const cancel = stripComments(read(join(ROOT, 'app', 'api', 'orders', '[id]', 'cancel', 'route.ts')))
  assert.match(cancel, /SUBSCRIPTION_BOX_IN_PRODUCTION/, '결제된 정기배송 박스를 고객이 직접 취소할 수 있다(사장님: 그대로 발송)')
  const dogSub = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'subscription', 'DogSubscriptionClient.tsx')))
  assert.match(dogSub, /inProgress\[sub\.id\]\s*\?\s*`이번 박스는 그대로 보내드리고, 그다음 박스를/, '결제 뒤 미루기 안내가 이번 박스도 미뤄지는 것처럼 말한다')
  assert.match(dogSub, /inProgress\[sub\.id\]\s*\?\s*'이번 박스는 그대로 보내드리고, 그다음부터 쉬어/, '결제 뒤 일시정지 안내가 이번 박스도 멈추는 것처럼 말한다')
})

test('규칙155: 결제 후 취소 제한은 그 결제 전에 받은 필수 동의가 있을 때만 — 카드 등록 입구마다 체크, 동의 기록은 서버가 카드와 함께', () => {
  /**
   * # 왜 (2026-10-02 사장님 "A가 좋다")
   * 주문 제작 재화의 청약철회 제한은 그 거래에 대한 **별도 고지 + 고객 동의**가 요건이고(전자상거래법 §17②·시행령 §21),
   * 게시된 환불정책은 아직 "출고 전 셀프 취소"를 약속한다. 그래서 결제된 박스의 셀프 취소는 **결제 전에 필수 체크로
   * 동의한 박스만** 막고, 동의 기록이 없는 구독(기존 서포터즈·옛 화면)은 게시된 정책대로 취소된다.
   */
  const lib = stripComments(read(join(ROOT, 'lib', 'payments', 'no-cancel-consent.ts')))
  assert.match(lib, /if \(!input\.consentAt \|\| !input\.paidAt\) return false/, '동의 기록이나 결제 시각을 모르는데 취소를 막는다')
  assert.match(lib, /return c <= p/, '결제 뒤에 한 동의로 그 전에 결제된 박스까지 막는다')

  // 토스 카드창을 여는 곳은 전부 필수 체크를 거치고 동의 버전을 싣는다.
  const launchers = walk(join(ROOT, 'app')).filter((f) => /\.tsx?$/.test(f) && /openBillingWindow\(\{/.test(read(f)))
  assert.ok(launchers.length >= 2, `토스 카드창 입구를 ${launchers.length}곳만 찾았다 — 검사가 헛돈다`)
  for (const f of launchers) {
    const src = stripComments(read(f))
    for (const m of src.matchAll(/openBillingWindow\(\{([\s\S]*?)\}\)/g)) {
      assert.match(m[1] ?? '', /noCancelConsent: NO_CANCEL_CONSENT_VERSION/, `${f} — 카드창을 열면서 결제 후 취소 동의를 싣지 않는다`)
    }
    assert.match(src, /if \(!noCancelAgreed\)/, `${f} — 필수 체크 없이 카드 등록으로 넘어갈 수 있다`)
  }
  const auth = stripComments(read(join(ROOT, 'app', 'subscribe', 'billing-auth', 'page.tsx')))
  assert.equal((auth.match(/disabled=\{!!launchingId \|\| !noCancelAgreed\}/g) ?? []).length, 2, '카드 등록 화면의 등록 버튼이 동의 전에 열려 있다')
  // 앱 모양(2026-10-09 'A 포스터')의 등록 버튼도 같은 잠금 — 조건을 한 변수로 받아 쓴다(웹 두 곳의 수는 위가 센다).
  assert.match(auth, /const registerLocked = !!launchingId \|\| !noCancelAgreed/, '앱 카드 등록 버튼의 잠금 조건이 웹과 다르다')
  assert.equal((auth.match(/disabled=\{registerLocked\}/g) ?? []).length, 1, '앱 카드 등록 버튼이 동의 전에 열려 있다')
  assert.equal((auth.match(/onClick=\{\(\) => void launch\(/g) ?? []).length, 3, '잠금을 거치지 않는 카드 등록 버튼이 새로 생겼다(웹 2 · 앱 1)')
  assert.doesNotMatch(auth, /setError\(NO_CANCEL/, '동의 안내를 화면 전체 오류(막다른 화면)로 띄운다')

  // 왕복 주소 → 완료 화면 → 서버: 지금 버전일 때만, 카드 저장과 같은 쓰기로.
  assert.match(stripComments(read(join(ROOT, 'lib', 'payments', 'billing-urls.ts'))), /\$\{NO_CANCEL_CONSENT_PARAM\}=/, '토스 왕복 주소에 동의 버전이 안 실린다')
  assert.match(stripComments(read(join(ROOT, 'app', 'subscribe', 'billing-success', 'page.tsx'))), /noCancelConsent \? \{ noCancelConsent \} : \{\}/, '완료 화면이 동의 버전을 서버로 넘기지 않는다')
  const issue = stripComments(read(join(ROOT, 'app', 'api', 'payments', 'billing-issue', 'route.ts')))
  // 10/6 10차 C: 처음 동의만 기록한다(재등록이 동의 시각을 결제 뒤로 밀어 셀프 취소를 다시 열지 않게).
  assert.match(issue, /isCurrentNoCancelConsent\(parsed\.data\.noCancelConsent\) && !cur\?\.no_cancel_consent_at\s*\?\s*\{ no_cancel_consent_at:/, '서버가 버전 검사 없이 동의를 기록하거나, 재등록 때 첫 동의 시각을 덮어쓴다')
  assert.ok(issue.indexOf('{ no_cancel_consent_at:') > issue.indexOf('billing_key: result.billingKey'), '동의 기록이 카드 저장과 같은 쓰기에 있지 않다')

  // 취소를 막는 두 곳은 같은 판정을 쓴다 — 무조건 차단으로 되돌아가면 동의 없는 고객의 권리를 막는다.
  const cancel = stripComments(read(join(ROOT, 'app', 'api', 'orders', '[id]', 'cancel', 'route.ts')))
  assert.match(cancel, /selfCancelBlockedByConsent\(\{\s*consentAt: consentRow\?\.no_cancel_consent_at \?\? null,\s*paidAt: order\.paid_at \?\? order\.created_at,?\s*\}\)/, '취소 API 가 동의 여부 없이 결제된 박스를 막는다')
  assert.match(cancel, /if \(consentErr\) \{[\s\S]{0,400}status: 503/, '동의 조회 실패를 동의 없음/있음으로 넘겨짚는다')
  const orderPage = stripComments(read(join(ROOT, 'app', 'mypage', 'orders', '[id]', 'page.tsx')))
  assert.match(orderPage, /selfCancelBlockedByConsent\(\{ consentAt: noCancelConsentAt, paidAt: order\.paid_at \?\? order\.created_at \}\)/, '주문 상세가 동의 없는 고객에게서도 취소 버튼을 숨긴다')

  const mig = read(join(ROOT, 'supabase', 'migrations', '20261002120000_subscriptions_no_cancel_consent.sql'))
  assert.match(mig, /add column if not exists no_cancel_consent_at timestamptz/, '동의 기록 칸 마이그레이션이 없다')

  // 동의 문구는 결제 시점을 말하지 않는다 — 서포터즈(발송일 결제)는 조리가 결제보다 먼저다(2026-10-02 교체).
  assert.doesNotMatch(lib, /결제되면 바로|만들기 시작/, '동의 문구가 "결제되면 바로 만든다"고 말한다 — 서포터즈에겐 거짓')

  // 법정 페이지(2026-10-02 즉시 시행 — 사장님 "바로 해도 돼")가 같은 범위·같은 일정을 말한다.
  const refund = stripComments(read(join(ROOT, 'app', 'legal', 'refund', 'page.tsx')))
  const terms = stripComments(read(join(ROOT, 'app', 'legal', 'terms', 'page.tsx')))
  assert.match(refund, /결제 전에 별도로 안내하고\s+동의를 받은 정기배송 회차는/, '환불정책이 결제 후 취소 제한(동의 회차)을 안 적었다')
  assert.match(terms, /결제 전에 회사가 그 사실을 별도로 알리고 회원이 동의한 경우/, '약관 제9조 제한 사유에 동의 회차가 없다')
  assert.match(terms, /직전\s+금요일 밤/, '약관 제8조 마감이 금요일 밤이 아니다(lib/shipping-schedule LEAD_DAYS 4)')
  for (const [name, src] of [['환불정책', refund], ['약관', terms]] as const) {
    // ★2026-10-10 웹 가게(단품, 규칙172): 단품은 토스 결제창의 카드·간편결제로 한 번에 결제한다 — '간편결제'는 단품 조항에서만
    //   허용한다. 정기배송은 여전히 카드 전용이고, 가상계좌·에스크로는 어디에도 없다.
    assert.doesNotMatch(src, /가상계좌|에스크로/, `${name}이 없는 결제 수단(가상계좌·에스크로)을 약속한다`)
    for (const m of src.matchAll(/간편결제/g)) {
      assert.ok(src.slice(Math.max(0, (m.index ?? 0) - 200), m.index).includes('단품'), `${name}이 정기배송에 간편결제를 약속한다 — 정기배송은 카드 전용(간편결제는 단품 조항에서만)`)
    }
    assert.doesNotMatch(src, /마이페이지에서 반품 신청/, `${name}이 없는 '마이페이지 반품 신청'을 안내한다`)
    assert.doesNotMatch(src, /수도권은 다음 날|일요일이며/, `${name}이 옛 일정(일요일 마감·다음 날 도착)을 말한다`)
  }
})

test('규칙156: 개인정보처리방침은 실제 처리와 같다 — 코드가 보내고 저장하는 것은 방침에서 지울 수 없다', () => {
  /**
   * # 왜 (2026-10-02 사장님 "ㄱㄱ" — docs/LEGAL_REVISION_2026_10.md §1 즉시 시행)
   * 방침이 "익명화된 설문 응답만 Anthropic 으로(이름·연락처 미포함)"·"Supabase 미국 저장"·"결제 방식(카드·가상계좌)만
   * 저장"이라고 적고 있었는데 실제로는 진료 영수증 이미지(보호자 성명·연락처 인쇄)가 그대로 가고, 저장은 서울 리전이며,
   * 카드사명·끝 4자리·빌링키를 저장한다. 개인정보보호법 §30(기재 정확성). 규칙68(푸시)과 같은 방식으로 코드↔문서를 묶는다.
   */
  const policy = stripComments(read(join(ROOT, 'app', 'legal', 'privacy', 'page.tsx')))
  assert.match(policy, /보호자 이름, 출생연도/, '가입 시 이름·출생연도 수집이 방침에 없다(app/start/join)')
  assert.match(policy, /카드번호 끝 4자리/, '카드번호 끝 4자리 저장이 방침에 없다(subscriptions.billing_card_last4)')
  assert.match(policy, /빌링키/, '정기결제 빌링키 저장이 방침에 없다(subscriptions.billing_key)')
  assert.doesNotMatch(policy, /가상계좌/, '방침이 없는 결제 수단(가상계좌)을 적는다 — 카드 전용')
  assert.doesNotMatch(policy, /us-east/, 'Supabase 저장 위치를 미국으로 적는다 — 프로젝트 리전은 ap-northeast-2(서울)')
  assert.match(policy, /서울 리전/, 'Supabase 저장 위치(서울 리전)가 방침에 없다')
  assert.doesNotMatch(policy, /이름·연락처\s*포함하지 않음/, 'Anthropic 전송에 이름·연락처가 없다고 적는다 — 영수증 이미지에 인쇄돼 있다')

  const ocr = join(ROOT, 'app', 'api', 'health', 'ocr', 'route.ts')
  if (existsSync(ocr) && /anthropic/i.test(read(ocr))) {
    assert.match(policy, /진료서·영수증 이미지/, '진료서 판독이 Claude 로 이미지를 보내는데 방침에 없다')
  }
  if (existsSync(join(ROOT, 'lib', 'notify', 'alimtalk.ts'))) {
    assert.match(policy, /솔라피/, '알림톡 발송 대행(솔라피)이 위탁표에 없다 — 첫 발송 전에 있어야 한다(§26②)')
    assert.match(policy, /알림톡 전달/, '알림톡 전달((주)카카오)이 위탁표에 없다')
  }
  if (/replayIntegration\(/.test(stripComments(read(join(ROOT, 'instrumentation-client.ts'))))) {
    assert.match(policy, /세션 리플레이/, 'Sentry 세션 리플레이를 켜 두었는데 방침에 없다')
  }
})

test('규칙157: 1기 서포터즈 체험 구간은 신청 마감도 원래 방식(일요일) — 첫 박스·재개 날짜를 정하는 곳은 전부 결제 시점을 넘긴다', () => {
  /**
   * # 왜 (2026-10-02 사장님 "여태 우리가 만든 규칙에 이번 1기 서포터즈는 포함 아닌 거 아니었어?")
   * 일정 변경(토·일 조리)에서 서포터즈는 결제(발송일 화요일)만 원래대로 두고 **마감은 금요일 밤을 모두에게** 걸었다 →
   * 주말에 카드를 등록하는 서포터즈가 10/6 대신 10/13 을 받을 뻔했다. 체험 구간(chargeTimingFor = ship_day) 동안은
   * 마감도 옛 규칙(일요일, LEAD 2). 정상가부터 금요일 밤.
   */
  const sched = stripComments(read(join(ROOT, 'lib', 'shipping-schedule.ts')))
  assert.match(sched, /const LEAD_DAYS_SUPPORTER = 2\b/, '서포터즈 마감이 일요일(발송 이틀 전)이 아니다')
  assert.match(sched, /return timing === 'ship_day' \? LEAD_DAYS_SUPPORTER : LEAD_DAYS/, '마감이 결제 시점(서포터즈 체험 구간)을 따르지 않는다')
  assert.match(sched, /addDaysKst\(fromIso, leadDaysFor\(timing\)\)/, 'nextShipDate 가 결제 시점별 마감을 쓰지 않는다')

  // 첫 박스·재개 날짜를 정하는 호출은 전부 결제 시점을 넘긴다(안 넘기면 서포터즈도 금요일 마감).
  let calls = 0
  for (const f of walk(join(ROOT, 'app')).filter((x) => /\.tsx?$/.test(x))) {
    const src = stripComments(read(f))
    for (const m of src.matchAll(/\b(nextShipDate|resumeShipDate)\(/g)) {
      calls++
      const tail = src.slice(m.index!, m.index! + 220)
      assert.match(tail, /chargeTiming|chargeTimingFor\(|shipTiming|'ship_day'|'before_cooking'/, `${f} — ${m[1]} 가 결제 시점 없이 마감을 잡는다(서포터즈에게 금요일 마감)`)
    }
  }
  assert.ok(calls >= 8, `첫 박스·재개 날짜 호출을 ${calls}곳만 찾았다 — 검사가 헛돈다`)

  const issue = stripComments(read(join(ROOT, 'app', 'api', 'payments', 'billing-issue', 'route.ts')))
  assert.match(issue, /const chargeTiming = await getChargeTiming\(user\.id\)[\s\S]{0,200}firstDeliveryIso = nextShipDate\(undefined, chargeTiming \?\? 'before_cooking'\)/, '카드 등록이 서포터즈 첫 박스를 금요일 마감으로 잡는다')
  const order = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'order', 'OrderClient.tsx')))
  assert.match(order, /pricePreview\?\.discountKind === 'trial' \? 'ship_day' : 'before_cooking'/, '주문 화면이 서포터즈 첫 발송일을 금요일 마감으로 보여준다')
  assert.match(order, /shipWeekFor\(timing\)/, '주문 화면 리듬표가 서포터즈에게 금요일 마감 문구를 보여준다')
})

test('규칙158: 미루기는 확인을 거치고, 실수로 미뤄도 되돌릴 수 있다 — 고객은 원래 회차 마감 전까지, 사장님은 어드민에서', () => {
  /**
   * # 왜 (2026-10-06 사장님 "우리 구독 실수로 건너뛰기해 버리면 할 수 있는 게 없더라")
   * 앱 '2주 미루기'는 한 번 누르면 바로 밀렸고 되돌리는 길이 없었다. 일시정지→재개도 아직 오지 않은 날짜를 그대로 두고
   * (resumeShipDate), 어드민에도 발송일을 고치는 곳이 없었다. 박스가 2주치라 실수 한 번 = 아이가 2주 굶는다.
   */
  const sched = stripComments(read(join(ROOT, 'lib', 'shipping-schedule.ts')))
  assert.match(sched, /export function undoSkipTarget\(/, '미루기 되돌리기 정본이 없다')
  assert.match(sched, /if \(target < nextShipDate\(i\.today, i\.timing \?\? 'before_cooking'\)\) return null/, '되돌리기가 원래 회차의 신청 마감을 보지 않는다 — 조리 중인 주에 박스를 끼운다')
  assert.match(sched, /if \(i\.paidBoxShipIso && i\.paidBoxShipIso >= target\) return null/, '되돌리기가 결제된 박스와 같은 회차를 만들 수 있다')

  const app = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'subscription', 'DogSubscriptionClient.tsx')))
  assert.match(app, /onSkip=\{\(\) => setSkipId\(sub\.id\)\}/, '앱 미루기가 확인 없이 바로 밀린다')
  assert.doesNotMatch(app, /onSkip=\{\(\) => skip\(/, '앱 미루기가 확인 시트를 건너뛴다')
  assert.match(app, /function SkipSheet\(/, '앱 미루기 확인 시트가 없다')
  assert.match(app, /label: '되돌리기', onClick: \(\) => void undoSkip\(/, '미룬 직후 알림에 되돌리기가 없다')
  // 11차 A#6: 결제된 박스를 모르면(조회 실패) 되돌리기를 숨긴다.
  assert.match(app, /const undoTo =\s*state === 'active' && !paidUnknown\s*\?\s*undoSkipTarget\(/, '앱 카드의 되돌리기가 정본 판정을 쓰지 않거나 결제 박스를 모를 때도 보인다')

  const web = stripComments(read(join(ROOT, 'app', 'account', 'subscriptions', 'SubscriptionsWebClient.tsx')))
  assert.match(web, /async function handleUndoSkip\(subId: string, fromIso: string, toIso: string\)/, '웹에 미루기 되돌리기가 없다')
  assert.match(web, /\.update\(\{ next_delivery_date: toIso \}\)[\s\S]{0,120}\.eq\('next_delivery_date', fromIso\)/, '웹 되돌리기가 화면이 본 날짜를 확인하지 않는다(그 사이 결제되면 같은 회차를 두 번)')
  assert.match(web, /undoSkipTarget\(\{/, '웹 되돌리기가 정본 판정을 쓰지 않는다')

  const admin = stripComments(read(join(ROOT, 'app', 'admin', 'subscriptions', 'page.tsx')))
  assert.match(admin, /function ShipDateModal\(/, '어드민에 발송일 바꾸기가 없다 — 고객이 문의해도 고칠 수 없다')
  assert.match(admin, /const cutoffFirst = nextShipDate\(today, timing \?\? 'before_cooking'\)/,'어드민 발송일 선택지가 신청 마감을 안 본다(조리 중인 주에 끼운다)')
  assert.match(admin, /fromIso \? q\.eq\('next_delivery_date', fromIso\) : q\.is\('next_delivery_date', null\)/, '어드민 발송일 변경이 화면이 본 날짜를 확인하지 않는다')
  assert.match(admin, /const canSetShipDate = !!sub\.has_billing_key && !sub\.requires_billing_key_renewal/, '카드 없는 구독에 발송일을 박을 수 있다(카드 등록이 첫 배송을 잡는다)')
})

test('규칙159: 청구·발송일·셀프 취소의 돈 방어 — 서포터즈 정가 청구 차단, 발송일 칸 DB 검사, 결제 진행·발송 후 취소 차단 (10차 점검)', () => {
  /**
   * # 왜 (2026-10-06 10차 점검 B·C — 서포터즈 첫 실제 청구 당일 아침에 고침)
   *  · 할인 판정(getTrialState)만 순간 실패하면 '체험 아님'으로 접혀 100원 약속 고객에게 정가가 나갔다.
   *  · 결제 시점 조회 실패 시 서포터즈 다음 박스가 한 주 밀리고 위 실패와 겹치면 정가까지.
   *  · 고객이 next_delivery_date 에 '-infinity' 를 쓰면 RangeError 로 청구 크론 전체가 멈췄다(값 검사 0).
   *  · 이미 결제된 회차로 날짜를 되돌리면 멱등키가 재생돼 돈 없이 '결제됨' 주문이 생길 수 있었다.
   *  · 카드 재등록이 동의 시각을 덮어 결제 후 셀프 취소가 다시 열렸다.
   *  · 청구 진행 중(결제 대기) 정기 주문·이미 발송된 박스를 셀프 취소할 수 있었다.
   */
  const charge = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')))
  assert.match(charge, /if \(!timingKnown\) \{\s*return NextResponse\.json\(/, '체험 상태를 모르는데 청구를 이어 간다(서포터즈 정가·일정 밀림)')
  assert.match(charge, /timingOf\(sub\) === 'ship_day' && discountReason !== 'trial_cheap' && discountReason !== 'trial_half'/, '서포터즈인데 할인이 체험가가 아닐 때 청구를 막지 않는다')
  const guardAt = charge.indexOf("timingOf(sub) === 'ship_day' && discountReason !== 'trial_cheap'")
  const chargeRowAt = charge.search(/\.from\('subscription_charges'\)\s*\.insert\(/)
  assert.ok(guardAt > 0 && chargeRowAt > guardAt, '체험가 불일치 검사가 청구 행 생성보다 뒤에 있다')

  const migs = readdirSync(join(ROOT, 'supabase', 'migrations'))
  const checkMig = migs.find((f) => f.includes('subscriptions_next_delivery_tuesday_check'))
  assert.ok(checkMig, '발송일 칸 값 검사(CHECK) 마이그레이션이 없다')
  const checkSql = read(join(ROOT, 'supabase', 'migrations', checkMig!))
  assert.match(checkSql, /isfinite\(next_delivery_date\)/, "발송일 CHECK 에 isfinite 가 없다 — 'infinity' 는 isodow 가 NULL 이라 통과한다")
  assert.match(checkSql, /extract\(isodow from next_delivery_date\) = 2/, '발송일 CHECK 가 화요일을 강제하지 않는다')
  // ★가장 최근 정의를 본다(11차 A — v2 가 덮어썼다). 이름순 마지막 = 최신.
  const trgMig = migs.filter((f) => f.includes('guard_customer_next_delivery_date')).sort().at(-1)
  assert.ok(trgMig, '고객 발송일 쓰기 규칙(트리거) 마이그레이션이 없다')
  const trgSql = read(join(ROOT, 'supabase', 'migrations', trgMig!))
  assert.match(trgSql, /last_charge_lock_at > now\(\) - interval '5 minutes'/, '청구 진행 중 발송일 변경을 막지 않는다')
  // 11차 A#6: 늦은 성공 박스(결제일 + 8 발송)까지 — + 3 이면 그 사이 날짜로 되돌려 같은 박스를 또 청구한다.
  assert.match(trgSql, /\(old\.last_charged_at at time zone 'Asia\/Seoul'\)::date \+ 8/, '이미 결제된 회차(늦은 성공 박스 포함)로 되돌리는 것을 막지 않는다')
  assert.match(trgSql, /if auth\.uid\(\) is null then\s*return new;/, '트리거가 크론·서버 쓰기(service_role)까지 막는다')
  // 11차 A#9: 해지(비우기+cancelled)는 잠금보다 먼저 허용 — 일시정지와 같은 결과(크론 재확인이 자동 환불).
  const cancelAllowAt = trgSql.search(/if new\.next_delivery_date is null and new\.status = 'cancelled' then\s*return new;/)
  const lockAt = trgSql.indexOf("last_charge_lock_at > now() - interval '5 minutes'")
  assert.ok(cancelAllowAt > 0 && cancelAllowAt < lockAt, '청구 잠금이 해지를 막는다(같은 순간 일시정지는 통과)')
  const chargeSrc = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')))
  assert.ok((chargeSrc.match(/last_charge_lock_at: null/g) ?? []).length >= 2, '청구가 끝나도 잠금 표시를 지우지 않는다(5분간 미루기가 막힌다)')

  const cancel = stripComments(read(join(ROOT, 'app', 'api', 'orders', '[id]', 'cancel', 'route.ts')))
  assert.match(cancel, /order\.subscription_id && order\.payment_status === 'pending'/, '청구 진행 중인 정기 주문을 셀프 취소할 수 있다(크론이 결제됨으로 덮는다)')
  assert.match(cancel, /\.shipped_at\) \{/, '이미 발송된 박스를 셀프 취소할 수 있다')

  const admin = stripComments(read(join(ROOT, 'app', 'admin', 'subscriptions', 'page.tsx')))
  assert.match(admin, /paidShipIso && addDaysKst\(paidShipIso, 7\) > cutoffFirst/, '어드민 발송일 선택지가 결제된 박스와 같은 회차를 준다(같은 박스 두 번 청구)')
  assert.match(admin, /const options = paidUnknown \? \[\]/, '결제된 박스를 모를 때도 어드민이 발송일을 바꿀 수 있다')
})

test('규칙160: 고객에게 하는 말 = 실제 동작 — 7일 환불·익일 도착·전문용어·영양소 %·없는 기능 약속 (10차 점검 E)', () => {
  /**
   * # 왜 (2026-10-06 10차 점검 E)
   *  10/2 정책(결제 후 취소 제한 동의 · 주말 조리 일정)이 마케팅·온보딩·분석 화면 문구까지 퍼지지 않았다.
   *  · 웹 16개 페이지 프로모바·가입 완료·플랜·사업자 페이지가 "미개봉 7일 환불"을 약속했다(동의 회차는 제한).
   *  · /plans FAQ "수도권은 익일" — 사실상 수요일 도착 약속(규칙140 정규식은 '다음 날'만 잡았다).
   *  · 분석 화면 '이렇게 추천했어요'가 엔진 원문("12개월 미만 puppy", "BCS 정상")을 그대로 그렸다(DB 실재).
   *  · 췌장염 게이트·AI '이렇게 해보세요'에 정확한 영양소 %("단백질 32% 이상").
   *  · 체크인 결과 "처방"·"소스 대기열 등록(출시 시 알림)" — 그런 기능이 없다. 온보딩 "레시피도 배송일도 변경".
   *  · 승인 화면이 금액 변경 제안의 보류(notApproved)를 무시하고 "적용됐어요"라고 말했다.
   */
  const noSevenDay: Array<[string, string]> = [
    ['프로모바', join(ROOT, 'components', 'WebChrome.tsx')],
    ['가입 완료', join(ROOT, 'app', 'start', 'done', 'page.tsx')],
    ['플랜', join(ROOT, 'app', 'plans', 'page.tsx')],
    ['사업자 정보', join(ROOT, 'app', 'business', 'page.tsx')],
  ]
  for (const [name, p] of noSevenDay) {
    const src = stripComments(read(p))
    assert.doesNotMatch(src, /미개봉[^'"\n]{0,20}7일|7일 이내 단순 변심/, `${name}이 '미개봉 7일 환불'을 약속한다(결제 후 취소 제한 동의 회차와 어긋남)`)
  }
  const plans = stripComments(read(join(ROOT, 'app', 'plans', 'page.tsx')))
  assert.doesNotMatch(plans, /익일|48시간 이내 도착/, '/plans 가 도착 날짜를 약속한다(도착은 "하루나 이틀"로만)')
  assert.doesNotMatch(plans, /2주(마다| 단위로) 급여량 리뷰/, '/plans 가 2주마다 리뷰를 약속한다(재제안은 박스 3개마다)')

  const box = stripComments(read(join(ROOT, 'components', 'analysis', 'magazine', 'BoxMixCard.tsx')))
  assert.match(box, /trigger: plainTrigger\(r\.trigger\)/, "분석 화면이 엔진 원문 근거(puppy·BCS …)를 그대로 그린다")
  const approve = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'approve', 'ApproveClient.tsx')))
  assert.match(approve, /trigger: plainTrigger\(r\.trigger\)/, '승인 화면이 엔진 원문 근거를 그대로 그린다')
  assert.match(approve, /isPlainCustomerText\(r\.action\) &&/, '승인 화면이 문헌 인용·DM % 가 든 설명을 그대로 그린다')
  assert.match(approve, /if \(json\.notApproved\)/, '승인 화면이 서버의 보류(notApproved)를 무시하고 "적용됐어요"라고 말한다')
  for (const rel of [['app', '(main)', 'dogs', '[id]', 'analysis', 'AnalysisView.tsx'], ['app', '(main)', 'dogs', '[id]', 'order', 'OrderClient.tsx']]) {
    const src = stripComments(read(join(ROOT, ...rel)))
    assert.doesNotMatch(src, /\{gateChip\.action\}/, `${rel.at(-1)} 가 췌장염 게이트 저장 문구(정확한 지방 %)를 그린다`)
    assert.match(src, /\{PANCREATITIS_GATE_COPY\}/, `${rel.at(-1)} 가 췌장염 게이트 안내 정본을 쓰지 않는다`)
  }
  const aiCard = stripComments(read(join(ROOT, 'components', 'v3', 'AiCommentCard.tsx')))
  assert.match(aiCard, /\.filter\(isCustomerSafeAiLine\)\.slice\(0, 3\)/, "AI '이렇게 해보세요'가 영양소 %·약어 줄을 거르지 않는다(저장된 옛 분석)")
  const aiPrompt = stripComments(read(join(ROOT, 'lib', 'nutrition', 'ai-prompt.ts')))
  assert.match(aiPrompt, /typeof s === 'string' && isCustomerSafeAiLine\(s\)/, '새 AI 응답의 nextActions 를 거르지 않는다')

  const feedback = stripComments(read(join(ROOT, 'lib', 'personalization', 'v3', 'feedback.ts')))
  assert.doesNotMatch(feedback, /처방|대기열|출시 시 알림/, "체크인 결과가 '처방'이나 없는 기능(소스 대기열·출시 알림)을 말한다")
  const onboarding = stripComments(read(join(ROOT, 'components', 'Onboarding.tsx')))
  assert.doesNotMatch(onboarding, /레시피도 배송일도|배송일 변경/, '온보딩이 없는 기능(레시피·배송일 변경)을 약속한다')
  const home = stripComments(read(join(ROOT, 'app', 'page.tsx')))
  assert.doesNotMatch(home, /언제든/, "홈이 금지어 '언제든'을 쓴다")

  // 환불 소요일은 환불정책(영업일 3~7일) 하나로.
  for (const rel of [
    ['app', 'mypage', 'orders', '[id]', 'page.tsx'],
    ['app', 'mypage', 'orders', '[id]', 'CancelOrderButton.tsx'],
    ['lib', 'email', 'templates', 'orders.ts'],
    ['lib', 'notify', 'templates.ts'],
    ['app', 'api', 'orders', '[id]', 'cancel', 'route.ts'],
    ['app', 'api', 'payments', 'confirm', 'route.ts'],
  ]) {
    const src = stripComments(read(join(ROOT, ...rel)))
    assert.doesNotMatch(src, /3[-~]5 ?영업일|영업일 기준 3~5일/, `${rel.join('/')} 의 환불 소요일이 환불정책(3~7일)과 다르다`)
  }
})

test('규칙161: 10차 점검 나머지 — 되돌리는 건 올린 것만·재생 결제 장부 중복 금지·재등록 날짜 정본·앞당기면 처방도 (2026-10-06)', () => {
  /**
   * # 왜 (2026-10-06 10차 점검 A·B·C·D — 서포터즈 첫 청구 후 처리)
   *  · 환불 트리거가 "결제됨→취소" 전이만 보고 체험 회차 +1·배송 횟수 −1 — 청구 도중 해지·즉시환불 실패 경로는 차감·증가
   *    전에 빠지므로 쓴 적 없는 100원 박스가 생겼다(C#4).
   *  · 토스 멱등키 재생 응답을 경보만 남기고 성공 처리 — 이미 장부에 있는 결제로 두 번째 '결제됨' 주문(B#2·C#6).
   *  · 미루기→새 처방 승인→되돌리기면 새 금액으로 결제·옛 처방으로 포장(B#5).
   *  · 카드 재등록: 고지 화면(billing-terms)과 저장(billing-issue)이 다른 날짜 · 일요일 아침 재등록이 한 주 밀림(A F3·F4).
   *  · 웹훅 DONE 이 정기결제 원장·영수증을 크론과 이중으로(C#7) · cron_health 가 청구 신호를 잘랐다(C#12).
   */
  const charge = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-charge', 'route.ts')))
  assert.match(charge, /trialRoundConsumed = !decErr && \(decRows\?\.length \?\? 0\) > 0/, '회차를 실제로 차감했는지 기록하지 않는다')
  // 11차 A#7: 표시는 **실제로 올린 직후** — 회차는 차감 성공 직후, 배송 횟수는 구독 쓰기 성공 뒤.
  assert.match(charge, /if \(trialRoundConsumed\) \{\s*const \{ error: trcErr \} = await supabase\s*\.from\('orders'\)\s*\.update\(\{ trial_round_consumed_at:/, '회차 차감 직후 주문에 표시하지 않는다')
  assert.match(charge, /if \(!subUpd\.error\) \{\s*const \{ error: dcErr \} = await supabase\s*\.from\('orders'\)\s*\.update\(\{ delivery_counted_at: successIso \}\)/, '배송 횟수를 올린 뒤에만 주문에 표시하지 않는다')
  // 11차 A#1: 재생 판정은 옛 주문 상태 글자가 아니라 토스 실제 상태 + 같은 결제키의 결제됨 주문으로.
  assert.match(charge, /fetchPayment\(replayPk \|\| 'missing-payment-key'\)/, '재생된 결제의 토스 실제 상태를 보지 않는다(환불된 결제를 새 결제로 처리)')
  assert.match(charge, /tossOutcome === 'none'\s*\?\s*'refunded'/, '환불된 결제의 재생을 걸러내지 않는다')
  assert.match(charge, /\.eq\('payment_key', replayPk \|\| 'missing-payment-key'\)\s*\.in\('payment_status', \['paid', 'partially_refunded'\]\)/, '재생된 결제가 이미 장부에 있어도 새 성공으로 처리한다')
  assert.match(charge, /charge_key_seq: \(sub\.charge_key_seq \?\? 0\) \+ 1 \}\)/, '환불된 결제가 재생되면 다음 시도가 새 멱등키를 쓰지 않는다(매일 재생)')
  assert.match(charge, /`subscription\.charge\.replay_\$\{verdict\}`/, '재생 결제 보류 분기가 없다')
  // 11차 A#2: 청구 행에 주문을 토스 호출 전에 잇는다 — 결과 불명 확인이 order_id 있는 행만 본다.
  assert.match(charge, /\.update\(\{ order_id: orderRow\.id \}\)\s*\.eq\('id', chargeRow!\.id\)/, '청구 행에 주문을 잇지 않아 결과 불명 확인이 실패·중단 건을 못 본다')
  const linkAt = charge.indexOf('.update({ order_id: orderRow.id })')
  const tossCallAt = charge.indexOf('chargeBillingKey({')
  assert.ok(linkAt > 0 && tossCallAt > linkAt, '청구 행-주문 연결이 토스 호출보다 뒤에 있다')

  const migs = readdirSync(join(ROOT, 'supabase', 'migrations'))
  const markerMig = migs.find((f) => f.includes('orders_trial_delivery_markers'))
  assert.ok(markerMig, '주문 표시 칸 마이그레이션이 없다')
  const markerSql = read(join(ROOT, 'supabase', 'migrations', markerMig!))
  assert.match(markerSql, /and old\.trial_round_consumed_at is not null/, '체험 회차 복원이 차감한 주문으로 제한되지 않는다')
  assert.match(markerSql, /and old\.delivery_counted_at is not null/, '배송 횟수 되돌림이 올린 주문으로 제한되지 않는다')
  const realignMig = migs.find((f) => f.includes('realign_formula_start_on_pull_earlier'))
  assert.ok(realignMig, '앞당길 때 처방 시작일을 맞추는 마이그레이션이 없다')
  const realignSql = read(join(ROOT, 'supabase', 'migrations', realignMig!))
  assert.match(realignSql, /new\.next_delivery_date < old\.next_delivery_date/, '앞당길 때만 처방을 맞춰야 한다')
  assert.match(realignSql, /applied_from > new\.next_delivery_date\s*and applied_from <= old\.next_delivery_date/, '처방 시작일 조정 범위가 (새, 옛] 이 아니다')

  // 카드 재등록 날짜 — 크론 시각과 판정 정본.
  const sched = read(join(ROOT, 'lib', 'shipping-schedule.ts'))
  assert.match(sched, /export const CHARGE_CRON_KST_MINUTES = 9 \* 60 \+ 10/, '청구 크론 KST 시각 상수가 없다')
  const vercel = JSON.parse(read(join(ROOT, 'vercel.json'))) as { crons: Array<{ path: string; schedule: string }> }
  const chargeCron = vercel.crons.find((c) => c.path === '/api/cron/subscription-charge')
  assert.equal(chargeCron?.schedule, '10 0 * * *', '청구 크론 시각이 바뀌었다 — CHARGE_CRON_KST_MINUTES 도 같이 바꿀 것')

  const webhook = stripComments(read(join(ROOT, 'app', 'api', 'payments', 'webhook', 'route.ts')))
  assert.match(webhook, /if \(order\.subscription_id\) \{\s*return NextResponse\.json\(\{ ok: true, marked: 'paid', deferredTo: 'subscription-charge' \}\)/, '웹훅이 정기결제 원장·영수증을 크론과 이중으로 남긴다')
  const tracking = read(join(ROOT, 'lib', 'cron-tracking.ts'))
  for (const k of ['timingKnown', 'backlog', 'ambiguousHeld']) {
    assert.ok(tracking.includes(`'${k}'`), `cron_health 요약이 청구 신호 ${k} 를 자른다`)
  }
  const progression = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'personalization-progression', 'route.ts')))
  assert.match(progression, /const since = boxCountSince\(cur\.applied_from, cur\.created_at\)/, '재제안 박스 수를 첫 박스 결제일부터 세지 않는다')
  const rotation = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'protein-rotation', 'route.ts')))
  assert.match(rotation, /paidBoxShipIso\(s\.next_delivery_date, s\.last_charged_at\) === todayIso/, '단백질 로테이션 푸시가 오늘 나가지 않는 박스에도 간다')
  const reminders = stripComments(read(join(ROOT, 'app', 'api', 'cron', 'subscription-reminders', 'route.ts')))
  assert.match(reminders, /\.not\('billing_key', 'is', null\)\s*\.not\('requires_billing_key_renewal', 'is', true\)/, '카드 없는 구독에도 결제 고지를 보낸다')

  // 화면
  const web = stripComments(read(join(ROOT, 'app', 'account', 'subscriptions', 'SubscriptionsWebClient.tsx')))
  assert.match(web, /if \(stillTo !== toIso\)/, '웹 되돌리기가 누른 순간 마감을 다시 보지 않는다')
  const order = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'order', 'OrderClient.tsx')))
  assert.match(order, /chargeTiming \?\? \(pricePreview\?\.discountKind === 'trial' \? 'ship_day' : 'before_cooking'\)/, '주문 화면이 서버가 아는 결제 시점을 쓰지 않는다(첫 발송일이 뒤집혀 보임)')
  const auth = stripComments(read(join(ROOT, 'app', 'subscribe', 'billing-auth', 'page.tsx')))
  assert.ok((auth.match(/<ConsentNeededHint show=\{!noCancelAgreed\} \/>/g) ?? []).length >= 2, '카드 등록 버튼이 막힌 이유를 말하지 않는다')
  const subClient = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'subscription', 'DogSubscriptionClient.tsx')))
  assert.match(subClient, /const boxes = Math\.max\(0, sub\.total_deliveries - \(inProgress \? 1 : 0\) - \(inTransit \? 1 : 0\)\)/, "결제만 된 박스·배송 중 박스를 '받은 박스'로 센다")
  assert.match(subClient, /paidBoxInProgress=\{paidStateUnknown \? null : !!inProgress\[skipId\]\}/, '결제된 박스를 모를 때 미루기 시트가 "박스가 안 가요"를 단정한다')
})

test('규칙162: 옛 앱(Capacitor 8.3.1) 보호·iOS 버전 고정·첫 발송일 운영 화면 (11차 점검 B·C, 2026-10-06)', () => {
  /**
   * # 왜
   *  · GHSA-rvm3-566m-v7fv(CVSS 9.3): 8.0.0~8.4.2 안드로이드 앱은 `/_capacitor_http_interceptor_?u=<공격자>` 로 이동하면
   *    공격자 페이지를 **앱 출처**에서 연다. 우리 앱은 App Links 로 우리 도메인 전 경로를 받아 router.push 로 보내므로 문자
   *    링크 한 번이 세션 탈취로 이어질 수 있었다. 새 앱 빌드 전까지 옛 앱을 지키는 건 웹 배포뿐 — 모든 목적지 검사가 막는다.
   *  · iOS 는 SPM 이 GitHub 의 capacitor-swift-pm 을 받는다 — npm 만 올리면 iOS 는 8.3.1 그대로였다.
   *  · 첫 발송일: 송장을 넣으면 피킹 리스트가 그 박스를 "고객이 미룸 — 보내지 마세요"로 · 택배사 기본값 CJ 가 저장 안 됨 ·
   *    '배송 완료' 오클릭은 되돌릴 수 없음 · 송장 하이픈은 배송조회가 조용히 건너뜀.
   */
  const safeNext = read(join(ROOT, 'lib', 'auth', 'safe-next.ts'))
  assert.match(safeNext, /if \(hasCapacitorInternalMarker\(raw\)\) return null/, 'safeNextPath 가 Capacitor 내부 경로를 막지 않는다')
  const nativeNav = stripComments(read(join(ROOT, 'lib', 'native-nav.ts')))
  assert.ok((nativeNav.match(/if \(hasCapacitorInternalMarker\(trimmed\)\) return null/g) ?? []).length >= 2, '앱 링크(화면·/api) 처리가 Capacitor 내부 경로를 먼저 끊지 않는다')
  const callback = stripComments(read(join(ROOT, 'app', 'auth', 'callback', 'route.ts')))
  assert.match(callback, /const safeNext = safeNextPath\(next\) \?\? '\/dashboard'/, '로그인 콜백이 정본 safeNextPath 를 쓰지 않는다(자체 검사는 Capacitor 경로를 통과시켰다)')
  const bridge = stripComments(read(join(ROOT, 'components', 'NativeShellBridge.tsx')))
  assert.match(bridge, /'security\.capacitor_internal_link_blocked'/, '차단한 공격 링크를 기록하지 않는다')

  // iOS SPM 고정 버전 = npm @capacitor/ios 버전(잠금 파일).
  const lock = JSON.parse(read(join(ROOT, 'package-lock.json'))) as { packages: Record<string, { version?: string }> }
  const iosVer = lock.packages['node_modules/@capacitor/ios']?.version
  const spm = read(join(ROOT, 'ios', 'App', 'CapApp-SPM', 'Package.swift'))
  const spmVer = spm.match(/capacitor-swift-pm\.git", exact: "([\d.]+)"/)?.[1]
  assert.ok(iosVer && spmVer, 'iOS Capacitor 버전을 읽지 못했다')
  assert.equal(spmVer, iosVer, `iOS Package.swift(capacitor-swift-pm ${spmVer})가 npm @capacitor/ios(${iosVer})와 다르다 — 보안 패치가 iOS 에 안 들어간다`)
  const pkg = JSON.parse(read(join(ROOT, 'package.json'))) as { dependencies: Record<string, string>; scripts: Record<string, string> }
  for (const k of ['@capacitor/android', '@capacitor/ios', '@capacitor/core', '@capacitor/cli']) {
    assert.match(pkg.dependencies[k] ?? '', /^~8\.4\.(3|[4-9]|\d{2,})$/, `${k} 범위가 취약 버전(8.5.0 등)을 허용한다: ${pkg.dependencies[k]}`)
  }
  assert.equal(pkg.scripts['cap:sync'], 'node scripts/cap-sync.mjs', '윈도우에서 iOS 까지 sync 하면 Package.swift 경로가 깨진다')
  assert.match(read(join(ROOT, 'scripts', 'cap-sync.mjs')), /if \(process\.platform === 'darwin'\)/, 'cap-sync 가 iOS 를 맥에서만 돌리지 않는다')

  // 첫 발송일 운영 화면
  const shipBlock = read(join(ROOT, 'lib', 'admin', 'ship-block.ts'))
  assert.match(shipBlock, /if \(input\.alreadyShipped\) return 'already_shipped'/, '이미 보낸 박스가 라벨·조리 합계에 다시 들어간다')
  const picking = stripComments(read(join(ROOT, 'app', 'admin', 'personalization', 'picking-list', 'page.tsx')))
  assert.match(picking, /const hasPaidOrder = orderBySubId\.has\(sub\.id\) \|\| shipped !== null/, '송장을 넣은 박스가 결제 증거를 잃어 "고객이 미룸"으로 바뀐다')
  const shipCtl = stripComments(read(join(ROOT, 'app', 'admin', 'orders', '[id]', 'ShippingControl.tsx')))
  assert.match(shipCtl, /isCarrierCode\(currentCarrier\) \? currentCarrier : ''/, '택배사가 CJ 로 미리 골라져 저장되지 않는다')
  assert.match(shipCtl, /const trimmed = normalizeTrackingNumber\(trackingNumber\)/, '송장번호 하이픈·공백을 정리하지 않는다')
  for (const rel of [['app', 'api', 'admin', 'orders', '[id]', 'status', 'route.ts'], ['app', 'api', 'admin', 'orders', '[id]', 'tracking', 'route.ts']]) {
    assert.match(stripComments(read(join(ROOT, ...rel))), /normalizeTrackingNumber\(/, `${rel.join('/')} 가 송장번호를 정리하지 않는다`)
  }
  const statusCtl = read(join(ROOT, 'app', 'admin', 'orders', '[id]', 'OrderStatusControl.tsx'))
  assert.match(statusCtl, /고객에게 "배송이 완료됐어요" 알림이 바로 가고, 되돌릴 수 없어요/, "'배송 완료' 확인창이 결과(되돌릴 수 없는 고객 알림)를 말하지 않는다")
})

test('규칙163: 11차 점검 A — 고지 첫 결제일·재개 CAS·결제 박스 모를 때 되돌리기 숨김·웹훅은 정기주문 상태를 안 올림', () => {
  // 카드 재등록 고지: 지난 날·오늘 결제 시각이 지난 날을 첫 결제일로 말하지 않는다.
  const terms = stripComments(read(join(ROOT, 'app', 'api', 'subscriptions', 'billing-terms', 'route.ts')))
  assert.match(terms, /const firstChargeDate = timing \? firstChargeNoticeDate\(firstShipDate, timing\) : null/, '정기결제 고지 화면이 지난 날을 첫 결제일로 고지한다')
  // 재개는 본 상태(일시정지 + 본 날짜) 그대로일 때만.
  const app = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'subscription', 'DogSubscriptionClient.tsx')))
  assert.match(app, /\.update\(\{ status: 'active', next_delivery_date: next \}\)[\s\S]{0,120}\.eq\('status', 'paused'\)/, '앱 재개가 옛 화면 날짜로 덮어쓴다(CAS 없음)')
  const web = stripComments(read(join(ROOT, 'app', 'account', 'subscriptions', 'SubscriptionsWebClient.tsx')))
  assert.match(web, /\.update\(\{ status: 'active', next_delivery_date: nextIso \}\)[\s\S]{0,120}\.eq\('status', 'paused'\)/, '웹 재개가 옛 화면 날짜로 덮어쓴다(CAS 없음)')
  // 결제된 박스를 모르면 되돌리기를 숨긴다(웹).
  assert.match(web, /state === 'active' && !paidStateUnknown\s*\?\s*undoSkipTarget\(/, '웹이 결제된 박스를 모를 때도 되돌리기를 보인다')
  // 웹훅은 정기결제 주문의 주문 상태를 올리지 않는다(발송 대기는 청구 크론 몫).
  const webhook = stripComments(read(join(ROOT, 'app', 'api', 'payments', 'webhook', 'route.ts')))
  assert.match(webhook, /order_status: order\.subscription_id\s*\?\s*order\.order_status/, '웹훅이 정기결제 주문을 발송 대기로 올린다')
})

/**
 * `start` 부터 한 문장(메서드 체인)의 끝까지를 잘라낸다 — 규칙164 용 작은 파서.
 * 괄호·문자열 안은 건너뛰고, 깊이 0 에서 `,` `;` 닫는 괄호, 또는 다음 줄이 `.` 로 이어지지
 * 않는 줄바꿈(앞 줄이 `+`·`=` 로 끝나면 이어짐)에서 멈춘다. 이 저장소는 세미콜론을 안 쓴다.
 */
function statementFrom(src: string, start: number): string {
  let depth = 0
  let quote: string | null = null
  for (let i = start; i < src.length; i++) {
    const ch = src[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch
    else if (ch === '(' || ch === '{' || ch === '[') depth++
    else if (ch === ')' || ch === '}' || ch === ']') {
      if (depth === 0) return src.slice(start, i)
      depth--
    } else if (depth === 0 && (ch === ',' || ch === ';')) return src.slice(start, i)
    else if (depth === 0 && ch === '\n') {
      if (src.slice(start, i).trim() === '') continue // `= ↵ '…'` 처럼 다음 줄에서 시작
      const prev = src.slice(start, i).trimEnd().slice(-1)
      const next = src.slice(i + 1).match(/^\s*(\S)/)?.[1]
      if (next !== '.' && prev !== '+' && prev !== '=') return src.slice(start, i)
    }
  }
  return src.slice(start)
}

test('규칙164: 배합비(products.ingredients)는 공개 조회에서 빠져 있고, products 를 * 나 ingredients 로 읽는 곳은 관리자 확인 + service_role 뿐', () => {
  /**
   * # 왜 (2026-10-06 운영 DB 실측)
   * products.ingredients 에 화식 4종의 배합비(%)가 들어 있는데(영업비밀 — lib/recipe-ingredients.ts),
   * 표 권한이 Supabase 기본값(anon·authenticated 표 전체 SELECT)이라 **공개 anon 키로 REST 조회하면
   * 누구나 배합비를 읽었다.** RLS 는 행을 거르지 칸을 거르지 않는다(AGENTS 규칙3: 쓸 수 없게/읽을 수
   * 없게 만드는 층위를 먼저 본다).
   * 칸 권한을 뺀 뒤에는 쿠키 클라이언트(관리자 포함 authenticated)의 select('*')·ingredients 조회가
   * permission denied 로 **화면 전체를 깨뜨린다** — 그래서 세 가지를 잠근다:
   *  ① 마이그레이션이 공개 grant 에서 ingredients 를 빼고, 뒤 마이그레이션이 되돌려주지 않는다.
   *  ② products 를 '*'·ingredients 로 읽는 곳은 정해진 어드민 3곳뿐이고, 셋 다 관리자 확인 + service_role.
   *  ③ 다른 표 조회에 products(*)·products(ingredients) 를 끼워 읽지 않는다.
   */
  const migDir = join(ROOT, 'supabase', 'migrations')
  const MIG = '20261006140000_products_hide_ingredients.sql'
  const sql = read(join(migDir, MIG)).replace(/--.*$/gm, '')
  assert.match(sql, /revoke select on public\.products from anon, authenticated;/, '표 전체 SELECT 회수가 없다 — 배합비가 공개 조회된다')
  const grant = sql.match(/grant select \(([\s\S]*?)\) on public\.products to anon, authenticated;/)
  assert.ok(grant, '칸 단위 공개 grant 가 없다')
  const cols = (grant?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  assert.ok(!cols.includes('ingredients'), '공개 grant 에 ingredients(배합비)가 들어 있다')
  for (const c of ['id', 'name', 'slug', 'price', 'sale_price', 'image_url', 'stock', 'is_subscribable', 'is_active', 'nutrition_facts', 'net_weight_g', 'sales_channel']) {
    assert.ok(cols.includes(c), `고객 화면이 읽는 칸 ${c} 가 공개 grant 에서 빠졌다 — 구독 화면이 permission denied`)
  }
  assert.match(sql, /has_column_privilege\('anon', 'public\.products', 'ingredients', 'select'\)/, '마이그레이션 자기 검증(적용 직후 권한 대조)이 없다')

  // ① 뒤 마이그레이션이 표 전체 SELECT·ingredients 칸을 공개 역할에 되돌려주지 않는다.
  const regrants: string[] = []
  for (const f of readdirSync(migDir).filter((n) => n.endsWith('.sql') && n > MIG)) {
    const s = read(join(migDir, f)).replace(/--.*$/gm, '').toLowerCase()
    const pub = String.raw`[^;]*\b(?:anon|authenticated|public)\b`
    if (
      new RegExp(String.raw`grant\s+(?:select|all)\b[^;(]*\bon\s+(?:table\s+)?(?:public\.)?products\s+to` + pub).test(s) ||
      new RegExp(String.raw`grant\s+select\s*\([^)]*\bingredients\b[^)]*\)\s*on\s+(?:table\s+)?(?:public\.)?products\s+to` + pub).test(s) ||
      new RegExp(String.raw`grant\s+[^;]*\bon\s+all\s+tables\s+in\s+schema\s+public\s+to` + pub).test(s)
    )
      regrants.push(f)
  }
  assert.deepEqual(regrants, [], `뒤 마이그레이션이 products 표 SELECT(또는 ingredients)를 공개 역할에 되돌려준다 — 배합비가 다시 샌다:\n${regrants.join('\n')}`)

  // ②③ 코드 — products 를 읽는 모든 체인을 해석한다.
  const readers = new Set<string>()
  const offenders: string[] = []
  let scanned = 0
  for (const f of [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib')), ...walk(join(ROOT, 'components'))]) {
    const src = stripComments(read(f))
    if (/\bproducts(?:!\w+)?\s*\(\s*(?:\*|[^)]*\bingredients\b)/.test(src)) offenders.push(`${rel(f)} — 다른 표 조회에 products(*)·products(ingredients) 를 끼워 읽는다`)
    for (const m of src.matchAll(/\.from\(\s*['"`]products['"`]\s*\)/g)) {
      const receiver = src.slice(0, m.index).match(/(\w+)\s*$/)?.[1] ?? '(식)'
      if (receiver === 'storage') continue // 스토리지 버킷 'products' — 표가 아니다
      scanned++
      const chain = statementFrom(src, m.index! + m[0].length)
      const at = chain.indexOf('.select(')
      if (at === -1) continue // update·delete·insert 만 — 읽지 않는다
      const args = statementFrom(chain, at + '.select('.length)
      let first = args.trim()
      const ident = first.match(/^([A-Za-z_$][\w$]*)$/)?.[1]
      if (ident) {
        const def = src.match(new RegExp(String.raw`const ${ident}\s*(?::[^=]+)?=`))
        first = def ? statementFrom(src, def.index! + def[0].length) : ''
      }
      const text = [...first.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g)].map((x) => x[2]).join('')
      const star = args.trim() === '' || text.split(',').some((c) => c.trim() === '*')
      if (!star && !/\bingredients\b/.test(text)) continue
      readers.add(rel(f))
      const viaServiceRole = new RegExp(String.raw`const ${receiver}\s*=\s*createAdminClient\(\)`).test(src)
      const adminChecked = /\bisAdmin\(|\brequireAdmin\(/.test(src)
      if (!viaServiceRole || !adminChecked)
        offenders.push(`${rel(f)} — products 를 ${star ? "select('*')" : 'ingredients'} 로 읽는데 ${viaServiceRole ? '' : 'service_role 이 아니다(쿠키·브라우저 클라이언트는 permission denied) '}${adminChecked ? '' : '관리자 확인이 없다'}`)
    }
  }
  assert.ok(scanned >= 20, `products 조회를 ${scanned}곳밖에 못 찾았다 — 스캐너가 망가졌다`)
  assert.deepEqual(offenders, [], `배합비 보호 위반:\n${offenders.join('\n')}`)
  // 배합비를 읽는 곳은 화이트리스트다 — 늘리려면 여기서 이유와 함께 추가한다(관리자 확인 + service_role).
  assert.deepEqual([...readers].sort(), [
    'app/admin/label/[sku]/page.tsx', // 사료관리법 라벨 — 원료명 및 함량
    'app/admin/page.tsx', // 식품정보고시 채움률 — 채움 여부만, 문자열은 브라우저로 안 넘어감
    'app/admin/products/[id]/page.tsx', // 상품 수정 폼 — 배합비 편집
  ], `products 를 '*'·ingredients 로 읽는 곳이 바뀌었다 — 배합비가 새 화면으로 흐르는지 확인하고 목록을 갱신한다`)
})

test('규칙165: /app 앱 소개 화면엔 본 사이트로 나가는 길이 없고, 인스타 링크 모음 첫 버튼은 /app 이다', () => {
  /**
   * 사장님(2026-10-09): 토스 일반결제 심사 전이라 자사몰은 팔 수 없지만 막으면 심사가 안 된다.
   * → 본 사이트는 주소를 직접 치면 열리게 두고, 인스타로 오는 손님(링크 모음 /link 첫 버튼)만
   *   /app 으로 보낸다. /app 에서 본 사이트로 나가는 길이 하나라도 생기면 손님이 결제 안 되는
   *   상점·옛 설문으로 흘러 들어간다 — 메뉴 하나, 로고 링크 하나로 조용히 뚫린다.
   * 밖으로 나가는 건 앱스토어·구글플레이·스마트스토어·카카오 채널(전부 외부)만 허용한다.
   */
  const page = read(join(ROOT, 'app/app/page.tsx'))
  const code = stripComments(page)
  assert.ok(!/from ['"]next\/link['"]/.test(code), '/app 이 next/link 를 쓴다 — 본 사이트로 가는 길이 생긴다')
  assert.ok(!/\b(WebChrome|SiteFooter|FdFooter|AuthAwareShell|FunnelCta)\b/.test(code), '/app 에 사이트 머리줄·바닥·퍼널 버튼이 붙었다 — 메뉴로 본 사이트에 들어간다')
  const literal = [...code.matchAll(/href=\{?\s*(["'`])([^"'`]*)\1/g)].map((m) => m[2] ?? '')
  assert.deepEqual(literal.filter((h) => !/^https:\/\//.test(h)), [], '/app 에 본 사이트로 가는 글자 링크가 있다')
  const ALLOWED = new Set(['APP_STORE_LINKS.ios', 'APP_STORE_LINKS.android', 'SMARTSTORE_URL', 'business.kakaoChannelUrl'])
  const exprs = [...code.matchAll(/href=\{([^}"'`]+)\}/g)].map((m) => (m[1] ?? '').trim())
  assert.ok(exprs.length >= 4, `/app 의 링크를 ${exprs.length}개밖에 못 찾았다 — 검사가 망가졌다`)
  assert.deepEqual(exprs.filter((e) => !ALLOWED.has(e)), [], '/app 링크가 허용된 외부 주소(앱스토어·구글플레이·스마트스토어·카카오)가 아니다')
  assert.match(code, /if \(await isAppContextServer\(\)\) redirect\('\/dashboard'\)/, '/app 이 앱 안에서 열리면 웹 화면이 앱에 뜬다 — 앱 홈으로 보내야 한다')

  const links = stripComments(read(join(ROOT, 'lib/links.ts')))
  const first = /export const BIO_LINKS[^=]*=\s*\[\s*\{([\s\S]*?)\n {2}\}/.exec(links)?.[1] ?? ''
  assert.ok(first, 'BIO_LINKS 첫 버튼을 못 찾았다')
  assert.match(first, /href:\s*`\/app\?/, '링크 모음 첫 버튼이 /app 이 아니다 — 인스타 손님이 본 사이트로 들어간다')
  assert.match(first, /primary:\s*true/, '링크 모음 강조 버튼이 /app 이 아니다')
})

test('규칙166: 앱 바탕 흰색(셸 3세대) 뒤에도 옛 셸은 그 셸 색으로 잇는다 — 윗줄·탭바·로딩 바탕·상태바·도장 그림', () => {
  /**
   * # 왜 (2026-10-09 앱 새 디자인 'A 포스터' — 사장님 "흰색, 시안대로")
   * 앱 바탕을 흰색으로 바꾸면 웹 배포는 모든 설치 버전에 바로 닿지만, 네이티브 색(폰 화면·상태바·홈바 구간)은 스토어
   * 업데이트로만 바뀐다. 2세대 셸(FtShell/2 — 네이티브 종이색 #F7F5F0)에서 웹만 흰색이면
   *   ① 아이폰은 상태바·홈바 구간이 종이색 띠로 남고(contentInset 'always' — 규칙84 의 이유),
   *   ② 폰 화면(종이색) → 웹 로딩(흰색)으로 넘어갈 때 바탕색이 바뀌고, 흰 바탕에 구운 도장이 종이색 위에 뜬다(규칙149 의 이유).
   * 그래서 head 스크립트가 FtShell/3 미만 셸에 html.ft-paper-shell 을 붙이고(1세대 아이폰은 ft-old-shell-ios),
   * 그 셸에선 윗줄·탭바(--ft-native-bg)·로딩 바탕·안드로이드 상태바를 종이색으로, 도장 그림·영상은 종이색 위에 구운 v1 로 잇는다.
   * 옛 셸이 남아 있는 동안 v1 그림·영상을 지우면 그 셸의 로딩이 빈다.
   */
  const cap = read(join(ROOT, 'capacitor.config.ts'))
  const gen = Number(cap.match(/appendUserAgent:\s*'FarmerstailApp FtShell\/(\d+)'/)?.[1])
  assert.equal(gen, 3, '셸 세대가 3이 아니다 — 흰 바탕 셸의 표식을 바꾸면 head 스크립트의 옛 셸 판정(gen<3)도 같이 고칠 것')

  const layoutSrc = read(join(ROOT, 'app', 'layout.tsx'))
  assert.match(layoutSrc, /var gen=g\?\+g\[1\]:0;if\(gen<2&&/, 'head 스크립트가 셸 세대를 숫자로 읽지 않는다')
  assert.match(layoutSrc, /else if\(gen<3\)\{h\.classList\.add\('ft-paper-shell'\);\}/, 'head 스크립트가 옛 셸(FtShell/3 미만)에 ft-paper-shell 을 안 붙인다')
  assert.match(layoutSrc, /l\.href=\(h\.classList\.contains\('ft-paper-shell'\)\|\|h\.classList\.contains\('ft-old-shell-ios'\)\)\?'\$\{PAPER_SHELL_STILL_SRC\}':'\$\{SPLASH_STILL_SRC\}'/, '옛 셸이 흰 바탕 도장을 미리 받는다(그 셸이 쓰는 건 종이색 도장)')

  const css = stripComments(read(join(ROOT, 'app', 'globals.css')))
  assert.match(css, /html\.ft-paper-shell \[data-ft-chrome="app"\] \{\s*--ft-native-bg: #F7F5F0;/, '옛 셸에서 윗줄이 네이티브 종이색을 안 따른다 — 상태바를 흰색으로 못 바꾼 옛 셸에서 위에 띠가 생긴다')
  assert.match(css, /html\.ft-paper-shell \.ft-splash \{\s*background: #F7F5F0;/, '옛 셸 로딩 바탕이 그 셸 폰 화면(종이색)과 다르다')
  // ★2026-10-10 (사장님 옛 아이폰 화면 "위아래 띠가 색이 이상해") — 로딩이 걷힐 때 상태바를 흰색으로 바꾸는 데 성공하면
  // html.ft-sb-white 가 붙고 윗줄도 흰색. 이 규칙은 셸 색 규칙들 **뒤에** 있어야 이긴다(같은 무게).
  const sbWhiteAt = css.search(/html\.ft-sb-white \[data-ft-chrome="app"\] \{\s*--ft-native-bg: #FFFFFF;/)
  assert.ok(sbWhiteAt > 0, '상태바를 흰색으로 바꾼 옛 셸에서 윗줄을 흰색으로 돌리는 규칙(html.ft-sb-white)이 없다')
  assert.ok(sbWhiteAt > css.search(/html\.ft-paper-shell \[data-ft-chrome="app"\]/) && sbWhiteAt > css.search(/html\.ft-old-shell-ios \[data-ft-chrome="app"\]/), 'html.ft-sb-white 규칙이 옛 셸 색 규칙보다 앞에 있어 진다 — 상태바만 희고 윗줄은 셸 색으로 남는다')

  const chrome = stripComments(read(join(ROOT, 'components', 'AppChrome.tsx')))
  assert.match(chrome, /<header[\s\S]{0,120}background: 'var\(--ft-native-bg\)'/, '윗줄이 상태바 구간 색(--ft-native-bg)을 안 쓴다 — 옛 아이폰 셸에서 위에 띠가 생긴다')

  const splash = read(join(ROOT, 'components', 'AppSplash.tsx'))
  assert.equal(splash.match(/export const PAPER_SHELL_BG = '(#[0-9A-Fa-f]{6})'/)?.[1], '#F7F5F0', '옛 셸 바탕색이 2세대 네이티브 종이색이 아니다')
  assert.match(splash, /var paperShell=root\.classList\.contains\('ft-paper-shell'\);/, '로딩 스크립트가 옛 셸을 가려내지 않는다')
  assert.match(splash, /var oldShell=paperShell\|\|oldIos;/, '로딩 스크립트가 옛 아이폰 셸을 옛 셸로 안 친다')
  assert.match(splash, /color:paperShell\?'\$\{PAPER_SHELL_BG\}':'\$\{APP_PAPER\}'/, '안드로이드 옛 셸의 로딩 중 상태바를 흰색으로 칠한다 — 종이색 로딩 위에 흰 띠가 생긴다')
  assert.match(splash, /pic\.src=\(oldShell&&pic\.getAttribute\('data-src-paper'\)\)\|\|pic\.getAttribute\('data-src'\)/, '옛 셸에 흰 바탕 도장 그림을 띄운다')
  assert.match(splash, /wag\.src=\(oldShell&&wag\.getAttribute\('data-src-paper'\)\)\|\|wag\.getAttribute\('data-src'\)/, '옛 셸에 흰 바탕 꼬리 영상을 띄운다')
  // 상태바 흰색은 **성공했을 때만** 윗줄을 흰색으로(실패하면 셸 색 그대로 = 띠 없음), 로딩이 걷힐 때·이미 본 세션이면 바로.
  assert.match(splash, /var sbWhite=function\(\)\{if\(oldShell\)call\('StatusBar','setBackgroundColor',\{color:'\$\{APP_PAPER\}'\}\)\.then\(function\(\)\{root\.classList\.add\('ft-sb-white'\)\}/, '옛 셸 상태바를 흰색으로 바꾼 뒤에만 윗줄을 흰색으로 돌리지 않는다')
  assert.match(splash, /\{hideNative\(\);sbWhite\(\);return\}/, '로딩을 건너뛴 실행(같은 세션 두 번째)에서 옛 셸 상태바를 흰색으로 안 바꾼다')
  assert.match(splash, /gone=true;sbWhite\(\);/, '로딩이 걷힐 때 옛 셸 상태바를 흰색으로 안 바꾼다')
  assert.match(splash, /data-src-paper=\{PAPER_SHELL_STILL_SRC\}/, '정지 도장에 종이색 그림 주소가 없다')
  assert.match(splash, /data-src-paper=\{PAPER_SHELL_WAG_SRC\}/, '꼬리 영상에 종이색 영상 주소가 없다')
  // 두 벌의 그림·영상이 실제로 있고 서로 다른 파일이다.
  const srcOf = (k: string) => splash.match(new RegExp('export const ' + k + " = '([^']+)'"))?.[1] ?? ''
  for (const k of ['SPLASH_STILL_SRC', 'SPLASH_WAG_SRC', 'PAPER_SHELL_STILL_SRC', 'PAPER_SHELL_WAG_SRC']) {
    const src = srcOf(k)
    assert.ok(src && existsSync(join(ROOT, 'public', ...src.split('/').filter(Boolean))), k + '(' + src + ') 파일이 없다')
  }
  assert.notEqual(srcOf('SPLASH_STILL_SRC'), srcOf('PAPER_SHELL_STILL_SRC'), '흰 바탕 도장과 종이색 도장이 같은 파일이다')
  assert.notEqual(srcOf('SPLASH_WAG_SRC'), srcOf('PAPER_SHELL_WAG_SRC'), '흰 바탕 영상과 종이색 영상이 같은 파일이다')
})

test('규칙167: 정기배송 상세(앱) — 일시정지·다시 시작은 확인창을 거치고, 해지창은 "그냥 둘게요"가 진하며, 지난 정기배송엔 결제 없는 신청서를 띄우지 않는다', () => {
  /**
   * # 왜 (2026-10-09 앱 새 디자인 'A 포스터' · 웹시안_진단/앱시안_결정할것.md 3번 '동작'·13번·15번)
   * ① 일시정지·다시 시작이 누르는 즉시 바뀌고 토스트만 떴다. 다시 시작은 다음 결제가 잡히는 일이라, 언제 얼마가
   *    결제되는지 보고 누르게 한다(미루기 확인창 — 규칙158 — 과 같은 틀).
   * ② 해지 확인창에서 '해지하기'가 진한 버튼이면 실수로 누르기 쉽다 → '그냥 둘게요'를 진하게, 해지는 빨간 테두리.
   * ③ 카드 등록을 못 마쳐 자동 정리된 신청서가 '지난 정기배송 · 신청 취소'로 떠 헷갈렸다(10/8 실제 해지 2건이 전부 이것,
   *    두 분 다 다음 날 다시 신청). 정기배송 탭과 같은 기준(isSubscriptionVisibleToUser)으로 거른다.
   * ④ 앱 화식 비율 창은 비율(%)을 말하지 않는다(브랜드 보이스). 웹 창은 같은 컴포넌트의 기본 모양 그대로.
   */
  const src = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'subscription', 'DogSubscriptionClient.tsx')))
  // ① 타일·버튼은 확인창을 열 뿐이고, 저장 함수는 확인창의 버튼만 부른다.
  assert.match(src, /onPause=\{\(\) => setPauseId\(sub\.id\)\}/, '일시정지 타일이 확인창 없이 바로 멈춘다')
  assert.match(src, /onResume=\{\(\) => setResumeId\(sub\.id\)\}/, '다시 시작 버튼이 확인창 없이 바로 재개한다')
  assert.match(src, /<PauseSheet[\s\S]{0,400}onConfirm=\{\(\) => void pause\(s\)\}/, '일시정지 확인창이 pause 를 부르지 않는다')
  assert.match(src, /<ResumeSheet[\s\S]{0,600}onConfirm=\{\(\) => void resume\(s\)\}/, '다시 시작 확인창이 resume 을 부르지 않는다')
  assert.doesNotMatch(src, /onPause=\{\(\) => pause\(|onResume=\{\(\) => resume\(/, '일시정지·다시 시작을 확인창 없이 부르는 곳이 있다')
  // ② 해지 확인창 — '그냥 둘게요'가 진한 버튼, 해지는 빨간 테두리.
  const cancelSheet = src.slice(src.indexOf('function CancelSheet('))
  assert.match(cancelSheet, /className="sub-sheet-btn is-solid" onClick=\{onClose\}>\s*그냥 둘게요/, "해지 확인창의 '그냥 둘게요'가 진한 버튼이 아니다")
  assert.match(cancelSheet, /className="sub-sheet-btn is-danger" onClick=\{onConfirm\}/, '해지 버튼이 빨간 테두리(is-danger)가 아니다')
  // ③ 지난 정기배송 = 사용자에게 보일 구독만.
  assert.match(
    src,
    /const past = subs\.filter\(\(s\) => s\.status === 'cancelled' && isSubscriptionVisibleToUser\(s\)\)/,
    '지난 정기배송에 결제 없이 해지된 신청서가 뜬다',
  )
  // ④ 앱 화식 비율 창 — 앱 모양으로 띄우고, 그 모양은 % 부제를 그리지 않는다.
  assert.match(src, /<FreshRatioSheet\s+variant="app"/, '앱 화식 비율 창이 앱 모양(variant="app")이 아니다')
  const ratio = stripComments(read(join(ROOT, 'components', 'subscription', 'FreshRatioSheet.tsx')))
  const appSub = ratio.match(/const APP_TIER_SUB[\s\S]*?\n\}/)?.[0] ?? ''
  assert.ok(appSub.includes('light:') && appSub.includes('half:') && appSub.includes('full:'), '앱 부제(APP_TIER_SUB)가 세 티어를 다 갖고 있지 않다')
  assert.doesNotMatch(appSub, /%/, '앱 화식 비율 부제에 비율(%)이 있다')
  const appBranch = ratio.slice(ratio.indexOf("if (variant === 'app')"), ratio.indexOf('<div className="flex flex-col gap-3">'))
  assert.ok(appBranch.length > 500, '앱 화식 비율 분기를 찾지 못했다')
  assert.match(appBranch, /APP_TIER_SUB\[t\.key\]/, '앱 화식 비율 창이 앱 부제를 그리지 않는다')
  assert.doesNotMatch(appBranch, /\bt\.sub\b/, '앱 화식 비율 창이 웹 부제(t.sub — "화식 30% · 건사료 70%")를 그린다')
})

test('규칙168: 주문 영수증·운송장(앱) — 앱 화면으로 그리고, 저장은 그림 저장 정본, ← 는 그 주문 상세 · 레시피 작은 네모는 레시피 색 · 앱 날짜는 오전/오후', () => {
  /**
   * 2026-10-09 앱 새 디자인 묶음④(캔버스 M07~M10·I01·I02·I09·I10). 앱시안 결정 3번 '동작':
   * "영수증이 앱 머리줄 없이 열리고, 인쇄가 새 탭 방식이라 앱에서 안 될 수 있음" — 앱 WebView 엔 새 탭이 없고
   * 안드로이드 window.print() 는 무반응이다. 그리고 점검 중에 같이 드러난 것들:
   *  · 서버에서 그리는 toLocaleString('ko-KR') 시각이 이 PC 의 Node(ICU 78)에서 "AM 07:00" 이었다.
   *  · 레시피 작은 네모·사진 테두리를 파우치 색(흑돼지 #BEBDB6)으로 그렸다 — 시안은 전부 레시피 색(#2E3338).
   *    파우치 색은 카드 바탕·테두리 전용(boxLines.ts 머리글과 같은 규칙).
   *  · html2canvas 그림 속 글자가 몇 px 아래로 밀렸다 — Tailwind 의 img block 이 기준선 측정을 틀어서.
   */
  const O = ['app', 'mypage', 'orders', '[id]']
  // ① 영수증 — 앱은 앱 머리줄(AuthAwareShell)이 있는 앱 화면, 저장은 그림 저장 정본(새 탭·인쇄 금지).
  const rp = stripComments(read(join(ROOT, ...O, 'receipt', 'page.tsx')))
  assert.match(rp, /if \(await isAppContextServer\(\)\) \{\s*return \(\s*<AuthAwareShell>\s*<ReceiptAppView/, '앱 영수증이 앱 머리줄 없는 웹 영수증으로 뜬다')
  const rb = stripComments(read(join(ROOT, ...O, 'receipt', 'ReceiptSaveButton.tsx')))
  assert.ok(rb.includes('captureNodeToCanvas(') && rb.includes('saveCanvasImage('), '앱 영수증 저장이 그림 저장 정본(captureNodeToCanvas·saveCanvasImage)을 안 쓴다')
  assert.ok(!rb.includes('window.print') && !rb.includes('_blank'), '앱 영수증 저장이 인쇄·새 탭에 기댄다(앱 WebView 에선 안 열린다)')
  // ② 그림 뜨기 정본은 기준선 보정(1px 측정 그림 inline)을 지금 화면 문서에 건다 — onclone 으로는 안 고쳐진다.
  const si = stripComments(read(join(ROOT, 'lib', 'save-image.ts')))
  assert.match(si, /img\[src="\$\{HTML2CANVAS_PROBE_IMG\}"\] \{ display: inline !important; \}/, '그림 뜨기에 글자 기준선 보정이 없다')
  assert.ok(si.includes('document.head.appendChild(probeFix)') && si.includes('probeFix.remove()'), '기준선 보정을 지금 화면 문서에 걸고 빼지 않는다')
  // html2canvas 는 정본(lib/save-image)에서만 부른다 — 직접 부르면 보정이 빠진다(영수증·리포트·등록증이 이 정본을 쓴다).
  const direct: string[] = []
  for (const f of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'components')), walk(join(ROOT, 'lib')))) {
    if (rel(f) === 'lib/save-image.ts') continue
    if (/import\(\s*['"]html2canvas['"]\s*\)|from\s+['"]html2canvas['"]/.test(stripComments(read(f)))) direct.push(rel(f))
  }
  assert.deepEqual(direct, [], `html2canvas 를 직접 부르는 곳(그림 속 글자가 밀린다 — captureNodeToCanvas 로):\n${direct.join('\n')}`)
  // ③ 운송장 — 앱은 TrackingView 의 앱 화면(웹 머리말 'Tracking' 없음).
  const tp = stripComments(read(join(ROOT, ...O, 'track', 'page.tsx')))
  assert.match(tp, /if \(await isAppContextServer\(\)\) \{[\s\S]{0,700}?app=\{\{ orderNumber: order\.order_number \}\}/, '앱 운송장 조회가 웹 화면(영어 머리말)으로 뜬다')
  const tv = stripComments(read(join(ROOT, ...O, 'track', 'TrackingView.tsx')))
  // 2026-10-10 웹 리뉴얼: 웹도 같은 화면(app.web)을 쓰게 되어 옛 웹 갈래를 지웠다 — TrackingView 는 늘 앱 화면 하나를 그린다.
  assert.ok(
    /return \(\s*<TrackingAppView/.test(tv) &&
      /\bapp: \{ orderNumber: string; web\?: boolean \}/.test(tv) &&
      !/function ProgressBar\(/.test(tv) &&
      (tv.match(/\breturn \(/g) ?? []).length === 1,
    'TrackingView 가 새 화면(TrackingAppView) 하나로 그리지 않는다 — 옛 웹 갈래가 돌아왔다',
  )
  // ④ 윗줄 — 제목은 각자 이름, ← 는 그 주문 상세(목록까지 두 단계 건너뛰지 않는다). 영수증엔 아래 탭이 없다(시안 M09).
  const chrome = stripComments(read(join(ROOT, 'components', 'AppChrome.tsx')))
  assert.ok(chrome.includes("'/mypage/orders/:id/receipt': '주문 영수증'") && chrome.includes("'/mypage/orders/:id/track': '운송장 조회'"), '영수증·운송장 윗줄 제목이 "주문 상세"로 뜬다')
  assert.ok(chrome.includes('(receipt|track)') && chrome.includes('return `/mypage/orders/${orderSub[1]}`'), '영수증·운송장의 ← 가 주문 상세가 아니라 목록으로 간다')
  assert.match(chrome, /const tabBarHidden = focusMode \|\| checkout \|\| receipt/, '영수증 화면에 아래 탭이 뜬다(시안 M09 엔 없다)')
  // ⑤ 앱 날짜 — 서버 ICU 에 맡기지 않는다(오전/오후는 lib/datetime-kst 가 붙인다).
  for (const f of [join(...O, 'receipt', 'ReceiptAppView.tsx'), join(...O, 'OrderDetailAppView.tsx'), join(...O, 'track', 'TrackingAppView.tsx')]) {
    assert.doesNotMatch(stripComments(read(join(ROOT, f))), /Date\([^)]*\)\.toLocale(Date|Time)?String\(/, `${f}: 날짜를 toLocaleString 으로 그린다(서버에서 "AM 07:00")`)
  }
  assert.ok(stripComments(read(join(ROOT, ...O, 'receipt', 'ReceiptAppView.tsx'))).includes('kstKoDateTimeParts('), '앱 영수증 날짜가 정본(kstKoDateTimeParts)을 안 쓴다')
  const dp = stripComments(read(join(ROOT, ...O, 'page.tsx')))
  // ★2026-10-10 웹 리뉴얼: 웹도 같은 화면(OrderDetailAppView)을 SiteShell 에 담아 앱·웹이 한 갈래다 — 파일 전체가 정본 날짜만 쓴다.
  assert.ok(dp.includes('<OrderDetailAppView m={model} />') && dp.includes('<SiteShell>'), '주문 상세가 새 화면(OrderDetailAppView + SiteShell)으로 그려지지 않는다')
  assert.ok(!dp.includes('formatDateTime(') && dp.includes('formatKstKoDateTime('), '주문 상세 날짜가 toLocaleString 경로(formatDateTime)로 그려진다')
  // ⑥ 레시피 작은 네모·사진 테두리 = 레시피 색(RECIPE_COLOR). 파우치 색은 카드 바탕·테두리 전용.
  for (const f of [
    join(...O, 'OrderDetailAppView.tsx'),
    join('app', '(main)', 'dogs', '[id]', 'order', 'OrderClient.tsx'),
    join('app', 'account', 'subscriptions', 'PriceChangeConsentModal.tsx'),
    join('app', '(main)', 'dogs', '[id]', 'subscription', 'DogSubscriptionClient.tsx'),
    join('app', '(main)', 'dogs', '[id]', 'plan', 'PlanClient.tsx'),
    join('components', 'v3', 'subs', 'SubscriptionsSummaryView.tsx'),
  ]) {
    const src = stripComments(read(join(ROOT, f)))
    assert.ok(!src.includes('background: POUCH[') && !src.includes('2px ${POUCH['), `${f}: 레시피 작은 네모·테두리를 파우치 색으로 그린다(시안은 레시피 색 — 흑돼지 #2E3338)`)
  }
  // ⑦ 주문하기 추천 없음(시안 I02) — 앱은 회색 안내 카드 + '분석 보러 가기', 머리말에 '–번째 박스'를 안 붙인다.
  const oc = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'order', 'OrderClient.tsx')))
  assert.ok(oc.includes('{!formula && isApp && (') && oc.includes('className="ord-empty-app-go"'), '앱 주문하기 추천 없음 카드가 없다')
  assert.ok(!/isApp \? '맞춤 박스' : 'CUSTOM BOX'\} · \{formula\?\.cycleNumber \?\? '–'\}/.test(oc), "앱 머리말이 추천 없을 때 '맞춤 박스 · –번째 박스'로 뜬다")
})

test('규칙169: 로그인·가입 앱 화면 — 앱 판정은 서버 틀이 첫 그림부터, 문구는 실제 규칙대로(언제든·이모지·비밀번호 규칙)', () => {
  /**
   * 2026-10-09 앱 새 디자인 묶음⑤(캔버스 W06~W13·W18·W22~W27). 이 화면들은 웹·앱이 같이 쓰는 최상위 주소라
   * AppChrome 밖이다. 클라이언트 훅(useIsAppContext)으로 모양을 고르면 마운트 전 첫 그림이 웹 모양이었다가
   * 바뀐다 → 서버 레이아웃이 쿠키·UA 로 판정해 ServerAppContextProvider 로 넘기고 화면은 useServerAppContext 로 고른다.
   */
  const layoutOk = (segs: string[]) => {
    const src = stripComments(read(join(ROOT, ...segs)))
    return src.includes('await isAppContextServer()') && src.includes('<ServerAppContextProvider isApp={isApp}>')
  }
  for (const segs of [['app', '(auth)', 'layout.tsx'], ['app', 'onboarding', 'layout.tsx'], ['app', 'offline', 'layout.tsx'], ['app', 'subscribe', 'layout.tsx']]) {
    assert.ok(layoutOk(segs), `${segs.join('/')}: 앱 판정을 서버가 넘기지 않는다 — 앱 화면이 웹 모양으로 한 번 깜빡인다`)
  }
  for (const segs of [
    ['app', '(auth)', 'login', 'page.tsx'],
    ['app', '(auth)', 'forgot-password', 'page.tsx'],
    ['app', '(auth)', 'reset-password', 'page.tsx'],
    ['app', 'onboarding', 'age-gate', 'page.tsx'],
    ['app', 'offline', 'page.tsx'],
  ]) {
    const src = stripComments(read(join(ROOT, ...segs)))
    assert.ok(/const appLook = useServerAppContext\(\)/.test(src) && /if \(appLook\)/.test(src), `${segs.join('/')}: 앱 모양을 서버 판정값(useServerAppContext)으로 고르지 않는다`)
  }
  // 앱 갈래만 잘라 본다(웹 갈래엔 예전 문구가 그대로 있다 — 웹은 바꾸지 않는다).
  const appPart = (src: string, start: string, end: string) => {
    const a = src.indexOf(start)
    const b = a < 0 ? -1 : src.indexOf(end, a)
    return a < 0 || b < 0 ? '' : src.slice(a, b)
  }
  // 앱 로그인의 소셜 버튼은 같은 크기·모양(4.8 동등 비중) — 카카오만 앱 모양이면 애플이 알약으로 남는다.
  const login = stripComments(read(join(ROOT, 'app', '(auth)', 'login', 'page.tsx')))
  const appLogin = appPart(login, 'if (appLook) {', '</AuthAppMain>')
  assert.ok(appLogin.length > 0, '앱 로그인 갈래를 찾지 못했다')
  assert.ok(appLogin.includes('<KakaoLoginButton variant="login" next={socialNext} look="app" />') && appLogin.includes('<AppleLoginButton variant="login" next={socialNext} look="app" />'), '앱 로그인의 카카오·애플 버튼 모양이 다르다')
  assert.ok(!appLogin.includes('언제든'), "앱 로그인 안내에 '언제든'이 있다(고객 문구 금지어)")
  // 새 비밀번호(앱) 안내 = 실제 규칙(영문·숫자·특수문자 — 가입 화면과 같은 규칙, 사장님 2026-07-22).
  const reset = stripComments(read(join(ROOT, 'components', 'v3', 'auth', 'ResetPasswordAppView.tsx')))
  assert.ok(reset.includes('영문·숫자·특수문자 포함 8자 이상'), '앱 새 비밀번호 안내가 가입 규칙(특수문자 포함)과 다르다')
  // 이메일 인증 결과·오프라인(앱)은 이모지 대신 아이콘(앱시안 결정 3번 '문구').
  const confirmed = stripComments(read(join(ROOT, 'app', 'auth', 'confirmed', 'page.tsx')))
  const offline = stripComments(read(join(ROOT, 'app', 'offline', 'page.tsx')))
  for (const [name, part] of [
    ['auth/confirmed', appPart(confirmed, 'if (await isAppContextServer())', '</AuthAppMain>')],
    ['offline', appPart(offline, 'if (appLook)', '</AuthAppMain>')],
  ] as const) {
    assert.ok(part.length > 0, `${name}: 앱 갈래를 찾지 못했다`)
    assert.doesNotMatch(part, /[\u{1F300}-\u{1FAFF}\u{23F0}]/u, `${name}: 앱 화면에 이모지가 있다`)
  }
  // 이메일 회원가입(앱 전용)도 같은 소셜 버튼 모양 + 재발송·세션 즉시 발급 처리는 그대로(규칙20·재발송 규칙이 따로 본다).
  const joinPage = stripComments(read(join(ROOT, 'app', 'start', 'join', 'page.tsx')))
  assert.ok(joinPage.includes('<KakaoLoginButton variant="signup" next="/start/onboard" look="app" />') && joinPage.includes('<AppleLoginButton variant="signup" next="/start/onboard" look="app" />'), '앱 회원가입의 카카오·애플 버튼 모양이 다르다')
})

test('규칙170: 새 첫 화면·결과 둘러보기(앱) — 첫 실행은 새 첫 화면, 초안은 "설문은 가입 뒤", 사진은 강아지가 생길 때 붙고, 둘러보기 표식은 짝이 맞는다', () => {
  /**
   * 2026-10-09 앱 새 디자인 3단계(캔버스 Y1~Y6·TR0~TR4, 앱시안 결정 4·22번).
   *  · 앱 첫 실행 = /start 새 첫 화면(FirstScreenFlow) — 옛 /welcome 캐러셀·옛 한 장 입력 폼이 아니다.
   *  · 새 첫 화면은 설문 답을 모으지 않는다 → 초안에 surveyDeferred 를 단다. 빠지면 첫 단계의 '로그인'으로 나간
   *    사람의 초안을 로그인 화면이 '설문 끝난 웹 초안'으로 읽어, 답하지 않은 기본값으로 분석을 만든다(점검 중 발견).
   *  · 가입 전에 고른 사진은 폰에 들고 있다가 강아지가 만들어질 때(createDogFromDraft) 올린다 — 올리기가 설문 입장을
   *    붙잡지 않게 상한을 둔다. 초안을 버릴 땐 사진도 같이 버린다(남으면 다음에 만드는 강아지에 붙는다).
   *  · 둘러보기는 data-tour 표식(plan·record·stats)을 비춘다 — 표식이 빠지면 조용히 가운데 카드로만 뜨고, 겹치면
   *    엉뚱한 곳을 비춘다. 옛 홈 튜토리얼(OnboardingTutorial)과 겹쳐 뜨지 않게 그건 지웠다.
   */
  // ① 첫 실행 → /start, 앱 /start = 새 첫 화면.
  const gate = stripComments(read(join(ROOT, 'components', 'OnboardingGate.tsx')))
  assert.ok(gate.includes("router.replace('/start')"), '앱 첫 실행이 새 첫 화면(/start)으로 가지 않는다')
  assert.ok(gate.includes("if (pathname.startsWith('/start')) return"), '첫 실행 관문이 /start 에서도 다시 튕긴다(같은 곳으로 계속 이동)')
  const startPage = stripComments(read(join(ROOT, 'app', 'start', 'page.tsx')))
  assert.match(startPage, /if \(isApp\)\s*return \(\s*<Suspense fallback=\{null\}>\s*<FirstScreenFlow \/>/, '앱 /start 가 새 첫 화면(FirstScreenFlow)을 그리지 않는다')
  // ② 초안 = 설문은 가입 뒤(두 저장 모두) + 로그인 화면은 그 표식이면 강아지만 만들고 설문으로.
  const flow = stripComments(read(join(ROOT, 'app', 'start', 'first', 'FirstScreenFlow.tsx')))
  const saves = flow.match(/saveAutosignupDraft\(\{ dog: dogDraft[^)]*\)/g) ?? []
  assert.ok(saves.length >= 2, `새 첫 화면의 초안 저장을 찾지 못했다(${saves.length}곳)`)
  for (const s of saves) assert.ok(s.includes('surveyDeferred: true'), `새 첫 화면 초안 저장에 surveyDeferred 가 없다 — 로그인 경로가 기본값으로 분석을 만든다: ${s}`)
  const login = stripComments(read(join(ROOT, 'app', '(auth)', 'login', 'page.tsx')))
  assert.match(login, /if \(draft\.surveyDeferred\) \{\s*const deferredDogId = await createDogFromDraft\(/, '로그인 화면이 surveyDeferred 초안을 강아지만 만드는 길로 보내지 않는다')
  // ③ 사진 — 강아지 insert 뒤에 올리고(상한), 초안을 버릴 때 같은 키로 같이 버린다.
  const cd = stripComments(read(join(ROOT, 'lib', 'auth', 'createDogFromDraft.ts')))
  const insertAt = cd.indexOf('.insert(')
  const uploadAt = cd.indexOf('uploadHeldStartPhoto(supabase, userId, dogId)')
  assert.ok(insertAt > 0 && uploadAt > insertAt, '새 첫 화면 사진을 강아지가 만들어진 뒤에 올리지 않는다')
  assert.ok(cd.includes('Promise.race([uploadHeldStartPhoto('), '사진 올리기가 설문 입장을 붙잡는다(기다림 상한 없음)')
  const photoKey = /const KEY = '([^']+)'/.exec(read(join(ROOT, 'lib', 'start-photo.ts')))?.[1]
  assert.ok(photoKey, 'lib/start-photo 의 저장 키를 찾지 못했다')
  const draftSrc = stripComments(read(join(ROOT, 'lib', 'autosignup-draft.ts')))
  const clearAt = draftSrc.indexOf('export function clearAutosignupDraft')
  assert.ok(clearAt > 0, 'clearAutosignupDraft 를 찾지 못했다')
  assert.ok(draftSrc.slice(clearAt, clearAt + 600).includes(`localStorage.removeItem('${photoKey}')`), `초안을 버릴 때 들고 있던 사진(${photoKey})을 같이 버리지 않는다 — 다음에 만드는 강아지에 붙는다`)
  // ④ 둘러보기 표식 — 각 표식은 정해진 부품 한 곳에만 있고, 둘러보기가 그 표식을 비춘다.
  //    (JSX 속성만 센다 — 앞이 빈칸. 둘러보기 안의 선택자 문자열 '[data-tour=...]' 은 앞이 '[' 라 안 걸린다.)
  const expected: Record<string, string> = {
    plan: 'components/analysis/RecommendationBox.tsx',
    record: 'components/app/BottomTabBar.tsx',
    stats: 'components/v3/home/ActiveDogCard.tsx',
  }
  const found: Record<string, string[]> = {}
  for (const f of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'components')))) {
    const r = rel(f)
    if (r.includes('/design-check')) continue
    for (const m of stripComments(read(f)).matchAll(/\sdata-tour="([a-z-]+)"/g)) {
      const k = m[1]
      if (k) (found[k] ??= []).push(r)
    }
  }
  assert.deepEqual(Object.keys(found).sort(), Object.keys(expected).sort(), `둘러보기 표식이 바뀌었다: ${JSON.stringify(found)}`)
  for (const [k, file] of Object.entries(expected)) {
    assert.deepEqual(found[k], [file], `data-tour="${k}" 는 ${file} 한 곳에만 있어야 한다(지금: ${(found[k] ?? []).join(', ')})`)
  }
  const tour = stripComments(read(join(ROOT, 'components', 'v3', 'tour', 'ResultTour.tsx')))
  for (const k of Object.keys(expected)) assert.ok(tour.includes(`selector: '[data-tour="${k}"]'`), `둘러보기가 data-tour="${k}" 를 비추지 않는다`)
  // ⑤ 장착 — 결과 화면(시작·1단계·끝)은 시작 조건 값을 넘기고, 홈(2·3단계)은 진행 중일 때만 뜬다. 옛 튜토리얼은 없다.
  const av = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'analysis', 'AnalysisView.tsx')))
  assert.ok(av.includes('<ResultTour place="result" dogName={dog.name} fromSurvey={fromSurvey} analysisCount={totalCount} />'), '결과 화면에 둘러보기가 없다(또는 시작 조건 값 — 설문 직후·분석 수 — 을 안 넘긴다)')
  const dash = stripComments(read(join(ROOT, 'app', '(main)', 'dashboard', 'page.tsx')))
  assert.ok(dash.includes('<ResultTour place="home" />'), '홈에 둘러보기(2·3단계)가 없다 — 결과 화면에서 넘어온 둘러보기가 홈에서 끊긴다')
  const oldTutorial = walk(join(ROOT, 'app'))
    .concat(walk(join(ROOT, 'components')))
    .filter((f) => stripComments(read(f)).includes('OnboardingTutorial'))
    .map(rel)
  assert.deepEqual(oldTutorial, [], `옛 홈 튜토리얼이 남아 둘러보기와 겹쳐 뜬다: ${oldTutorial.join(', ')}`)
  // ⑥ 가입 직후 '가입 완료' 띠(Y7) — 가입하자마자 강아지가 만들어진 두 길만, 방금 만든 계정에만 표식을 붙이고,
  //    설문은 표식을 읽자마자 주소에서 지운다(새로고침·뒤로가기로 다시 뜨지 않게). 정확도 올리기엔 띄우지 않는다.
  const onboard = stripComments(read(join(ROOT, 'app', 'start', 'onboard', 'page.tsx')))
  assert.ok(onboard.includes('router.replace(surveyStartHref(dogId, isFreshAccount(user.created_at)))'), "카카오·애플 가입 직후 설문에 '가입 완료' 표식이 없다(또는 오래된 계정에도 붙는다)")
  assert.ok(login.includes('router.replace(surveyStartHref(deferredDogId, isFreshAccount(signedIn.created_at)))'), "이메일 가입 뒤 첫 로그인 설문에 '가입 완료' 표식이 없다(또는 오래된 계정에도 붙는다)")
  const sc = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'survey', 'SurveyClient.tsx')))
  assert.ok(sc.includes('q.delete(WELCOME_PARAM)') && sc.includes("window.history.replaceState(null, ''"), "설문이 '가입 완료' 표식을 주소에서 지우지 않는다 — 새로고침·뒤로가기마다 다시 뜬다")
  assert.ok(sc.includes("if (!refineMode) setWelcome('on')"), "정확도 올리기(추가 답변)에도 '가입 완료' 띠가 뜬다")
})

test('규칙171: 앱 레시피 제목 = 팩에 찍힌 영어 + 아래 회색 한글 상품 이름 · 체형 꼬리표는 겁주지 않는 말', () => {
  /**
   * 2026-10-10 사장님 결정(앱 새 디자인 결정 목록).
   *  · 레시피 이름이 '제목'으로 크게 나오는 자리 8곳은 팩에 찍힌 영어(CHICKEN · DUCK · BLACK PORK · HANWOO BEEF RECIPE)를
   *    크게, 바로 아래 회색으로 한글 상품 이름(products.name 과 같은 '닭고기 화식'…)을 쓴다 — 손님이 냉동실 팩과 앱을 바로
   *    맞춰 보게. 한글을 같이 두는 건 10/9 결정(부모님 세대가 영어를 못 읽는다)을 지키려는 것 — 영어만 남기면 안 된다.
   *    두 레시피를 한 줄에 잇는 자리(홈 배송 카드·정기배송 요약 등)는 한글 그대로(POUCH_NAME).
   *  · 설문 체형 판정 꼬리표: 심한 저체중·비만(1·8·9단계)은 '위험' 대신 '관리 필요'(색은 그대로 빨강).
   */
  const pouch = stripComments(read(join(ROOT, 'lib', 'design', 'pouch.ts')))
  for (const [k, en, ko] of [
    ['chicken', 'CHICKEN RECIPE', '닭고기 화식'],
    ['duck', 'DUCK RECIPE', '오리고기 화식'],
    ['pork', 'BLACK PORK RECIPE', '흑돼지 화식'],
    ['beef', 'HANWOO BEEF RECIPE', '한우 화식'],
  ] as const) {
    assert.ok(pouch.includes(`${k}: '${en}'`), `팩 영어 이름이 팩 글자와 다르다(${k} → ${en})`)
    assert.ok(pouch.includes(`${k}: '${ko}'`), `회색 한글이 상품 이름과 다르다(${k} → ${ko})`)
  }
  // 제목 자리 8곳 — 팩 영어 이름을 쓰고(직접 또는 recipeTitleOfLine), 한글 상품 이름도 같이 그린다.
  const TITLE_PLACES = [
    'components/analysis/magazine/BoxMixCard.tsx',
    'components/analysis/AdjustSheet.tsx',
    'app/(main)/dogs/[id]/plan/PlanClient.tsx',
    'app/(main)/dogs/[id]/order/OrderClient.tsx',
    'app/(main)/dogs/[id]/_components/CurrentFormulaCard.tsx',
    'app/mypage/orders/OrdersAppView.tsx',
    'app/mypage/orders/[id]/OrderDetailAppView.tsx',
    'app/mypage/orders/[id]/receipt/ReceiptAppView.tsx',
  ]
  for (const f of TITLE_PLACES) {
    const src = stripComments(read(join(ROOT, ...f.split('/'))))
    // recipeTitleOfLine 은 import 한 줄 + 쓰는 곳(직접 부르거나 map 에 넘기거나) — 두 번 이상 나와야 쓴 것이다.
    const usesTitle = (src.match(/\brecipeTitleOfLine\b/g) ?? []).length >= 2
    const usesEn = usesTitle || src.includes('POUCH_NAME_EN[')
    const usesKo = usesTitle || src.includes('POUCH_PRODUCT_KO[')
    assert.ok(usesEn && usesKo, `${f}: 레시피 제목이 '팩 영어 + 회색 한글'이 아니다`)
  }
  const display = stripComments(read(join(ROOT, 'components', 'analysis', 'display.ts')))
  assert.match(display, /return pouch \? \{ en: POUCH_NAME_EN\[pouch\], ko: POUCH_PRODUCT_KO\[pouch\] \}/, 'recipeTitleOfLine 이 팩 영어·한글 상품 이름을 같이 돌려주지 않는다')
  // 체형 꼬리표 — '위험' 금지.
  const body = stripComments(read(join(ROOT, 'app', '(main)', 'dogs', '[id]', 'survey', 'steps', 'Body.tsx')))
  assert.ok(!body.includes("tag: '위험'"), "설문 체형 꼬리표에 '위험'이 있다(사장님 10/10 — '관리 필요')")
  assert.equal((body.match(/tag: '관리 필요'/g) ?? []).length, 3, "체형 1·8·9단계 꼬리표가 '관리 필요'가 아니다")
})


test('규칙172: 웹 가게(단품) — 가게 주문은 결제위젯 가맹점 키로만 승인·환불·조회하고, 재고를 되돌리지 않으며, 금액은 서버가 상품표로 계산한다', () => {
  /**
   * # 왜 (2026-10-10 사장님 "웹 = 단품 가게"·"시안 숫자 그대로"·"회원만" — docs/WEB_STORE_RENEWAL_PLAN_2026_10.md)
   * ① 토스 가맹점이 둘이 됐다 — 정기결제(빌링) 계약과 웹 가게 일회 결제(결제위젯) 계약은 MID·비밀 키가 다르고, 결제는
   *    그 결제를 만든 가맹점 키로만 승인·환불·조회된다. 가게 주문(FTS-)을 빌링 키로 환불하면 결제를 못 찾아 **환불이 조용히
   *    실패**한다. 그래서 돈이 지나는 다섯 곳(승인·고객 취소·환불 재시도·웹훅·어드민 부분취소)이 주문번호로 가맹점을 가린다.
   * ② 재고 — 지금 재고를 잡는 경로는 없다. 예전 판정(subscription_id == null = 예약 주문)을 그대로 두면 가게 주문 취소·만료마다
   *    차감한 적 없는 재고가 유령처럼 는다(2026-08-08 정기배송에서 잡은 그 사고). 판정은 lib/commerce/stock-gate 하나.
   * ③ 금액 — 브라우저는 '무엇을 몇 개'만 보낸다. 서버가 상품표(cartSummary)로 계산해 주문을 만든다(고객은 orders 를 못 쓴다).
   * ④ 앱은 단품을 안 판다 — 상점 경로·주문 API 는 앱에서 막는다(웹/앱 절대 분리).
   * ⑤ 토스 공개 테스트 키는 미리보기·로컬 전용 — 운영(production)에선 절대 안 쓴다(키가 없으면 '결제 준비 중').
   */
  const toss = stripComments(read(join(ROOT, 'lib', 'payments', 'toss.ts')))
  assert.match(toss, /export function merchantForOrderNumber\(orderNumber: string \| null \| undefined\): TossMerchant \{\s*return isStoreOrderNumber\(orderNumber\) \? 'widget' : 'billing'/, '주문번호로 가맹점을 가리는 함수가 없다/바뀌었다')
  assert.match(toss, /if \(merchant === 'widget'\) \{[\s\S]{0,200}if \(process\.env\.VERCEL_ENV !== 'production'\) return TOSS_DOCS_TEST_WIDGET_SECRET_KEY\s*throw/, '운영에서도 토스 공개 테스트 키로 떨어질 수 있다')
  const orderNo = read(join(ROOT, 'lib', 'store', 'order-number.ts'))
  assert.match(orderNo, /export const STORE_ORDER_PREFIX = 'FTS-'/, "가게 주문번호 머리가 'FTS-' 가 아니다 — 정기배송('FT-')과 가려지지 않는다")

  // ① 돈이 지나는 다섯 곳이 가맹점을 가린다.
  const moneyPaths: [string, RegExp][] = [
    [join('app', 'api', 'payments', 'confirm', 'route.ts'), /const merchant = merchantForOrderNumber\(order\.order_number\)[\s\S]*confirmPayment\(\{ paymentKey, orderId, amount, merchant \}\)/],
    [join('app', 'api', 'orders', '[id]', 'cancel', 'route.ts'), /cancelPayment\(\{[\s\S]{0,200}merchant: merchantForOrderNumber\(order\.order_number\)/],
    [join('app', 'api', 'cron', 'refund-retry', 'route.ts'), /cancelPayment\(\{[\s\S]{0,1200}merchant: merchantForOrderNumber\(orderRow\?\.order_number\)/],
    [join('app', 'api', 'payments', 'webhook', 'route.ts'), /fetchPayment\(paymentKey, merchantForOrderNumber\(orderId\)\)/],
    [join('app', 'api', 'admin', 'orders', '[id]', 'partial-cancel', 'route.ts'), /tossSecretKey\(merchantForOrderNumber\(order\.order_number\)\)/],
  ]
  for (const [rel, re] of moneyPaths) {
    const src = stripComments(read(join(ROOT, rel)))
    assert.match(src, re, `${rel}: 가게 주문(FTS-)을 결제위젯 가맹점 키로 다루지 않는다 — 다른 가맹점 키로는 결제를 못 찾아 환불·승인이 실패한다`)
  }
  const confirm = stripComments(read(join(ROOT, 'app', 'api', 'payments', 'confirm', 'route.ts')))
  assert.equal((confirm.match(/cancelPayment\(\{[^}]*merchant,/g) ?? []).length, 2, '승인 라우트의 자동 환불 두 곳이 가맹점 키를 안 넘긴다')
  const partial = stripComments(read(join(ROOT, 'app', 'api', 'admin', 'orders', '[id]', 'partial-cancel', 'route.ts')))
  assert.doesNotMatch(partial, /process\.env\.TOSS_SECRET_KEY/, '어드민 부분취소가 빌링 키를 직접 읽는다 — 가게 주문 환불이 실패한다')

  // ② 재고 되돌림 판정은 정본 하나.
  const gate = read(join(ROOT, 'lib', 'commerce', 'stock-gate.ts'))
  assert.match(gate, /if \(isStoreOrderNumber\(o\.order_number\)\) return false/, '재고 판정이 가게 주문을 예약 주문으로 읽는다')
  for (const rel of [join('app', 'api', 'cron', 'order-expire', 'route.ts'), join('app', 'api', 'orders', '[id]', 'cancel', 'route.ts'), join('app', 'api', 'admin', 'orders', '[id]', 'partial-cancel', 'route.ts')]) {
    const src = stripComments(read(join(ROOT, rel)))
    assert.match(src, /const reservedStock = orderReservedStock\(/, `${rel}: 재고 되돌림이 정본(orderReservedStock)을 안 쓴다`)
    assert.doesNotMatch(src, /reservedStock\s*=\s*[^\n]*subscription_id\s*={2,3}\s*null/, `${rel}: 옛 판정(subscription_id == null)이 남아 가게 주문 재고가 유령처럼 는다`)
  }

  // ③ 금액은 서버가 상품표로.
  const api = stripComments(read(join(ROOT, 'app', 'api', 'store', 'orders', 'route.ts')))
  assert.match(api, /const lines = normalizeCart\(body\.lines\)/, '주문 API 가 장바구니를 상품표로 거르지 않는다')
  assert.match(api, /const summary = cartSummary\(lines\)/, '주문 API 가 금액을 상품표로 계산하지 않는다')
  assert.match(api, /total_amount: summary\.total/, '주문 금액이 서버 계산값이 아니다')
  assert.doesNotMatch(api, /body\.(amount|price|total|subtotal|shipping)/, '주문 API 가 브라우저가 보낸 금액을 읽는다')
  assert.match(api, /order_number: storeOrderNumber\(\)/, '가게 주문번호가 FTS- 머리로 만들어지지 않는다')
  assert.match(api, /if \(!user\) return NextResponse\.json\(\{ code: 'UNAUTHORIZED'/, '가게 주문이 비회원도 받는다(사장님 10/10 "회원만")')

  // ④ 앱에서는 가게가 없다.
  assert.match(api, /if \(await isAppContextServer\(\)\) \{\s*return NextResponse\.json\(\{ code: 'APP_NOT_STORE'/, '앱에서 가게 주문이 만들어진다')
  const storeLayout = stripComments(read(join(ROOT, 'app', 'store', 'layout.tsx')))
  assert.match(storeLayout, /if \(await isAppContextServer\(\)\) redirect\('\/dashboard'\)/, '앱에서 상점 화면이 열린다(앱은 단품을 안 판다)')

  // ⑤ 운영은 테스트 키를 쓰지 않는다(브라우저 쪽).
  const widget = read(join(ROOT, 'lib', 'store', 'toss-widget.ts'))
  assert.match(widget, /return process\.env\.VERCEL_ENV === 'production' \? null : TOSS_DOCS_TEST_WIDGET_CLIENT_KEY/, '운영에서 결제위젯이 토스 공개 테스트 키로 열린다')
  const design = stripComments(read(join(ROOT, 'app', 'design-check-store', 'page.tsx')))
  assert.match(design, /if \(process\.env\.VERCEL_ENV === 'production'\) notFound\(\)/, '가게 점검 화면이 운영에서 열린다')
})

test('규칙173: 앱 로딩 꼬리는 영상이 막혀도 움직인다 — 아이폰 저전력 모드(play() 거절)·옛 웹뷰는 꼬리 그림 장면으로', () => {
  /**
   * # 왜 (2026-10-10 사장님 아이폰 화면 "왜또 꼬리가 안움직여" — 배터리 아이콘이 노란색 = 저전력 모드)
   * 꼬리는 영상(mp4)으로만 움직였다. 아이폰 저전력 모드는 영상 재생(play())을 거절한다(WebKit 버그 216887 —
   * Capacitor 앱도 같다). 그러면 정지 도장만 남고 점(CSS)만 돌았다. 장면 신호(requestVideoFrameCallback)가 없는 옛 웹뷰는
   * 아예 정지 도장이었다. 그림·CSS 애니메이션은 안 막힌다 → 영상이 거절·오류면(옛 웹뷰는 처음부터) 꼬리가 움직이는
   * 네모만 51장면 묶음 그림을 CSS 가 넘기고, 영상 앞 장면의 도장 '쿵'도 CSS 로 같이 한다.
   * 헤드리스 엣지에서 play() 를 거절시켜 51장면이 다 넘어가는 것을 확인했다(정상일 땐 영상, 그림은 안 받는다).
   */
  const splash = read(join(ROOT, 'components', 'AppSplash.tsx'))
  // ① 영상 재생이 거절되면 꼬리 그림으로 — 거절을 삼키기만 하면(예전 p.catch(function(){})) 꼬리가 멈춘다.
  assert.match(splash, /if\(rvfc\)\{var p=wag\.play\(\);if\(p&&p\.catch\)p\.catch\(function\(\)\{startTail\(\)\}\)\}else startTail\(\)/, '영상 재생이 거절되면(아이폰 저전력 모드) 꼬리가 멈춘다 — 꼬리 그림 장면으로 넘어가지 않는다')
  assert.match(splash, /wag\.addEventListener\('error',function\(\)\{startTail\(\)\}\)/, '영상 오류에도 꼬리 그림 장면으로 안 넘어간다')
  // ② 움직임 줄이기만 정지 — 장면 신호(rvfc)가 없다고 정지시키지 않는다(그건 그림 장면으로).
  assert.match(splash, /var calm=!!\(window\.matchMedia&&matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\);/, '움직임 줄이기 말고도 꼬리를 멈추는 조건이 섞였다(옛 웹뷰는 그림 장면으로 돌아야 한다)')
  // ③ 꼬리 그림은 다 풀린 뒤에만 보이고, 옛 셸은 종이색 그림 — 영상이 이미 돌면 그림을 안 받는다(정상일 땐 영상만).
  assert.match(splash, /var startTail=function\(\)\{if\(tailOn\|\|wagOn\|\|gone\|\|calm\|\|!tail\)return;/, '영상이 도는데도 꼬리 그림을 받거나, 로딩이 걷힌 뒤에 받는다')
  assert.match(splash, /var src=\(oldShell&&tail\.getAttribute\('data-src-paper'\)\)\|\|tail\.getAttribute\('data-src'\)/, '옛 셸에 흰 바탕 꼬리 그림을 띄운다')
  assert.match(splash, /\(im\.decode\?im\.decode\(\):[^)]*\)[^)]*\)\)\.then\(function\(\)\{if\(gone\)return;tail\.style\.backgroundImage='url\('\+src\+'\)';el\.classList\.add\('ft-splash--tail'\)\}/, '꼬리 그림이 다 풀리기 전에 보인다(빈 칸이 정지 도장을 가린다)')
  // '쿵' 칸을 연 뒤 닫히기(</div>) 전에 정지 도장·꼬리 칸이 둘 다 있어야 한다(카나리아: 꼬리 칸을 밖으로 빼면 빨강).
  assert.match(splash, /<div className="ft-splash__bob">(?:(?!<\/div>)[\s\S])*?className="ft-splash__still"(?:(?!<\/div>)[\s\S])*?<div className="ft-splash__tail" data-src=\{SPLASH_TAIL_SRC\} data-src-paper=\{PAPER_SHELL_TAIL_SRC\} \/>/, '정지 도장과 꼬리 칸이 같은 \'쿵\' 칸 안에 없다 — 커질 때 꼬리가 어긋난다')
  // ④ 두 벌의 그림이 실제로 있고 서로 다르며, 저전력일 때만 받는 대신 너무 크지 않다.
  const srcOf = (k: string) => splash.match(new RegExp('export const ' + k + " = '([^']+)'"))?.[1] ?? ''
  for (const k of ['SPLASH_TAIL_SRC', 'PAPER_SHELL_TAIL_SRC']) {
    const src = srcOf(k)
    const p = join(ROOT, 'public', ...src.split('/').filter(Boolean))
    assert.ok(src && existsSync(p), k + '(' + src + ') 파일이 없다')
    assert.ok(statSync(p).size < 300 * 1024, k + ' 꼬리 그림이 300KB 를 넘는다 — 로딩이 걷히기 전에 못 받는다')
  }
  assert.notEqual(srcOf('SPLASH_TAIL_SRC'), srcOf('PAPER_SHELL_TAIL_SRC'), '흰 바탕·종이색 꼬리 그림이 같은 파일이다')
  // ⑤ CSS — 51장면을 1.7초(영상과 같은 길이)에 한 칸씩, 도장 '쿵'도 같은 1.7초.
  const css = stripComments(read(join(ROOT, 'app', 'globals.css')))
  assert.match(css, /\.ft-splash--tail \.ft-splash__tail \{\s*opacity: 1;\s*animation: ft-tail-frames 1\.7s steps\(1, end\) infinite;/, '꼬리 그림 장면이 영상과 같은 1.7초 장면 넘기기로 돌지 않는다')
  assert.match(css, /\.ft-splash--tail \.ft-splash__bob \{\s*animation: ft-tail-bob 1\.7s linear infinite;/, '꼬리 그림 장면일 때 도장 \'쿵\'이 없다')
  const frames = css.match(/@keyframes ft-tail-frames \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.equal((frames.match(/background-position:/g) ?? []).length, 51, '꼬리 그림 장면이 51장이 아니다(영상과 장면 수가 다르다)')
  assert.match(css, /\.ft-splash__tail \{[^}]*opacity: 0;/, '꼬리 칸이 처음부터 보인다 — 그림이 오기 전 빈 칸이 정지 도장을 가린다')
})

test('규칙174: 레시피 QR 화면(웹 C01) — 재료 이름은 정본에서 · "이 레시피에만"은 첫째 토핑만 · 사기 줄·앱 띠는 웹만 · 성분 % 없음 · 없어진 웹 설문을 가리키지 않는다', async () => {
  /**
   * # 왜 (2026-10-10 웹 리뉴얼)
   * 옛 QR 화면의 원장(RECIPE_LEDGER)은 사장님 확정 배합표(lib/recipe-ingredients)와 따로 손으로 적혀 있어서 토핑을 하나씩
   * 빠뜨리고(오리 애호박·흑돼지 양배추·한우 비트) '브로콜리·블루베리는 치킨 레시피에만'이라 했다 — 블루베리는 한우에도 있다.
   * 닭 알레르기 답은 "오리 레시피를 안내해 드려요"였지만 앱은 닭 알레르기에 오리를 '비슷한 단백질 주의'로 표시하고, 가게 상품
   * 화면은 흑돼지·한우를 권한다. 웹 설문은 앱으로 옮겼는데 답마다 '설문'을 가리켰다.
   */
  const page = stripComments(read(join(ROOT, 'app', 'recipe', '[protein]', 'page.tsx')))
  const detailSrc = stripComments(read(join(ROOT, 'lib', 'recipe-detail.ts')))
  // ① 재료 이름은 정본에서 — 손으로 적은 원장이 돌아오면 또 어긋난다.
  assert.ok(detailSrc.includes('RECIPE_INGREDIENTS[SKU_MODEL[p].legacyLine]') && !/RECIPE_LEDGER/.test(detailSrc + page), '주요 재료 이름을 정본(lib/recipe-ingredients) 대신 손으로 적는다')
  const { recipeLedger } = await import('./recipe-detail.ts')
  const { RECIPE_INGREDIENTS } = await import('./recipe-ingredients.ts')
  const lines = { chicken: 'weight', duck: 'basic', pork: 'joint', beef: 'premium' } as const
  const heroes = Object.values(lines).map((l) => RECIPE_INGREDIENTS[l]!.toppings[0])
  const supports = Object.values(lines).map((l) => RECIPE_INGREDIENTS[l]!.toppings[1])
  // ② "○○는 이 레시피에만 들어가요" 는 첫째 토핑이 4종에서 한 번씩만 나올 때만 참이다.
  assert.equal(new Set(heroes).size, 4, '첫째 토핑이 두 레시피에 겹친다 — "이 레시피에만" 이 거짓이 된다')
  assert.ok(heroes.every((h) => !supports.includes(h)), '첫째 토핑이 다른 레시피의 둘째 토핑으로도 들어간다 — "이 레시피에만" 이 거짓이 된다')
  for (const [p, l] of Object.entries(lines)) {
    const ing = RECIPE_INGREDIENTS[l]!
    const rows = recipeLedger(p as keyof typeof lines)
    const all = [ing.main, ...ing.organs, ...ing.veg, ...ing.toppings, ...ing.base].join(' ')
    for (const r of rows) for (const name of r.name.split(' · ')) assert.ok(name && all.includes(name), `${p} 주요 재료 '${name}' 가 정본 원재료에 없다`)
    assert.equal(rows.find((r) => r.label === '토핑')?.name, ing.toppings.join(' · '), `${p} 토핑 줄이 정본 토핑 2종과 다르다`)
  }
  // ③ 전체 원재료는 정본 함수 그대로(규칙127과 같은 줄).
  assert.ok(page.includes('fullIngredientNames(PROTEIN_LINE[key]).join'), '전체 원재료를 정본 목록 대신 다른 데서 그린다')
  // ④ 사기 줄(/store)·앱 띠(/app)는 웹만 — 앱은 단품을 팔지 않고, /store 는 앱에서 앱 홈으로 튕긴다.
  assert.match(page, /\{!isApp && \(\s*<Link\s+href=\{`\/store\/\$\{key\}`\}/, "'이 레시피 사기' 줄이 앱에도 보인다")
  assert.match(page, /\{isApp \? \([\s\S]{0,200}?\) : \([\s\S]{0,600}?href="\/app"/, "'앱에서 할인' 띠가 앱에도 보인다")
  // ⑤ 성분 % 는 싣지 않는다(검사 결과 전 — 가게 상품 화면과 같은 말).
  assert.ok(!/\d\s*%\s*이[상하]/.test(page) && !/조단백|조지방|조섬유|조회분/.test(page), 'QR 화면에 등록성분 숫자(% 이상·이하)를 싣는다')
  // ⑥ 웹 설문은 앱으로 옮겼다 — 고객 문구가 '설문'·/start 를 가리키지 않는다. 닭 알레르기에 오리를 권하지 않는다.
  assert.ok(!/설문/.test(page) && !/설문/.test(detailSrc) && !/href="\/start/.test(page), 'QR 화면 문구가 없어진 웹 설문을 가리킨다')
  assert.ok(!/오리 레시피를 안내/.test(detailSrc), '닭 알레르기 답이 오리를 권한다(앱은 오리를 비슷한 단백질 주의로, 가게는 흑돼지·한우를 권한다)')
})

test('규칙175: 아이폰 앱 링크(AASA)는 웹 가게·행사·링크 모음을 앱으로 열지 않는다 — 제외가 전체 허용보다 먼저', () => {
  /**
   * # 왜 (2026-10-10 웹 리뉴얼, 기획서 §6)
   * AASA 가 /admin·/api 말고 전부(/*)를 앱으로 열어서, 앱이 깔린 아이폰에서 가게(/store) 링크를 누르면 앱이 열리고
   * 앱은 /store 를 앱 홈으로 보낸다 — 가게에서 살 길이 없어진다. 단품은 웹에서만 판다(앱은 맞춤·정기배송).
   * Apple 은 components 를 위에서부터 첫 일치로 판정하므로 제외 줄이 전체 허용('/*')보다 앞에 있어야 한다.
   */
  const src = stripComments(read(join(ROOT, 'app', '.well-known', 'apple-app-site-association', 'route.ts')))
  const allowAt = src.indexOf("{ '/': '/*' }")
  assert.ok(allowAt > 0, "AASA 의 전체 허용 줄({ '/': '/*' })을 못 찾았다 — 검사가 망가졌다")
  for (const p of ['/store', '/store/*', '/p/*', '/link']) {
    const at = src.indexOf(`{ '/': '${p}', exclude: true }`)
    assert.ok(at > 0 && at < allowAt, `AASA 가 ${p} 를 앱으로 연다(제외 줄이 없거나 전체 허용보다 뒤에 있다)`)
  }
})
