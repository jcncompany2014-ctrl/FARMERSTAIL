/**
 * DogSubscriptionEmpty — 강아지 상세 '구독' 탭에서 이 강아지의 진행중 구독이
 * 없을 때 표시. 일반 SubscriptionsEmptyState(/start 유도)와 달리 이 강아지의
 * 맞춤 플로우(분석/플랜)로 바로 시작하도록 유도한다(사장님 2026-07-13).
 */
'use client'

import Link from 'next/link'
import { Truck } from 'lucide-react'
import { V3, V3FontWeight, V3LetterSpacing, V3Radius } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'
import { petName } from '@/lib/korean'

export default function DogSubscriptionEmpty({
  dogName,
  startHref,
}: {
  dogName: string
  /** 이 강아지의 시작 경로 — 처방 있으면 /plan, 없으면 /analysis. */
  startHref: string
}) {
  return (
    <div
      className="text-center"
      style={{
        marginTop: 24,
        borderRadius: V3Radius.sm,
        border: `1.5px dashed ${V3.rule}`,
        padding: '44px 20px',
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
        <Truck size={24} color={V3.inkMute} strokeWidth={1.3} />
      </div>
      <Mono color="sage" size="xxs" weight={600}>
        Start
      </Mono>
      <h3
        style={{
          margin: '8px 0 0',
          fontFamily: 'var(--font-sans)',
          fontWeight: V3FontWeight.black,
          fontSize: 16,
          color: V3.ink,
          letterSpacing: V3LetterSpacing.heading,
        }}
      >
        아직 진행중인 정기배송이 없어요
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
        {petName(dogName)}의 맞춤 박스를 2주마다 문 앞까지. 지금 시작해보세요.
      </p>
      <Link
        href={startHref}
        className="inline-flex items-center active:scale-[0.98] transition"
        style={{
          marginTop: 20,
          gap: 5,
          padding: '12px 24px',
          borderRadius: V3Radius.pill,
          fontSize: 12,
          fontWeight: V3FontWeight.bold,
          background: V3.ink,
          color: V3.paperHi,
          textDecoration: 'none',
        }}
      >
        <Truck size={13} strokeWidth={2.4} />
        정기배송 시작하기
      </Link>
    </div>
  )
}
