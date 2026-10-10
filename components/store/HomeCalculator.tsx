'use client'

/**
 * 홈 "500g 한 봉, 며칠 먹을까요?"(웹 시안 Main) — 몸무게 3·5·10kg 버튼, 닭고기를 건사료에 곁들일 때(30%) 기준.
 * 숫자는 lib/store/feeding(앱과 같은 계산식). 직접 넣어 보기 → 닭고기 상품 페이지 계산기.
 */
import { useState } from 'react'
import Link from 'next/link'
import DaysBox from './DaysBox'
import { HOME_WEIGHTS, feedingSummary } from '@/lib/store/feeding'
import { RECIPE_BAND } from '@/lib/store/catalog'

export default function HomeCalculator() {
  const [kg, setKg] = useState(5)
  const s = feedingSummary(kg, 'chicken', 'light', 500)
  return (
    <>
      <div role="group" aria-label="몸무게" style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {HOME_WEIGHTS.map((w) => {
          const on = w === kg
          return (
            <button
              key={w}
              type="button"
              onClick={() => setKg(w)}
              aria-pressed={on}
              style={{ height: 56, borderRadius: 4, border: '1.5px solid #141414', background: on ? '#141414' : '#FFFFFF', color: on ? '#FFFFFF' : '#141414', fontSize: 19, fontWeight: 800, cursor: 'pointer' }}
            >
              {w}kg
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: 14 }}>
        <DaysBox heading={`${kg}kg 아이에게 500g 한 봉이면`} days={s.days} gramsPerDay={s.gramsPerDay} costPerDay={s.costPerDay} color={RECIPE_BAND.chicken} />
      </div>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 14, color: '#595959' }}>중성화한 성견·보통 활동량 기준이에요</span>
        <Link href="/store/chicken#calc" style={{ flexShrink: 0, height: 48, display: 'flex', alignItems: 'center', gap: 2, fontSize: 16, fontWeight: 700, color: '#141414' }}>
          직접 넣어 보기
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </>
  )
}
