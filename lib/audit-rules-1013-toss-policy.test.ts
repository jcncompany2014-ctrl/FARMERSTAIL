/**
 * 2026-10-13 토스 일반결제(결제위젯) 홈페이지 심사 준비 — '정책·문서' 묶음의 규칙 206~208 (가지 fix/1013-toss-policy).
 *
 * 문서에만 적은 규칙은 같은 날 또 어긴다 — 고친 것을 테스트로 박는다. 각 규칙은 고치기 전 코드(54b8ecd3)에서는 빨간불,
 * 지금 코드에서는 초록불인지 검산했다(카나리아). 카나리아 실행: AUDIT_ROOT=<옛 파일을 같은 경로로 풀어 둔 폴더> 로
 * 이 파일을 돌리면 그 폴더를 읽는다(lib/audit-rules-1013-ops.test.ts 와 같은 방식).
 *
 * 사장님 결정(10/13): 반품 배송비 = 단순 변심 편도 5,000원 · 5만 원 이상 무료배송으로 받았다면 왕복 10,000원 · 하자·오배송은
 * 회사 부담(정본 lib/store/shipping 의 returnShippingFeeFor) · 환불 조건 문장 하나(해요체·합니다체 정본 아래) ·
 * 전화·카카오톡은 '물어보는 곳'(토스 밖 직거래 주문으로 읽히지 않게) · 결제수단 카드·간편결제만.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()

function read(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n')
}

/** 주석을 걷어낸 본문 — 주석 속 설명이 규칙에 걸리지 않게(lib/audit-rules.test.ts 와 같은 방식). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
}

/** 주석을 걷고 공백을 한 칸으로 — JSX 는 문장을 아무 데서나 접으므로 줄바꿈을 넘어 문장을 찾는다. */
function flat(...parts: string[]): string {
  return stripComments(read(...parts)).replace(/\s+/g, ' ')
}

async function load<T>(...parts: string[]): Promise<T> {
  return (await import(pathToFileURL(join(ROOT, ...parts)).href)) as T
}

const won = (n: number) => n.toLocaleString('ko-KR')

/** 환불 조건 정본 — 합니다체(약관·정책). */
const CANON_REFUND = '상품을 받은 날부터 7일 이내, 진공 포장(팩)을 개봉하지 않았다면 청약철회(환불)할 수 있습니다.'
const CANON_BOX_OK = '상품을 확인하려고 배송 상자를 연 것은 개봉으로 보지 않습니다.'
/** 환불 조건 정본 — 해요체(가게 화면·FAQ). */
const CANON_REFUND_HAEYO = '받은 날부터 7일 안, 팩(진공 포장)을 뜯지 않았다면 환불돼요. 상자를 열어 확인한 건 괜찮아요.'
/** 옛 환불 문구 — 하나로 바꾸기 전의 여러 말투. */
const OLD_REFUND_COPY = /뜯지 않은 상품|개봉·섭취한 식품 제외|그 밖의 주문은 상품 수령 후 7일/

