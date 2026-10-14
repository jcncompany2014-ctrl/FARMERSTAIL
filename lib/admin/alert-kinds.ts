/**
 * 운영 경보함(admin_alerts) — **사장님이 직접 처리해야 하는 경보 종류의 정본 목록** (2026-10-14 B1, 규칙247).
 *
 * # 왜
 * 서버의 업무 경보(lib/sentry/trace captureBusinessEvent, 호출 200여 곳)는 Sentry 로만 갔다. 그런데 Sentry 메일은
 * 사장님 Gmail 로 오지 않는다(메모리: 사장님이 캡처로 보여 줘야 안다). 그래서 '토스에서 직접 환불하세요' 같은 일이
 * 어디에도 남지 않았다. warning·error 중 **사람이 손으로 풀어야 하는 것만** 이름으로 골라 어드민 경보함에도 적는다.
 * 일시 오류(다음 실행이 다시 시도하는 것)·고객이 화면에서 안내받는 것은 넣지 않는다 — 경보함이 시끄러우면 아무도 안 본다.
 *
 * # 규칙
 *  · 목록에 없는 이름은 경보함에 적지 않는다(Sentry 에는 그대로 간다). 새 경보가 사람 손이 필요하면 여기 한 줄을 더한다.
 *  · minLevel 'error' 인 종류는 error 로 올라올 때만 적는다(같은 이름이 warning 이면 정상 동작 — 예: 광고 메일 수신 차단).
 *  · 문맥(context)은 id·숫자·짧은 코드만 남긴다(sanitizeAlertContext) — 이름·이메일·전화·주소·키 값은 버린다.
 *  · 순수 모듈 — 브라우저·테스트에서도 불러도 된다(DB·Sentry 를 부르지 않는다). 기록은 lib/admin/alert-record.
 *    import 는 상대 경로 + .ts 만(node 테스트가 lib/sentry/trace 를 거쳐 값으로 불러온다).
 */
import { scrubSentryString } from '../sentry-scrub.ts'

export type AlertSeverity = 'warning' | 'error'

/** 경보함 필터 묶음 — 화면의 '종류별' 칩. */
export type AlertGroup = 'money' | 'refund' | 'trial' | 'recipe' | 'contact' | 'ops'

export const ALERT_GROUP_LABEL: Record<AlertGroup, string> = {
  money: '결제',
  refund: '환불',
  trial: '서포터즈',
  recipe: '레시피·알레르기',
  contact: '메일·알림',
  ops: '운영·키',
}

export type OwnerAlertDef = {
  group: AlertGroup
  /** 경보 한 줄 — 무슨 일이 있었나(사장님 말로). */
  title: string
  /** 무엇을 하면 되나. */
  action: string
  /**
   * 'global' = 대상과 무관하게 같은 종류를 하나로 묶는다(설정·키 문제처럼 고객마다 따로 볼 일이 아닌 것).
   * 기본은 대상(구독 → 주문 → 강아지 → 고객 순)마다 따로.
   */
  scope?: 'global'
  /** 이 등급 이상으로 올라올 때만 적는다. 기본 warning(= warning·error 둘 다). */
  minLevel?: AlertSeverity
}

/**
 * ★정본 목록. 이름은 captureBusinessEvent 의 두 번째 인자 그대로.
 * 전수 조사(2026-10-14): warning·error 이름 190여 개 중 사람이 손으로 풀어야 하는 것만 골랐다 — 표는 보고서.
 */
