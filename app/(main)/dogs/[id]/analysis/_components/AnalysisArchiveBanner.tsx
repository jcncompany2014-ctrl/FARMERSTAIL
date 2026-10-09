/**
 * AnalysisArchiveBanner — 과거 분석 히스토리 모드일 때 표시되는 안내 배너.
 *
 * 분할 (2026-05-27): AnalysisView.tsx 에서 추출. 시각 / 동작 동일.
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 A07): 회색 면 + 왼쪽 6px 머스타드 띠, 시계 아이콘 + 두 줄,
 *   오른쪽 밑줄 링크 "최신 분석 →"(누르는 자리 48).
 */
'use client'

import Link from 'next/link'
import { V3 } from '@/lib/design/tokens'

type Props = {
  dogId: string
  analysisDate: string
}

export default function AnalysisArchiveBanner({ dogId, analysisDate }: Props) {
  return (
    <section
      aria-label="과거 분석 안내"
      style={{
        margin: '20px 20px 0',
        padding: '4px 4px 4px 14px',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        background: V3.soft,
        borderLeft: `6px solid ${V3.mustard}`,
        color: V3.ink,
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          minWidth: 0,
          padding: '10px 0',
          fontSize: 15,
          fontWeight: 800,
          lineHeight: 1.45,
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{ flexShrink: 0, marginTop: 1 }}
        >
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span>
          {analysisDate} 기록
          <br />
          <span style={{ fontWeight: 600, color: V3.inkMute }}>과거 분석 보기</span>
        </span>
      </span>
      <Link
        href={`/dogs/${dogId}/analysis`}
        style={{
          flexShrink: 0,
          minHeight: 48,
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          fontSize: 15,
          fontWeight: 800,
          color: V3.ink,
          textDecoration: 'underline',
          textUnderlineOffset: 4,
        }}
      >
        최신 분석 →
      </Link>
    </section>
  )
}