test('규칙206: 배송·교환·환불 정책 — 맨 앞 웹 스토어 단품 절 · 반품 배송비는 정본 함수로 · 환불 조건 문장 하나', async () => {
  const src = stripComments(read('app', 'legal', 'refund', 'page.tsx'))
  const doc = flat('app', 'legal', 'refund', 'page.tsx')

  assert.match(src, /const TITLE = '배송·교환·환불 정책'/, "제목이 '배송·교환·환불 정책'이 아니다")
  assert.match(src, /const EFFECTIVE_DATE = '2026-10-13'/, '시행일을 10/13 으로 올리지 않았다')

  // 단품 절이 요약 다음 맨 앞, 그 아래 정기배송 절.
  const iStore = doc.indexOf('title="Ⅰ. 웹 스토어 단품"')
  const iSub = doc.indexOf('title="Ⅱ. 앱 정기배송"')
  assert.ok(iStore > 0, '웹 스토어 단품 절이 없다')
  assert.ok(iSub > iStore, '정기배송 절이 단품 절 아래에 없다')
  assert.ok(iStore < doc.indexOf('<Section'), '단품 절이 맨 앞이 아니다(다른 장이 먼저 나온다)')

  const store = doc.slice(iStore, iSub)
  const NEED: Array<[string, string]> = [
    ['won(SHIPPING_FEE)', '배송비를 정본 상수로 그리지 않는다'],
    ['won(FREE_SHIPPING_MIN)', '무료배송 기준을 정본 상수로 그리지 않는다'],
    ['화요일과 목요일', '출고 요일(화·목)이 없다'],
    ['출고일 전날 밤 12시', '주문 마감(출고 전날 밤 12시)이 없다'],
    ['하루나 이틀', "도착을 '하루나 이틀'로 말하지 않는다"],
    ['도서·산간 추가 배송비 없음', '도서·산간 배송비가 약관 제8조(추가 배송비 없음)와 다르다'],
    ['&ldquo;주문 취소&rdquo;', '출고 전 셀프 취소 경로가 없다'],
    ['&lsquo;준비 중&rsquo;', '셀프 취소가 되는 상태(준비 중)를 말하지 않는다'],
    [CANON_REFUND, '환불 조건 합니다체 정본 문장이 없다'],
    [CANON_BOX_OK, "'상자를 연 것은 개봉 아님' 정본 문장이 없다"],
    ['전자상거래법 제17조 제2항', '청약철회 제한의 법 근거가 없다'],
    ['won(RETURN_FEE_ONE_WAY)', '편도 반품 배송비를 정본 함수 값으로 그리지 않는다'],
    ['won(RETURN_FEE_ROUND_TRIP)', '왕복 반품 배송비를 정본 함수 값으로 그리지 않는다'],
    ['전액 회사 부담', '하자·오배송 배송비 회사 부담이 없다'],
    ['보낼 곳과 보내는 방법을 안내', '반품 접수(고객센터에 먼저 알리면 보낼 곳 안내)가 없다'],
    ['{CUSTOMER_CENTER_HOURS}', '고객센터 운영시간을 정본 상수로 쓰지 않는다'],
    ['3영업일 이내에 결제를 취소', '환불 시기(확인 뒤 3영업일)가 없다'],
    ['카드 승인 취소', '카드 환불 방법(승인 취소)이 없다'],
    ['결제한 간편결제 수단으로 취소', '간편결제 환불 방법이 없다'],
    ['3개월 이내', '하자 3개월(법정)이 없다'],
  ]
  for (const [k, why] of NEED) assert.ok(store.includes(k), `단품 절: ${why} — '${k}'`)

  // 반품 배송비는 정본(lib/store/shipping)에서 계산한다 — 손으로 적은 금액 0.
  assert.match(src, /import \{[^}]*returnShippingFeeFor[^}]*\} from '@\/lib\/store\/shipping'/, '반품 배송비 정본 함수를 안 쓴다')
  assert.match(src, /const RETURN_FEE_ONE_WAY = returnShippingFeeFor\(SHIPPING_FEE\)/, '편도 반품 배송비 계산이 정본과 다르다')
  assert.match(src, /const RETURN_FEE_ROUND_TRIP = returnShippingFeeFor\(0\)/, '왕복 반품 배송비 계산이 정본과 다르다')
  assert.doesNotMatch(src, /\d{1,3}[,_]\d{3}|\b\d{4,5}\s*원/, '환불정책에 금액을 손으로 적었다 — lib/store/shipping 상수로')

  // 옛 말투 0 · 확인 안 된 약속 0 · 정기배송 절 안의 항 번호가 새 번호를 가리킨다.
  assert.doesNotMatch(doc, OLD_REFUND_COPY, '환불정책에 옛 환불 문구가 남았다')
  assert.doesNotMatch(doc, /회수 기사|방문 회수|기사님이 방문|직접 수거/, '환불정책이 확인 안 된 회수 방법을 약속한다')
  assert.ok(doc.includes('10항 기준을 따르며') && doc.includes('13항에 따라 환불'), '정기배송 절이 옛 항 번호(2항·5항)를 가리킨다')

  // 정본 함수의 값 — 사장님 결정(편도 5,000원·무료배송이면 왕복 10,000원).
  const ship = await load<typeof import('./store/shipping.ts')>('lib', 'store', 'shipping.ts')
  assert.equal(ship.returnShippingFeeFor(ship.SHIPPING_FEE), 5_000)
  assert.equal(ship.returnShippingFeeFor(0), 10_000)

  // 가게 FAQ — 해요체 정본 + 반품 배송비(정본 함수) · 팩 무게는 상수로(단품 100g·체험팩 50g 이 섞이지 않게).
  const faq = await load<typeof import('./store/faq.ts')>('lib', 'store', 'faq.ts')
  const refundQa = faq.STORE_FAQ.find((x) => x.q.includes('환불'))
  assert.ok(refundQa, '가게 FAQ 에 환불 질문이 없다')
  assert.ok(refundQa!.a.startsWith(CANON_REFUND_HAEYO), `가게 FAQ 환불 답이 해요체 정본으로 시작하지 않는다: ${refundQa!.a}`)
  assert.ok(refundQa!.a.includes(`편도 ${won(ship.returnShippingFeeFor(ship.SHIPPING_FEE))}원`), '가게 FAQ 에 편도 반품 배송비가 없다')
  assert.ok(refundQa!.a.includes(`왕복 ${won(ship.returnShippingFeeFor(0))}원`), '가게 FAQ 에 왕복 반품 배송비가 없다')
  const faqSrc = stripComments(read('lib', 'store', 'faq.ts'))
  assert.match(faqSrc, /returnShippingFeeFor\(SHIPPING_FEE\)/, '가게 FAQ 가 반품 배송비를 정본 함수로 계산하지 않는다')
  assert.doesNotMatch(faqSrc, OLD_REFUND_COPY, '가게 FAQ 에 옛 환불 문구가 남았다')
  assert.doesNotMatch(faqSrc, /\b(100|50)g/, '가게 FAQ 에 팩 무게를 손으로 적었다 — PACK_G·TRIAL_PACK_G 로')
  const trialQa = faq.STORE_FAQ.find((x) => x.a.includes('체험팩'))
  const catalog = await load<typeof import('./store/catalog.ts')>('lib', 'store', 'catalog.ts')
  assert.ok(trialQa && trialQa.a.includes(`${catalog.TRIAL_PACK_G}g씩`), '가게 FAQ 체험팩 팩 무게가 정본(TRIAL_PACK_G)과 다르다')

  // 사업자 정보 '결제와 환불' — 단품 먼저, 정기배송은 '앱 정기배송은'. 단품 문장은 2026-10-14 부터 정본 + 반품 배송비 한 줄(규칙222).
  const biz = flat('app', 'business', 'page.tsx')
  assert.ok(
    biz.includes('웹 스토어 단품은 {REFUND_RULE_HAEYO}') && biz.includes('이에요. 앱 정기배송은 결제 전까지'),
    "사업자 정보 '결제와 환불'에 단품 환불 문장(맨 앞)·'앱 정기배송은'이 없다",
  )
})

