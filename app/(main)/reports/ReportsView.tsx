/**
 * 건강 리포트 그리기 — 집계(조회)는 page.tsx 가 하고, 여기는 받은 숫자를 놓는다.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 A11): 머리말(머스타드 네모) + 제목 글꼴 34 + 흰 바탕 먹선 저장 버튼
 *   → 이번 달 숫자 3칸 = 머스타드 바탕 도장 그림자 카드(이 화면의 핵심, 큰 숫자 Anton) → 우리 강아지 목록(먹선 2px 로 여는 줄).
 *   점검 화면(/design-check/analysis)이 같은 컴포넌트에 예시 값을 넣어 로그인 없이 본다.
 */

import Link from 'next/link'
import { petName } from '@/lib/korean'
import { V3, V3Shadow } from '@/lib/design/tokens'
import ReportExportButton from './ReportExportButton'

const ICON = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: V3.ink,
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export default function ReportsView({
  monthLabel,
  weightCount,
  diaryCount,
  analysisCount,
  dogs,
}: {
  monthLabel: string
  weightCount: number
  diaryCount: number
  analysisCount: number
  dogs: Array<{ id: string; name: string }>
}) {
  const stats = [
    {
      label: '체중 기록',
      value: weightCount,
      icon: (
        <svg {...ICON}>
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M15 7h6v6" />
        </svg>
      ),
    },
    {
      label: '다이어리',
      value: diaryCount,
      icon: (
        <svg {...ICON}>
          <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
          <path d="M4 19a2 2 0 0 1 2-2h13" />
        </svg>
      ),
    },
    {
      label: '분석',
      value: analysisCount,
      icon: (
        <svg {...ICON}>
          <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" />
          <path d="M7.5 14h9" />
        </svg>
      ),
    },
  ]

  return (
    <div style={{ paddingBottom: 28, color: V3.ink, lineHeight: 'normal' }}>
      <section style={{ padding: '26px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: V3.inkMute }}>
          <span aria-hidden style={{ width: 8, height: 8, background: V3.mustard }} />
          리포트
        </span>
        {/* 제목 글꼴은 앱 틀의 h1 규칙이 준다. */}
        <h1 style={{ margin: '10px 0 0', fontSize: 34, lineHeight: 1.15 }}>{monthLabel} 리포트</h1>
        <p style={{ margin: '8px 0 0', fontSize: 16, lineHeight: 1.55, color: V3.inkSoft }}>
          이번 달 우리 가족이 함께 한 기록을 한눈에
        </p>
        <div style={{ marginTop: 14 }}>
          <ReportExportButton monthLabel={monthLabel} />
        </div>
      </section>

      {/* 저장 버튼이 이 칸(.ft-report-capture)을 그림으로 찍는다. */}
      <section
        aria-label="이번 달 기록"
        className="ft-report-capture"
        style={{
          margin: '24px 20px 0',
          border: `2px solid ${V3.ink}`,
          boxShadow: V3Shadow.stamp,
          borderRadius: 4,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          background: V3.mustard,
        }}
      >
        {stats.map((st, i) => (
          <div
            key={st.label}
            style={{
              padding: '16px 12px 14px',
              borderLeft: i > 0 ? '1px solid rgba(20,20,20,0.2)' : 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {st.icon}
            <span className="ft-num" style={{ fontSize: 40, lineHeight: 1 }}>
              {st.value.toLocaleString()}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{st.label}</span>
          </div>
        ))}
      </section>

      {dogs.length > 0 && (
        <section aria-labelledby="dogs-title" style={{ margin: '34px 20px 0', display: 'flex', flexDirection: 'column' }}>
          {/* h2 는 앱 틀에서 제목 글꼴이 된다 — 이 머리말은 본문 글자(시안)라 h3. */}
          <h3 id="dogs-title" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: V3.inkMute }}>
            우리 강아지
          </h3>
          <div style={{ marginTop: 10, borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}>
            {dogs.map((d) => (
              <Link
                key={d.id}
                href={`/dogs/${d.id}/year-in-review`}
                className="transition active:scale-[0.99]"
                style={{
                  minHeight: 76,
                  padding: '12px 0',
                  boxSizing: 'border-box',
                  borderBottom: `1px solid ${V3.rule}`,
                  color: V3.ink,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{petName(d.name)}의 연간 리뷰</span>
                  <span style={{ fontSize: 15, color: V3.inkMute }}>지난 1년간의 성장, 변화, 감동 순간들</span>
                </span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            ))}
          </div>
        </section>
      )}

      {dogs.length === 0 && (
        <section
          style={{
            margin: '34px 20px 0',
            padding: '32px 20px',
            border: `1.5px dashed ${V3.inkFaint}`,
            borderRadius: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>아직 등록된 강아지가 없어요</p>
          <p style={{ margin: '8px 0 0', fontSize: 16, lineHeight: 1.55, color: V3.inkSoft }}>
            강아지를 등록하면 이번 달 기록이 리포트로 모여요
          </p>
          <Link
            href="/dogs/new"
            style={{
              marginTop: 18,
              alignSelf: 'stretch',
              height: 56,
              borderRadius: 4,
              background: V3.ink,
              color: '#FFFFFF',
              fontSize: 17,
              fontWeight: 800,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            강아지 등록하기 →
          </Link>
        </section>
      )}
    </div>
  )
}
