/**
 * 2026-10-14 배포 뒤 점검 묶음 '운영' 의 규칙 214~219 (가지 fix/1014-ops).
 *
 * 문서에만 적은 규칙은 같은 날 또 어긴다 — 고친 것을 테스트로 박는다. 각 규칙은 고치기 전 코드
 * (5866b6c8)에서는 빨간불, 지금 코드에서는 초록불인지 검산했다(카나리아 — 보고서에 결과).
 * 카나리아 실행: AUDIT_ROOT=<옛 파일을 같은 경로로 풀어 둔 폴더> 로 이 파일을 돌리면 그 폴더를 읽는다.
 *
 *   214 O1 포장 목록 — 알레르기 확인 필요 박스는 라벨·조리 합계·CSV 에서 같은 기준으로 빠진다
 *   215 O2 식단 변경 승인 — 진행 중 정기배송의 금액을 못 내면 승인하지 않고 보류
 *   216 O3 결제 웹훅 — 결제 시험 기간의 가게 주문은 토스를 조회하지 않고 200 + 기록만
 *   217 O4·O5 설문 조회 — 강아지 설문은 200마리씩 나눠 묻고, 정기배송 신청은 그 강아지의 최신 설문 한 행으로 판정
 *   218 O6 박스 계산 — 판매하지 않는 레시피(연어) 몫은 알레르기여도 대체 규칙으로 간다
 *   219 O7·O8 어드민 상태 버튼의 송장 중복 확인 · 광고 동의 칸 고객 쓰기 회수(마이그레이션 파일)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()

function read(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n')
}

/** 주석을 걷어낸 본문 — 주석 속 설명이 규칙에 걸리지 않게(lib/audit-rules.test.ts 와 같은 방식). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
}

function code(...parts: string[]): string {
  return stripComments(read(...parts))
}

async function load<T>(...parts: string[]): Promise<T> {
  return (await import(pathToFileURL(join(ROOT, ...parts)).href)) as T
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p)
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────

test("규칙214: 포장 목록 — '알레르기 확인 필요'(담지 못한 몫) 박스는 라벨·조리 합계·CSV 에서 같은 기준(ship-block)으로 빠진다 (O1)", async () => {
  /**
   * # 왜 (2026-10-14 점검 O1)
   * 화면은 빨간 '확인 필요 — 이대로 보내지 마세요'를 띄우는데, 발송 판정(shipBlockReason)에 담지 못한 몫(held)이 없어
   * 배송 라벨이 인쇄되고(ShippingLabels) 조리 합계에 들어가고(page rows.filter(isShippable)) CSV 엔 '청구완료'로 나갔다.
   */
  const sb = await load<typeof import('./admin/ship-block.ts')>('lib', 'admin', 'ship-block.ts')
  const clean = {
    cannotCharge: false,
    chargeFailedToday: false,
    pausedBeforeCharge: false,
    skippedNotCharged: false,
    overdueNotCharged: false,
    notChargedAfterRun: false,
    alreadyShipped: null,
  }
  const held = [{ name: '한우 레시피', reason: '처방에 알레르기 레시피가 들어 있어요' }]
  assert.equal(sb.shipBlockReason({ ...clean, held } as Parameters<typeof sb.shipBlockReason>[0]), 'allergy_check_needed', '담지 못한 몫이 있는데 발송 가능으로 판정한다')
  assert.equal(sb.isShippable({ ...clean, held } as Parameters<typeof sb.isShippable>[0]), false, '담지 못한 몫이 있는 박스가 라벨·조리 합계에 들어간다')
  assert.equal(sb.shipBlockReason({ ...clean, held: [] } as Parameters<typeof sb.shipBlockReason>[0]), null, '빈 held 를 막는다(정상 박스까지 멈춘다)')
  // 돈 사유와 겹치면 돈 사유가 먼저(화면 배지와 같은 순서) — 그래도 발송 금지.
  assert.equal(sb.shipBlockReason({ ...clean, cannotCharge: true, held } as Parameters<typeof sb.shipBlockReason>[0]), 'cannot_charge')
  const labels = sb.SHIP_BLOCK_LABEL as Record<string, string>
  assert.match(labels.allergy_check_needed ?? '', /알레르기.*발송금지/, "CSV 에 보일 '알레르기 확인 필요' 라벨이 없다")

  // 세 곳이 같은 함수를 쓴다.
  const labelsSrc = code('app', 'admin', 'personalization', 'picking-list', 'ShippingLabels.tsx')
  assert.match(labelsSrc, /\.filter\(isShippable\)/, '배송 라벨이 발송 판정 정본(isShippable)을 안 쓴다')
  const page = code('app', 'admin', 'personalization', 'picking-list', 'page.tsx')
  assert.match(page, /const shippable = rows\.filter\(isShippable\)/, '조리 합계가 발송 판정 정본(isShippable)을 안 쓴다')
  assert.match(page, /held,\s*boxTotalG:/, '행(PickingRow)에 담지 못한 몫(held)이 안 실린다 — 판정이 볼 수 없다')
  assert.match(page, /\) : payBlockReason\(r\) \? \([\s\S]{0,600}\) : r\.held\.length > 0 \? \(\s*[\s\S]{0,200}알레르기 확인 필요 — 보내지 마세요/, '화면 배지가 판정 순서(돈 사유 → 알레르기 확인)와 다르다')
  assert.match(page, /if \(r\.notChargedAfterRun\) return '[^']+'\s*return null/, "돈 사유 마지막('아침 결제 아직')이 빠졌다")
  const csv = code('app', 'admin', 'personalization', 'picking-list', 'PickingListExport.tsx')
  assert.match(csv, /상태: shipBlockReason\(r\)/, 'CSV 상태 칸이 발송 판정 정본을 안 쓴다')
  assert.match(csv, /hasAllergyHold\(r\)[\s\S]{0,200}SHIP_BLOCK_LABEL\.allergy_check_needed/, 'CSV 가 돈 사유에 가려진 알레르기 확인을 덧붙이지 않는다')
})