test("규칙207: 가게 바닥·메뉴 — '주문을 도와드려요' 0회 · 호스팅 · 운영시간은 한 상수 · 사업자 정보 링크 · 주소 라벨", async () => {
  const b = await load<typeof import('./business.ts')>('lib', 'business.ts')
  assert.equal(b.CUSTOMER_CENTER_HOURS, '평일 10:00–18:00', '고객센터 운영시간 상수가 없거나 문의하기 화면 값과 다르다')
  assert.ok(b.business.hostingProvider.length > 0, '호스팅 제공자가 비었다')

  for (const [name, parts] of [
    ['바닥', ['components', 'store', 'StoreFooter.tsx']],
    ['메뉴', ['components', 'store', 'StoreMenu.tsx']],
  ] as const) {
    const src = flat(...parts)
    assert.ok(!src.includes('주문을 도와드려요'), `${name}: 전화·카카오톡 '주문을 도와드려요'(토스 밖 직거래로 읽힌다)가 남았다`)
    assert.ok(src.includes('주문이 어렵거나 궁금하면 전화·카카오톡으로 물어보세요'), `${name}: 바꾼 문구(물어보세요)가 없다`)
    assert.match(src, /import \{[^}]*CUSTOMER_CENTER_HOURS[^}]*\} from '@\/lib\/business'/, `${name}: 운영시간 정본 상수를 안 읽는다`)
    assert.ok(src.includes('{CUSTOMER_CENTER_HOURS}'), `${name}: 운영시간을 그리지 않는다`)
    assert.doesNotMatch(src, /평일 \d/, `${name}: 운영시간을 손으로 적었다 — CUSTOMER_CENTER_HOURS 로`)
  }

  const footer = flat('components', 'store', 'StoreFooter.tsx')
  assert.ok(footer.includes('호스팅 {business.hostingProvider}'), '바닥 사업자 줄에 호스팅 제공자가 없다')
  assert.ok(footer.includes('주소 {business.address}'), "바닥 주소 앞에 '주소' 라벨이 없다")
  assert.ok(footer.includes('고객센터 {business.phone} ({CUSTOMER_CENTER_HOURS})'), '바닥 고객센터 줄에 운영시간이 없다')
  const legalNav = footer.slice(footer.indexOf('aria-label="약관과 정책"'), footer.indexOf('</nav>', footer.indexOf('aria-label="약관과 정책"')))
  assert.ok(legalNav.includes('href="/business"'), '바닥 약관 줄에 사업자 정보(/business) 링크가 없다')
  assert.ok(legalNav.includes('href="/legal/refund"') && legalNav.includes('배송·교환·환불 정책'), "바닥 약관 줄의 환불정책 링크 이름이 문서 제목('배송·교환·환불 정책')과 다르다")

  const contact = flat('app', 'contact', 'page.tsx')
  assert.ok(contact.includes('label={`전화 · ${CUSTOMER_CENTER_HOURS}`}'), '문의하기 화면이 운영시간 정본 상수를 안 쓴다')
  assert.doesNotMatch(contact, /평일 \d/, '문의하기 화면에 운영시간을 손으로 적었다')
})

