'use client'

/**
 * Magazine CTAStack — 보조 2버튼 (제품 문의 + 공유).
 *
 * 메인 적색 SUBSCRIBE 버튼은 2026-05-21 폐기 — 정기배송 신청 CTA 는
 * RecommendationBox 의 fb-totals 안 "정기배송 신청" 버튼이 단독 담당
 * (옛 디자인 기능 보존).
 *
 * 2026-07-14 사장님: '처방 상담 · 수의사 연결' → 수의사 연결 서비스가 없으므로
 * 제품 문의(/contact)로 교체. 없는 서비스를 광고하지 않는다.
 */

import Link from 'next/link'
import { MessageCircle, Share2 } from 'lucide-react'
import type { MagazinePalette } from './palette'
import { Reveal } from './primitives'

interface CTAStackProps {
  p: MagazinePalette
  /** 제품 문의 CTA 경로 (/contact) */
  consultHref: string
  /** 공유 CTA 클릭 */
  onShare?: () => void
}

export function CTAStack({ p, consultHref, onShare }: CTAStackProps) {
  return (
    <Reveal delay={60}>
      <div
        style={{
          padding: '18px 18px 22px',
          display: 'flex',
          gap: 10,
        }}
      >
        <SecondaryBtn
          p={p}
          href={consultHref}
          icon={<MessageCircle size={18} color={p.ink2} strokeWidth={1.8} />}
          label="제품 문의"
          sub="궁금한 점 물어보기"
        />
        <SecondaryBtnButton
          p={p}
          onClick={onShare}
          icon={<Share2 size={18} color={p.ink2} strokeWidth={1.8} />}
          label="결과 공유"
          sub="PDF · 링크"
        />
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
        borderRadius: 8,
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
        borderRadius: 8,
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