test('규칙215: 식단 변경 승인 — 진행 중 정기배송이 있는데 금액을 못 내면(설문 조회 실패·담지 못한 몫) 승인하지 않고 보류한다 (O2)', () => {
  /**
   * # 왜 (2026-10-14 점검 O2)
   * boxForApproved 가 null 이면 '금액 미변경'으로 읽고 식단만 approved 로 바꿨다 — 다음 박스는 새 구성, 청구는 옛 금액,
   * 적용일은 오늘. '동의 금액과 다름' 분기가 막으려던 '새 박스 + 옛 금액'이 이 길로 다시 열렸다.
   */
  const ap = code('app', 'api', 'personalization', 'approve', 'route.ts')
  const holdAt = ap.indexOf("if (quote.kind === 'unavailable') {")
  const approveAt = ap.indexOf("approval_status: 'approved'")
  assert.ok(holdAt > 0, '금액을 못 낸 경우를 가르지 않는다(null 이면 식단만 승인)')
  assert.ok(approveAt > holdAt, '보류 판단이 식단 승인(approved 전이)보다 뒤에 있다')
  const hold = ap.slice(holdAt, ap.indexOf('return NextResponse.json', holdAt) + 400)
  assert.match(hold, /notApproved: true/, '보류 응답이 notApproved 가 아니다 — 화면이 "바뀌었어요"라고 말한다')
  assert.match(hold, /priceUpdated: false/)
  assert.match(hold, /message: AMOUNT_UNAVAILABLE_MESSAGE/, '보류 응답에 안내 문구가 없다')
  // 세 갈래 — 진행 중 정기배송이 없을 때만 식단만 승인.
  const fn = ap.slice(ap.indexOf('async function boxForApproved('))
  assert.ok(!/return null/.test(fn), "boxForApproved 가 아직 null 을 돌려준다 — '없음'과 '계산 실패'가 구분되지 않는다")
  assert.match(fn, /if \(subErr\) \{[\s\S]{0,200}kind: 'unavailable', reason: 'subscription_lookup_failed'/, '구독 조회 실패를 "정기배송 없음"으로 읽는다')
  assert.match(fn, /if \(!subRow\) return \{ kind: 'no_subscription' \}/)
  assert.match(fn, /if \(!blocks\.ok\) \{[\s\S]{0,200}kind: 'unavailable', reason: 'survey_lookup_failed'/, '설문 조회 실패를 보류로 보내지 않는다')
  assert.match(fn, /if \(!quote\) return \{ kind: 'unavailable', reason: 'quote_unavailable'/, '견적 없음(담지 못한 몫 등)을 보류로 보내지 않는다')
  // 문구 — 다시 시도·상담 안내, 금지어 없음.
  const msg = /const AMOUNT_UNAVAILABLE_MESSAGE =\s*'([^']+)'/.exec(read('app', 'api', 'personalization', 'approve', 'route.ts'))?.[1] ?? ''
  assert.ok(msg.includes('다시 시도') && msg.includes('카카오톡'), `보류 문구에 다시 시도·상담 안내가 없다: ${msg}`)
  assert.ok(!/처방|언제든/.test(msg), `보류 문구에 금지어: ${msg}`)
  // 웹 금액 동의 창도 보류(notApproved)를 성공으로 말하지 않는다.
  const modal = code('app', 'account', 'subscriptions', 'PriceChangeConsentModal.tsx')
  assert.match(modal, /decision === 'approve' && \(b\.amountMismatch \|\| b\.notApproved\)/, "금액 동의 창이 보류를 '새 레시피로 바꿨어요'로 말한다")
})

test('규칙216: 결제 웹훅 — 결제 시험 기간의 가게 주문(FTS-)은 토스를 조회하지 않고 200 + 기록(info)만 (O3)', () => {
  /**
   * # 왜 (2026-10-14 점검 O3)
   * 시험 기간엔 위젯 시크릿이 없어 조회가 tossSecretKey throw → TOSS_NETWORK → 500. 토스가 재전송을 반복하고 그때마다
   * '조회 실패' 오류 알림이 갔다. 이 기간엔 승인 라우트가 가게 결제를 승인하지 않으므로(규칙209) 반영할 결제가 없다.
   */
  const wh = code('app', 'api', 'payments', 'webhook', 'route.ts')
  const guardAt = wh.indexOf("if (merchantForOrderNumber(orderId) === 'widget' && storeConfirmTestOnly()) {")
  const fetchAt = wh.indexOf('await fetchPayment(')
  assert.ok(guardAt > 0, '웹훅이 결제 시험 기간(storeConfirmTestOnly)을 보지 않는다')
  assert.ok(fetchAt > guardAt, '시험 기간 판단보다 토스 조회가 먼저다')
  const guard = wh.slice(guardAt, fetchAt)
  assert.match(guard, /captureBusinessEvent\('info', 'payment\.webhook\.store_test_mode_skipped'/, '건너뛴 사실을 기록(info)하지 않는다')
  assert.match(guard, /return NextResponse\.json\([\s\S]{0,120}\{ status: 200 \}/, '시험 기간 가게 웹훅에 200 을 돌려주지 않는다(재전송 반복)')
  assert.doesNotMatch(guard, /status: 5\d\d/, '시험 기간 가게 웹훅이 5xx 를 돌려준다')
  assert.match(wh, /import \{ storeConfirmTestOnly \} from '@\/lib\/store\/toss-widget'/, '승인 라우트와 같은 판정 함수를 쓰지 않는다')
})

test('규칙217: 설문 조회 — 강아지 설문은 200마리씩 나눠 묻고, 정기배송 신청은 그 강아지의 최신 설문 한 행으로 알레르기·췌장염을 판정 (O4·O5)', async () => {
  /**
   * # 왜 (2026-10-14 점검 O4·O5)
   * O4: loadBlockedLinesByDog 가 강아지 id 를 한 번에 .in() 으로 물어, 약 390마리부터 주소 머리 16KB 한도로 실패 → 포장 목록 전체가
   *     '설문 조회 실패'로 멈춘다(규칙190 과 같은 병).
   * O5: 정기배송 신청 API 만 .eq('user_id', user.id) 로 본인 설문만 읽었다 — 가족이 나중에 알레르기를 더한 설문을 주문 화면·포장 목록은
   *     보는데 신청 API 는 못 봐서 판정이 갈라졌다. 췌장염 판정도 같은 행이어야 한다.
   */
  const m = await load<typeof import('./personalization/dogAllergyBlocks.ts')>('lib', 'personalization', 'dogAllergyBlocks.ts')
  const ids = Array.from({ length: 450 }, (_, i) => `dog-${String(i).padStart(3, '0')}`)
  const calls: Array<{ cols: string; n: number }> = []
  const rowsFor = (chunk: string[]) =>
    chunk.flatMap((id) => [
      { dog_id: id, answers: { allergies: ['오리'] }, chronic_conditions: [], created_at: '2026-09-01T00:00:00Z' },
      { dog_id: id, answers: { allergies: ['소고기'] }, chronic_conditions: ['pancreatitis'], created_at: '2026-10-01T00:00:00Z' },
    ])
  const client = (fail = false) => ({
    from: () => ({
      select: (cols: string) => ({
        in: (_col: string, chunk: string[]) => ({
          order: () => {
            calls.push({ cols, n: chunk.length })
            return Promise.resolve(fail && calls.length === 2 ? { data: null, error: { message: 'boom' } } : { data: rowsFor(chunk), error: null })
          },
        }),
      }),
    }),
  })
  const r = await m.loadBlockedLinesByDog(client(), ids)
  assert.ok(r.ok, '정상 조회가 실패로 나온다')
  assert.ok(calls.length >= 3 && calls.every((c) => c.n <= 200), `강아지 id 를 200개씩 나눠 묻지 않는다: ${calls.map((c) => c.n).join(',')}`)
  if (r.ok) {
    assert.equal(r.byDog.size, 450, '묶음을 합치지 않았다')
    assert.deepEqual(r.byDog.get('dog-449'), ['premium'], '강아지마다 최신 설문(소고기)이 아니다')
  }
  calls.length = 0
  const failed = await m.loadBlockedLinesByDog(client(true), ids)
  assert.equal(failed.ok, false, '한 묶음이 실패했는데 부분 결과로 판정한다(규칙1)')

  // 한 마리 — 최신 설문 한 행(알레르기·췌장염 같은 행).
  calls.length = 0
  const one = await m.loadDogLatestSurvey(client(), 'dog-001')
  assert.ok(one.ok)
  if (one.ok) {
    assert.deepEqual(one.blockedLines, ['premium'])
    assert.deepEqual(one.survey?.chronic_conditions, ['pancreatitis'], '췌장염 판정용 칸이 같은 최신 행에서 오지 않는다')
  }
  assert.ok(calls.every((c) => c.cols.includes('chronic_conditions')), '최신 설문 조회가 chronic_conditions 를 안 읽는다')

  const create = code('app', 'api', 'subscriptions', 'create', 'route.ts')
  assert.ok(!/from\('surveys'\)/.test(create), "정기배송 신청 API 가 설문을 직접(본인 것만) 읽는다 — '그 강아지의 최신 설문' 도우미를 쓸 것")
  assert.match(create, /const latest = await loadDogLatestSurvey\(supabase, body\.dogId\)/, '정기배송 신청이 강아지 최신 설문 도우미를 안 쓴다')
  assert.match(create, /if \(!latest\.ok\) \{[\s\S]{0,300}status: 503/, '설문 조회 실패를 "알레르기 없음"으로 넘긴다')
  assert.match(create, /const latestSurvey = latest\.survey/, '췌장염 판정이 같은 행을 보지 않는다')
  assert.match(create, /chronicConditions: \(latestSurvey as/, '췌장염 판정이 최신 설문 행의 chronic_conditions 를 안 본다')
})

test('규칙218: 박스 계산 — 판매하지 않는 레시피(연어) 몫은 알레르기여도 대체 규칙(알레르기 아닌 판매 레시피)으로 간다 (O6)', async () => {
  /**
   * # 왜 (2026-10-14 점검 O6)
   * computeBoxPlan 이 막힌 라인을 판매 여부와 상관없이 먼저 '처방에 알레르기 레시피'(held)로 뺐다. 처방에 연어(판매 안 함) 몫이
   * 있고 생선 알레르기면, 오리 등으로 옮겨질 몫이 '확인 필요'로 막혀 주문·견적·포장이 멈췄다.
   * (기존 규칙183 — 1,920조합에서 박스에 알레르기 레시피 0번 — 은 그대로 초록이어야 한다.)
   */
  const bp = await load<typeof import('./personalization/boxPricing.ts')>('lib', 'personalization', 'boxPricing.ts')
  const { LINE_TO_SLUG } = await load<typeof import('./personalization/skuMap.ts')>('lib', 'personalization', 'skuMap.ts')
  const product = (slug: string) => ({ slug, price: 2000, sale_price: 1700, stock: 50, is_subscribable: true, nutrition_facts: null })
  const sold = ['weight', 'basic', 'joint', 'premium'] as const
  const products: Record<string, ReturnType<typeof product>> = {}
  for (const l of sold) products[LINE_TO_SLUG[l]!] = product(LINE_TO_SLUG[l]!)
  const ratios = (r: Record<string, number>) => ({ basic: 0, weight: 0, skin: 0, premium: 0, joint: 0, ...r })
  const plan = (r: Record<string, number>, blockedLines: Array<'basic' | 'weight' | 'skin' | 'premium' | 'joint'>, prods = products) =>
    bp.computeBoxPlan({ formula: { lineRatios: ratios(r), toppers: { protein: 0, vegetable: 0 }, dailyKcal: 400 }, freshRatio: 50, products: prods, blockedLines })

  // 연어 100% + 생선 알레르기 → 오리로(대체 1순위), 확인 필요 없음.
  const a = plan({ skin: 1 }, ['skin'])
  assert.deepEqual(a.held, [], `연어(판매 안 함) 몫이 생선 알레르기 때문에 '확인 필요'로 막힌다: ${JSON.stringify(a.held)}`)
  assert.deepEqual(a.items.map((i) => i.line), ['basic'], '연어 몫이 오리로 대체되지 않는다')
  // 연어 50 + 치킨 50 + 생선 알레르기 → 치킨 + 오리.
  const b = plan({ skin: 0.5, weight: 0.5 }, ['skin'])
  assert.deepEqual(b.held, [])
  assert.deepEqual(b.items.map((i) => i.line).sort(), ['basic', 'weight'])
  // 생선 + 오리 알레르기 → 연어 몫은 오리를 건너뛰고 다른 안전한 판매 레시피로(박스에 알레르기 0).
  const c = plan({ skin: 1 }, ['skin', 'basic'])
  assert.deepEqual(c.held, [])
  assert.ok(c.items.length > 0 && c.items.every((i) => i.line !== 'skin' && i.line !== 'basic'), `알레르기 레시피가 박스에 들어갔다: ${c.items.map((i) => i.line)}`)
  // 판매 중인 알레르기 레시피가 처방에 있으면 예전처럼 '확인 필요'.
  const d = plan({ premium: 1 }, ['premium'])
  assert.deepEqual(d.held.map((h) => `${h.line}:${h.reason}`), ['premium:allergen_in_formula'], '판매 중인 알레르기 레시피를 조용히 바꾼다')
  // 판매 레시피가 하나도 없으면 대체 규칙이 돌지 않는다 — 몫이 조용히 사라지지 않게 '확인 필요'.
  const e = plan({ skin: 1 }, ['skin'], {})
  assert.deepEqual(e.held.map((h) => h.line), ['skin'], '판매 레시피가 없을 때 알레르기 몫이 조용히 사라진다')
})

test('규칙219: 어드민 주문 상태 버튼은 송장 중복(409)을 확인 받고 다시 보낸다 · 광고 동의 칸은 고객이 직접 못 쓴다(마이그레이션 파일) (O7·O8)', () => {
  /**
   * # 왜 (2026-10-14 점검 O7·O8)
   * O7: 저장된 송장으로 '배송 중'을 다시 누르면 서버가 송장 중복을 409 로 묻는데(규칙198), 상태 버튼은 그걸 '변경 실패'로만 띄웠다.
   * O8: profiles 의 고객 UPDATE 화이트리스트에 동의 칸 5개가 남아(운영 실측), 고객이 동의 값을 바꾸면 동의 기록(consent_log) 없이 값만 바뀐다.
   */
  const ctl = code('app', 'admin', 'orders', '[id]', 'OrderStatusControl.tsx')
  // 2026-10-14 규칙239 — 밤 알림 확인 값(nightPush)이 같은 본문에 덧붙을 수 있다.
  assert.match(ctl, /body: JSON\.stringify\(\{ orderStatus: next, confirmDuplicate(, nightPush)? \}\)/, '상태 버튼이 confirmDuplicate 를 보내지 않는다')
  assert.match(ctl, /if \(res\.status === 409\) \{[\s\S]{0,300}data\.code === DUPLICATE_TRACKING \|\| data\.code === DUPLICATE_TRACKING_CHECK_FAILED/, '상태 버튼이 송장 중복 409 를 가르지 않는다')
  assert.match(ctl, /window\.confirm\([\s\S]{0,200}res = await send\(true\)/, '확인 창 뒤 confirmDuplicate:true 로 다시 보내지 않는다')

  // 마이그레이션 — 파일만(메인이 적용). 회수 + 자기 검증.
  const dir = join(ROOT, 'supabase', 'migrations')
  const f = readdirSync(dir).find((n) => n === '20261014100000_profiles_revoke_consent_columns.sql')
  assert.ok(f, '동의 칸 회수 마이그레이션 파일이 없다')
  const mig = readFileSync(join(dir, f!), 'utf8').replace(/\r\n/g, '\n')
  assert.match(mig, /revoke update \(agree_email, agree_email_at, agree_sms, agree_sms_at, marketing_policy_version\)\s*on public\.profiles from authenticated, anon;/, '동의 칸 5개를 고객에게서 회수하지 않는다')
  assert.match(mig, /has_column_privilege\('authenticated', 'public\.profiles', c, 'update'\)[\s\S]{0,200}raise exception '고객이 profiles\.% 를 아직 쓸 수 있다'/, '자기 검증이 회수 결과를 확인하지 않는다')
  for (const col of ['name', 'phone', 'zip', 'address', 'address_detail', 'birth_year', 'birth_month', 'birth_day', 'onboarded_at']) {
    assert.ok(mig.includes(`'${col}'`), `자기 검증이 허용 칸 ${col} 이 그대로인지 보지 않는다`)
  }
  assert.match(mig, /proname = 'set_marketing_consent' and p\.prosecdef/, '자기 검증이 동의 RPC(SECURITY DEFINER)가 살아 있는지 보지 않는다')
  assert.ok(!/^\s*(grant|alter table|drop)\b/im.test(mig), '회수 마이그레이션에 다른 변경이 섞였다')

  // 코드 — 동의 칸을 profiles 에 직접 쓰는 곳은 service_role 경로(탈퇴·수신거부 웹훅)뿐. 고객 화면은 RPC.
  const writers: string[] = []
  for (const p of [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib')), ...walk(join(ROOT, 'components')), ...walk(join(ROOT, 'hooks'))]) {
    const src = stripComments(readFileSync(p, 'utf8').replace(/\r\n/g, '\n'))
    if (/from\('profiles'\)\s*\.(update|upsert|insert)\(\{[^}]*\b(agree_email|agree_sms|marketing_policy_version)\b/.test(src)) {
      writers.push(relative(ROOT, p).split(sep).join('/'))
    }
  }
  assert.deepEqual(writers.sort(), ['app/api/account/delete/route.ts', 'app/api/webhooks/resend/route.ts'], `동의 칸을 profiles 에 직접 쓰는 곳이 늘었다: ${writers.join(', ')}`)
  const del = code('app', 'api', 'account', 'delete', 'route.ts')
  assert.match(del, /await admin\s*\.from\('profiles'\)\s*\.update\(\{[\s\S]{0,400}agree_email: false/, '탈퇴가 동의 칸을 service_role(admin)로 쓰지 않는다')
  assert.match(code('app', 'api', 'webhooks', 'resend', 'route.ts'), /supabase: ReturnType<typeof createAdminClient>/, '수신거부 웹훅이 service_role 이 아니다')
  for (const f2 of [['app', '(main)', 'mypage', 'consent', 'ConsentSettingsClient.tsx'], ['app', 'account', 'notifications', 'ConsentWebClient.tsx'], ['lib', 'auth', 'applySignupProfile.ts']]) {
    assert.match(code(...f2), /\.rpc\('set_marketing_consent'/, `${f2.join('/')}: 동의를 RPC 로 바꾸지 않는다`)
  }
})
