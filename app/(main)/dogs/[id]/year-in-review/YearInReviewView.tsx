/**
 * 연말 결산(함께한 기록 돌아보기) 그리기 — 조회·계산은 page.tsx 가 하고, 여기는 받은 숫자를 놓는다.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 A09·I11):
 *   머리말(머스타드 네모) → 머스타드 바탕 도장 그림자 카드("땅콩이와 함께한 247일", 이 화면의 핵심) → 2×2 회색 면
 *   카드(왼쪽 6px 색 띠, 큰 숫자 Anton) → 체중 이야기(먹선 2px 로 여는 묶음) → 고마워요 카드 → 먹색 버튼.
 *   영어 머리말("Year in Review"·"Weight Story")은 한글로만(규칙85). 30일 미만이면 가운데 안내 + 흰 바탕 먹선 버튼.
 *   점검 화면(/design-check/analysis)이 같은 컴포넌트에 예시 값을 넣어 로그인 없이 본다.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'
import { josa, petName } from '@/lib/korean'
import { V3, V3Shadow } from '@/lib/design/tokens'

export interface YearInReviewData {
  dogId: string
  dogName: string
  daysIn: number
  isFullYear: boolean
  analysisCount: number
  weightCount: number
  checkinCount: number
  diaryCount: number
  weightStart: number | null
  weightEnd: number | null
  weightDelta: number | null
  weightMin: number | null
  weightMax: number | null
}

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

/** 함께한 지 30일 미만 — "아직 한 해가 안 됐어요"(시안 I11). */
export function YearTooEarlyView({ dogId, dogName, daysIn }: { dogId: string; dogName: string; daysIn: number }) {
  return (
    <section
      style={{
        // 머리줄·강아지 탭·아래 탭을 뺀 높이에서 가운데(시안 I11).
        minHeight: 'calc(100dvh - 240px)',
        boxSizing: 'border-box',
        padding: '40px 20px 32px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        color: V3.ink,
        lineHeight: 'normal',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 72,
          height: 72,
          boxSizing: 'border-box',
          border: `2px solid ${V3.ink}`,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={V3.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 3h10M7 21h10" />
          <path d="M8 3c0 5 8 5 8 9s-8 4-8 9" />
          <path d="M16 3c0 5-8 5-8 9s8 4 8 9" />
        </svg>
      </span>
      {/* 제목 글꼴은 앱 틀의 h1 규칙이 준다. */}
      <h1 style={{ margin: '24px 0 0', fontSize: 36, lineHeight: 1.15 }}>
        아직 한 해가
        <br />
        안 됐어요
      </h1>
      <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.65, color: V3.inkSoft, wordBreak: 'keep-all' }}>
        {josa(petName(dogName), '과', '와')} 함께한 시간이 {daysIn}일이에요.
        <br />
        조금만 더 모이면 한 해 회고를 볼 수 있어요.
      </p>
      <Link
        href={`/dogs/${dogId}`}
        style={{
          marginTop: 14,
          height: 54,
          boxSizing: 'border-box',
          borderRadius: 4,
          border: `1.5px solid ${V3.ink}`,
          background: '#FFFFFF',
          color: V3.ink,
          fontSize: 16,
          fontWeight: 800,
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        우리 아이로 돌아가기
      </Link>
    </section>
  )
}

function StatCard({ icon, label, value, unit, band }: { icon: ReactNode; label: string; value: number; unit: string; band: string }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: V3.soft,
        borderLeft: `6px solid ${band}`,
      }}
    >
      {icon}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: V3.inkMute }}>{label}</span>
        <span style={{ whiteSpace: 'nowrap' }}>
          <span className="ft-num" style={{ fontSize: 34 }}>
            {value.toLocaleString()}
          </span>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{unit}</span>
        </span>
      </span>
    </div>
  )
}

