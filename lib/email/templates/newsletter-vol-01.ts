/**
 * Tail Letter Vol. 01 — 첫 정기 뉴스레터.
 *
 * 트리거:
 *   현재는 cron 없음. 수동 발송 (scripts/send-newsletter-vol-01.ts) — confirmed
 *   상태인 newsletter_subscribers 전체를 돌며 배치 발송. 추후 cron 으로 옮길
 *   때는 app/api/cron/newsletter-broadcast/route.ts 신설 + Vercel cron schedule
 *   등록. 단 배치 발송은 Resend rate limit (2 rps free tier, 10 rps paid) 와
 *   Vercel cron timeout (300s hobby / 900s pro) 을 같이 고려해야 함.
 *
 * 거래성/광고성:
 *   정기 뉴스레터는 명백한 광고성 정보 (정보통신망법 §50). 제목 (광고) 표기 +
 *   본문 끝 unsubscribe_token 링크 필수.
 *
 * 콘텐츠:
 *   1. 이번 달 영양 인사이트 — BCS 5단계 간단 소개 + 자가 체크 방법
 *   2. 이번 주 베스트 — 오션 오메가 믹스
 *   3. 보호자 Q&A — 화식 전환 시 주의점
 *   4. 다음 호 예고 — 단백질 알레르기 진단법
 *   5. CTA — 무료 분석 시작
 */
import { renderLayout, escape, SITE_URL, block } from '../layout'

export function renderNewsletterVol01(input: {
  email: string
  unsubscribeToken: string
}): { subject: string; html: string } {
  const subject = '(광고) [Tail Letter Vol. 01] 우리 아이 BCS 점수, 알고 계세요?'

  const unsubscribeUrl = `${SITE_URL}/api/newsletter/unsubscribe?token=${encodeURIComponent(input.unsubscribeToken)}`

  // 섹션 헤더 헬퍼 — 인라인 스타일. 메일 클라이언트가 class/css 변수를 안 먹음.
  const section = (kicker: string, title: string): string => `
    <div style="margin:24px 0 10px 0;">
      <div style="font-size:10px;color:#B63619;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;">${escape(kicker)}</div>
      <div style="margin-top:4px;font-size:16px;font-weight:800;color:#173B33;letter-spacing:-0.02em;line-height:1.35;">${escape(title)}</div>
    </div>
  `

  const body = `
    <p style="margin:0 0 14px 0;">
      안녕하세요. 파머스테일의 첫 정기 메일, Tail Letter 1호예요.
      이번 호엔 보호자분들이 자주 놓치는 BCS 이야기를 담았어요.
    </p>

    ${section('Insight 01', '이번 달의 영양 인사이트')}
    <p style="margin:0 0 10px 0;">
      BCS (Body Condition Score) 는 우리 아이의 체형을 1~9 단계로 평가하는
      수의영양학 표준이에요. 5가 가장 이상적인 상태예요.
    </p>
    <p style="margin:0 0 10px 0;">
      집에서 1분이면 체크해 보실 수 있어요.
    </p>
    ${block.callout(
      'moss',
      `<strong>1) 갈비뼈 만져보기</strong> — 손바닥을 펴 등에 올렸을 때, 살짝 만져지면 정상.<br />
       <strong>2) 위에서 내려다보기</strong> — 허리 라인이 살짝 들어가 보이면 정상.<br />
       <strong>3) 옆에서 보기</strong> — 배가 살짝 위로 들어가 있으면 정상.<br />
       세 가지 중 두 가지 이상 어긋나면 1단계씩 위/아래로 평가해 보세요.`,
    )}
    <p style="margin:10px 0 0 0;font-size:11.5px;color:#5A6C61;line-height:1.6;">
      파머스테일 분석은 BCS 를 포함해 12개 지표로 우리 아이의 한 끼를 계산해요.
    </p>

    ${block.hr()}

    ${section('This Week', '이번 주의 추천 메뉴')}
    <p style="margin:0 0 10px 0;">
      <strong style="color:#173B33;">오션 오메가 믹스</strong> — 노르웨이 연어와
      국내산 광어를 사람이 먹는 등급으로 손질한 화식이에요. 오메가-3 함량이
      높아 피부·털 컨디션이 거친 아이에게 자주 추천돼요.
    </p>
    ${block.callout(
      'gold',
      `<strong style="color:#173B33;">보호자 후기는 준비 중이에요.</strong><br />
       <span style="font-size:11.5px;color:#5A6C61;">첫 박스를 받아보신 분들의 솔직한 이야기를, 후기가 쌓이는 대로 이 자리에 담을게요. 지어낸 후기는 싣지 않아요.</span>`,
    )}

    ${block.hr()}

    ${section('Q&A', '보호자 Q&A')}
    <p style="margin:0 0 8px 0;font-weight:700;color:#173B33;">
      Q. 사료에서 화식으로 갑자기 바꿔도 괜찮을까요?
    </p>
    <p style="margin:0 0 10px 0;">
      급하게 바꾸면 위장이 적응 못 해서 무른 변이나 토가 나올 수 있어요.
      7~10일에 걸쳐 천천히 섞어가며 비율을 늘려주시는 걸 권장해요.
    </p>
    <p style="margin:0 0 10px 0;font-size:12px;color:#173B33;line-height:1.7;">
      1~3일: 기존 사료 75% + 화식 25%<br />
      4~6일: 기존 사료 50% + 화식 50%<br />
      7~9일: 기존 사료 25% + 화식 75%<br />
      10일~: 화식 100%
    </p>
    <p style="margin:0;font-size:11.5px;color:#5A6C61;line-height:1.6;">
      전환 중에 변 상태가 평소와 많이 다르면 그 비율에서 2~3일 더 머무르세요.
    </p>

    ${block.hr()}

    ${section('Next Issue', '다음 호 예고')}
    <p style="margin:0;">
      Vol. 02 에서는 <strong style="color:#173B33;">단백질 알레르기 진단법</strong>
      을 다룰 거예요. 닭고기를 의심하는 보호자분이 많은데, 실제로는 다른
      원인일 때가 많아요. 격주 뒤에 보내드릴게요.
    </p>

    <div style="margin-top:22px;padding-top:14px;border-top:1px solid #DCD6C4;font-size:10px;color:#9A9A9A;line-height:1.6;">
      본 메일은 ${escape(input.email)} 으로 신청해 주신 파머스테일 뉴스레터예요.
      더 이상 받지 않으시려면
      <a href="${escape(unsubscribeUrl)}" style="color:#5A6C61;text-decoration:underline;">여기에서 수신거부</a> 하실 수 있어요.
    </div>
  `

  const html = renderLayout({
    preview: 'BCS 점수로 우리 아이 체형 자가 체크 · 오션 오메가 믹스 · 화식 전환법',
    kicker: 'Tail Letter · Vol. 01',
    heading: '우리 아이 BCS 점수, 알고 계세요?',
    body,
    cta: {
      label: '우리 아이 분석 시작하기',
      href: `${SITE_URL}/start`,
    },
  })

  return { subject, html }
}