export const OWNER_ALERT_KINDS = {
  // ── 결제(돈이 나갔는데 장부가 안 맞음 · 결제를 멈춘 이유가 사람 일) ──
  'subscription.charge.ambiguous_captured': {
    group: 'money',
    title: '결과 불명 결제 — 토스에선 결제됐는데 주문이 확정되지 않았어요',
    action: '토스 결제를 확인해 주문을 결제됨으로 맞추거나 토스에서 환불해 주세요',
  },
  'subscription.charge.stale_pending_captured': {
    group: 'money',
    title: '청구 도중 끊긴 결제가 토스에선 결제됐어요',
    action: '주문을 결제됨으로 맞춰 발송하거나 토스에서 환불해 주세요',
  },
  'subscription.charge.unresolved_skip': {
    group: 'money',
    title: '결제는 됐는데 주문이 확정되지 않아 이 구독 청구를 멈췄어요',
    action: '청구 기록과 토스 결제를 대조해 정리해 주세요',
  },
  'subscription.charge.replay_unknown': {
    group: 'money',
    title: '같은 결제가 다시 응답됐는데 상태를 확인하지 못했어요',
    action: '토스 대시보드에서 결제 상태를 보고 청구 기록을 정리해 주세요',
  },
  'subscription.charge.replay_booked': {
    group: 'money',
    title: '이미 결제된 회차가 다시 청구될 뻔했어요(발송일이 되돌려진 구독)',
    action: '이 구독의 발송일이 왜 되돌려졌는지 확인해 주세요',
  },
  'subscription.charge.replayed_order_mismatch': {
    group: 'money',
    title: '토스 결제가 다른(옛) 주문번호에 붙어 있어요',
    action: '옛 주문과 이번 주문 중 하나로 장부를 정리해 주세요',
  },
  'subscription.charge.amount_mismatch': {
    group: 'money',
    title: '청구 금액이 계산한 금액과 달라요',
    action: '구독 금액과 박스 구성을 확인해 주세요(재고 변동·처방 회차 차이면 정상)',
  },
  'subscription.charge.cancelled_mid_charge': {
    group: 'money',
    title: '결제 도중 고객이 해지·정지해 자동 환불을 시도했어요',
    action: '환불이 끝났는지 환불 화면에서 확인해 주세요',
  },
  'subscription.charge.refund_queue_insert_failed': {
    group: 'refund',
    title: '돌려줘야 할 결제를 환불 대기열에 넣지 못했어요 — 자동 환불이 돌지 않아요',
    action: '토스에서 직접 환불해 주세요',
  },
  'subscription.charge.paid_write_failed': {
    group: 'money',
    title: '결제됐는데 주문이 결제 전 상태로 남았어요',
    action: '주문을 결제됨으로 맞춰 주세요(안 그러면 박스가 안 나가요)',
  },
  'subscription.charge.charge_row_success_write_failed': {
    group: 'money',
    title: '결제됐는데 청구 기록이 성공으로 바뀌지 않았어요',
    action: '자동결제 이력에서 이 회차를 확인해 주세요',
  },
  'subscription.charge.zero_amount': {
    group: 'money',
    title: '청구 금액이 0원이라 결제를 건너뛰었어요',
    action: '할인·금액 설정을 확인해 주세요',
  },
  'subscription.charge.trial_discount_mismatch': {
    group: 'trial',
    title: '서포터즈인데 서포터즈 가격이 아니라 결제를 건너뛰었어요',
    action: '체험단 화면에서 이 고객의 남은 회차를 확인해 주세요',
  },
  'subscription.charge.trial_decrement_failed': {
    group: 'trial',
    title: '서포터즈 남은 회차를 줄이지 못했어요 — 다음 결제도 할인가로 나갈 수 있어요',
    action: '체험단 화면에서 남은 회차를 고쳐 주세요',
  },
  'subscription.charge.trial_decrement_conflict': {
    group: 'trial',
    title: '서포터즈 남은 회차가 동시에 바뀌어 줄이지 못했어요',
    action: '체험단 화면에서 남은 회차를 확인해 주세요',
  },
  'subscription.charge.trial_notice_unreached': {
    group: 'trial',
    title: '서포터즈 가격 전환 안내가 푸시·메일 어디로도 닿지 않았어요',
    action: '고객에게 직접 안내해 주세요',
  },
  'subscription.charge.trial_notice_failed': {
    group: 'trial',
    title: '서포터즈 가격 전환 안내를 보내다 오류가 났어요',
    action: '고객이 안내를 받았는지 확인해 주세요',
  },
  // 서포터즈 인상 동의가 없어 청구 크론이 보류할 때 보내는 이름(app/api/cron/subscription-charge — 2026-10-14 A 갈래).
  //   병합 때 B 가 임시로 쓰던 'trial.price_increase.consent_missing' 을 실제로 보내는 이름으로 맞췄다 — 이름이 다르면 영영 안 쌓인다.
  'subscription.charge.price_rise_consent_missing': {
    group: 'trial',
    title: '서포터즈 가격이 오르는데 고객 동의가 없어 결제를 보류했어요',
    action: '고객에게 바뀌는 가격을 안내하고 동의를 받아 주세요',
  },
  'subscription.charge.backlog': {
    group: 'money',
    title: '오늘 청구를 다 끝내지 못했어요 — 남은 구독은 내일로 밀려요',
    action: '자동결제 이력을 보고 필요하면 청구를 다시 돌려 주세요',
    scope: 'global',
  },
  'subscription.charge.merchant_config_error': {
    group: 'ops',
    title: '토스가 우리 결제 요청·키를 거부했어요(고객 카드 문제 아님)',
    action: '토스 키·가맹점 설정을 확인해 주세요',
    scope: 'global',
  },
  'subscription.no_shipping_address': {
    group: 'money',
    title: '배송지가 없어 결제를 건너뛰었어요',
    action: '고객에게 배송지를 받아 주세요',
  },
  'payment_ledger.mismatch': {
    group: 'money',
    title: '결제 장부와 주문이 맞지 않아요',
    action: '재무 화면에서 대조해 주세요',
    scope: 'global',
  },
  'order.webhook.amount_mismatch': {
    group: 'money',
    title: '토스 결제 금액이 주문 금액과 달라요',
    action: '주문과 토스 결제를 대조해 주세요',
  },
  'order.webhook.orderid_mismatch': {
    group: 'money',
    title: '토스 결제의 주문번호가 우리 주문과 달라요',
    action: '주문과 토스 결제를 대조해 주세요',
  },
  'order.webhook.done_on_terminal': {
    group: 'money',
    title: '이미 취소·실패로 끝난 주문에 결제 완료가 들어왔어요',
    action: '환불할지 주문을 되살릴지 정해 주세요',
  },
  'order.expire.paid_order_skipped': {
    group: 'money',
    title: '결제 기록이 있는데 주문이 결제 전 상태예요(만료시키지 않았어요)',
    action: '주문을 결제됨·준비 중으로 올려 주세요(안 그러면 박스가 안 나가요)',
  },
  'order.payment.race_already_terminal': {
    group: 'money',
    title: '결제와 주문 만료가 겹쳐 자동 환불을 시도했어요',
    action: '환불이 끝났는지 확인해 주세요',
  },
  'order.payment.race_refund_unqueued': {
    group: 'refund',
    title: '겹친 결제의 환불을 대기열에 넣지 못했어요',
    action: '토스에서 직접 환불해 주세요',
  },
  'order.confirm.refund_queue_failed': {
    group: 'refund',
    title: '결제 확인 실패분의 환불을 대기열에 넣지 못했어요',
    action: '토스에서 직접 환불해 주세요',
  },
  'order.cancel.refunded_but_state_changed': {
    group: 'refund',
    title: '환불은 됐는데 그 사이 주문 상태가 바뀌었어요(발송 처리 등)',
    action: '박스가 나갔는지와 주문 상태를 확인해 주세요',
  },
  'admin.partial_cancel.refund_row_failed': {
    group: 'refund',
    title: '부분 환불은 됐는데 환불 기록을 남기지 못했어요',
    action: '환불 화면에서 기록을 확인해 주세요',
  },
  // ── 환불 ──
  'refund_queue.needs_manual_check': {
    group: 'refund',
    title: '환불이 됐는지 확실하지 않아요',
    action: '토스 대시보드에서 실제 환불 여부를 확인해 주세요',
  },
  'refund_queue.permanent_failure': {
    group: 'refund',
    title: '자동 환불이 끝내 실패했어요',
    action: '토스에서 직접 환불해 주세요',
  },
  'refund.queue.order_update_failed': {
    group: 'refund',
    title: '환불은 됐는데 주문 상태가 바뀌지 않았어요',
    action: '주문을 환불 상태로 맞춰 주세요',
  },
  'refund.queue.ledger_write_failed': {
    group: 'refund',
    title: '환불은 됐는데 결제 장부에 적지 못했어요',
    action: '재무 화면에서 확인해 주세요',
  },
  // ── 레시피·알레르기 ──
  'personalization.next_box_allergen_leak': {
    group: 'recipe',
    title: '다음 박스에 알레르기 재료가 들어갈 뻔해 구독을 멈췄어요',
    action: '고객과 상담해 안전한 레시피를 정해 주세요',
  },
  'personalization.leak_pause_failed': {
    group: 'recipe',
    title: '알레르기를 감지했는데 구독을 멈추지 못했어요',
    action: '구독을 직접 일시정지하고 고객과 상담해 주세요',
  },
  'personalization.compute.subscribed_formula_overwritten': {
    group: 'recipe',
    title: '구독 중인 박스 구성이 안전 사유로 바뀌었어요 — 금액·품목은 옛 값',
    action: '구독 금액을 확인하고 고객에게 안내해 주세요',
  },
  'subscription.create.held_allergen_share': {
    group: 'recipe',
    title: '정기배송 신청이 알레르기 때문에 담을 수 없는 레시피로 막혔어요',
    action: '고객이 카카오톡으로 문의할 수 있어요 — 먼저 연락해 주세요',
  },
  'approve.total_amount_update_failed': {
    group: 'recipe',
    title: '새 레시피는 승인됐는데 구독 금액을 바꾸지 못했어요',
    action: '구독 금액을 새 레시피에 맞춰 주세요',
  },
  approve_amount_unavailable: {
    group: 'recipe',
    title: '고객의 새 레시피 동의를 보류했어요 — 금액을 계산하지 못했어요',
    action: '고객이 다시 시도하거나 문의할 수 있어요 — 박스 구성을 확인해 주세요',
  },
  'subscription.items.rebuild_failed': {
    group: 'recipe',
    title: '구독 품목을 다시 만들지 못했어요 — 담을 품목이 비었을 수 있어요',
    action: '포장 목록에서 이 구독의 박스 구성을 확인해 주세요',
  },
  // ── 메일·알림 ──
  'email.suppressed_skip': {
    group: 'contact',
    title: '주문·결제 안내 메일이 수신 차단 목록 때문에 나가지 않았어요',
    action: '고객에게 카카오톡·전화로 알려 주세요',
    minLevel: 'error',
    scope: 'global',
  },
  'email.not_configured': {
    group: 'contact',
    title: '메일 발송 설정이 없어 메일이 한 통도 안 나가요',
    action: '메일 환경값(RESEND_API_KEY·EMAIL_FROM)을 확인해 주세요',
    scope: 'global',
  },
  'email.bounced.permanent': {
    group: 'contact',
    title: '없는 주소로 메일이 반송됐어요 — 그 주소로는 앞으로 메일이 안 나가요',
    action: '고객에게 다른 연락 수단으로 주소를 확인해 주세요',
    scope: 'global',
  },
  'push.web.vapid_not_configured': {
    group: 'contact',
    title: '웹 푸시 설정이 없어 웹 알림이 안 나가요',
    action: '웹 푸시 환경값(VAPID)을 확인해 주세요',
    scope: 'global',
  },
  // ── 운영·키 ──
  'inventory.shortage_forecast': {
    group: 'ops',
    title: '다가오는 발송분에 재고가 모자랄 것 같아요',
    action: '상품 재고를 확인하고 재료를 주문해 주세요',
    scope: 'global',
  },
  'account.delete.partial_failure': {
    group: 'ops',
    title: '회원 탈퇴 처리가 일부 실패했어요 — 개인정보가 남았을 수 있어요',
    action: '남은 기록을 직접 지워 주세요(탈퇴 즉시 파기 의무)',
  },
  'anthropic.daily_cap_exceeded': {
    group: 'ops',
    title: 'AI 하루 사용 한도에 닿았어요 — 분석·챗봇이 멈춰요',
    action: '한도를 올릴지 정해 주세요',
    scope: 'global',
  },
  'tracking.tracker_key_rejected': {
    group: 'ops',
    title: '배송조회 키가 거절됐어요(만료·오입력) — 자동 배송완료가 멈춰요',
    action: 'console.tracker.delivery 에서 키를 다시 받아 Vercel 환경값을 바꾸고, 경보함 아래 칸에 오늘 날짜를 적어 주세요',
    scope: 'global',
  },
  // B4 — 외부 키 만료 7·3·1일 전(대상 = 키 이름, lib/admin/key-expiry).
  'ops.key_expiring': {
    group: 'ops',
    title: '외부 키 만료가 다가와요',
    action: '만료 전에 키를 새로 받아 바꾸고 설정일을 적어 주세요',
  },
  // 2026-10-15 F-b(규칙270) — 첫 박스 체크인 답(앱 서버 동작 app/(main)/dogs/[id]/first-checkin/actions.ts, 판정 lib/first-checkin).
  // 대상 = 강아지(같은 강아지는 24시간 안이면 한 줄). detail 에 '강아지 이름 · 답 · 메모(가린 뒤 짧게)'.
  'feeding.first_checkin_poor': {
    group: 'recipe',
    title: "첫 박스 체크인 — '잘 안 먹어요'라고 답했어요",
    action: '다음 조리 전에 카카오톡·전화로 먼저 연락해 주세요(고객 화면 → 강아지 칸의 첫 박스 반응)',
  },
  'feeding.first_checkin_note': {
    group: 'recipe',
    title: "첫 박스 체크인 — '조금 가렸어요'와 메모를 남겼어요",
    action: '메모를 읽고 필요하면 연락해 주세요',
  },
} as const satisfies Record<string, OwnerAlertDef>

