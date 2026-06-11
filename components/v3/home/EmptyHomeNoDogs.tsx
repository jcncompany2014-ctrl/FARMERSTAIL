/**
 * EmptyHomeNoDogs — 강아지 0마리 상태의 홈 empty state.
 *
 * 핸드오프 패턴: dashed paper 카드 + 중앙 plus icon + 헤딩 + CTA.
 * 매거진 톤 유지 — Greeting 다음에 바로 노출.
 */

import Link from 'next/link'
import { Plus, PawPrint as DogIcon } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

interface EmptyHomeNoDogsProps {
  /** "아이 추가" 링크. */
  addDogHref?: string
  /** CTA 라벨. */
  ctaLabel?: string
  /** 헤딩 — 기본 "첫 아이를 등록해주세요". */
  heading?: string
  /** 부연 — 기본 안내 문구. */
  description?: string
}

export default function EmptyHomeNoDogs({
  addDogHref = '/dogs/new',
  ctaLabel = '아이 등록하기',
  heading = '첫 아이를 등록해주세요',
  description = '맞춤 영양 분석과 정기배송 추천이 시작돼요.',
}: EmptyHomeNoDogsProps) {
  return (
    <section style={{ padding: '0 20px 30px' }}>
      <Link
        href={addDogHref}
        className="flex flex-col items-center text-center transition active:scale-[0.99]"
        style={{
          padding: '40px 20px',
          borderRadius: 4,
          background: 'transparent',
          border: `1.5px dashed ${V3.rule}`,
          textDecoration: 'none',
          color: V3.ink,
        }}
      >
        <span
          className="flex items-center justify-center"
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: V3.paperHi,
            border: `1px solid ${V3.rule}`,
            position: 'relative',
          }}
        >
          <DogIcon size={28} color={V3.inkMute} strokeWidth={1.4} />
          <span
            className="absolute flex items-center justify-center"
            style={{
              right: -6,
              bottom: -6,
              width: 24,
              height: 24,
              borderRadius: 12,
              background: V3.accent,
              border: `2px solid ${V3.paper}`,
            }}
            aria-hidden
          >
            <Plus size={14} color={V3.paperHi} strokeWidth={2.4} />
          </span>
        </span>
        <Mono color="accent" size="xs" weight={600} style={{ marginTop: 18 }}>
          Welcome
        </Mono>
        <h2
          style={{
            margin: '8px 0 0',
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 22,
            color: V3.ink,
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
            textWrap: 'balance',
            wordBreak: 'keep-all',
          }}
        >
          {heading}
        </h2>
        <p
          style={{
            margin: '8px 0 18px',
            fontFamily: 'var(--font-sans)',
            fontSize: 13.5,
            color: V3.inkSoft,
            lineHeight: 1.5,
            maxWidth: 280,
            textWrap: 'pretty',
            wordBreak: 'keep-all',
          }}
        >
          {description}
        </p>
        <span
          className="inline-flex items-center"
          style={{
            gap: 6,
            background: V3.ink,
            color: V3.paperHi,
            padding: '10px 18px',
            borderRadius: 4,
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.bold,
            fontSize: 13.5,
            letterSpacing: '-0.005em',
          }}
        >
          {ctaLabel}
          <Plus size={14} color={V3.paperHi} strokeWidth={2.2} />
        </span>
      </Link>
    </section>
  )
}
