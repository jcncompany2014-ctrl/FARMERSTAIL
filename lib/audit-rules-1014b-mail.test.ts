/**
 * 2026-10-14 메일·알림·앱 셸 점검 묶음의 규칙 236~240 (가지 fix/1014b-mail).
 *
 *   236 M1 — 메일 글자판(text/plain)에 버튼 주소가 남고 HTML 엔티티(&#39; · &quot;)가 안 남는다.
 *   237 M2·M3 — 서포터즈 안내의 날짜는 정본 하나("12월 1일", 0 없음) · 결제 완료 푸시는 결제 시점(일반 토요일 / 서포터즈 화요일)별 문구.
 *   238 M4 — 거래 메일(입금 대기·서포터즈 가격 변경 포함)이 수신차단으로 막히면 error · 운영 점검 메일에 '메일 못 받는 손님 N명'.
 *   239 M5 — 어드민 수동 처리(배송 완료 등)가 밤(KST 22~8시)에 손님 알림을 보내기 전에 사장님에게 묻는다.
 *   240 M6 — 다음 앱 빌드 셸: 흰 손짓 막대 · 글자 크기 바꿔도 재시작 안 함 · 세로 고정 · 오프라인 안내 흰 화면.
 *
 * 문서에만 적은 규칙은 같은 날 또 어긴다 — 고친 것을 테스트로 박는다. 각 규칙은 고치기 전 코드(32d1ea8c)에서는 빨간불,
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

function readIf(...parts: string[]): string {
  const p = join(ROOT, ...parts)
  return existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : ''
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMod = Record<string, any>

type Mail = { id: string; subject: string; html: string }

const MAIL = 'hello@example.com'

/**
 * 템플릿 폴더의 모든 render* 함수를 예시 값(보호자님·땅콩)으로 그린다 — lib/audit-rules-1014-email.test.ts 의 SAMPLES 와 같은 방식.
 * 예시가 없는 render* 함수가 생기면 missing 에 이름이 남는다(새 메일이 이 규칙들 밖으로 새지 않게).
 * 날짜는 0 이 붙기 쉬운 한 자리 달·날(1월 23일 · 12월 1일)로 고른다(규칙237).
 */
