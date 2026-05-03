/**
 * Farmer's Tail — Personalization cycle 진행 알림 메일.
 *
 * 트리거: cron `/api/cron/personalization-progression` 이 새 dog_formulas
 * row 를 생성한 직후. push 알림과 함께 발송 (push 가 OFF 인 사용자도 메일은
 * 받게).
 */
import { block, escape, renderLayout, SITE_URL } from '../layout'

export type PersonalizationCycleEmailInput = {
  recipientName: string
  dogName: string
  dogId: string
  cycleNumber: number
  /** 메인 라인 한국어명 — "Joint" / "Skin" 등. */
  mainLineName: string
  /** 메인 라인 한국어 부제 — "관절·시니어" 등. */
  mainLineSubtitle: string
  /** 메인 라인 % (정수, 0~100). */
  mainLinePct: number
  /** Reasoning chipLabel 배열. 최대 4개 노출. */
  reasoningLabels: string[]
}

export function renderPersonalizationCycle(
  input: PersonalizationCycleEmailInput,
): { subject: string; html: string } {
  const subject = `[파머스테일] ${input.dogName}이의 다음 박스 준비됐어요`

  const reasoningChips = input.reasoningLabels
    .slice(0, 4)
    .map(
      (label) => `
        <span style="
          display:inline-block;
          background:#FFFFFF;
          color:#3D2B1F;
          font-size:11px;
          font-weight:700;
          padding:4px 10px;
          border-radius:99px;
          margin:0 4px 6px 0;
          box-shadow:inset 0 0 0 1px #EDE6D8;
        ">${escape(label)}</span>`,
    )
    .join('')

  const calloutHtml = `
    <div style="font-size:11px;font-weight:800;color:#A0452E;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">
      이번 달 메인
    </div>
    <div style="font-family:Pretendard,sans-serif;font-size:22px;font-weight:800;color:#2E1F14;letter-spacing:-0.02em;line-height:1.2;">
      ${escape(input.mainLineName)} ${input.mainLinePct}%
    </div>
    <div style="font-size:13px;color:#7A7A7A;margin-top:4px;">
      ${escape(input.mainLineSubtitle)}
    </div>
  `

  const body = `
    <p style="margin:0 0 14px 0;">
      ${escape(input.recipientName)}님, 안녕하세요.
    </p>
    <p style="margin:0 0 18px 0;">
      <strong style="color:#1E1A14;">${escape(input.dogName)}이의
      ${input.cycleNumber}번째 박스</strong>가 준비됐어요. 그동안의 체크인
      응답을 반영해 비율을 조정했어요.
    </p>

    ${block.callout('terracotta', calloutHtml)}

    ${
      reasoningChips
        ? `
    <div style="margin:22px 0 8px 0;">
      <div style="font-size:11px;font-weight:700;color:#7A7A7A;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:8px;">
        결정 근거
      </div>
      <div>${reasoningChips}</div>
    </div>`
        : ''
    }

    <p style="margin:24px 0 0 0;font-size:13px;color:#3D2B1F;line-height:1.7;">
      라인별 분배, 토퍼 비중, 이번 cycle 의 결정 이유 — 모두 박스 페이지에서
      확인할 수 있어요. 마음에 안 드는 부분이 있으면 직접 비율을 조정할 수도
      있어요.
    </p>

    <p style="margin:18px 0 0 0;font-size:11px;color:#7A7A7A;line-height:1.65;">
      박스가 도착하기 약 일주일 전에 정기 결제가 진행돼요. 변경이 필요하면
      <a href="${SITE_URL}/mypage/subscriptions" style="color:#A0452E;">구독 관리</a>
      에서 언제든 조정 가능합니다.
    </p>
  `

  return {
    subject,
    html: renderLayout({
      preview: subject,
      kicker: `Cycle ${input.cycleNumber} · 다음 박스`,
      heading: `${input.dogName}이의 다음 박스`,
      body,
      cta: {
        label: '이번 달 박스 자세히 보기',
        href: `${SITE_URL}/dogs/${input.dogId}/analysis`,
      },
      icon: '🐾',
    }),
  }
}
