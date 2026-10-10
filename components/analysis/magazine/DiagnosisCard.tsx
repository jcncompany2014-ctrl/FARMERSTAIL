/**
 * 분석 한 줄 카드 — 칩 줄 + 진단 문장(마지막 줄 머스타드 밑줄) + 국제 기준 풋터.
 * (Magazine DiagnosisCard 에서 출발 — 2026-05-21 핸드오프.)
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 D08): 떠 있는 흰 카드·알약 칩·색 글자 강조를 걷고
 *   회색 면(#F6F4F5) 카드 + 네모 칩(먹색/흰색) + 굵은 문장. 풋터 문구는 기준 약어(AAFCO·FEDIAF·NRC) 대신
 *   "국제 영양 기준을 충족해요"(사장님 결정 목록 — 고객 문구에서 전문용어를 뺀다).
 */

import { V3 } from '@/lib/design/tokens'

interface DiagnosisChip {
  label: string
  variant: 'primary' | 'soft'
}

interface DiagnosisCardProps {
  chips: DiagnosisChip[]
  /** 진단 문장 앞줄들 — 줄마다 끊는다. */
  lines: string[]
  /** 마지막 줄 — 머스타드 밑줄. */
  highlight: string
  /** 풋터 왼쪽 — 기준 충족 문구. */
  guidelineLabel?: string
  /** 풋터 오른쪽 — "분석 · 9월 30일". */
  versionLabel?: string
}

export function DiagnosisCard({
  chips,
  lines,
  highlight,
  guidelineLabel = '국제 영양 기준을 충족해요',
  versionLabel,
}: DiagnosisCardProps) {
  return (
    <section
      aria-label="분석 한 줄"
      style={{
        margin: '22px 20px 0',
        padding: 18,
        background: V3.soft,
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {chips.map((c, i) => (
          <span
            key={i}
            style={{
              height: 30,
              padding: '0 10px',
              borderRadius: 4,
              background: c.variant === 'primary' ? V3.ink : '#FFFFFF',
              color: c.variant === 'primary' ? '#FFFFFF' : V3.ink,
              fontSize: 14,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {c.label}
          </span>
        ))}
      </span>

      <p style={{ margin: 0, fontSize: 19, fontWeight: 700, lineHeight: 1.6, color: V3.ink, wordBreak: 'keep-all' }}>
        {lines.map((l, i) => (
          <span key={i}>
            {l}
            <br />
          </span>
        ))}
        <span style={{ borderBottom: `4px solid ${V3.mustard}` }}>{highlight}</span>
      </p>

      <span
        style={{
          paddingTop: 12,
          borderTop: '1px solid #E0DDDE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 800, color: V3.ink }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          {guidelineLabel}
        </span>
        {versionLabel && (
          <span style={{ fontSize: 13, color: V3.inkMute, whiteSpace: 'nowrap' }}>{versionLabel}</span>
        )}
      </span>
    </section>
  )
}
