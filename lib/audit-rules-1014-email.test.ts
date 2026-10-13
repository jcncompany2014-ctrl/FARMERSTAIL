/**
 * 2026-10-14 메일 새 디자인('A 포스터') 묶음의 규칙 225~229 (가지 design/1014-email).
 *
 * 사장님 10/14: "우리 이메일 템플릿도 새로운 디자인으로 다 바꿔야 돼." — 모든 메일을 공용 틀(lib/email/layout.ts
 * renderLayout) 하나로 그리게 했다. 문구·링크·법정 표시는 그대로이고, 아래 규칙이 그걸 지킨다.
 *
 * 문서에만 적은 규칙은 같은 날 또 어긴다 — 고친 것을 테스트로 박는다. 각 규칙은 고치기 전 코드(5866b6c8)에서는 빨간불,
 * 지금 코드에서는 초록불인지 검산했다(카나리아 — 보고서에 결과).
 * 카나리아 실행: AUDIT_ROOT=<옛 파일을 같은 경로로 풀어 둔 폴더> 로 이 파일을 돌리면 그 폴더를 읽는다(그 폴더는 저장소 안에 두어야
 * 패키지를 찾는다).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()

function read(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n')
}

/** 주석을 걷어낸 본문 — 주석 속 설명이 규칙에 걸리지 않게(lib/audit-rules.test.ts 와 같은 방식). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git' || name === '.claude') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mts|mjs)$/.test(name) && !name.includes('.test.')) out.push(p)
  }
  return out
}

function rel(p: string): string {
  return p.replace(ROOT, '').split(sep).join('/').replace(/^\//, '')
}

/** 모듈을 ROOT 에서 읽는다 — 없으면 null(옛 트리 카나리아에서 새 모듈은 없다). */
async function tryLoad<T>(relPath: string): Promise<T | null> {
  const file = join(ROOT, relPath)
  if (!existsSync(file)) return null
  return (await import(pathToFileURL(file).href)) as T
}

type Mail = { id: string; subject: string; html: string; ad: boolean }

/**
 * 'A 포스터' 메일 팔레트 — 메일에 나오는 색은 이것뿐이다(규칙228). lib/email/layout.ts EMAIL_COLORS 와 같아야 한다.
 * 먹 · 본문 · 보조 · 선 · 회색 면 · 머스터드 · 빨강(한우) · 흰 · 먹 위 글자 둘.
 */
const POSTER_PALETTE = ['#141414', '#3D3D3D', '#595959', '#E5E5E5', '#F6F4F5', '#D4A24C', '#B5573A', '#FFFFFF', '#BDBDBD', '#9A9A9A']

/** 옛 크림·베이지 바탕과 옛 갈색·초록 브랜드 색 — 메시지에 이름을 붙이려고 따로 적는다. */
const OLD_CREAM = ['#F5F0E6', '#F7F5F0', '#FAF6EE', '#FAF6EC', '#EFEADF', '#DCD6C4', '#E6DDC8', '#E8E2D5', '#F0EADB', '#ECEAE2', '#FFF6E0', '#FBEEE8', '#FBE8E5', '#F0F4E6']

const MAIL = 'hello@example.com'

/** 인증 메일마다 남아 있어야 하는 Supabase 변수 — 링크 형식(token_hash · ConfirmationURL)은 옛 파일 그대로. */
const AUTH_VARS: Record<string, string[]> = {
  'confirm-signup.html': ['{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=signup'],
  'reset-password.html': ['{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&amp;type=recovery', '{{ .Email }}'],
  'change-email.html': ['href="{{ .ConfirmationURL }}"', '{{ .Email }}'],
  'magic-link.html': ['href="{{ .ConfirmationURL }}"', '{{ .Email }}'],
}

/**
 * 템플릿 폴더의 모든 render* 함수를 예시 값(보호자님·땅콩)으로 그린다. 예시가 없는 render* 함수가 생기면
 * missing 에 이름이 남는다 — 규칙225 가 빨간불을 낸다(새 메일이 이 규칙들 밖으로 새지 않게).
 */
