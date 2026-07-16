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
}): { subject: string; html: string } {
  // (광고) 표기 — 본문에 할인 안내 (광고성) 포함되어 있어 안전하게 마킹.
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
       <strong>· 이번 주의 추천 메뉴</strong> — 그 주의 메뉴와, 산지·재료를 고른 기준<br />
       <strong>· 보호자 Q&amp;A</strong> — 자주 받는 질문에 수의영양 관점에서 답변`,
    )}
    <p style="margin:14px 0 0 0;">
      아직 안 해보셨다면, 2분 설문으로 우리 아이에게 맞는 화식부터 확인해 보세요.
      구독하면 정기배송 할인이 기본으로 들어가요.
    </p>
    <div style="margin:18px 0 6px 0;background:#EFEADF;border:1px solid #DCD6C4;border-radius:8px;padding:18px 20px;text-align:center;">
      <div style="font-size:10px;color:#5A6C61;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;">2-min Survey · 무료 분석</div>
      <div style="margin-top:6px;font-size:20px;font-weight:800;color:#173B33;letter-spacing:-0.02em;">우리 아이 맞춤 화식</div>
      <div style="margin-top:8px;font-size:11px;color:#5A6C61;">체형·건강에 맞춰 하루 급여량까지 계산해 드려요</div>
    </div>
    <p style="margin:18px 0 0 0;">
      다음 메일에서 만나요.<br />
      — 파머스테일 드림
    </p>
    <div style="margin-top:22px;padding-top:14px;border-top:1px solid #DCD6C4;font-size:10px;color:#9A9A9A;line-height:1.6;">
      본 메일은 ${escape(input.email)} 으로 신청해 주신 파머스테일 뉴스레터예요.
      더 이상 받지 않으시려면
      <a href="${escape(unsubscribeUrl)}" style="color:#5A6C61;text-decoration:underline;">여기에서 수신거부</a> 하실 수 있어요.
    </div>
  `

  const html = renderLayout({
    preview: '파머스테일 뉴스레터에 오신 걸 환영해요. 2분 설문으로 우리 아이 맞춤 화식을 만나보세요.',
    kicker: 'Welcome · 첫 메일',
    heading: '환영해요. 첫 메일이에요.',
    icon: '🐾',
    body,
    cta: {
      label: '맞춤 플랜 시작하기',
      href: `${SITE_URL}/start`,
    },
  })

  return { subject, html }
}