export type OwnerAlertKind = keyof typeof OWNER_ALERT_KINDS

export function isOwnerAlertKind(name: string): name is OwnerAlertKind {
  return Object.prototype.hasOwnProperty.call(OWNER_ALERT_KINDS, name)
}

export function ownerAlertDef(name: string): OwnerAlertDef | null {
  return isOwnerAlertKind(name) ? OWNER_ALERT_KINDS[name] : null
}

/** 이 등급으로 올라온 이 이름을 경보함에 적어야 하나. info 는 언제나 아니다. */
export function shouldRecordOwnerAlert(level: 'info' | 'warning' | 'error', name: string): boolean {
  if (level === 'info') return false
  const def = ownerAlertDef(name)
  if (!def) return false
  if (def.minLevel === 'error' && level !== 'error') return false
  return true
}

export type AlertContext = Record<string, string | number | boolean | null | undefined>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function uuidOf(ctx: AlertContext, keys: readonly string[]): string | null {
  for (const k of keys) {
    const v = ctx[k]
    if (typeof v === 'string' && UUID_RE.test(v.trim())) return v.trim().toLowerCase()
  }
  return null
}

export type AlertTargets = {
  orderId: string | null
  subscriptionId: string | null
  userId: string | null
  dogId: string | null
}

/** 문맥에서 관련 주문·구독·고객·강아지 id 를 꺼낸다(uuid 모양만 — 이상한 값이 기록을 깨지 않게). */
export function alertTargetsOf(ctx: AlertContext): AlertTargets {
  return {
    orderId: uuidOf(ctx, ['orderId', 'order_id']),
    subscriptionId: uuidOf(ctx, ['subscriptionId', 'subscription_id', 'subId']),
    userId: uuidOf(ctx, ['userId', 'user_id']),
    dogId: uuidOf(ctx, ['dogId', 'dog_id']),
  }
}