export default function YearInReviewView({ data: d }: { data: YearInReviewData }) {
  return (
    <div style={{ paddingBottom: 28, color: V3.ink, lineHeight: 'normal' }}>
      {/* 히어로 */}
      <section style={{ padding: '26px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: V3.inkMute }}>
          <span aria-hidden style={{ width: 8, height: 8, background: V3.mustard }} />
          {d.isFullYear ? '한 해 회고' : '함께한 기록 · 돌아보기'}
        </span>
        <div
          style={{
            marginTop: 14,
            padding: '20px 18px 18px',
            border: `2px solid ${V3.ink}`,
            boxShadow: V3Shadow.stamp,
            borderRadius: 4,
            display: 'flex',
            flexDirection: 'column',
            background: V3.mustard,
          }}
        >
          {/* 제목 글꼴은 앱 틀의 h1 규칙이 준다. 실제 일수 "함께한 N일"로 정직하게(사장님 2026-07-23). */}
          <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.2 }}>{josa(petName(d.dogName), '과', '와')} 함께한</h1>
          <span style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 4, whiteSpace: 'nowrap' }}>
            <span className="ft-num" style={{ fontSize: 96, lineHeight: 0.95 }}>
              {d.daysIn.toLocaleString()}
            </span>
            <span className="ft-poster" style={{ fontSize: 34 }}>
              일
            </span>
          </span>
        </div>
        <p style={{ margin: '18px 0 0', fontSize: 17, lineHeight: 1.6, color: V3.inkSoft, wordBreak: 'keep-all' }}>
          정성껏 챙겨주셔서 고마워요. {d.isFullYear ? '한 해를' : '그동안을'} 짧게 돌아볼게요.
        </p>
      </section>

      {/* 카드 grid */}
      <section
        aria-label="함께한 기록 숫자"
        style={{ margin: '26px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}
      >
        <StatCard
          band={V3.mustard}
          label="분석"
          value={d.analysisCount}
          unit="회"
          icon={
            <svg {...ICON}>
              <rect x="5" y="4" width="14" height="17" rx="2" />
              <path d="M9 3h6v3H9z" />
              <path d="M8.5 11h7M8.5 15h5" />
            </svg>
          }
        />
        <StatCard
          band="#2F8F8B"
          label="체중 기록"
          value={d.weightCount}
          unit="회"
          icon={
            <svg {...ICON}>
              <rect x="4" y="4" width="16" height="16" rx="3" />
              <path d="M8.5 9.5a5 5 0 0 1 7 0" />
              <path d="M12 9.5l1.5-1.5" />
            </svg>
          }
        />
        <StatCard
          band={V3.sale}
          label="체크인"
          value={d.checkinCount}
          unit="회"
          icon={
            <svg {...ICON}>
              <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
              <path d="M4 19a2 2 0 0 1 2-2h13" />
            </svg>
          }
        />
        <StatCard
          band="#2E3338"
          label="일기"
          value={d.diaryCount}
          unit="편"
          icon={
            <svg {...ICON}>
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          }
        />
      </section>

      {/* 체중 변화 narrative */}
      {d.weightDelta !== null && d.weightStart != null && d.weightEnd != null && (
        <section
          aria-label="체중 이야기"
          style={{
            margin: '28px 20px 0',
            borderTop: `2px solid ${V3.ink}`,
            paddingTop: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: V3.inkMute }}>체중 이야기</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              aria-hidden
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                background: V3.soft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={V3.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                {d.weightDelta > 0.05 ? (
                  <path d="M5 16l6-6 4 4 4-6" />
                ) : d.weightDelta < -0.05 ? (
                  <path d="M5 8l6 6 4-4 4 6" />
                ) : (
                  <path d="M5 12h14" />
                )}
              </svg>
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>
              <span className="ft-num" style={{ fontSize: 30 }}>
                {d.weightStart}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800 }}> kg</span>
              <span style={{ margin: '0 8px', fontSize: 20, fontWeight: 800 }}>→</span>
              <span className="ft-num" style={{ fontSize: 30 }}>
                {d.weightEnd}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800 }}> kg</span>
            </span>
          </span>
          <span style={{ fontSize: 16, lineHeight: 1.55, color: V3.inkSoft, wordBreak: 'keep-all' }}>
            {d.weightDelta > 0.05
              ? `${Math.abs(d.weightDelta)} kg 늘었어요 — 잘 자라고 있어요`
              : d.weightDelta < -0.05
                ? `${Math.abs(d.weightDelta)} kg 변화 — 함께 살펴봐도 좋아요`
                : '안정적인 체중이에요'}
            {d.weightMin != null && d.weightMax != null && (
              <> · 최저 {d.weightMin} kg / 최고 {d.weightMax} kg</>
            )}
          </span>
        </section>
      )}

      {/* 감사 메시지 */}
      <section
        aria-label="고마워요"
        style={{
          margin: '28px 20px 0',
          padding: 18,
          borderRadius: 4,
          background: V3.soft,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill={V3.mustard} aria-hidden>
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
        </svg>
        <span className="ft-poster" style={{ fontSize: 22, lineHeight: 1.3, wordBreak: 'keep-all' }}>
          {d.isFullYear ? '한 해 동안' : '그동안'} 정성껏 챙겨주셔서 고마워요
        </span>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: V3.inkSoft, wordBreak: 'keep-all' }}>
          {petName(d.dogName)}의 작은 변화 하나하나가 모여 이번 회고가 됐어요.
          {d.isFullYear ? ' 다음 한 해도' : ' 앞으로도'} 천천히, 함께 가요.
        </p>
      </section>

      {/* CTA */}
      <Link
        href={`/dogs/${d.dogId}`}
        className="transition active:scale-[0.99]"
        style={{
          margin: '24px 20px 0',
          height: 58,
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
        돌아가기
      </Link>
    </div>
  )
}