async function renderAll(): Promise<{ mails: Mail[]; missing: string[] }> {
  const mails: Mail[] = []
  const missing: string[] = []
  const add = (id: string, r: { subject: string; html: string }) => mails.push({ id, subject: r.subject, html: r.html, ad: r.subject.startsWith('(광고)') })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyMod = Record<string, any>
  const SAMPLES: Record<string, (m: AnyMod) => void> = {
    'orders.ts': (m) => {
      const base = { orderId: 'o1', orderNumber: 'FTS-20261014-K7P2QX', recipientName: '보호자', totalAmount: 42900, items: [{ product_name: '닭고기 화식 500g', quantity: 1, line_total: 24000 }, { product_name: '4종 체험팩', quantity: 1, line_total: 13900 }] }
      add('renderOrderConfirmation', m.renderOrderConfirmation({ ...base, shippingFee: 5000, paymentMethodLabel: '카드' }))
      add('renderVirtualAccountWaiting', m.renderVirtualAccountWaiting({ ...base, bankCode: '88', accountNumber: '56211234567890', accountHolder: '파머스테일', dueDate: '2026-10-16T23:59:59+09:00' }))
      add('renderOrderShipped', m.renderOrderShipped({ ...base, carrier: 'cj', trackingNumber: '689012345678' }))
      add('renderOrderDelivered', m.renderOrderDelivered(base))
      add('renderOrderCancelled', m.renderOrderCancelled({ ...base, reason: '고객 요청', refundAmount: 42900 }))
      add('renderWelcome', m.renderWelcome({ recipientName: '보호자' }))
    },
    'subscription.ts': (m) => {
      add('renderSubscriptionReminder', m.renderSubscriptionReminder({ recipientName: '보호자', items: [{ productName: '닭고기 화식', quantity: 7 }], nextDeliveryDate: '2026-10-20', chargeDate: '2026-10-17', daysBefore: 2, chargeAmount: 60690 }))
      add('renderSubscriptionChargeFailed', m.renderSubscriptionChargeFailed({ recipientName: '보호자', productLabel: '닭고기 화식', amount: 60690, attemptCount: 3, paused: true, reason: '잔액이 부족해요' }))
      add('renderTrialPriceChange', m.renderTrialPriceChange({ recipientName: '보호자', nextPhase: 'full', nextChargeDate: '2026-11-28', nextShipDate: '2026-12-01', nextAmount: 60690 }))
    },
    'newsletter.ts': (m) => {
      add('renderNewsletterConfirm', m.renderNewsletterConfirm({ email: MAIL, confirmToken: 'tok1' }))
      add('renderUnsubscribeAck', m.renderUnsubscribeAck({ email: MAIL, channel: 'email' }))
      add('renderConsentResult', m.renderConsentResult({ channels: ['email'], granted: false, at: '2026-10-14T10:30:00+09:00' }))
    },
    'newsletter-welcome.ts': (m) => add('renderNewsletterWelcome', m.renderNewsletterWelcome({ email: MAIL, unsubscribeToken: 'unsub_tok' })),
    'newsletter-vol-01.ts': (m) => add('renderNewsletterVol01', m.renderNewsletterVol01({ email: MAIL, unsubscribeToken: 'unsub_tok' })),
    'personalization-cycle.ts': (m) => {
      add('renderPersonalizationCycle', m.renderPersonalizationCycle({ recipientName: '보호자', dogName: '땅콩', dogId: 'd1', cycleNumber: 2, recipeLabel: '치킨·오리 레시피', reasoningLabels: ['체중 유지'] }))
      add('renderPersonalizationApprovalNeeded', m.renderPersonalizationApprovalNeeded({ recipientName: '보호자', dogName: '땅콩', recipeLabel: '치킨·흑돼지 레시피', days: 3, priceFrom: 60690, priceTo: 64855, forced: false, ctaPath: '/account/subscriptions', ctaLabel: '확인하기' }))
      add('renderPersonalizationKeptPrevious', m.renderPersonalizationKeptPrevious({ recipientName: '보호자', dogName: '땅콩', days: 5 }))
    },
    'quarterly-report.ts': (m) => add('renderQuarterlyReport', m.renderQuarterlyReport({ recipientName: '보호자', dogName: '땅콩', dogId: 'd1', quarterLabel: '2026년 4분기', weightKg: 10.4, bcsLabel: '이상적인 편', feedG: 248, merKcal: 612, proteinPct: 31, fatPct: 14 })),
    'contact.ts': (m) => {
      add('renderContactAdmin', m.renderContactAdmin({ name: '보호자', email: MAIL, categoryLabel: '정기배송', message: '땅콩이 박스를 미루고 싶어요.' }))
      add('renderContactAck', m.renderContactAck({ categoryLabel: '정기배송' }))
    },
    'ops-digest.ts': (m) => add('renderOpsDigest', m.renderOpsDigest({
      failures: [], cronErrors: [{ path: '/api/cron/x', error_message: 'timeout', executed_at: '2026-10-14T03:00:00+09:00' }],
      refundRows: [], refundPending: 0, refundPermFailed: 0, staleOrders: [], lowStock: [], lowStockThreshold: 5, generatedAt: Date.parse('2026-10-14T08:00:00+09:00'),
    })),
    'auth.ts': (m) => {
      for (const f of m.AUTH_TEMPLATE_FILES as string[]) add('renderAuthTemplate', { subject: `[auth] ${f}`, html: m.renderAuthTemplate(f) })
    },
  }
  const dir = join(ROOT, 'lib', 'email', 'templates')
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
  for (const f of files) {
    const m = await tryLoad<AnyMod>(`lib/email/templates/${f}`)
    if (!m) continue
    const sample = SAMPLES[f]
    if (!sample) {
      missing.push(`${f} (예시 없음)`)
      continue
    }
    const before = mails.length
    sample(m)
    const rendered = new Set(mails.slice(before).map((x) => x.id))
    for (const name of Object.keys(m).filter((k) => /^render[A-Z]/.test(k) && typeof m[k] === 'function')) {
      if (!rendered.has(name)) missing.push(`${f} ${name} (예시 없음)`)
    }
  }
  for (const f of Object.keys(SAMPLES)) if (!files.includes(f)) missing.push(`lib/email/templates/${f} (파일 없음)`)
  return { mails, missing }
}