/**
 * 같은 경보를 묶는 대상 열쇠 — '같은 종류 + 같은 대상'(24시간 안이면 횟수만 올림, RPC record_admin_alert).
 * 우선순위 구독 → 주문 → 강아지 → 고객: 같은 구독의 재시도 실패는 주문이 매번 새로 생겨도 한 줄로 묶인다.
 * 'global' 종류이거나 대상이 없으면 '' (종류 하나로 묶는다). ctx.targetKey 가 있으면 그대로(키 만료처럼 id 가 아닌 대상).
 */
export function alertTargetKey(name: string, ctx: AlertContext, t: AlertTargets = alertTargetsOf(ctx)): string {
  if (typeof ctx.targetKey === 'string' && ctx.targetKey.trim()) return ctx.targetKey.trim().slice(0, 120)
  if (ownerAlertDef(name)?.scope === 'global') return ''
  if (t.subscriptionId) return `sub:${t.subscriptionId}`
  if (t.orderId) return `order:${t.orderId}`
  if (t.dogId) return `dog:${t.dogId}`
  if (t.userId) return `user:${t.userId}`
  return ''
}

/** 개인정보·비밀로 보이는 열쇠 — 문맥에서 통째로 버린다. */
const DROP_KEY_RE = /(email|e_mail|phone|tel|address|addr|recipient|name|token|secret|password|authorization|billing_?key|card)/i

