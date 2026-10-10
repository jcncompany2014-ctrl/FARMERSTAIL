/**
 * AnalysisCTASection — 분석 페이지 하단 CTA (정기배송 신청 / 다시 분석 / 히스토리).
 *
 * 분할 (2026-05-27): AnalysisView.tsx 에서 추출. 시각 / 동작 동일.
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 D08·A07): 먹색 꽉 찬 버튼 58 + 흰 바탕 1.5px 먹선 버튼.
 *   이미 구독 중이면 '맞춤 정기배송 신청하기'를 숨긴다(사장님 결정 11 — `hideStart`).
 */
'use client'

import Link from 'next/link'
import { V3 } from '@/lib/design/tokens'

type Props = {
  dogId: string
  dogName: string
  isArchive: boolean
  /** 이미 구독 중 — 신청 버튼을 숨긴다(사장님 결정 11). */
  hideStart?: boolean
}

const primary = {
  height: 58,
  borderRadius: 4,
  background: V3.ink,
  color: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  fontSize: 17,
  fontWeight: 800,
  textDecoration: 'none',
} as const

const secondary = {
  // 시안은 높이 54 + 먹선 1.5 위아래(링크 기본 content-box) = 57
  height: 57,
  boxSizing: 'border-box',
  border: `1.5px solid ${V3.ink}`,
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  fontWeight: 800,
  color: V3.ink,
  textDecoration: 'none',
} as const

export default function AnalysisCTASection({
  dogId,
  dogName,
  isArchive,
  hideStart = false,
}: Props) {
  return (
    <section style={{ margin: isArchive ? '24px 20px 0' : '28px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {isArchive ? (
        <>
          <Link href={`/dogs/${dogId}/analysis`} className="transition active:scale-[0.98]" style={primary}>
            최신 분석 보기
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <Link href={`/dogs/${dogId}/analyses`} style={{ ...secondary, height: 52 }}>
            히스토리 목록
          </Link>
        </>
      ) : (
        <>
          {/* 목적지 = 플랜(레시피 고르는 단계). /order 로 직행시키면 상단
              스텝바가 '레시피 → 배송 → 결제' 인데 레시피를 건너뛴 채 배송에
              떨어지고, 무엇보다 고른 레시피(?recipes=)가 없어서 주문 화면이
              제멋대로 보였다 (사장님 2026-07-15). RecommendationBox 도 /plan
              으로 가므로 목적지 통일. */}
          {!hideStart && (
            <Link href={`/dogs/${dogId}/plan`} className="transition active:scale-[0.98]" style={primary}>
              {dogName} 맞춤 정기배송 신청하기 →
            </Link>
          )}
          <Link href={`/dogs/${dogId}/survey`} style={secondary}>
            다시 분석하기
          </Link>
          {/* '이전 분석 히스토리' 버튼은 여기서 제거 — 페이지 최하단에 눈에 덜
              띄는 텍스트 링크로 내림(2026-07-14 사장님). AnalysisView 참고. */}
        </>
      )}
    </section>
  )
}
