/**
 * FarmToTailSection — 매거진 톤 brand story 블록.
 *
 * 핸드오프 패턴:
 *   - 상단 2px ink hairline + leaf sage icon + Mono sage "Farm to Tail — Vol. NN" + 우측 mute date
 *   - 44px sans 900 헤딩 "농장에서\n꼬리까지." (마지막 단어 accent, italic 폐기 — 색만 강조)
 *   - 풀폭 hero photo 210h
 *   - 본문 13.5 + textBalance + "이야기 읽기 →" link
 */

import Link from 'next/link'
import Image from 'next/image'
import { Leaf, ArrowRight, BookOpen } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

interface FarmToTailSectionProps {
  /** 발행호 라벨 — "Vol. 02" 등. */
  issueLabel: string
  /** 발행일 — "04. 25" 또는 "MAY 21". */
  dateLabel: string
  /** 헤딩 1줄 (sans 900). */
  heading1: string
  /** 헤딩 2줄 — accent 색으로 표시 (italic 폐기). */
  heading2: string
  /** 본문 (3~4줄 내). */
  body: string
  /** Hero photo URL. 없으면 placeholder. */
  heroImageUrl?: string | null
  /** Hero photo placeholder bg (이미지 없을 때). */
  heroToneBg?: string
  /** CTA — "이야기 읽기" 링크 경로. */
  storyHref: string
  /** CTA 라벨. 기본 "이야기 읽기". */
  ctaLabel?: string
}

export default function FarmToTailSection({
  issueLabel,
  dateLabel,
  heading1,
  heading2,
  body,
  heroImageUrl,
  heroToneBg = '#c4b694',
  storyHref,
  ctaLabel = '이야기 읽기',
}: FarmToTailSectionProps) {
  return (
    <section style={{ margin: '0 0 30px' }}>
      <div style={{ padding: '0 20px' }}>
        <div
          className="ft-rule-ink"
          style={{ marginBottom: 18 }}
          aria-hidden
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: 8 }}>
            <Leaf size={14} color={V3.sage} strokeWidth={1.6} />
            <Mono color="sage" size="xs" weight={600}>
              Farm to Tail — {issueLabel}
            </Mono>
          </div>
          <Mono color="inkMute" size="xs" weight={500}>
            {dateLabel}
          </Mono>
        </div>
        <h2
          style={{
            margin: '14px 0 4px',
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.display, // 900
            fontSize: 44,
            lineHeight: 0.98,
            letterSpacing: '-0.025em',
            color: V3.ink,
            wordBreak: 'keep-all',
            textWrap: 'balance',
          }}
        >
          {heading1}
          <br />
          <span style={{ color: V3.accent }}>{heading2}</span>
        </h2>
      </div>
      <div
        className="relative overflow-hidden"
        style={{
          marginTop: 14,
          width: '100%',
          aspectRatio: '16 / 9',
          background: heroToneBg,
          boxShadow: 'inset 0 0 0 1px rgba(22,20,15,0.2)',
        }}
      >
        {heroImageUrl ? (
          <Image
            src={heroImageUrl}
            alt={`${heading1} ${heading2}`}
            fill
            sizes="448px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={48} color={V3.inkMute} strokeWidth={1.2} />
          </div>
        )}
      </div>
      <div style={{ padding: '16px 20px 0' }}>
        <p
          className="ft-clamp-3"
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 13.5,
            lineHeight: 1.55,
            color: V3.inkSoft,
            maxWidth: 320,
            wordBreak: 'keep-all',
            textWrap: 'pretty',
          }}
        >
          {body}
        </p>
        <Link
          href={storyHref}
          className="inline-flex items-center"
          style={{
            marginTop: 14,
            gap: 10,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              color: V3.ink,
              fontWeight: 700,
              textDecoration: 'underline',
              textUnderlineOffset: 4,
            }}
          >
            {ctaLabel}
          </span>
          <ArrowRight size={20} color={V3.ink} strokeWidth={2} />
        </Link>
      </div>
    </section>
  )
}
