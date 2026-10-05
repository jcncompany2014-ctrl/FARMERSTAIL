/**
 * 카카오 알림톡 템플릿 정본 — 순수 모듈 (테스트: templates.test.ts).
 *
 * ★여기 body 는 카카오에 **등록·승인된 문구와 글자 하나까지 같아야** 발송된다(다르면 3105
 *   미등록 템플릿). 승인 후엔 수정이 안 되므로, 문구를 바꾸려면 코드를 _V2 로 새로 만들어
 *   다시 접수한다(docs/MARKET_HUB_AND_ALIMTALK_PLAN_2026_10.md §2).
 *
 * 규칙(카카오 심사): 정보성만 — 주문·결제·배송·계약 조건 안내. 재구매·쿠폰·리뷰 요청·앱 설치
 * 유도 금지. 변수는 #{...}, 버튼명·타이틀엔 변수 금지, 치환 후 1,000자 이내.
 * 브랜드 보이스: '언제든 해지' 금지(규칙31) — 마감을 말한다("결제 전까지").
 *
 * solapiTemplateId 가 '' 이면 아직 승인 전 — 발송하지 않는다(sendAlimtalk 가 건너뜀).
 */

export type AlimtalkTemplateCode =
  | 'ORDER_PAID_V1'
  | 'SHIPPED_V1'
  | 'CHARGE_NOTICE_V1'
  | 'CHARGE_FAILED_V1'
  | 'PRICE_CHANGE_V1'
  | 'CANCEL_REFUND_V1'

export type AlimtalkButton =
  | { type: 'WL'; name: string; url: string }
  /** 배송조회 — 카카오가 본문의 택배사·송장번호를 읽어 조회 화면을 연다. */
  | { type: 'DS'; name: string }

export type AlimtalkTemplate = {
  code: AlimtalkTemplateCode
  /** 솔라피 콘솔에 등록할 템플릿 이름(사장님이 콘솔에서 보는 이름). */
  name: string
  /** 카카오 승인 후 솔라피가 준 템플릿 ID. '' = 아직 승인 전. */
  solapiTemplateId: string
  body: string
  buttons: AlimtalkButton[]
  /** 알림톡이 못 가면(카톡 미사용·차단) 문자로 대신 보낼지 — 발신번호 등록이 있어야 동작. */
  smsFallback: boolean
}

const SITE = 'https://www.farmerstail.kr'

