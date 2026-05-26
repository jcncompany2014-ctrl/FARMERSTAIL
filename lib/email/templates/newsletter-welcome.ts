/**
 * 뉴스레터 — 구독 confirm 직후 발송하는 환영 메일 (1회).
 *
 * 트리거:
 *   /api/newsletter/confirm 이 status='confirmed' 로 마킹한 직후 fire-and-forget.
 *   double opt-in 의 "확인 메일" (renderNewsletterConfirm) 과 다른 메일.
 *
 * 거래성/광고성 분류:
 *   구독 절차의 응답이라는 점에선 거래성이지만, 본문에 첫 주문 5,000원 할인
 *   코드 (광고성 콘텐츠) 가 포함된다. 정보통신망법 §50④ 안전 해석으로 (광고)
 *   표기 + 수신거부 링크를 박는다. 사용자 입장에서도 부담 없음 — 본인이 방금
 *   구독 신청한 직후라 "왜 광고 메일이?" 가 아님.
 *
 * 콘텐츠 톤:
 *   진짜 사람이 쓴 느낌. 마케팅 카피 ("최고의!", "혁명적인!") 금지. 신뢰도
 *   라는 단어 X — 정확도/정밀도 사용. 회사 표기는 lib/business.ts 의
 *   companyName ("파머스테일 (Farmer's Tail)") 가 single source.
 */
import { renderLayout, escape, SITE_URL, block } from '../layout'

export function renderNewsletterWelcome(input: {
  email: string
  /** 영구 unsubscribe 토큰 — newsletter_subscribers.unsubscribe_token. */
  unsubscribeToken: string
  /** 첫 주문 할인 쿠폰 코드 — admin/coupons 에 활성 상태여야 동작.
   *  기본 'WELCOME5000' (5,000원 즉시 할인). env (WELCOME_COUPON_CODE) 로 override. */
  couponCode?: string
}): { subject: string; html: string } {
  const code = (input.couponCode ?? 'WELCOME5000').toUpperCase()
  // (광고) 표기 — 본문에 할인 코드 (광고성) 포함되어 있어 안전하게 마킹.
  const subject = '(광고) [파머스테일] 환영해요. 첫 메일이에요.'

  const unsubscribeUrl = `${SITE_URL}/api/newsletter/unsubscribe?token=${encodeURIComponent(input.unsubscribeToken)}`

  const body = `
    <p style="margin:0 0 14px 0;">
      안녕하세요. 파머스테일 (Farmer's Tail) 의 안성민이에요.
      뉴스레터 구독해 주셔서 정말 감사해요.
    </p>
    <p style="margin:0 0 14px 0;">
      파머스테일은 수의영양학을 기준으로, 사람이 먹는 등급의 재료를 산지에서
      바로 손질해 만드는 반려견 음식이에요. Farm to Tail — 농장에서 우리
      아이의 그릇까지, 중간 단계를 줄였어요.
    </p>
    <p style="margin:0 0 14px 0;">
      앞으로 격주로 한 통, 이런 메일을 보내드릴 거예요.
    </p>
    ${block.callout(
      'moss',
      `<strong>· 이번 달의 영양 인사이트</strong> — BCS, 단백질 알레르기 같은 보호자 입장에서 알아두면 좋은 이야기<br />
       <strong>· 이번 주의 추천 메뉴</strong> — 실제로 인기 많은 상품과 보호자분들 후기<br />
       <strong>· 보호자 Q&amp;A</strong> — 자주 받는 질문에 수의영양 관점에서 답변`,
    )}
    <p style="margin:14px 0 0 0;">
      그리고 첫 메일이니, 작은 인사 하나 드릴게요.
      아래 쿠폰은 첫 주문에 자동으로 적용돼요. 따로 코드를 입력하실 필요 없어요.
    </p>
    <div style="margin:18px 0 6px 0;background:#F3ECDC;border:1px solid #E6DDC8;border-radius:8px;padding:18px 20px;text-align:center;">
      <div style="font-size:10px;color:#7A7A7A;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;">First Order · 첫 주문</div>
      <div style="margin-top:6px;font-size:20px;font-weight:800;color:#1E1A14;letter-spacing:-0.02em;">5,000원 할인</div>
      <div style="margin-top:8px;font-size:11px;color:#7A7A7A;font-family:monospace;letter-spacing:0.04em;">ref: ${escape(code)}</div>
    </div>
    <p style="margin:14px 0 0 0;font-size:11.5px;color:#7A7A7A;line-height:1.6;">
      쿠폰은 결제 단계에서 자동으로 안내돼요. 다른 쿠폰과 중복 사용은 안 돼요.
    </p>
    <p style="margin:18px 0 0 0;">
      다음 메일에서 만나요.<br />
      — 파머스테일 드림
    </p>
    <div style="margin-top:22px;padding-top:14px;border-top:1px solid #E6DDC8;font-size:10px;color:#9A9A9A;line-height:1.6;">
      본 메일은 ${escape(input.email)} 으로 신청해 주신 파머스테일 뉴스레터예요.
      더 이상 받지 않으시려면
      <a href="${escape(unsubscribeUrl)}" style="color:#7A7A7A;text-decoration:underline;">여기에서 수신거부</a> 하실 수 있어요.
    </div>
  `

  const html = renderLayout({
    preview: '파머스테일 뉴스레터에 오신 걸 환영해요. 첫 주문 5,000원 할인이 함께해요.',
    kicker: 'Welcome · 첫 메일',
    heading: '환영해요. 첫 메일이에요.',
    icon: '🐾',
    body,
    cta: {
      label: '메뉴 둘러보기',
      href: `${SITE_URL}/products`,
    },
  })

  return { subject, html }
}
