/**
 * Farmer's Tail — 정기배송 알림 메일.
 *
 * 트리거: 매일 1회 cron 이 `next_delivery_date` 가 `reminder_days_before` 일
 * 후인 활성 구독을 스캔해 발송. 사용자가 /mypage/subscriptions 에서 알림 토글
 * 한 경우만 (reminder_enabled = true).
 *
 * # 심미 가이드
 *   - 히어로 아이콘: 🚚 (배송 임박 시각 단서). 거래 메일이라 스팸 영향 거의 X.
 *   - Callout: moss — "정기적/안정" 톤. 정기배송 대시보드 카드와 같은 색.
 *   - CTA: "구독 관리" — /mypage/subscriptions. 잠시 멈춤 / 변경 / 해지를
 *     원할 수 있는 사용자가 한 번에 닿게.
 */
import { block, escape, renderLayout, SITE_URL } from '../layout'

export type SubscriptionReminderItem = {
  productName: string
  quantity: number
}

export function renderSubscriptionReminder(input: {
  recipientName: string
  items: SubscriptionReminderItem[]
  /** 'YYYY-MM-DD' 또는 ISO. 한국어 날짜 + 요일로 렌더. */
  nextDeliveryDate: string
  /** 0 = 오늘 도착, 1 = 내일, 2-... = D-N. */
  daysBefore: number
}): { subject: string; html: string } {
  const dateLabel = formatKoDate(input.nextDeliveryDate)
  const itemCountLabel =
    input.items.length > 1
      ? `${escape(input.items[0]!.productName)} 외 ${input.items.length - 1}개`
      : escape(input.items[0]?.productName ?? '')

  const heading =
    input.daysBefore === 0
      ? '오늘 정기배송이 출발해요'
      : input.daysBefore === 1
        ? '내일 정기배송이 출발해요'
        : `D-${input.daysBefore} · 정기배송 알림`

  const subject = `[파머스테일] ${heading}`

  const itemRows = input.items
    .map((it) => block.orderItem(it.productName, it.quantity, 0))
    .join('')

  const body = `
    <p style="margin:0 0 14px 0;">
      ${escape(input.recipientName)}님, ${
        input.daysBefore === 0
          ? '오늘'
          : input.daysBefore === 1
            ? '내일'
            : `D-${input.daysBefore} 후`
      } 정기배송이 출발해요.
    </p>
    ${block.callout(
      'moss',
      `<strong>${escape(dateLabel)} 도착 예정</strong><br/>${itemCountLabel}`,
    )}
    <div style="height:14px;"></div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      ${itemRows}
    </table>
    <p style="margin:14px 0 0 0;font-size:11px;color:#7A7A7A;line-height:1.6;">
      잠시 멈춤·화식 비율 변경·해지는 마이페이지에서 가능해요. 도움이 필요하면
      답장 주세요.
    </p>
  `

  const html = renderLayout({
    kicker: 'Subscription · 정기배송',
    heading,
    icon: '🚚',
    preview: `${dateLabel} 도착 예정 · ${itemCountLabel}`,
    body,
    cta: {
      label: '구독 관리하기',
      href: `${SITE_URL}/mypage/subscriptions`,
    },
  })

  return { subject, html }
}

/**
 * 한국어 날짜 — `04월 28일 화요일`. KST 강제.
 * dashboard 의 동일 헬퍼와 같은 구현. 거래 메일 한 곳에서만 쓰여 co-locate.
 */
function formatKoDate(iso: string): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00+09:00` : iso)
  const fmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  })
  const parts = fmt.formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('month').padStart(2, '0')}월 ${get('day').padStart(2, '0')}일 ${get('weekday')}`
}

/**
 * 정기배송 자동결제 실패 알림.
 *
 * cron 이 Toss 결제 호출에 실패하면 발송. 카드 만료 / 잔액 부족이 가장 흔한
 * 원인. 거래성 메일 — (광고) 표기 불요. 사용자가 새 카드 등록을 위해 마이
 * 페이지로 가게끔 단일 CTA.
 *
 * # variant
 * - errorClass='permanent' (카드 만료/유효 X)  → 즉시 paused + 카드 재등록 CTA
 * - errorClass='transient' (잔액부족/네트워크) → 24h 후 자동 재시도 안내
 * - 그 외                                      → 기존 톤 (3-strike 정책)
 *
 * # 멱등
 * idempotencyKey = `sub-charge-failed:{sub_id}:{date}` 로 같은 (구독, 일자)
 * 가 24h 내에 두 번 발송되지 않게 호출처에서 보장.
 */
