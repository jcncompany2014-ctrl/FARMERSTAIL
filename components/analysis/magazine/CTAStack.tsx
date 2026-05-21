'use client'

/**
 * Magazine CTAStack — 메인 구독 CTA (full width, 적색 그림자) +
 * 보조 2버튼 (처방 상담 + 공유).
 */

import Link from 'next/link'
import { ArrowRight, ClipboardList, Share2 } from 'lucide-react'
import type { MagazinePalette } from './palette'
import { Reveal } from './primitives'

interface CTAStackProps {
  p: MagazinePalette
  dogName: string
  /** 메인 CTA 클릭 시 이동할 경로 */
  primaryHref: string
  /** 결제 라벨 (1주분 · 39,900원 · 무료배송 등) */
  primaryMeta: string
  /** 처방 상담 CTA 경로 */
  consultHref: string
  /** 공유 CTA 클릭 */
  onShare?: () => void
}

export function CTAStack({
  p,
  dogName,
  primaryHref,
  primaryMeta,
  consultHref,
  onShare,
}: CTAStackProps) {
  return (
    <Reveal delay={60}>
      <div
        style={{
          padding: '18px 18px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <Link
          href={primaryHref}
          style={{
            background: p.brand,
            color: '#fff',
            border: 'none',
            borderRadius: 16,
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            boxShadow: `0 8px 24px ${p.brand}55`,
            textDecoration: 'none',
          }}
        >
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div
              style={{
                fontFamily: 'var(--font-stencil, "Stardos Stencil", serif)',
                fontSize: 9.5,
                letterSpacing: '0.32em',
                opacity: 0.8,
                fontWeight: 700,
              }}
            >
              SUBSCRIBE
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>
              {dogName}이 첫 박스 시작하기
            </div>
            <div
              style={{
                fontSize: 11,
                opacity: 0.85,
                marginTop: 1,
                fontWeight: 500,
              }}
            >
              {primaryMeta}
            </div>
          </div>
          <ArrowRight size={22} color="#fff" strokeWidth={2} />
        </Link>

        <div style={{ display: 'flex', gap: 10 }}>
          <SecondaryBtn
            p={p}
            href={consultHref}
            icon={<ClipboardList size={18} color={p.ink2} strokeWidth={1.8} />}
            label="처방 상담"
            sub="수의사 연결"
          />
          <SecondaryBtnButton
            p={p}
            onClick={onShare}
            icon={<Share2 size={18} color={p.ink2} strokeWidth={1.8} />}
            label="결과 공유"
            sub="PDF · 링크"
          />
        </div>
      </div>
    </Reveal>
  )
}

function SecondaryBtn({
  p,
  href,
  icon,
  label,
  sub,
}: {
  p: MagazinePalette
  href: string
  icon: React.ReactNode
  label: string
  sub: string
}) {
  return (
    <Link
      href={href}
      style={{
        flex: 1,
        background: p.card,
        color: p.ink,
        border: `1px solid ${p.line}aa`,
        borderRadius: 14,
        padding: '14px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        textAlign: 'left',
        textDecoration: 'none',
      }}
    >
      {icon}
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 10.5, color: p.muted, fontWeight: 500 }}>{sub}</div>
    </Link>
  )
}

function SecondaryBtnButton({
  p,
  onClick,
  icon,
  label,
  sub,
}: {
  p: MagazinePalette
  onClick?: () => void
  icon: React.ReactNode
  label: string
  sub: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        background: p.card,
        color: p.ink,
        border: `1px solid ${p.line}aa`,
        borderRadius: 14,
        padding: '14px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {icon}
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 10.5, color: p.muted, fontWeight: 500 }}>{sub}</div>
    </button>
  )
}