/**
 * 경보함에 남길 문맥 — id·숫자·짧은 코드만. 이름·이메일·전화·주소·키 값은 버리고, 남은 글자 속 개인정보 모양
 * (휴대폰·이메일·주민번호·계좌·주소 속 토큰)은 Sentry 와 같은 정본(lib/sentry-scrub scrubSentryString)으로 가린다.
 * (호출부가 넣은 것을 믿지 않는다 — 호출 200여 곳을 다 볼 수 없으므로 여기서 한 번 거른다.)
 */
export function sanitizeAlertContext(ctx: AlertContext): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  let n = 0
  for (const [k, v] of Object.entries(ctx)) {
    if (n >= 20) break
    if (v === null || v === undefined) continue
    if (k === 'targetKey' || k === 'paymentKey') continue
    if (DROP_KEY_RE.test(k)) continue
    if (typeof v === 'number') {
      if (Number.isFinite(v)) out[k] = v
    } else if (typeof v === 'boolean') {
      out[k] = v
    } else {
      // id(uuid)는 그대로 — 숫자만인 마디가 이어지면 계좌번호 모양으로 가려져 바로 가기 링크가 깨진다.
      const raw = String(v).trim()
      const s = UUID_RE.test(raw) ? raw : scrubSentryString(raw).trim()
      if (s) out[k] = s.length > 300 ? `${s.slice(0, 300)}…` : s
    }
    n++
  }
  return out
}

/** 경보 한 줄 — 경보함 목록·브리핑이 쓰는 문장(종류 정의의 title, 정의가 없으면 이름). */
export function alertMessageOf(name: string, ctx: AlertContext): string {
  const def = ownerAlertDef(name)
  const base = def?.title ?? name
  // 키 만료처럼 대상이 이름인 경보는 호출부가 붙인 설명(detail)을 덧붙인다.
  const detail = typeof ctx.detail === 'string' ? ctx.detail.trim() : ''
  return (detail ? `${base} — ${detail}` : base).slice(0, 300)
}