let cached: Promise<{ mails: Mail[]; missing: string[] }> | null = null
const all = () => (cached ??= renderAll())

/** Supabase 인증 메일 원본(대시보드에 붙여 넣는 HTML) — 우리 서버가 아니라 Supabase 가 보낸다. */
function supabaseAuthFiles(): Array<{ file: string; html: string }> {
  const dir = join(ROOT, 'supabase', 'email-templates')
  return readdirSync(dir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => ({ file: f, html: readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n') }))
}

/** 메일 HTML 안의 색 값(#RGB·#RRGGBB) 전부 — 대문자 6자리로. */
function hexColors(html: string): string[] {
  return [...html.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z])/g)].map((m) => {
    const h = m[1]!.toUpperCase()
    return `#${h.length === 3 ? h.split('').map((c) => c + c).join('') : h}`
  })
}

function luminance(hex: string): number {
  const n = hex.replace('#', '')
  const ch = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!
}

function contrastOnWhite(hex: string): number {
  return (1 + 0.05) / (luminance(hex) + 0.05)
}

test('규칙225: 모든 메일이 공용 틀(renderLayout — A 포스터) 하나로 그려진다 · 손으로 쓴 메일 HTML 이 없다 · Supabase 인증 메일 4종도 같은 틀에서 만든다', async () => {
  /**
   * # 왜 (2026-10-14 사장님 — "이메일 템플릿도 새로운 디자인으로 다 바꿔야 돼")
   * 메일은 틀이 세 갈래였다 — lib/email/layout(갈색·테라코타·Pretendard 세리프 제목), 문의 라우트가 직접 그린 크림 바탕(#FAF6EE),
   * Supabase 인증 메일 4종의 베이지 바탕(#F5F0E6, 대시보드에 붙이는 HTML). 하나만 바꾸면 나머지가 옛 모습으로 남는다.
   * 이제 메일 HTML 은 lib/email/templates 의 render* 함수만 만들고, 그 함수들은 renderLayout 하나를 쓴다.
   */
  const { mails, missing } = await all()
  assert.deepEqual(missing, [], `예시가 없거나 빠진 메일 템플릿 — 이 파일 renderAll 의 SAMPLES 에 넣을 것:\n${missing.join('\n')}`)
  assert.ok(mails.length >= 25, `그린 메일이 ${mails.length}통뿐이다(카나리아)`)
  for (const m of mails) {
    assert.equal((m.html.match(/data-ft-frame="poster"/g) ?? []).length, 1, `${m.id}: 공용 틀(A 포스터)로 그려지지 않았다`)
  }

  // 템플릿 파일은 renderLayout 을 부르고, 스스로 <html>·<body> 를 그리지 않는다.
  for (const f of readdirSync(join(ROOT, 'lib', 'email', 'templates')).filter((n) => n.endsWith('.ts') && !n.includes('.test.'))) {
    const src = stripComments(read('lib', 'email', 'templates', f))
    assert.ok(src.includes('renderLayout('), `lib/email/templates/${f}: 공용 틀(renderLayout)을 쓰지 않는다`)
    assert.ok(!/<html|<body|<!doctype/i.test(src), `lib/email/templates/${f}: 메일 HTML 을 직접 그린다`)
  }

  // sendEmail 을 부르는 곳(라우트·크론·스크립트)은 메일 HTML 을 손으로 쓰지 않는다 — 템플릿 함수가 만든 것만 보낸다.
  const handWritten: string[] = []
  for (const f of [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib')), ...walk(join(ROOT, 'scripts'))]) {
    const r = rel(f)
    if (r.startsWith('lib/email/')) continue
    const src = stripComments(readFileSync(f, 'utf8'))
    if (!/\bsendEmail\(/.test(src)) continue
    if (/<html|<body|<!doctype|<table/i.test(src)) handWritten.push(r)
  }
  assert.deepEqual(handWritten, [], `메일 HTML 을 손으로 쓰는 발송처 — lib/email/templates 로 옮길 것:\n${handWritten.join('\n')}`)

  // Supabase 인증 메일 4종 = 공용 틀로 만든 결과와 같다(틀을 바꾸고 파일을 다시 안 만들면 빨간불).
  const auth = await tryLoad<typeof import('./email/templates/auth.ts')>('lib/email/templates/auth.ts')
  assert.ok(auth, 'lib/email/templates/auth.ts 가 없다 — Supabase 인증 메일이 공용 틀 밖에 있다')
  const files = supabaseAuthFiles()
  assert.deepEqual(files.map((x) => x.file).sort(), auth.AUTH_TEMPLATE_FILES.map((f) => `${f}.html`).sort(), 'Supabase 인증 메일 파일 목록이 다르다')
  const normYear = (s: string) => s.replace(/© \d{4}/g, '© YEAR')
  for (const { file, html } of files) {
    assert.match(html, /data-ft-frame="poster"/, `supabase/email-templates/${file}: 공용 틀이 아니다`)
    const expected = auth.renderAuthTemplate(file.replace(/\.html$/, '') as (typeof auth.AUTH_TEMPLATE_FILES)[number])
    assert.equal(
      normYear(html),
      normYear(expected),
      `supabase/email-templates/${file}: 공용 틀로 다시 만든 결과와 다르다 — node --experimental-strip-types scripts/build-email-auth-templates.ts`,
    )
    for (const v of AUTH_VARS[file] ?? []) {
      assert.ok(html.includes(v), `supabase/email-templates/${file}: Supabase 변수 ${v} 가 사라졌다`)
    }
  }
})

test('규칙226: 광고 메일은 제목 머리 (광고) · 수신거부 링크(토큰)·원클릭 헤더가 남아 있고, 수신거부 안내는 읽히는 크기·대비다', async () => {
  /**
   * # 왜 (정보통신망법 §50④ — 광고 표시, §50⑦ — 수신거부를 쉽게 할 수 있게)
   * 디자인만 바꾸는 작업이 법정 표시를 지우면 안 된다. 그리고 예전 수신거부 안내는 10px 연회색(#9A9A9A, 흰 바탕 대비 2.8:1)이라
   * '쉽게 알아볼 수 있게'에 못 미쳤다 — 새 틀은 13px · 대비 4.5:1 이상(block.fine)으로 그린다.
   */
  const { mails } = await all()
  const ads = mails.filter((m) => m.ad)
  const adIds = ads.map((m) => m.id).sort()
  assert.deepEqual(adIds, ['renderNewsletterVol01', 'renderNewsletterWelcome'], `광고 메일 목록이 바뀌었다(제목 '(광고)' 머리를 잃었거나 새로 생겼다): ${adIds.join(', ')}`)
  for (const m of ads) {
    assert.ok(m.subject.startsWith('(광고) '), `${m.id}: 제목이 '(광고)' 로 시작하지 않는다`)
    assert.match(m.html, /\/api\/newsletter\/unsubscribe\?token=unsub_tok"/, `${m.id}: 본문에 수신거부 링크(토큰)가 없다`)
    const at = m.html.indexOf('수신거부</a>')
    assert.ok(at > 0, `${m.id}: '수신거부' 링크 글자가 없다`)
    const head = m.html.slice(0, at)
    const open = Math.max(head.lastIndexOf('<div style="'), head.lastIndexOf('<p style="'))
    const style = head.slice(open, head.indexOf('>', open))
    const size = Number(/font-size:(\d+(?:\.\d+)?)px/.exec(style)?.[1] ?? 0)
    const color = /(?:^|;|")color:(#[0-9A-Fa-f]{6})/.exec(style)?.[1] ?? '#FFFFFF'
    assert.ok(size >= 13, `${m.id}: 수신거부 안내 글자가 ${size}px — 13px 이상이어야 읽힌다`)
    assert.ok(contrastOnWhite(color) >= 4.5, `${m.id}: 수신거부 안내 색 ${color} 대비 ${contrastOnWhite(color).toFixed(1)}:1 — 4.5:1 이상이어야 한다`)
  }
  // 광고 아닌 메일엔 (광고) 를 달지 않는다(거래 안내가 광고로 보이면 스팸함에 간다).
  for (const m of mails.filter((x) => !x.ad)) assert.ok(!m.subject.includes('(광고)'), `${m.id}: 거래 메일에 (광고)`)
  // 받은편지함의 원클릭 수신거부(List-Unsubscribe) — 광고 두 통은 sendEmail 에 unsubscribeUrl 을 넘긴다.
  const index = stripComments(read('lib', 'email', 'index.ts'))
  for (const fn of ['notifyNewsletterWelcome', 'broadcastNewsletterVol01']) {
    const at = index.indexOf(`export async function ${fn}(`)
    assert.ok(at > 0, `${fn} 가 없다`)
    const seg = index.slice(at, index.indexOf('export async function', at + 10))
    assert.match(seg, /unsubscribeUrl: `\$\{baseUrl\}\/api\/newsletter\/unsubscribe\?token=/, `${fn}: 원클릭 수신거부 헤더(unsubscribeUrl)를 안 넘긴다`)
  }
  // 거래 메일 바닥의 '알림 설정' 링크도 남아 있다(옛 틀 그대로의 문장).
  const tx = mails.find((m) => m.id === 'renderOrderConfirmation')!
  assert.match(tx.html, /수신을 원치 않으시면 <a href="https:\/\/[^"]+\/account\/notifications"[^>]*>알림 설정<\/a>/, '거래 메일 바닥의 알림 설정 안내가 사라졌다')
})

test('규칙227: 메일 바닥의 사업자 정보는 lib/business 정본에서 온다 — 모든 메일(문의 자동답장·Supabase 인증 메일 포함)에 상호·대표·사업자번호·통신판매업·주소·연락처', async () => {
  /**
   * # 왜 (전자상거래법 §10 — 통신판매업자 신원 표시)
   * 문의 자동답장은 주소·사업자번호만 손으로 따로 적었고(상호·대표 없음), Supabase 인증 메일 4종에는 사업자 정보가 아예 없었다.
   * 이제 공용 틀 바닥 한 곳이 lib/business 를 읽는다 — 숫자를 손으로 적는 곳이 생기면 정본과 갈라진다.
   */
  const { business } = await import(pathToFileURL(join(ROOT, 'lib', 'business.ts')).href)
  const { escape } = await import(pathToFileURL(join(ROOT, 'lib', 'email', 'escape.ts')).href)
  const facts: Array<[string, string]> = [
    ['상호', business.companyName],
    ['대표', business.ceo],
    ['사업자등록번호', business.businessNumber],
    ['통신판매업', business.mailOrderNumber],
    ['주소', business.address],
    ['이메일', business.email],
    ['전화', business.phone],
  ]
  const { mails } = await all()
  const targets = [...mails.map((m) => ({ id: m.id, html: m.html })), ...supabaseAuthFiles().map((f) => ({ id: `supabase/${f.file}`, html: f.html }))]
  const lacking: string[] = []
  for (const t of targets) {
    for (const [label, v] of facts) if (!t.html.includes(escape(v))) lacking.push(`${t.id} — ${label}`)
  }
  assert.deepEqual(lacking, [], `사업자 정보가 빠진 메일:\n${lacking.join('\n')}`)

  // 정본 밖에서 사업자 정보를 손으로 적지 않는다(메일 코드 · 문의 라우트 · 운영 점검 크론).
  const hard: string[] = []
  const scan = [...walk(join(ROOT, 'lib', 'email')), join(ROOT, 'app', 'api', 'contact', 'route.ts'), join(ROOT, 'app', 'api', 'cron', 'ops-digest', 'route.ts')]
  for (const f of scan) {
    if (!existsSync(f)) continue
    const src = stripComments(readFileSync(f, 'utf8'))
    for (const v of [business.businessNumber, business.mailOrderNumber, business.address, business.phone]) {
      if (src.includes(v)) hard.push(`${rel(f)} (${v})`)
    }
  }
  assert.deepEqual(hard, [], `사업자 정보를 손으로 적었다 — lib/business 를 읽을 것:\n${hard.join('\n')}`)
})

test('규칙228: 메일에 크림·베이지 바탕(옛 #F5F0E6 등)과 옛 갈색·초록 색이 없다 — A 포스터 팔레트 10색만', async () => {
  /**
   * # 왜 (사장님 10/7 — 크림·베이지는 'AI 티', 10/9~11 앱·웹은 흰 바탕·먹·머스터드로 바뀌었다)
   * 메일만 옛 크림 바탕(#F7F5F0·#FAF6EE·#F5F0E6)과 갈색·테라코타·초록(#2E1F14·#C86B45·#173B33…)으로 남아 있었다.
   * 팔레트는 lib/email/layout.ts EMAIL_COLORS 한 곳 — 템플릿이 새 색을 손으로 적으면 이 규칙이 잡는다.
   */
  const layout = await tryLoad<Record<string, unknown>>('lib/email/layout.ts')
  const colors = (layout?.EMAIL_COLORS ?? {}) as Record<string, string>
  const palette = Object.values(colors).map((c) => c.toUpperCase())
  assert.deepEqual([...palette].sort(), [...POSTER_PALETTE].sort(), 'lib/email/layout.ts EMAIL_COLORS 가 A 포스터 팔레트가 아니다')

  const { mails } = await all()
  const targets = [...mails.map((m) => ({ id: m.id, html: m.html })), ...supabaseAuthFiles().map((f) => ({ id: `supabase/${f.file}`, html: f.html }))]
  const off: string[] = []
  for (const t of targets) {
    const bad = [...new Set(hexColors(t.html).filter((c) => !POSTER_PALETTE.includes(c)))]
    if (bad.length) off.push(`${t.id}: ${bad.map((c) => (OLD_CREAM.includes(c) ? `${c}(옛 크림·베이지)` : c)).join(' ')}`)
  }
  assert.deepEqual(off, [], `팔레트 밖 색이 메일에 있다:\n${off.join('\n')}`)

  // 소스에도 옛 크림·베이지가 남지 않는다(주석 제외) — 조건부로만 그려지는 칸도 잡으려고.
  const srcOff: string[] = []
  for (const f of [...walk(join(ROOT, 'lib', 'email')), join(ROOT, 'app', 'api', 'contact', 'route.ts'), join(ROOT, 'app', 'api', 'cron', 'ops-digest', 'route.ts')]) {
    if (!existsSync(f)) continue
    const bad = [...new Set(hexColors(stripComments(readFileSync(f, 'utf8'))).filter((c) => !POSTER_PALETTE.includes(c)))]
    if (bad.length) srcOff.push(`${rel(f)}: ${bad.join(' ')}`)
  }
  assert.deepEqual(srcOff, [], `메일 코드에 팔레트 밖 색:\n${srcOff.join('\n')}`)
})

test('규칙229: 메일 그림은 절대 주소(https://…farmerstail.kr)·크기·대체 글자가 있고, 로고는 바탕을 구운 그림이라 다크 모드에서 안 사라진다', async () => {
  /**
   * # 왜
   * 메일엔 상대 주소가 없다(받은편지함이 우리 사이트가 아니다) — 그림은 SITE_URL(www) 절대 주소로만.
   * 그리고 옛 로고(public/logo-ink.png)는 바탕이 투명한 검은 글자라, 다크 모드에서 메일 앱이 바탕만 검게 바꾸면(Gmail 안드로이드 등)
   * 로고가 통째로 사라졌다. 새 틀은 흰 바탕을 구운 public/email/logo-ink-white.png(투명 없음)를 쓴다.
   */
  const { mails } = await all()
  const targets = [...mails.map((m) => ({ id: m.id, html: m.html })), ...supabaseAuthFiles().map((f) => ({ id: `supabase/${f.file}`, html: f.html }))]
  let imgCount = 0
  for (const t of targets) {
    for (const tag of t.html.match(/<img\b[^>]*>/g) ?? []) {
      imgCount++
      const src = /\ssrc="([^"]+)"/.exec(tag)?.[1] ?? ''
      assert.match(src, /^https:\/\//, `${t.id}: 그림 주소가 절대 주소(https)가 아니다 — ${src}`)
      const url = new URL(src.replace(/&amp;/g, '&'))
      assert.ok(url.host === 'www.farmerstail.kr' || url.host.endsWith('.farmerstail.kr'), `${t.id}: 그림이 우리 도메인 밖에 있다 — ${src}`)
      for (const attr of ['width', 'height', 'alt']) assert.match(tag, new RegExp(`\\s${attr}="[^"]+"`), `${t.id}: 그림에 ${attr} 가 없다 — ${src}`)
      // 그림 파일이 저장소 public 에 있고, 투명 바탕이 아니다(PNG 색 형식 2·0, tRNS 없음 / JPEG).
      const file = join(ROOT, 'public', decodeURIComponent(url.pathname))
      assert.ok(existsSync(file), `${t.id}: 그림 파일이 public 에 없다 — ${url.pathname}`)
      const buf = readFileSync(file)
      const isPng = buf.subarray(1, 4).toString('latin1') === 'PNG'
      if (isPng) {
        const colorType = buf[25]
        assert.ok(colorType === 2 || colorType === 0, `${t.id}: ${url.pathname} 가 투명 바탕 PNG(색 형식 ${colorType}) — 다크 모드에서 사라진다`)
        assert.ok(!buf.includes(Buffer.from('tRNS')), `${t.id}: ${url.pathname} 에 투명색(tRNS)이 있다`)
      } else {
        assert.ok(buf[0] === 0xff && buf[1] === 0xd8, `${t.id}: ${url.pathname} 가 PNG·JPEG 가 아니다`)
      }
    }
  }
  assert.ok(imgCount >= mails.length, `그림이 ${imgCount}개뿐이다 — 모든 메일 머리에 로고가 있어야 한다(카나리아)`)
})

test('규칙230: 메일 문구 — 머리말은 한글만 · 분기 리포트에 영양소 % 숫자 없음 · 테일 레터에 증상 효능 문장 없음 · 인증 링크 만료 4종 모두 1시간 (사장님 10/14)', () => {
  const englishOnly = /^[A-Za-z][A-Za-z0-9 .&'-]*$/
  const files = readdirSync(join(ROOT, 'lib', 'email', 'templates')).filter((f) => f.endsWith('.ts'))
  assert.ok(files.length >= 8, 'templates 폴더를 못 읽었다(카나리아)')
  let kickers = 0
  for (const f of files) {
    const src = read('lib', 'email', 'templates', f)
    for (const m of src.matchAll(/kicker: '([^']+)'/g)) {
      kickers++
      for (const part of (m[1] ?? '').split(' · ')) {
        assert.ok(!englishOnly.test(part.trim()), `${f}: 머리말에 영어 조각이 있다 — '${m[1]}'`)
      }
    }
    for (const m of src.matchAll(/section\('([^']+)'/g)) {
      assert.ok(!englishOnly.test((m[1] ?? '').trim()), `${f}: 뉴스레터 섹션 머리말이 영어다 — '${m[1]}'`)
    }
  }
  assert.ok(kickers >= 15, `머리말을 ${kickers}개밖에 못 찾았다(카나리아)`)
  assert.ok(!read('lib', 'email', 'layout.ts').includes('text-transform:uppercase'), '머리말을 대문자로 바꾸는 스타일이 남았다')
  const q = read('lib', 'email', 'templates', 'quarterly-report.ts')
  assert.ok(!/'[^'\n]*\d+% [^'\n]*'/.test(q), '분기 리포트가 영양소를 % 숫자로 보낸다')
  assert.ok(!read('lib', 'email', 'templates', 'newsletter-vol-01.ts').includes('가려워'), '테일 레터에 증상(가려움)을 내세운 효능 문장이 남았다')
  for (const f of ['confirm-signup', 'reset-password', 'change-email', 'magic-link']) {
    const html = read('supabase', 'email-templates', `${f}.html`)
    assert.ok(html.includes('1시간 후 만료') && !html.includes('24시간 후 만료'), `${f}: 링크 만료 안내가 1시간이 아니다`)
  }
})