async function renderAll(): Promise<{ mails: Mail[]; missing: string[] }> {
  const mails: Mail[] = []
  const missing: string[] = []
  const add = (id: string, r: { subject: string; html: string }) => mails.push({ id, subject: r.subject, html: r.html })
  const SAMPLES: Record<string, (m: AnyMod) => void> = {
    'orders.ts': (m) => {
      const base = { orderId: 'o1', orderNumber: 'FTS-20261014-K7P2QX', recipientName: '보호자', totalAmount: 42900, items: [{ product_name: '닭고기 화식 500g', quantity: 1, line_total: 24000 }, { product_name: '4종 체험팩', quantity: 1, line_total: 13900 }] }
      add('renderOrderConfirmation', m.renderOrderConfirmation({ ...base, shippingFee: 5000, paymentMethodLabel: '카드' }))
      add('renderVirtualAccountWaiting', m.renderVirtualAccountWaiting({ ...base, bankCode: '88', accountNumber: '56211234567890', accountHolder: '파머스테일', dueDate: '2027-01-03T23:59:59+09:00' }))
      add('renderOrderShipped', m.renderOrderShipped({ ...base, carrier: 'cj', trackingNumber: '689012345678' }))
      add('renderOrderDelivered', m.renderOrderDelivered(base))
      add('renderOrderCancelled', m.renderOrderCancelled({ ...base, reason: '고객 요청', refundAmount: 42900 }))
      add('renderWelcome', m.renderWelcome({ recipientName: '보호자' }))
    },
    'subscription.ts': (m) => {
      add('renderSubscriptionReminder', m.renderSubscriptionReminder({ recipientName: '보호자', items: [{ productName: '닭고기 화식', quantity: 7 }], nextDeliveryDate: '2027-01-05', chargeDate: '2027-01-02', daysBefore: 2, chargeAmount: 60690 }))
      add('renderSubscriptionChargeFailed', m.renderSubscriptionChargeFailed({ recipientName: '보호자', productLabel: '닭고기 화식', amount: 60690, attemptCount: 1, paused: false, errorClass: 'transient', nextRetryAt: '2027-01-02T00:10:00Z', reason: '잔액이 부족해요' }))
      add('renderTrialPriceChange', m.renderTrialPriceChange({ recipientName: '보호자', nextPhase: 'full', nextChargeDate: '2026-11-28', nextShipDate: '2026-12-01', nextAmount: 60690 }))
    },
    'newsletter.ts': (m) => {
      add('renderNewsletterConfirm', m.renderNewsletterConfirm({ email: MAIL, confirmToken: 'tok1' }))
      add('renderUnsubscribeAck', m.renderUnsubscribeAck({ email: MAIL, channel: 'email' }))
      add('renderConsentResult', m.renderConsentResult({ channels: ['email'], granted: false, at: '2027-01-03T10:30:00+09:00' }))
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
      add('renderContactAdmin', m.renderContactAdmin({ name: "O'Neil", email: MAIL, categoryLabel: '정기배송', message: '땅콩이 박스를 미루고 싶어요.\n"다음 주"로요 & 감사해요.' }))
      add('renderContactAck', m.renderContactAck({ categoryLabel: '정기배송' }))
    },
    'ops-digest.ts': (m) => add('renderOpsDigest', m.renderOpsDigest({
      failures: [], cronErrors: [{ path: '/api/cron/x', error_message: 'timeout', executed_at: '2027-01-03T03:00:00+09:00' }],
      refundRows: [], refundPending: 0, refundPermFailed: 0, staleOrders: [], lowStock: [], lowStockThreshold: 5, generatedAt: Date.parse('2027-01-03T08:00:00+09:00'),
      mailBlocked: { customers: 2, newIn24h: 1, hardBounce: 1, complaint: 1 },
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
  return { mails, missing }
}

let cached: Promise<{ mails: Mail[]; missing: string[] }> | null = null
const all = () => (cached ??= renderAll())

/**
 * 메일 글자판 변환기 — 정본 lib/email/plain-text htmlToPlainText. 옛 트리(카나리아)엔 그 파일이 없으므로 client.ts 의 옛 stripHtml 을
 * 꺼내 돌린다 — 옛 동작이 실제로 이 규칙을 어기는지(주소 0개 · &#39;)를 보이려고.
 */
async function loadPlainText(): Promise<{ fn: (html: string) => string; source: 'plain-text.ts' | 'client.ts stripHtml' }> {
  const m = await tryLoad<AnyMod>('lib/email/plain-text.ts')
  if (m && typeof m.htmlToPlainText === 'function') return { fn: m.htmlToPlainText, source: 'plain-text.ts' }
  const src = read('lib', 'email', 'client.ts')
  const at = src.indexOf('function stripHtml(')
  assert.ok(at >= 0, '메일 글자판 변환기가 없다(lib/email/plain-text.ts 도 client.ts stripHtml 도 없음)')
  const end = src.indexOf('\n}\n', at)
  const body = src.slice(at, end + 2).replace('function stripHtml(html: string): string', 'function stripHtml(html)')
  const fn = new Function(`${body}\nreturn stripHtml`)() as (html: string) => string
  return { fn, source: 'client.ts stripHtml' }
}

const ENTITY = /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/

test('규칙236: 메일 글자판(text/plain)에 버튼·링크 주소가 남고(글 (주소)), HTML 엔티티(&#39; · &quot; …)가 하나도 남지 않는다', async () => {
  /**
   * # 왜 (2026-10-14 메일 점검 M1)
   * sendEmail 은 text 를 안 넘기면 HTML 을 글자판으로 바꿔 함께 보낸다. 옛 변환(client.ts stripHtml)은 <a href> 를 통째로 지워 글자판에
   * 링크 주소가 0개였고("정기배송 관리하기" 글자만), 엔티티는 &amp;·&lt;·&gt;·&nbsp; 넷만 되돌려 모든 메일 바닥에
   * "파머스테일 (Farmer&#39;s Tail)"이 그대로 찍혔다. 글자판으로 읽는 메일 앱·화면 낭독기·스팸 필터가 보는 판이다.
   */
  const { fn: toText, source } = await loadPlainText()

  // 단위 — 링크·엔티티·줄바꿈.
  const unit = toText(
    `<html><head><title>제목&#39;s</title><style>p{}</style></head><body>` +
      `<div style="display:none;">미리보기 줄</div>` +
      `<h1>Farmer&#39;s Tail</h1><p>&quot;안녕&quot; &amp; 반가워요 &#x27;땅콩&#x27;</p>` +
      `<a href="https://www.farmerstail.kr/a?b=1&amp;c=2" style="display:block;">정기배송 관리하기</a>` +
      `<p><a href="mailto:story@farmerstail.kr">story@farmerstail.kr</a> · <a href="https://www.farmerstail.kr/x">https://www.farmerstail.kr/x</a></p>` +
      `<div style="white-space:pre-wrap;">첫 줄\n둘째 줄</div><p>&amp;lt;글자 그대로&amp;gt;</p></body></html>`,
  )
  assert.match(unit, /정기배송 관리하기 \(https:\/\/www\.farmerstail\.kr\/a\?b=1&c=2\)/, `[${source}] 버튼 글 뒤에 주소가 없다:\n${unit}`)
  assert.ok(unit.includes("Farmer's Tail"), `[${source}] &#39; 를 되돌리지 않았다:\n${unit}`)
  assert.ok(unit.includes('"안녕" & 반가워요 \'땅콩\''), `[${source}] &quot; · &#x27; 를 되돌리지 않았다:\n${unit}`)
  assert.ok(unit.includes('story@farmerstail.kr') && !unit.includes('mailto:'), `[${source}] mailto 링크는 주소만 남아야 한다:\n${unit}`)
  assert.ok(!unit.includes('https://www.farmerstail.kr/x (https://'), `[${source}] 글이 곧 주소인 링크를 두 번 적었다:\n${unit}`)
  assert.match(unit, /첫 줄\n둘째 줄/, `[${source}] white-space:pre-wrap 칸(문의 본문)의 줄바꿈이 사라졌다:\n${unit}`)
  assert.ok(unit.includes('&lt;글자 그대로&gt;'), `[${source}] 엔티티를 두 번 되돌렸다(&amp;lt; 는 &lt; 글자로 남아야 한다):\n${unit}`)
  assert.ok(!unit.includes('미리보기 줄') && !unit.includes("제목'"), `[${source}] 미리보기 줄·<title> 이 글자판에 섞였다:\n${unit}`)
  assert.ok(!/\n{3,}/.test(unit) && !/[ \t]\n/.test(unit), `[${source}] 빈 줄이 겹치거나 줄 끝에 공백이 남았다:\n${JSON.stringify(unit)}`)

  // 모든 메일 — 글자판에 그 메일의 모든 http(s) 링크 주소가 있고, 엔티티가 0개.
  const { mails, missing } = await all()
  assert.deepEqual(missing, [], `예시가 없는 메일 템플릿 — 이 파일 renderAll 의 SAMPLES 에 넣을 것:\n${missing.join('\n')}`)
  assert.ok(mails.length >= 25, `그린 메일이 ${mails.length}통뿐이다(카나리아)`)
  const bad: string[] = []
  let ctas = 0
  for (const m of mails) {
    const text = toText(m.html)
    const ent = ENTITY.exec(text)
    if (ent) bad.push(`${m.id}: 글자판에 엔티티 ${ent[0]} 가 남았다`)
    if (text.includes('&#')) bad.push(`${m.id}: 글자판에 '&#' 가 남았다`)
    if (m.id === 'renderAuthTemplate') continue // Supabase 가 보내는 메일 — 주소가 {{ .ConfirmationURL }} 같은 변수다
    for (const a of m.html.matchAll(/<a\b[^>]*\bhref="(https?:\/\/[^"]+)"/g)) {
      const href = a[1]!.replace(/&amp;/g, '&')
      if (!text.includes(href)) bad.push(`${m.id}: 글자판에 링크 주소가 없다 — ${href}`)
    }
    const cta = /<a href="(https?:\/\/[^"]+)" style="display:block;padding:18px/.exec(m.html)?.[1]
    if (cta) {
      ctas++
      if (!text.includes(cta.replace(/&amp;/g, '&'))) bad.push(`${m.id}: 글자판에 버튼 주소가 없다 — ${cta}`)
    }
    if (m.html.includes('Farmer&#39;s Tail') && !text.includes("Farmer's Tail")) bad.push(`${m.id}: "Farmer's Tail" 이 글자판에서 깨졌다`)
  }
  assert.ok(ctas >= 15, `버튼이 있는 메일이 ${ctas}통뿐이다(카나리아 — 버튼 모양이 바뀌었으면 이 규칙을 고칠 것)`)
  assert.deepEqual(bad.slice(0, 40), [], `[${source}] 글자판 문제 ${bad.length}건:\n${bad.slice(0, 40).join('\n')}`)

  // 실제 발송이 이 변환기를 쓴다.
  const client = stripComments(read('lib', 'email', 'client.ts'))
  assert.match(client, /text:\s*input\.text\s*\?\?\s*htmlToPlainText\(input\.html\)/, 'sendEmail 이 글자판을 lib/email/plain-text htmlToPlainText 로 만들지 않는다')
  assert.ok(!/function stripHtml\(/.test(client), '옛 글자판 변환(stripHtml)이 client.ts 에 남았다')
})

test('규칙237: 서포터즈 안내 날짜는 정본 하나("12월 1일", 0 없음 — 메일=푸시) · 결제 완료 푸시는 결제 시점(일반 토요일 / 서포터즈 화요일)별 문구, 도착 요일 약속 없음', async () => {
  /**
   * # 왜 (2026-10-14 메일 점검 M2·M3)
   * M2: 서포터즈 가격 안내 메일은 "12월 01일 화요일"(템플릿 자체 포맷이 0을 채움), 같은 날 같은 일을 알리는 푸시는 "12월 1일"(크론 안
   *     한 줄 포맷)이었다. 날짜 모양은 lib/datetime-kst formatKoMonthDay 하나로 — 메일·푸시가 같이 쓴다.
   * M3: 결제 완료 푸시가 모두에게 "곧 박스를 준비할게요"였다. 서포터즈 체험 구간은 발송일(화) 아침 결제라(chargeDateFor) 이미 만든
   *     박스가 그날 나간다. 결제 시점 정본(chargeTimingFor → timingOf)과 그 박스의 발송일(paidBoxShipIso)로 문구를 가른다.
   */
  // 메일 — 서포터즈 가격 안내·결제 전 고지가 정본 모양을 쓴다.
  const sub = await tryLoad<AnyMod>('lib/email/templates/subscription.ts')
  assert.ok(sub, 'subscription 템플릿이 없다')
  const trial = sub.renderTrialPriceChange({ recipientName: '보호자', nextPhase: 'full', nextChargeDate: '2026-11-28', nextShipDate: '2026-12-01', nextAmount: 60690 }).html as string
  assert.ok(trial.includes('12월 1일 화요일에 보내드려요'), '서포터즈 가격 안내 메일의 발송일이 "12월 1일 화요일" 모양이 아니다')
  assert.ok(trial.includes('11월 28일 토요일 아침에'), '서포터즈 가격 안내 메일의 결제일 모양이 다르다')
  const remind = sub.renderSubscriptionReminder({ recipientName: '보호자', items: [{ productName: '닭고기 화식', quantity: 7 }], nextDeliveryDate: '2027-01-05', chargeDate: '2027-01-02', daysBefore: 2, chargeAmount: 60690 }).html as string
  assert.ok(remind.includes('1월 2일 토요일') && remind.includes('1월 5일 화요일'), '결제 전 고지 메일의 날짜 모양이 정본과 다르다')
  const { mails } = await all()
  const padded: string[] = []
  for (const m of mails) {
    const hit = /(?<![0-9])0[1-9](월|일)/.exec(m.html)
    if (hit) padded.push(`${m.id}: '${m.html.slice(Math.max(0, hit.index - 8), hit.index + 8)}'`)
  }
  assert.deepEqual(padded, [], `메일 날짜에 0 이 붙었다("12월 01일"):\n${padded.join('\n')}`)

  // 날짜 정본 — 메일과 푸시가 같이 쓴다.
  const dt = await tryLoad<AnyMod>('lib/datetime-kst.ts')
  assert.ok(dt && typeof dt.formatKoMonthDay === 'function', 'lib/datetime-kst 에 날짜 정본 formatKoMonthDay 가 없다')
  assert.equal(dt.formatKoMonthDay('2026-12-01'), '12월 1일')
  assert.equal(dt.formatKoMonthDay('2026-12-01', { weekday: true }), '12월 1일 화요일')
  assert.equal(dt.formatKoMonthDay('2027-01-23', { weekday: true }), '1월 23일 토요일')
  assert.equal(dt.formatKoMonthDay('2026-11-30T16:00:00Z'), '12월 1일', '시각(UTC)은 KST 날짜로 읽어야 한다')
  assert.equal(dt.formatKoMonthDay(''), '')
  const subSrc = stripComments(read('lib', 'email', 'templates', 'subscription.ts'))
  assert.ok(subSrc.includes('formatKoMonthDay(') && !subSrc.includes("padStart(2, '0')}월"), 'subscription 템플릿이 날짜 정본(formatKoMonthDay)을 쓰지 않는다')

  // 푸시 — 크론이 같은 정본으로 날짜를 쓴다(자기 한 줄 포맷 금지).
  const cron = stripComments(read('app', 'api', 'cron', 'subscription-charge', 'route.ts'))
  assert.ok(!/Number\(iso\.slice\(5, 7\)\)\}월/.test(cron), '청구 크론이 자기 날짜 포맷을 쓴다 — formatKoMonthDay 를 쓸 것')
  assert.match(cron, /formatKoMonthDay\(/, '청구 크론의 서포터즈 가격 안내 푸시가 날짜 정본을 쓰지 않는다')

  // M3 — 결제 완료 푸시 문구.
  const ss = await tryLoad<AnyMod>('lib/shipping-schedule.ts')
  assert.ok(ss && typeof ss.chargePaidPushBody === 'function', 'lib/shipping-schedule 에 결제 완료 푸시 문구 정본 chargePaidPushBody 가 없다')
  const supporterOnTime = ss.chargePaidPushBody({ amount: 100, timing: 'ship_day', shipIso: '2026-10-20', todayIso: '2026-10-20' }) as string
  const regularSat = ss.chargePaidPushBody({ amount: 60690, timing: 'before_cooking', shipIso: '2026-10-20', todayIso: '2026-10-17' }) as string
  const supporterLate = ss.chargePaidPushBody({ amount: 16100, timing: 'ship_day', shipIso: '2026-10-27', todayIso: '2026-10-21' }) as string
  assert.match(supporterOnTime, /^100원 · .*오늘 보내드려요$/, `서포터즈(발송일 결제)에게 오늘 나간다고 말하지 않는다: ${supporterOnTime}`)
  assert.match(supporterOnTime, /만들어 둔 박스/, `서포터즈 박스는 이미 만들어져 있다: ${supporterOnTime}`)
  assert.match(regularSat, /^60,690원 · 주말에 만들어 10월 20일 화요일에 보내드려요$/, `일반(토요일 결제) 문구가 다르다: ${regularSat}`)
  assert.match(supporterLate, /10월 27일 화요일에 보내드려요/, `늦게 결제된 서포터즈 박스의 발송일이 없다: ${supporterLate}`)
  for (const s of [supporterOnTime, regularSat, supporterLate]) {
    assert.ok(!/도착|수요일|준비할게요/.test(s), `결제 완료 푸시가 도착을 약속하거나 옛 문구를 쓴다: ${s}`)
  }
  assert.ok(!cron.includes('곧 박스를 준비할게요'), '청구 크론이 아직 모두에게 "곧 박스를 준비할게요"라고 한다')
  assert.match(
    cron,
    /chargePaidPushBody\(\{\s*amount: chargeAmount,\s*timing: timingOf\(sub\),\s*shipIso: paidBoxShipIso\(nextDate, successIso\),\s*todayIso: today,?\s*\}\)/,
    '결제 완료 푸시가 결제 시점 정본(timingOf)·그 박스 발송일(paidBoxShipIso)로 문구를 가르지 않는다',
  )
  const stale: string[] = []
  for (const f of [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib'))]) {
    if (stripComments(readFileSync(f, 'utf8')).includes('곧 박스를 준비할게요')) stale.push(rel(f))
  }
  assert.deepEqual(stale, [], `옛 결제 완료 문구가 남았다:\n${stale.join('\n')}`)
})

test('규칙238: 거래 메일(입금 대기·서포터즈 가격 변경 포함)이 수신차단으로 막히면 error — 태그 표 정본 · 운영 점검 메일에 "메일 못 받는 손님 N명"', async () => {
  /**
   * # 왜 (2026-10-14 메일 점검 M4)
   * 수신차단(하드바운스·스팸 신고) 주소로는 거래 메일까지 안 나간다. 거래 메일이 막히면 error 로 올려 사장님이 보게 했는데, 판정이
   * 태그 앞머리(order·subscription·va-·personalization)라 실제 태그 'virtual-account-waiting'(입금 대기)·'trial-price-change'(서포터즈
   * 가격 변경 고지)가 warning 으로 묻혔다. 그리고 막힌 손님 수는 운영 점검 메일 어디에도 없었다.
   */
  // 판정 — 정본 lib/email/tags. 옛 트리(카나리아)엔 없으므로 client.ts 의 옛 앞머리 판정식을 꺼내 돌린다(옛 동작이 실제로 놓치는지).
  const tags = await tryLoad<AnyMod>('lib/email/tags.ts')
  let judge: (t: string) => boolean
  let source: string
  if (tags && typeof tags.isTransactionalEmailTag === 'function') {
    judge = tags.isTransactionalEmailTag
    source = 'lib/email/tags'
  } else {
    const expr = /const isTransactional =([\s\S]*?)\n\s*try \{/.exec(read('lib', 'email', 'client.ts'))?.[1]
    assert.ok(expr, '거래 메일 판정식을 찾지 못했다')
    judge = new Function('tag', `return (${expr})`) as (t: string) => boolean
    source = 'client.ts 옛 앞머리 판정'
  }
  for (const t of ['virtual-account-waiting', 'trial-price-change', 'order-placed', 'order-shipped', 'order-delivered', 'order-cancelled', 'subscription-reminder', 'subscription-charge-failed', 'personalization-approval']) {
    assert.equal(judge(t), true, `[${source}] '${t}' 가 거래 메일로 분류되지 않는다 — 막혀도 warning 으로 묻힌다`)
  }
  for (const t of ['newsletter-welcome', 'newsletter-vol-01', 'ops-digest', 'contact-user']) {
    assert.equal(judge(t), false, `[${source}] '${t}' 는 거래 메일이 아니다(광고·운영 메일 차단은 정상 동작)`)
  }
  assert.ok(tags && typeof tags.isTransactionalEmailTag === 'function', 'lib/email/tags 에 거래 메일 판정 정본(isTransactionalEmailTag)이 없다')
  const client = stripComments(read('lib', 'email', 'client.ts'))
  assert.match(client, /const isTransactional = isTransactionalEmailTag\(input\.tag\)/, 'sendEmail 의 수신차단 경보가 태그 표 정본으로 거래 메일을 가르지 않는다')
  assert.match(client, /isTransactional \? 'error' : 'warning'/, '거래 메일 차단이 error 가 아니다')

  // 발송처의 모든 태그가 표 둘 중 하나에 있다 — 새 태그가 표 밖에서 앞머리 짐작에 기대지 않게.
  const known = new Set<string>([...tags.TRANSACTIONAL_EMAIL_TAGS, ...tags.NON_TRANSACTIONAL_EMAIL_TAGS])
  const unknown: string[] = []
  let seen = 0
  for (const f of [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib')), ...walk(join(ROOT, 'scripts'))]) {
    const src = stripComments(readFileSync(f, 'utf8'))
    if (!/\bsendEmail\(\{/.test(src)) continue
    for (const m of src.matchAll(/\btag: '([a-z0-9-]+)'/g)) {
      seen++
      if (!known.has(m[1]!)) unknown.push(`${rel(f)}: '${m[1]}'`)
    }
  }
  assert.ok(seen >= 18, `발송처 태그를 ${seen}개밖에 못 찾았다(카나리아)`)
  assert.deepEqual(unknown, [], `태그 표(lib/email/tags)에 없는 메일 태그 — 거래인지 아닌지 표에 넣을 것:\n${unknown.join('\n')}`)

  // 운영 점검 메일 — '메일 못 받는 손님 N명'.
  const od = await tryLoad<AnyMod>('lib/email/templates/ops-digest.ts')
  assert.ok(od, 'ops-digest 템플릿이 없다')
  const base = { failures: [], cronErrors: [], refundRows: [], refundPending: 0, refundPermFailed: 0, staleOrders: [], lowStock: [], lowStockThreshold: 5, generatedAt: Date.parse('2027-01-03T08:00:00+09:00') }
  const withBlocked = od.renderOpsDigest({ ...base, mailBlocked: { customers: 3, newIn24h: 1, hardBounce: 2, complaint: 1 } })
  assert.ok(withBlocked.html.includes('메일 못 받는 손님 3명'), '운영 점검 메일에 "메일 못 받는 손님 N명"이 없다')
  assert.ok(withBlocked.html.includes('스팸 신고 1명') && withBlocked.html.includes('주소 없음 반송 2명'), '막힌 이유별 숫자가 없다')
  assert.match(withBlocked.subject, /점검 필요 1건/, '새로 막힌 손님(24시간)이 점검 건수에 안 들어간다')
  const without = od.renderOpsDigest({ ...base, cronErrors: [{ path: '/api/cron/x', error_message: null, executed_at: '2027-01-03T03:00:00+09:00' }] })
  assert.ok(!without.html.includes('메일 못 받는 손님'), '막힌 손님이 없는데 줄이 나온다')
  const route = stripComments(read('app', 'api', 'cron', 'ops-digest', 'route.ts'))
  assert.match(route, /\.from\('email_suppressions'\)/, '운영 점검 크론이 수신차단 목록을 보지 않는다')
  assert.match(route, /const \{ data: suppRows, error: suppErr \} = await supabase/, '수신차단 조회가 error 를 꺼내지 않는다(조회 실패 = 0명 위장)')
  assert.match(route, /if \(suppErr\) \{\s*failures\.push\(/, '수신차단 조회 실패를 "숫자를 믿지 마세요"(failures)로 올리지 않는다')
  assert.match(route, /\(mailBlocked\?\.newIn24h \?\? 0\) \+\s*failures\.length/, '새로 막힌 손님이 있어도 점검 메일이 안 간다(issueCount)')
  assert.match(route, /renderOpsDigest\(\{\s*failures,\s*mailBlocked,/, '운영 점검 메일에 막힌 손님 숫자를 넘기지 않는다')
})

test('규칙239: 어드민 수동 처리(배송 완료·배송 시작·취소·송장 변경)는 밤(KST 22~8시)에 손님 알림을 보내기 전에 사장님에게 묻는다 — 쓰기 전에 409', async () => {
  /**
   * # 왜 (2026-10-14 메일 점검 M5)
   * 10/08 22:43 사장님이 서포터즈 6명의 주문을 '배송 완료'로 바꾸자 6명 휴대폰에 밤 알림이 그대로 나갔다. 조용시간은 손님이 설정 화면에서
   * 켠 경우에만 lib/push 가 막는다. 크론은 시각을 옮겨 피했지만(AGENTS 규칙9) 사람이 누르는 경로엔 장치가 없었다.
   * 미뤄 보내는 큐가 없어(만들면 DB 표·크론이 는다) 확인을 받는다: 바꾸지 않기 / 알림 없이 바꾸기(메일은 감) / 지금 보내기.
   */
  const np = await tryLoad<AnyMod>('lib/admin/night-push.ts')
  assert.ok(np, 'lib/admin/night-push(밤 알림 확인)가 없다 — 수동 처리가 밤에도 그대로 알림을 보낸다')
  for (const h of [22, 23, 0, 3, 7]) assert.equal(np.isNightPushHourKst(h), true, `${h}시는 밤이다`)
  for (const h of [8, 12, 18, 21]) assert.equal(np.isNightPushHourKst(h), false, `${h}시는 밤이 아니다`)
  assert.equal(np.parseNightPushChoice('send'), 'send')
  assert.equal(np.parseNightPushChoice('skip'), 'skip')
  assert.equal(np.parseNightPushChoice(true), null)
  const answers = (xs: boolean[]) => {
    const q = [...xs]
    return () => q.shift() ?? false
  }
  assert.equal(np.askNightPushChoice('밤', answers([false])), null, '첫 창에서 취소하면 아무것도 바꾸지 않아야 한다')
  assert.equal(np.askNightPushChoice('밤', answers([true, true])), 'send')
  assert.equal(np.askNightPushChoice('밤', answers([true, false])), 'skip')
  assert.match(np.nightPushMessage('배송이 완료됐어요 🐾'), /배송이 완료됐어요/, '확인 창이 어떤 알림이 가는지 말하지 않는다')

  for (const [file, writeAt] of [
    ['app/api/admin/orders/[id]/status/route.ts', ".update(update)"],
    ['app/api/admin/orders/[id]/tracking/route.ts', ".update({ carrier, tracking_number: trackingNumber })"],
  ] as const) {
    const src = stripComments(read(...file.split('/')))
    const check = src.search(/isNightPushHourKst\(currentKstHour\(\)\)/)
    const confirm = src.indexOf('code: NIGHT_PUSH_CONFIRM')
    const write = src.indexOf(writeAt)
    assert.ok(check > 0 && confirm > 0, `${file}: 밤(KST)이면 NIGHT_PUSH_CONFIRM 으로 묻지 않는다`)
    assert.ok(write > 0 && check < write && confirm < write, `${file}: 밤 확인이 DB 쓰기보다 뒤에 있다 — 물어보는 사이 이미 바뀐다`)
    const push = src.indexOf('await pushToUser(')
    const guard = src.lastIndexOf("nightPush !== 'skip'", push)
    assert.ok(push > 0 && guard > 0 && push - guard < 400, `${file}: '알림 없이'를 골라도 푸시가 나간다`)
  }
  const status = stripComments(read('app', 'api', 'admin', 'orders', '[id]', 'status', 'route.ts'))
  assert.match(status, /delivered: '배송이 완료됐어요 🐾'/, '배송 완료 알림이 밤 확인 대상 표(CUSTOMER_PUSH_TITLE)에 없다')
  assert.match(status, /const pushTitle = CUSTOMER_PUSH_TITLE\[orderStatus\]/, '밤 확인과 실제 알림이 같은 표를 보지 않는다')
  for (const f of ['OrderStatusControl.tsx', 'ShippingControl.tsx']) {
    const src = stripComments(read('app', 'admin', 'orders', '[id]', f))
    assert.match(src, /data\.code === NIGHT_PUSH_CONFIRM/, `${f}: 밤 확인(409 NIGHT_PUSH_CONFIRM)을 받아도 묻지 않는다`)
    assert.match(src, /askNightPushChoice\(/, `${f}: 사장님에게 고르게 하지 않는다`)
    assert.match(src, /nightPush = choice\s*res = await send\(/, `${f}: 고른 값으로 다시 보내지 않는다`)
    assert.match(src, /JSON\.stringify\(\{[^)]*\bnightPush\b[^)]*\}\)/, `${f}: 고른 값(nightPush)을 본문에 싣지 않는다`)
  }
})

test('규칙240: 다음 앱 빌드 셸 — 흰 손짓 막대(다크 모드·안드로이드 15+ 포함) · 글자 크기 바꿔도 재시작 안 함(웹뷰 배율 맞춤) · 세로 고정(안드로이드·아이폰) · 오프라인 안내 흰 화면', () => {
  /**
   * # 왜 (2026-10-14 메일 점검 M6 — 파일만, 빌드는 다음 출시 때)
   *   · 아래 손짓 막대 구간이 검은 띠였다(흰 셸 FtShell/3 과 안 맞음). API 27+ 는 흰 막대·어두운 버튼(values-v27 — 그 아래는 밝은 막대를
   *     못 그려 흰 버튼이 묻힌다). 안드로이드 15+ 는 막대 색이 무시되고 창 바탕이 보이므로 windowBackground 도 흰색. Capacitor SystemBars 가
   *     켜질 때 버튼 색을 기기 테마로 다시 정하므로 style 'LIGHT' 로 못 박는다.
   *   · 폰 글자 크기를 바꾸면 화면이 새로 만들어지며 앱이 첫 화면으로 돌아갔다 → configChanges fontScale·fontWeightAdjustment +
   *     onConfigurationChanged 에서 웹뷰 setTextZoom.
   *   · 가로로 돌리면 첫 화면 이름 칸이 가려졌다 → 세로 고정(안드로이드 screenOrientation · 아이폰 UISupportedInterfaceOrientations).
   *   · 첫 실행 오프라인 안내(error.html)가 옛 크림 바탕이었다 → 흰 바탕 · 먹색 버튼 흰 글자 · 웹 /offline 과 같은 문구.
   */
  // XML 주석은 걷어 낸다 — 설명 속 낱말(navigationBarColor 등)이 규칙에 걸리지 않게.
  const noXmlComments = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '')
  const colors = noXmlComments(read('android', 'app', 'src', 'main', 'res', 'values', 'ft_splash.xml'))
  assert.match(colors, /<color name="ft_splash_bg">#FFFFFF<\/color>/i, '셸 흰색(ft_splash_bg)이 #FFFFFF 가 아니다')
  const styles = noXmlComments(read('android', 'app', 'src', 'main', 'res', 'values', 'styles.xml'))
  const v27 = noXmlComments(readIf('android', 'app', 'src', 'main', 'res', 'values-v27', 'styles.xml'))
  const styleBlock = (xml: string, name: string) => new RegExp(`<style name="${name.replace(/\./g, '\\.')}"[^>]*?(?:/>|>[\\s\\S]*?</style>)`).exec(xml)?.[0] ?? ''
  const baseTheme = styleBlock(styles, 'Base.AppTheme.NoActionBar') || styleBlock(styles, 'AppTheme.NoActionBar')
  assert.match(baseTheme, /<item name="android:windowBackground">(@color\/ft_splash_bg|#FFFFFF)<\/item>/i, '앱 화면 테마의 창 바탕이 흰색이 아니다 — 안드로이드 15+ 에선 막대 자리에 창 바탕이 보인다(다크 모드면 검은 띠)')
  assert.ok(!/navigationBarColor/.test(styles), 'values/styles.xml(API 24~26 포함)에 막대 색을 칠했다 — 밝은 막대를 못 그리는 기기에서 흰 버튼이 흰 바탕에 묻힌다')
  const appTheme27 = styleBlock(v27, 'AppTheme.NoActionBar')
  assert.match(appTheme27, /<item name="android:navigationBarColor">(@color\/ft_splash_bg|#FFFFFF)<\/item>/i, 'values-v27 앱 화면 테마의 손짓 막대 색이 흰색이 아니다')
  assert.match(appTheme27, /<item name="android:windowLightNavigationBar">true<\/item>/, 'values-v27 앱 화면 테마에 밝은 막대(어두운 버튼)가 없다')
  assert.match(appTheme27, /parent="Base\.AppTheme\.NoActionBar"/, 'values-v27 앱 화면 테마가 공통 항목(Base)을 이어받지 않는다')
  const cap = stripComments(read('capacitor.config.ts'))
  assert.match(cap, /SystemBars:\s*\{\s*style:\s*'LIGHT',?\s*\}/, "capacitor.config SystemBars.style 이 'LIGHT' 가 아니다 — 다크 모드 폰에서 흰 막대에 흰 버튼이 된다")

  const manifest = noXmlComments(read('android', 'app', 'src', 'main', 'AndroidManifest.xml'))
  const activity = /<activity\b[^>]*android:name="\.MainActivity"[^>]*>/.exec(manifest)?.[0] ?? ''
  assert.ok(activity, 'MainActivity 선언을 못 찾았다')
  const changes = (/android:configChanges="([^"]+)"/.exec(activity)?.[1] ?? '').split('|')
  for (const c of ['fontScale', 'fontWeightAdjustment', 'orientation', 'screenSize', 'uiMode', 'density']) {
    assert.ok(changes.includes(c), `MainActivity configChanges 에 ${c} 가 없다 — 바뀌면 앱이 첫 화면으로 재시작한다`)
  }
  assert.match(activity, /android:screenOrientation="portrait"/, 'MainActivity 가 세로로 고정돼 있지 않다')
  const main = stripComments(read('android', 'app', 'src', 'main', 'java', 'com', 'farmerstail', 'app', 'MainActivity.java'))
  assert.match(main, /public void onConfigurationChanged\(Configuration newConfig\)\s*\{\s*super\.onConfigurationChanged\(newConfig\);\s*applyTextZoom\(newConfig\);/, 'MainActivity 가 글자 크기 변경을 웹뷰에 반영하지 않는다(onConfigurationChanged)')
  assert.match(main, /setTextZoom\(Math\.round\(scale \* 100f\)\)/, '웹뷰 글자 배율을 폰 글자 크기(fontScale)로 맞추지 않는다')
  assert.match(main, /config\.fontScale/, '웹뷰 글자 배율이 fontScale 을 보지 않는다')

  const plist = noXmlComments(read('ios', 'App', 'App', 'Info.plist'))
  const iphone = /<key>UISupportedInterfaceOrientations<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(plist)?.[1] ?? ''
  const orients = [...iphone.matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1])
  assert.deepEqual(orients, ['UIInterfaceOrientationPortrait'], `아이폰 방향이 세로만이 아니다: ${orients.join(', ')}`)

  const err = noXmlComments(read('scripts', 'capacitor-error.html'))
  assert.ok(!/#F5F0E6/i.test(err), '오프라인 안내(error.html)가 옛 크림 바탕(#F5F0E6)이다')
  assert.match(err, /html, body \{[^}]*background: #FFFFFF/, '오프라인 안내 바탕이 흰색이 아니다')
  const btn = /\n {2}a \{([^}]*)\}/.exec(err)?.[1] ?? ''
  assert.match(btn, /background: #141414/, '오프라인 안내 버튼이 먹색 바탕이 아니다')
  assert.match(btn, /color: #FFFFFF/, '오프라인 안내 버튼 글자가 흰색이 아니다')
  const offline = read('app', 'offline', 'page.tsx')
  for (const phrase of ['오프라인 상태예요', '인터넷 연결이 끊어진 것 같아요.', 'Wi-Fi나 모바일 데이터를 확인해 주세요.', '다시 시도하기']) {
    assert.ok(offline.includes(phrase), `웹 /offline(앱 화면)에 '${phrase}' 가 없다 — 이 규칙의 기준 문구를 고칠 것`)
    assert.ok(err.includes(phrase), `오프라인 안내(error.html)의 문구가 앱 /offline 과 다르다 — '${phrase}' 없음`)
  }
  // 원본은 scripts/capacitor-error.html 하나 — 복사본(capacitor-web · android/ios public)은 만들어지는 것이라 커밋하지 않는다.
  assert.ok(read('scripts', 'cap-webdir.mjs').includes("copyFileSync('scripts/capacitor-error.html', 'capacitor-web/error.html')"), 'cap:webdir 이 원본을 복사하지 않는다')
  assert.match(read('.gitignore'), /^\/capacitor-web\/$/m, 'capacitor-web 복사본이 gitignore 밖이다')
  assert.match(read('android', '.gitignore'), /^app\/src\/main\/assets\/public$/m, '안드로이드 public 복사본(cap sync)이 gitignore 밖이다')
  assert.match(read('ios', '.gitignore'), /^App\/App\/public$/m, 'iOS public 복사본(cap sync)이 gitignore 밖이다')
})
