'use client'

import { useShipDate } from './useShipDate'

/** "오늘 밤 12시까지 주문하면 10월 8일(목) 출고" — 홈 첫 화면(웹 시안 Main). 도착 요일은 약속하지 않는다. */
export default function ShipLine() {
  const ship = useShipDate()
  return (
    <p style={{ margin: '14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, color: '#3D3D3D' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M2.5 6.5h11v10h-11z" />
        <path d="M13.5 10h4l3 3.2v3.3h-7" />
        <circle cx="6.5" cy="17.5" r="1.6" />
        <circle cx="17" cy="17.5" r="1.6" />
      </svg>
      {ship ? (
        <span>
          오늘 밤 12시까지 주문하면 <strong style={{ fontWeight: 800, color: '#141414' }}>{ship.label} 출고</strong>
        </span>
      ) : (
        <span>
          <strong style={{ fontWeight: 800, color: '#141414' }}>화·목 출고</strong> · 얼린 채로 보냉 상자에
        </span>
      )}
    </p>
  )
}