test("규칙208: 이용약관 — 제6조 미성년자 취소권 · 제13조 관할은 전자상거래 표준약관 방식('회사 소재지' 전속관할 0회) · 환불 문장 정본 · 반품 배송비 정본", () => {
  const src = stripComments(read('app', 'legal', 'terms', 'page.tsx'))
  const doc = src.replace(/\s+/g, ' ')
  const eff = src.match(/const EFFECTIVE_DATE = '(\d{4}-\d{2}-\d{2})'/)?.[1] ?? ''
  assert.ok(eff >= '2026-10-13', '약관 시행일을 10/13 으로 올리지 않았다')

  const art = (n: number) => doc.slice(doc.indexOf(`number={${n}}`), doc.indexOf(`number={${n + 1}}`))
  assert.ok(
    art(6).includes('미성년자가 법정대리인의 동의 없이 구매 계약을 체결한 경우, 미성년자 본인 또는 법정대리인이 그 계약을 취소할 수 있습니다.'),
    '제6조(주문 및 계약 성립)에 미성년자 취소권 조항이 없다',
  )
  assert.ok(
    art(13).includes(
      '회사와 회원 사이에 제기된 전자상거래 소송은 제소 당시 회원의 주소에 의하고, 주소가 없는 경우에는 거소를 관할하는 지방법원의 전속관할로 합니다. 다만 제소 당시 회원의 주소 또는 거소가 분명하지 않거나 외국 거주자의 경우에는 민사소송법상의 관할법원에 제기합니다.',
    ),
    '제13조 관할이 전자상거래 표준약관 방식(회원 주소·거소 관할)이 아니다',
  )
  assert.doesNotMatch(doc, /회사의? (본사 )?소재지 관할|소재지 관할 법원을 전속/, "약관에 '회사 소재지 전속관할'이 남았다")

  // 요약과 제9조 — 2026-10-14 사장님 결정으로 ①은 10/13 전 문장('7일 이내 별도 사유 없이 철회'), 팩 조건은 ② 법정 제한 사유의
  // 예시로만(규칙224 가 지킨다 — 제9조는 정기배송 회원에게도 적용돼 ①에 조건을 붙이면 불리한 변경으로 읽힌다). 여기선 '상자를 연 것은
  // 개봉 아님'이 요약·제9조에 남았는지와 옛 말투 0 만 본다.
  const summary = doc.slice(0, doc.indexOf('const body'))
  assert.ok(summary.includes(CANON_BOX_OK), "약관 요약에 '상자를 연 것은 개봉 아님' 정본 문장이 없다")
  const art9 = art(9)
  assert.ok(art9.includes(CANON_BOX_OK.replace(/\.$/, '')), "제9조에 '상자를 연 것은 개봉 아님'이 없다")
  assert.doesNotMatch(doc, OLD_REFUND_COPY, '약관에 옛 환불 문구가 남았다')

  // 제9조 — 단품 반품 배송비는 정본 함수 값으로(손으로 적은 금액 0).
  assert.ok(art9.includes('won(RETURN_FEE_ONE_WAY)') && art9.includes('won(RETURN_FEE_ROUND_TRIP)'), '제9조에 단품 반품 배송비(편도·왕복)가 없다')
  assert.match(src, /const RETURN_FEE_ONE_WAY = returnShippingFeeFor\(SHIPPING_FEE\)/, '약관 편도 반품 배송비 계산이 정본과 다르다')
  assert.match(src, /const RETURN_FEE_ROUND_TRIP = returnShippingFeeFor\(0\)/, '약관 왕복 반품 배송비 계산이 정본과 다르다')
  assert.doesNotMatch(src, /\d{1,3},\d{3}\s*원|\b\d{4,5}원/, '약관에 금액을 손으로 적었다 — lib/store/shipping 상수로')
})
