/**
 * Farmer's Tail — Personalization cycle 진행 알림 메일.
 *
 * 트리거: cron `/api/cron/personalization-progression` 이 새 dog_formulas
 * row 를 생성한 직후. push 알림과 함께 발송 (push 가 OFF 인 사용자도 메일은
 * 받게).
 */
import { block, escape, renderLayout, SITE_URL } from '../layout.ts'
import { petName, withHonorific } from '../../korean.ts'

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
      ${escape(withHonorific(input.recipientName))}, 안녕하세요.
    </p>
    <p style="margin:0 0 18px 0;">
      <strong style="color:#173B33;">${escape(petName(input.dogName))}의
      다음 박스</strong>가 준비됐어요. 그동안의 체크인 응답을 반영해 구성을 조정했어요.
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
      레시피 구성과 이번 박스를 이렇게 정한 이유를 정기배송 화면에서 확인할 수 있어요.
    </p>

    <p style="margin:18px 0 0 0;font-size:11px;color:#5A6C61;line-height:1.65;">
      결제는 발송일 당일에 진행돼요. 바꾸고 싶은 게 있다면
      <a href="${SITE_URL}/account/subscriptions" style="color:#B63619;">구독 관리</a>
      에서 그 전까지 조정할 수 있어요.
    </p>
  `

  return {
    subject,
    html: renderLayout({
      preview: subject,
      // ★회차 번호(cycleNumber)는 박스 번호가 아니다 — 회차 1개 = 박스 3개(2026-09-25).
      kicker: '맞춤 박스',
      heading: `${petName(input.dogName)}의 다음 박스`,
      body,
      // 웹에서도 열리는 화면으로(/dogs 는 앱 전용 — 웹 구독자는 막다른 길이었다).
      cta: {
        label: '정기배송 확인하기',
        href: `${SITE_URL}/account/subscriptions`,
      },
      icon: '🐾',
    }),
  }
}

/**
 * ★승인·동의가 필요한 다음 박스 제안 (2026-09-25 출시 전 점검 4차).
 *
 * 예전엔 승인 대기 제안에도 위 "준비됐어요 · 조정했어요" 메일이 나갔고(사실과 다름 —
 * 응답이 없으면 자동 거절돼 옛 레시피가 간다), 금액이 바뀌는 제안은 메일을 아예 안
 * 보냈다. 앱 푸시만 가서 **웹 구독자는 제안이 있었다는 것도 몰랐다.**
 */
export function renderPersonalizationApprovalNeeded(input: {
  recipientName: string
  dogName: string
  recipeLabel: string
  /** 응답 기한(일) — 금액 변경 3일, 그 외 5일. */
  days: number
  /** 금액이 바뀌면 2주 결제 금액 전후. */
  priceFrom: number | null
  priceTo: number | null
  /** 안전(알레르기·건강) 때문에 필요한 변경. */
  forced: boolean
  /** 사이트 안 경로(예: '/account/subscriptions') — 호스트는 SITE_URL 정본. */
  ctaPath: string
  ctaLabel: string
}): { subject: string; html: string } {
  const dog = petName(input.dogName)
  const subject = input.forced
    ? `[파머스테일] [중요] ${dog} 다음 박스, 확인이 필요해요`
    : `[파머스테일] ${dog} 다음 박스, 확인이 필요해요`
  const hasPrice = input.priceFrom != null && input.priceTo != null && input.priceFrom !== input.priceTo
  const rows = [block.row('제안 레시피', escape(input.recipeLabel))]
  if (hasPrice) {
    rows.push(
      block.row(
        '2주 결제 금액',
        `${input.priceFrom!.toLocaleString()}원 → <strong>${input.priceTo!.toLocaleString()}원</strong>`,
      ),
    )
  }
  rows.push(block.row('확인 기한', `${input.days}일 안에`))

  const body = `
    <p style="margin:0 0 14px 0;">
      ${escape(withHonorific(input.recipientName))}, 안녕하세요.
    </p>
    <p style="margin:0 0 14px 0;">
      ${escape(dog)}의 요즘 상태를 반영해 다음 박스를 바꾸는 걸 제안드려요.
      ${input.forced ? '안전을 위해 필요한 변경이라 꼭 확인해 주세요.' : ''}
    </p>
    ${block.dl(rows)}
    <p style="margin:14px 0 0 0;font-size:13px;color:#173B33;line-height:1.7;">
      동의하시면 다음 박스부터 바뀌어요. ${input.days}일 안에 답이 없으면 지금 레시피와
      금액을 그대로 이어가요.
    </p>
  `
  return {
    subject,
    html: renderLayout({
      preview: subject,
      kicker: '확인이 필요해요',
      heading: `${dog} 다음 박스 제안`,
      body,
      cta: { label: input.ctaLabel, href: `${SITE_URL}${input.ctaPath}` },
      icon: '🐾',
    }),
  }
}

/** 응답 기한이 지나 지금 레시피를 그대로 이어갈 때 — 결과도 알려야 한다(2026-09-25). */
export function renderPersonalizationKeptPrevious(input: {
  recipientName: string
  dogName: string
  days: number
}): { subject: string; html: string } {
  const dog = petName(input.dogName)
  const subject = `[파머스테일] ${dog} 다음 박스는 지금 레시피 그대로예요`
  const body = `
    <p style="margin:0 0 14px 0;">
      ${escape(withHonorific(input.recipientName))}, 안녕하세요.
    </p>
    <p style="margin:0 0 14px 0;">
      제안드린 레시피 변경에 ${input.days}일 동안 답이 없어서, ${escape(dog)}의 다음 박스는
      지금 레시피와 금액 그대로 보내드려요. 다음 제안 때 다시 알려드릴게요.
    </p>
  `
  return {
    subject,
    html: renderLayout({
      preview: subject,
      kicker: '맞춤 박스',
      heading: '지금 레시피 그대로예요',
      body,
      cta: { label: '정기배송 확인하기', href: `${SITE_URL}/account/subscriptions` },
      icon: '🐾',
    }),
  }
}

