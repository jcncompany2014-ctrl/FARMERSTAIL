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
