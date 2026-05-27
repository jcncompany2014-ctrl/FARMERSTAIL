/**
 * SubscriptionsEmptyState — 정기배송이 없을 때 표시하는 상태 화면.
 *
 * 분할 (2026-05-27): SubscriptionsClient.tsx 에서 추출. 시각 / 동작 동일.
 */
'use client'

import Link from 'next/link'
import { Package } from 'lucide-react'
import { V3, V3FontWeight, V3LetterSpacing, V3Radius } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

export default function SubscriptionsEmptyState() {
  return (
    <div
      className="text-center"
      style={{
        marginTop: 32,
        borderRadius: V3Radius.sm,
        border: `1.5px dashed ${V3.rule}`,
        padding: '48px 20px',
        background: V3.paperHi,
      }}
    >
      <div
        className="mx-auto flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          background: V3.paper,
          border: `1px solid ${V3.rule}`,
          marginBottom: 16,
        }}
      >
        <Package size={24} color={V3.inkMute} strokeWidth={1.3} />
      </div>
      <Mono color="sage" size="xxs" weight={600}>
        Start
      </Mono>
      <h3
        style={{
          margin: '8px 0 0',
          fontFamily: 'var(--font-sans)',
          fontWeight: V3FontWeight.black,
          fontSize: 18,
          color: V3.ink,
          letterSpacing: V3LetterSpacing.heading,
        }}
      >
        아직 신청한 정기배송이 없어요
      </h3>
      <p
        style={{
          fontSize: 12,
          color: V3.inkMute,
          marginTop: 8,
          lineHeight: 1.55,
          maxWidth: 260,
          marginInline: 'auto',
        }}
      >
        꾸준한 영양 공급, 더 저렴한 가격. 정기배송으로 시작해보세요
      </p>
      <Link
        href="/products"
        className="inline-flex items-center active:scale-[0.98] transition"
        style={{
          marginTop: 20,
          gap: 4,
          padding: '12px 24px',
          borderRadius: V3Radius.pill,
          fontSize: 12,
          fontWeight: V3FontWeight.bold,
          background: V3.ink,
          color: V3.paperHi,
          textDecoration: 'none',
        }}
      >
        제품 둘러보기
      </Link>
    </div>
  )
}