export const ALIMTALK_TEMPLATES: Record<AlimtalkTemplateCode, AlimtalkTemplate> = {
  ORDER_PAID_V1: {
    code: 'ORDER_PAID_V1',
    name: '주문 접수 안내',
    solapiTemplateId: '',
    body: [
      '#{이름}님, 주문이 접수됐어요.',
      '',
      '■ 주문번호: #{주문번호}',
      '■ 결제금액: #{결제금액}원',
      '■ 발송 예정일: #{발송예정일}',
      '',
      '발송일에 맞춰 만들어 출고할게요. 출고되면 송장번호를 다시 알려드려요.',
    ].join('\n'),
    buttons: [{ type: 'WL', name: '주문 확인하기', url: `${SITE}/mypage/orders` }],
    smsFallback: false,
  },
  SHIPPED_V1: {
    code: 'SHIPPED_V1',
    name: '출고 안내',
    solapiTemplateId: '',
    body: [
      '#{이름}님, 주문하신 박스가 출고됐어요.',
      '',
      '■ 택배사: #{택배사}',
      '■ 송장번호: #{송장번호}',
      '',
      '받으시면 바로 냉동실에 보관해 주세요.',
    ].join('\n'),
    buttons: [{ type: 'DS', name: '배송 조회하기' }],
    smsFallback: false,
  },
  CHARGE_NOTICE_V1: {
    code: 'CHARGE_NOTICE_V1',
    name: '정기결제 사전 안내',
    solapiTemplateId: '',
    body: [
      '#{이름}님, 정기배송 결제 안내예요.',
      '',
      '■ 결제 예정일: #{결제일} 아침',
      '■ 결제 금액: #{결제금액}원',
      '■ 결제 수단: 등록하신 카드',
      '',
      '결제 전까지 정기배송 관리에서 미루거나 해지하면 청구되지 않아요.',
    ].join('\n'),
    buttons: [{ type: 'WL', name: '정기배송 관리', url: `${SITE}/account/subscriptions` }],
    smsFallback: false,
  },
  CHARGE_FAILED_V1: {
    code: 'CHARGE_FAILED_V1',
    name: '정기결제 실패 안내',
    solapiTemplateId: '',
    body: [
      '#{이름}님, 정기배송 결제가 이루어지지 않았어요.',
      '',
      '■ 결제 금액: #{결제금액}원',
      '■ 사유: #{실패사유}',
      '■ 다음 안내: #{다음안내}',
      '',
      '카드 한도나 유효기간을 확인해 주세요. 다른 카드로 바꾸시려면 아래 버튼에서 다시 등록할 수 있어요.',
    ].join('\n'),
    buttons: [{ type: 'WL', name: '카드 확인하기', url: `${SITE}/account/subscriptions` }],
    // 못 받으면 박스가 멈추는 안내 — 알림톡이 안 가면 문자로(발신번호 등록 시).
    smsFallback: true,
  },
  PRICE_CHANGE_V1: {
    code: 'PRICE_CHANGE_V1',
    name: '결제 금액 변경 안내',
    solapiTemplateId: '',
    body: [
      '#{이름}님, 다음 박스부터 결제 금액이 바뀌어요.',
      '',
      '■ 바뀌는 이유: #{변경사유}',
      '■ 적용 결제일: #{결제일}',
      '■ 바뀐 결제 금액: #{결제금액}원',
      '',
      '결제 전까지 정기배송 관리에서 미루거나 해지하면 청구되지 않아요.',
    ].join('\n'),
    buttons: [{ type: 'WL', name: '정기배송 관리', url: `${SITE}/account/subscriptions` }],
    smsFallback: false,
  },
  CANCEL_REFUND_V1: {
    code: 'CANCEL_REFUND_V1',
    name: '주문 취소·환불 안내',
    solapiTemplateId: '',
    body: [
      '#{이름}님, 주문이 취소됐어요.',
      '',
      '■ 주문번호: #{주문번호}',
      '■ 환불 금액: #{환불금액}원',
      '',
      '카드사 사정에 따라 환불이 반영되기까지 영업일 기준 3~7일 걸릴 수 있어요.',
    ].join('\n'),
    buttons: [{ type: 'WL', name: '주문 내역 보기', url: `${SITE}/mypage/orders` }],
    smsFallback: false,
  },
}

/** 본문의 #{변수} 이름들 — 등장 순서, 중복 제거. */
export function templateVariables(body: string): string[] {
  const seen: string[] = []
  for (const m of body.matchAll(/#\{([^}]+)\}/g)) {
    const v = m[1]!
    if (!seen.includes(v)) seen.push(v)
  }
  return seen
}

export const ALIMTALK_MAX_CHARS = 1000

export type RenderResult =
  | { ok: true; text: string; variables: Record<string, string> }
  | { ok: false; missing: string[]; tooLong: boolean }

/**
 * 변수 채우기 — 빠진 값·빈 값이 있거나 1,000자를 넘으면 ok:false(보내지 않는다).
 * variables 는 솔라피 형식({'#{이름}': '민지'}) 그대로 돌려준다.
 */
export function renderAlimtalk(code: AlimtalkTemplateCode, values: Record<string, string | number>): RenderResult {
  const t = ALIMTALK_TEMPLATES[code]
  const names = templateVariables(t.body)
  const missing = names.filter((n) => {
    const v = values[n]
    return v === undefined || v === null || String(v).trim() === ''
  })
  if (missing.length > 0) return { ok: false, missing, tooLong: false }
  const variables: Record<string, string> = {}
  let text = t.body
  for (const n of names) {
    const v = String(values[n])
    variables[`#{${n}}`] = v
    text = text.split(`#{${n}}`).join(v)
  }
  if (text.length > ALIMTALK_MAX_CHARS) return { ok: false, missing: [], tooLong: true }
  return { ok: true, text, variables }
}

/** 받는 번호 마스킹(어드민 표시용) — 010-****-1234. */
export function maskPhone(digits: string): string {
  const d = digits.replace(/\D/g, '')
  if (d.length < 8) return '***'
  return `${d.slice(0, 3)}-****-${d.slice(-4)}`
}