export function renderSubscriptionChargeFailed(input: {
  recipientName: string
  productLabel: string
  amount: number
  attemptCount: number
  paused: boolean
  reason?: string | null
  /** 'permanent' | 'transient' | 'unknown' (lib/payments/billing-error-classify) */
  errorClass?: 'permanent' | 'transient' | 'unknown'
  /** transient 시 다음 재시도 ISO timestamp — "내일 새벽" 톤으로 표시. */
  nextRetryAt?: string | null
}): { subject: string; html: string } {
  const isPermanent = input.errorClass === 'permanent'
  const isTransient = input.errorClass === 'transient'

  const subject = isPermanent
    ? '[파머스테일] 카드 정보를 다시 등록해 주세요'
    : input.paused
      ? '[파머스테일] 정기배송이 일시중단됐어요'
      : isTransient
        ? '[파머스테일] 결제가 일시 실패 — 내일 다시 시도할게요'
        : '[파머스테일] 정기배송 결제가 실패했어요'

  const heading = isPermanent
    ? '카드 정보를 다시 등록해 주세요'
    : input.paused
      ? '정기배송이 일시중단됐어요'
      : isTransient
        ? '결제가 일시적으로 실패했어요'
        : '결제를 처리하지 못했어요'

  const reasonLine = input.reason
    ? `<p style="margin:8px 0 0 0;font-size:11.5px;color:#9A9A9A">사유: ${escape(input.reason)}</p>`
    : ''

  // variant 별 본문
  let mainBody = ''
  if (isPermanent) {
    mainBody = `
      <p style="margin:0 0 14px 0;">
        <strong>${escape(input.productLabel)}</strong> 의 정기배송 결제가 카드
        문제로 거절됐어요. 카드 유효기간이 지났거나 카드 정보가 바뀌었을 가능성이
        높아요.
      </p>
      <p style="margin:0 0 14px 0;">
        새 카드를 등록하시면 자동으로 다시 정기배송이 진행돼요.
      </p>
    `
  } else if (isTransient) {
    const retryLine = input.nextRetryAt
      ? `다음 재시도: <strong>${escape(formatKoDate(input.nextRetryAt))}</strong>`
      : '내일 새벽 자동으로 다시 시도해드릴게요.'
    mainBody = `
      <p style="margin:0 0 14px 0;">
        <strong>${escape(input.productLabel)}</strong> 의 정기배송 결제가 잠시
        실패했어요. 잔액 부족이나 카드사 일시 거절이 가장 흔한 원인이에요.
      </p>
      <p style="margin:0 0 14px 0;font-size:12px;color:#7A7A7A;">
        ${retryLine}
      </p>
    `
  } else {
    mainBody = `
      <p style="margin:0 0 14px 0;">
        <strong>${escape(input.productLabel)}</strong> 의 정기배송 결제가
        ${input.paused
          ? '연속 3회 실패해 자동으로 일시중단 처리됐어요.'
          : `${input.attemptCount}회째 실패했어요.`}
        카드 만료나 잔액 부족이 가장 흔한 원인이에요.
      </p>
    `
  }

  const body = `
    <p style="margin:0 0 14px 0;">
      ${escape(input.recipientName)}님, 안녕하세요.
    </p>
    ${mainBody}
    ${block.callout(
      isPermanent ? 'sale' : isTransient ? 'gold' : 'sale',
      `결제 시도 금액: <strong>${input.amount.toLocaleString()}원</strong>${reasonLine}`,
    )}
    <p style="margin:14px 0 0 0;font-size:12px;color:#7A7A7A;line-height:1.6;">
      ${isTransient
        ? '재시도 전에 미리 다른 카드를 등록해 두셔도 좋아요. 마이페이지에서 가능해요.'
        : '마이페이지에서 카드 정보를 새로 등록하시면 다음 배송일에 자동으로 다시 결제돼요. 일시중단 상태도 카드 등록 시 자동 해제돼요.'}
    </p>
  `

  const html = renderLayout({
    preview: heading,
    kicker: isPermanent ? 'Card Renewal · 카드 재등록' : 'Charge Failed · 결제 실패',
    heading,
    body,
    cta: {
      label: isPermanent ? '카드 다시 등록하기' : '카드 정보 업데이트',
      href: `${SITE_URL}/mypage/subscriptions`,
    },
  })

  return { subject, html }
}
