import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

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

test('★ 규칙7: vercel.json 크론은 전부 하루 1회 이하', () => {
  // 넘으면 Vercel 이 요금 한도로 **빌드 시작을 거부**한다. Vercel 쪽에 배포 기록이
  // 아예 안 생겨서 진단이 어렵다(2026-07-30 실제로 겪음 — 커밋 3개가 조용히 미반영).
  const cfg = JSON.parse(read(join(ROOT, 'vercel.json'))) as {
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

  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app'))
    .concat(walk(join(ROOT, 'lib')))
    .concat(walk(join(ROOT, 'components')))) {
    const src = read(file)
    const re = /\.from\(\s*'(\w+)'\s*\)\s*\n?\s*\.select\(\s*([`'"])([\s\S]*?)\2/g
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
    const src = read(file)
    for (const m of src.matchAll(/\.from\(\s*'(\w+)'\s*\)([\s\S]{0,900})/g)) {
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
    if (!src.includes("from('orders')")) continue
    const re = /(\w+)\s*\n?\s*\)?\s*\.from\(\s*'orders'\s*\)\s*\.(update|delete|upsert)\(/g
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
        // `const X = Y as unknown as ...` → Y 를 따라간다.
        const alias = new RegExp(
          `(?:const|let)\\s+${name}\\s*=\\s*\\(?\\s*(\\w+)\\s+as\\s+unknown`,
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
      at: 'app/api/cron/daily-briefing/route.ts:89',
      why: "'발송했는데 7일째 배송중' 집계 — order_status='shipping' 자체가 결제 완료 이후 상태다",
    },
  ]

  const offenders: string[] = []
  for (const file of walk(join(ROOT, 'app/api')).concat(walk(join(ROOT, 'lib')))) {
    const src = read(file)
    if (!src.includes("from('orders')")) continue
    // .from('orders').select(..., { count: 'exact' }) 뒤에 이어지는 필터 체인을 본다.
    const re = /\.from\('orders'\)\s*\n?\s*\.select\([^\n]*count:\s*'exact'/g
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

test('★ 규칙23: 토스페이 기본 켜짐이면 출시 전 확인 문단이 살아 있어야 한다', () => {
  /**
   * # 왜
   * 토스페이는 토스가 아직 거절한다("토스페이 자동결제 결제수단 설정이 없습니다").
   * 그런데 사장님이 화면을 계속 보셔야 해서 **기본 켜짐**으로 돌렸다
   * (2026-07-31, 출시 전이라 감수하는 노출).
   *
   * 위험은 **잊는 것**이다 — 출시 날 고객이 토스페이를 누르면 그 자리에서 실패한다.
   * 그래서 코드 기본값과 리허설 문서의 "출시 전 반드시" 문단을 **묶는다**:
   * 기본이 켜짐인 동안 그 문단이 사라지면 테스트가 깨진다.
   *
   * 나중에 토스가 설정을 켜 주거나 기본을 다시 끄면, 이 규칙도 같이 정리한다 —
   * 그때는 문단이 없어져도 되는 상태다.
   */
  const src = stripComments(read(join(ROOT, 'lib/payments/billing-methods.ts')))
  const defaultsOn = /NEXT_PUBLIC_TOSSPAY_BILLING\s*!==\s*'off'/.test(src)
  if (!defaultsOn) return // 기본 꺼짐으로 되돌렸다면 이 규칙은 할 일이 없다

  const doc = read(join(ROOT, 'PAYMENT_REHEARSAL.md'))
  assert.match(
    doc,
    /출시 전 반드시 확인: 토스페이 노출/,
    '토스페이가 기본 켜짐인데 리허설 문서의 "출시 전 반드시 확인" 문단이 없다 — ' +
      '토스가 아직 거절하는 수단이라, 이 안내가 사라지면 출시 날 고객이 실패를 만난다',
  )
  assert.match(
    doc,
    /NEXT_PUBLIC_TOSSPAY_BILLING=off/,
    '끄는 방법(NEXT_PUBLIC_TOSSPAY_BILLING=off)이 문서에 없다 — 켜 둔 채로 ' +
      '출시하지 않으려면 끄는 길이 적혀 있어야 한다',
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
