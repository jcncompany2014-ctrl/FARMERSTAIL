/**
 * CatalogBanner — Catalog 페이지 상단 ink 매거진 banner.
 *
 * 핸드오프 패턴:
 *   - ink-bg 카드 + paper text + radius 4
 *   - kicker yellow "Issue №NN · Season"
 *   - 38px sans 900 heading 2줄 (heading2 만 accent — italic 폐기)
 *   - 본문 max-width 280
 *   - 좌하단 yellow accent CTA "레시피 보기 →"
 *   - 우하단 추천 사진 140×120 (radius 0)
 *
 * 카드 자체가 호버/클릭 단위 — Link 로 감싸 상세 페이지로 이동.
 */

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, BookOpen } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

interface CatalogBannerProps {
  /** "Issue №02 · Spring" 등 kicker 라벨. */
  kicker: string
  /** 헤딩 1줄 (sans 900 paper). */
  heading1: string
  /** 헤딩 2줄 (accent color, italic 없음). */
  heading2: string
  /** 본문 (max 280자, 3줄 권장). */
  body: string
  /** CTA 라벨. */
  ctaLabel?: string
  /** CTA href. */
  ctaHref: string
  /** 우하단 추천 사진. 없으면 placeholder. */
  imageUrl?: string | null
  /** photo placeholder bg tint (이미지 없을 때). */
  imageToneBg?: string
  /** 카드 자체 클릭 href. CTA 와 다르면 분리. 기본 ctaHref 와 동일. */
  cardHref?: string
}

export default function CatalogBanner({
  kicker,
  heading1,
  heading2,
  body,
  ctaLabel = '레시피 보기',
  ctaHref,
  imageUrl,
  imageToneBg = '#a8825a',
  cardHref,
}: CatalogBannerProps) {
  const card = (
    <div
      className="ft-card-ink relative overflow-hidden"
      style={{
        padding: '20px 20px 0',
      }}
    >
      <Mono color="yellow" size="xs" weight={600}>
        {kicker}
      </Mono>
      <h2
        style={{
          margin: '10px 0 0',
          fontFamily: 'var(--font-sans)',
          fontWeight: V3FontWeight.display, // 900
          fontSize: 38,
          lineHeight: 1,
          letterSpacing: '-0.025em',
          color: V3.paper,
          wordBreak: 'keep-all',
          textWrap: 'balance',
        }}
      >
        {heading1}
        <br />
        <span style={{ color: V3.accent }}>{heading2}</span>
      </h2>
      <p
        className="ft-clamp-3"
        style={{
          margin: '12px 0 16px',
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: 'rgba(244,237,224,0.7)',
          lineHeight: 1.5,
          maxWidth: 280,
          wordBreak: 'keep-all',
        }}
      >
        {body}
      </p>
      <div
        className="flex items-end"
        style={{ margin: '0 -20px' }}
      >
        <div style={{ flex: 1, padding: '0 20px 14px' }}>
          <Link
            href={ctaHref}
            className="inline-flex items-center transition active:scale-95"
            style={{
              background: V3.yellow,
              color: V3.ink,
              border: 'none',
              borderRadius: 4,
              padding: '11px 14px',
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.black,
              fontSize: 13,
              gap: 8,
              letterSpacing: '-0.005em',
            }}
            onClick={(e) => {
              // 카드 전체 Link 안에 있을 경우 — outer 클릭 막음.
              e.stopPropagation()
            }}
          >
            {ctaLabel}
            <ArrowRight size={14} color={V3.ink} strokeWidth={2.4} />
          </Link>
        </div>
        <div
          className="relative shrink-0 overflow-hidden"
          style={{
            width: 140,
            height: 120,
            background: imageToneBg,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
          }}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={`${heading1} ${heading2}`}
              fill
              sizes="140px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen
                size={32}
                color="rgba(255,255,255,0.45)"
                strokeWidth={1.4}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <section style={{ padding: '12px 20px 24px' }}>
      {cardHref && cardHref !== ctaHref ? (
        <Link href={cardHref}>{card}</Link>
      ) : (
        card
      )}
    </section>
  )
}
