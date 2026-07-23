/**
 * Farmer's Tail — Personalization cycle 진행 알림 메일.
 *
 * 트리거: cron `/api/cron/personalization-progression` 이 새 dog_formulas
 * row 를 생성한 직후. push 알림과 함께 발송 (push 가 OFF 인 사용자도 메일은
 * 받게).
 */
import { block, escape, renderLayout, SITE_URL } from '../layout'
import { petName } from '@/lib/korean'

export type PersonalizationCycleEmailInput = {
  recipientName: string
  dogName: string
  dogId: string
  cycleNumber: number
  /** 이번 박스 원물(레시피) 이름 — "한우·치킨 레시피". %·형용사 없음. */
  recipeLabel: string
  /** Reasoning chipLabel 배열. 최대 4개 노출. */
  reasoningLabels: string[]
}

export function renderPersonalizationCycle(
  input: PersonalizationCycleEmailInput,
): { subject: string; html: string } {
  const subject = `[파머스테일] ${petName(input.dogName)}의 다음 박스 준비됐어요`

  const reasoningChips = input.reasoningLabels
    .slice(0, 4)
    .map(
      (label) => `
        <span style="
          display:inline-block;
          background:#FFFFFF;
          color:#173B33;
          font-size:11px;
          font-weight:700;
          padding:4px 10px;
          border-radius:99px;
          margin:0 4px 6px 0;
          box-shadow:inset 0 0 0 1px #DCD6C4;
        ">${escape(label)}</span>`,
    )
    .join('')

  const calloutHtml = `
    <div style="font-size:11px;font-weight:800;color:#B63619;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">
      이번 박스 레시피
    </div>
    <div style="font-family:Pretendard,sans-serif;font-size:22px;font-weight:800;color:#173B33;letter-spacing:-0.02em;line-height:1.2;">
      ${escape(input.recipeLabel)}
    </div>
  `

  const body = `
    <p style="margin:0 0 14px 0;">
      ${escape(input.recipientName)}님, 안녕하세요.
    </p>
    <p style="margin:0 0 18px 0;">
      <strong style="color:#173B33;">${escape(petName(input.dogName))}의
      ${input.cycleNumber}번째 박스</strong>가 준비됐어요. 그동안의 체크인
      응답을 반영해 구성을 조정했어요.
    </p>

    ${block.callout('terracotta', calloutHtml)}

    ${
      reasoningChips
        ? `
    <div style="margin:22px 0 8px 0;">
      <div style="font-size:11px;font-weight:700;color:#5A6C61;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:8px;">
        결정 근거
      </div>
      <div>${reasoningChips}</div>
    </div>`
        : ''
    }

    <p style="margin:24px 0 0 0;font-size:13px;color:#173B33;line-height:1.7;">
      레시피 구성과 이번 박스를 이렇게 정한 이유 — 모두 박스 페이지에서
      확인할 수 있어요. 마음에 안 드는 부분이 있으면 직접 조정할 수도
      있어요.
    </p>

    <p style="margin:18px 0 0 0;font-size:11px;color:#5A6C61;line-height:1.65;">
      박스가 도착하기 약 일주일 전에 정기 결제가 진행돼요. 바꾸고 싶은 게 있다면
      <a href="${SITE_URL}/account/subscriptions" style="color:#B63619;">구독 관리</a>
      에서 언제든 조정할 수 있어요.
    </p>
  `

  return {
    subject,
    html: renderLayout({
      preview: subject,
      kicker: `${input.cycleNumber}번째 맞춤 박스`,
      heading: `${petName(input.dogName)}의 다음 박스`,
      body,
      cta: {
        label: '이번 달 박스 자세히 보기',
        href: `${SITE_URL}/dogs/${input.dogId}/analysis`,
      },
      icon: '🐾',
    }),
  }
}
