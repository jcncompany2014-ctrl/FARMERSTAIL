/**
 * 뉴스레터 — confirm 메일 (double opt-in) + unsubscribe 결과 통보.
 *
 * 정보통신망법 제50조 — 광고성 정보 발송 동의 절차로 "1. 명시 동의 + 2. 24h 내
 * 처리결과 통보" 가 권장. confirm 메일이 동의 행위를 검증, unsubscribe 결과
 * 메일이 §50⑤ 의 "처리결과 통보" 의무를 충족.
 *
 * 거래성/광고성 분류:
 * - confirm 메일: 사용자가 직접 신청한 절차의 응답 → 거래성 (광고 표기 X)
 * - unsubscribe 결과 메일: 동일 — 거래성 (광고 표기 X)
 */
import { renderLayout, escape, SITE_URL, block } from '../layout'

/**
 * 뉴스레터 가입 confirm 메일.
 * 사용자가 token 링크 클릭 시 /api/newsletter/confirm 이 status='confirmed'
 * 로 마킹.
 */
export function renderNewsletterConfirm(input: {
  email: string
  confirmToken: string
}): { subject: string; html: string } {
  const subject = '[파머스테일] 뉴스레터 구독 확인 메일'
  const confirmUrl = `${SITE_URL}/api/newsletter/confirm?token=${encodeURIComponent(input.confirmToken)}`
  const heading = '구독을 마무리해 주세요'

  const body = `
    <p style="margin:0 0 14px 0;">
      안녕하세요. 파머스테일 뉴스레터 구독을 신청해 주셔서 감사해요.
    </p>
    <p style="margin:0 0 14px 0;">
      아래 버튼을 눌러 구독을 확인해 주세요. 확인이 완료되어야 새 소식과
      혜택을 보내드릴 수 있어요.
    </p>
    ${block.callout(
      'gold',
      '24시간 안에 확인하지 않으시면 신청이 자동 취소돼요.',
    )}
    <p style="margin:14px 0 0 0;font-size:11px;color:#9A9A9A;line-height:1.6;">
      본 메일은 ${escape(input.email)} 으로 신청된 뉴스레터 구독 절차 안내예요.
      신청한 적이 없다면 무시하셔도 자동으로 취소돼요.
    </p>
  `

  const html = renderLayout({
    preview: heading,
    kicker: 'Confirm · 구독 확인',
    heading,
    body,
    cta: { label: '구독 확인하기', href: confirmUrl },
  })

  return { subject, html }
}

/**
 * 수신거부 결과 통보 메일.
 * 정보통신망법 제50조 제5항 — 동의 철회 후 14일 내 처리결과 통보 의무.
 * 거래성 메일이라 (광고) 표기 없이 발송.
 */
export function renderUnsubscribeAck(input: {
  email: string
  channel: 'email' | 'sms' | 'newsletter'
}): { subject: string; html: string } {
  const channelLabel =
    input.channel === 'sms'
      ? 'SMS / 카카오톡'
      : input.channel === 'newsletter'
        ? '뉴스레터'
        : '이메일'
  const subject = `[파머스테일] ${channelLabel} 수신거부 처리가 완료됐어요`
  const heading = `${channelLabel} 수신을 거부 처리했어요`

  const body = `
    <p style="margin:0 0 14px 0;">
      안녕하세요. 요청하신 ${escape(channelLabel)} 수신거부 처리가 완료됐어요.
    </p>
    ${block.callout(
      'moss',
      `더 이상 ${escape(channelLabel)} 마케팅 메시지를 보내드리지 않아요. 거래·배송·결제 안내처럼 서비스 이용에 꼭 필요한 메시지는 계속 발송돼요.`,
    )}
    <p style="margin:14px 0 0 0;font-size:11.5px;color:#7A7A7A;line-height:1.6;">
      마음이 바뀌셨거나 다시 받고 싶다면 언제든 마이페이지의 알림 설정에서
      재구독하실 수 있어요.
    </p>
  `

  const html = renderLayout({
    preview: heading,
    kicker: 'Unsubscribe · 수신거부 완료',
    heading,
    body,
    cta: {
      label: '알림 설정 보기',
      href: `${SITE_URL}/mypage/notifications`,
    },
  })

  return { subject, html }
}
