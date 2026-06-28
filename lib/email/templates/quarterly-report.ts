/**
 * Farmer's Tail — 분기 맞춤 영양 리포트 메일.
 *
 * 트리거: cron `/api/cron/quarterly-report` 가 분기 1회(1·4·7·10월 1일)
 * 새싹(sprout) 이상 등급 회원에게 발송. 강아지의 최신 분석(analyses) 데이터를
 * 요약 — 체중·체형(BCS)·일일 급여량·에너지(MER)·영양 분배. 새싹 등급 혜택
 * "분기 맞춤 분석 리포트" 의 실체.
 *
 * 거래/정보성 메일(본인 강아지 데이터, 광고 없음) — renderLayout 의 정보성
 * 푸터를 그대로 사용한다.
 */
import { block, escape, renderLayout, SITE_URL } from '../layout'
import { petName } from '@/lib/korean'

export type QuarterlyReportEmailInput = {
  recipientName: string
  dogName: string
  dogId: string
  /** 예: "2026년 2분기" */
  quarterLabel: string
  weightKg: number | null
  bcsLabel: string | null
  /** 일일 권장 급여량 (g) */
  feedG: number | null
  /** 일일 에너지 요구량 (kcal) */
  merKcal: number | null
  proteinPct: number | null
  fatPct: number | null
}

function fmt(v: number | null, suffix: string, digits = 0): string {
  return v === null || Number.isNaN(v) ? '—' : `${v.toFixed(digits)}${suffix}`
}

export function renderQuarterlyReport(
  input: QuarterlyReportEmailInput,
): { subject: string; html: string } {
  const name = petName(input.dogName)
  const subject = `[파머스테일] ${name}의 ${input.quarterLabel} 맞춤 영양 리포트`

  const rows: string[] = []
  if (input.weightKg !== null)
    rows.push(block.row('현재 체중', escape(fmt(input.weightKg, 'kg', 1))))
  if (input.bcsLabel)
    rows.push(block.row('체형 평가(BCS)', escape(input.bcsLabel)))
  if (input.feedG !== null)
    rows.push(block.row('하루 권장 급여량', escape(fmt(input.feedG, 'g'))))
  if (input.merKcal !== null)
    rows.push(block.row('하루 에너지(MER)', escape(fmt(input.merKcal, ' kcal'))))
  if (input.proteinPct !== null)
    rows.push(block.row('단백질 비율', escape(fmt(input.proteinPct, '%', 1))))
  if (input.fatPct !== null)
    rows.push(block.row('지방 비율', escape(fmt(input.fatPct, '%', 1))))

  const statsTable = rows.length > 0 ? block.dl(rows) : ''

  const body = `
    <p style="margin:0 0 14px 0;">
      ${escape(input.recipientName)}님, 안녕하세요.
    </p>
    <p style="margin:0 0 18px 0;">
      <strong style="color:#173B33;">${escape(name)}의 ${escape(input.quarterLabel)} 맞춤 영양 리포트</strong>가
      도착했어요. 그동안 쌓인 분석을 바탕으로 우리 아이의 현재 상태를 정리했어요.
      <span style="color:#5A6C61;">(새싹 등급 이상 회원 혜택)</span>
    </p>

    ${statsTable ? block.callout('moss', statsTable) : ''}

    <p style="margin:22px 0 0 0;font-size:13px;color:#173B33;line-height:1.7;">
      라인별 분배·결정 근거·체크인 추세까지 더 자세한 분석은 아래에서 확인할 수
      있어요. 계절이 바뀌면 활동량·체중도 달라질 수 있으니, 변화가 느껴지면
      재진단을 추천드려요.
    </p>
  `

  return {
    subject,
    html: renderLayout({
      preview: subject,
      kicker: `${input.quarterLabel} · 맞춤 영양 리포트`,
      heading: `${name}의 분기 영양 리포트`,
      body,
      cta: {
        label: '전체 분석 리포트 보기',
        href: `${SITE_URL}/dogs/${input.dogId}/analysis`,
      },
      icon: '📋',
    }),
  }
}
