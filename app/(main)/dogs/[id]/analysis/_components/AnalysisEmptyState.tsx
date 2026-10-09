/**
 * AnalysisEmptyState — 분석 데이터가 없을 때 표시.
 *
 * 분할 (2026-05-27): AnalysisView.tsx 에서 추출. 시각 / 동작 동일.
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 D10): 회색 점선 테두리 상자 + 회색 원 아이콘 72 + 제목 글꼴 28 +
 *   먹색 꽉 찬 버튼. 문구 "설문을 완료하면" → 시안 "설문을 마치면".
 */
'use client'

import Link from 'next/link'
import { V3 } from '@/lib/design/tokens'

export default function AnalysisEmptyState({ dogId }: { dogId: string }) {
  return (
    <section
      aria-label="분석 결과가 없어요"
      style={{
        margin: '28px 20px 32px',
        padding: '44px 22px 32px',
        border: `1.5px dashed ${V3.inkFaint}`,
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        color: V3.ink,
        lineHeight: 'normal',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          background: V3.soft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: V3.inkSoft,
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="4" width="14" height="17" rx="1.5" />
          <path d="M9 4V3h6v1" />
          <path d="M9 10h6M9 14h6M9 18h3" />
        </svg>
      </span>
      {/* 제목 글꼴은 앱 틀의 h1 규칙이 준다. */}
      <h1 style={{ margin: '20px 0 0', fontSize: 28, lineHeight: 1.15 }}>분석 결과가 없어요</h1>
      <p style={{ margin: '12px 0 0', fontSize: 17, lineHeight: 1.6, color: V3.inkSoft }}>
        설문을 마치면
        <br />
        맞춤 영양 분석을 받아볼 수 있어요
      </p>
      <Link
        href={`/dogs/${dogId}/survey`}
        className="transition active:scale-[0.98]"
        style={{
          marginTop: 26,
          alignSelf: 'stretch',
          height: 58,
          borderRadius: 4,
          background: V3.ink,
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 17,
          fontWeight: 800,
          textDecoration: 'none',
        }}
      >
        설문 시작하기
      </Link>
    </section>
  )
}
