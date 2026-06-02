/**
 * SubscriptionsNewBanner — 신규 정기배송 신청 직후 표시되는 confirmation 배너.
 * 4초 후 자동 dismiss — 부모에서 timer 관리.
 *
 * 분할 (2026-05-27): SubscriptionsClient.tsx 에서 추출. 시각 / 동작 동일.
 */
'use client'

import { Check } from 'lucide-react'
import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'

export default function SubscriptionsNewBanner() {
  return (
    <div
      style={{
        marginTop: 16,
        padding: '14px 16px',
        background: 'color-mix(in srgb, ' + V3.sage + ' 10%, transparent)',
        border: `1px solid ${V3.sage}`,
        borderRadius: V3Radius.sm,
      }}
    >
      <div
        className="flex items-center"
        style={{
          gap: 6,
          fontSize: 13.5,
          fontWeight: V3FontWeight.bold,
          color: V3.sage,
        }}
      >
        <Check size={16} strokeWidth={2.5} />
        정기배송이 신청되었어요!
      </div>
      <div style={{ fontSize: 10.5, color: V3.inkMute, marginTop: 4 }}>
        배송일 전에 안내 연락을 드릴게요.
      </div>
    </div>
  )
}
