'use client'

/**
 * MypageClient — v3 reskin (2026-05-22, R9).
 *
 * 변경:
 *   - 헤더: serif → sans 800 + Mono kicker.
 *   - 프로필 카드: paperHi + 1px rule + radius 4.
 *   - 포인트 hero: V3Dark ink 카드 + yellow accent (gradient → flat ink).
 *   - StatCard: 4-col mini metric strip 패턴 (ActiveDogCard 와 동일 톤).
 *   - MenuGroup: kicker (Mono) + paperHi 카드 + ink rule.
 *   - MenuItem: chevron / badge 톤은 V3.accent.
 *
 * 비즈니스 로직(로그아웃·tier·count)은 audit #101 유지.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User,
  Package,
  Repeat,
  Bell,
  MapPin,
  ChevronRight,
  LogOut,
  Star,
  Heart,
  Coins,
  Ticket,
  UserPlus,
  Mail,
  HelpCircle,
  FileText,
  Shield,
  Crown,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { tierMeta } from '@/lib/tiers'
import { V3, V3Dark, V3FontSize, V3FontWeight, V3LetterSpacing, V3Radius } from '@/lib/design/tokens'
import { Mono, Modal, Badge } from '@/components/v3'

type Profile = {
  name: string | null
  phone: string | null
  tier?: string | null
  cumulative_spend?: number | null
}

type Props = {
  email: string | null
  profile: Profile | null
  orderCount: number
  subCount: number
  pointBalance: number
  wishCount: number
  couponCount: number
}

export default function MypageClient({
  email,
  profile,
  orderCount,
  subCount,
  pointBalance,
  wishCount,
  couponCount,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  // browser confirm() → v3 Modal — 톤 통일 + accessibility 강화 (focus trap).
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function performLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName =
    profile?.name || (email ? email.split('@')[0] : null) || '고객'

  return (
    <main style={{ paddingBottom: 32 }}>
      {/* ──────────────────────────────────────────────────────────────
          헤더 — kicker + sans 800 h1
          ────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '24px 20px 12px' }}>
        <Mono color="inkMute" size="xs" weight={500}>
          My Account · 내 정보
        </Mono>
        <h1
          style={{
            margin: '6px 0 0',
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 32,
            lineHeight: 1,
            color: V3.ink,
            letterSpacing: V3LetterSpacing.heading,
          }}
        >
          마이페이지
        </h1>
      </section>

      {/* ──────────────────────────────────────────────────────────────
          프로필 카드 — paperHi + ink rule + radius 4
          ────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '8px 20px 0' }}>
        <div
          style={{
            background: V3.paperHi,
            border: `1px solid ${V3.rule}`,
            borderRadius: V3Radius.sm,
            padding: '16px 18px',
          }}
        >
          <div className="flex items-center" style={{ gap: 12 }}>
            <Link
              href="/account/profile"
              aria-label="프로필 수정"
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                background: V3.paper,
                border: `1px solid ${V3.rule}`,
              }}
            >
              <User size={20} color={V3.inkMute} strokeWidth={1.5} />
            </Link>
            <Link href="/account/profile" className="flex-1 min-w-0">
              <div
                className="truncate"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 15,
                  fontWeight: V3FontWeight.bold,
                  color: V3.ink,
                  letterSpacing: '-0.02em',
                }}
              >
                {displayName}님
              </div>
              <div
                className="truncate"
                style={{
                  fontSize: 11.5,
                  color: V3.inkMute,
                  marginTop: 2,
                }}
              >
                {email ?? '—'}
              </div>
              <Mono
                color="accent"
                size="xxs"
                weight={600}
                letterSpacing="0.12em"
                style={{ marginTop: 6, display: 'inline-block' }}
              >
                프로필 / 비밀번호 →
              </Mono>
            </Link>
            {profile?.tier && (
              <Link
                href="/mypage/membership"
                aria-label="멤버십 등급 보기"
                className="shrink-0 active:scale-95 transition"
              >
                <TierChip tier={profile.tier} />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────
          포인트 hero — V3Dark ink 카드 + yellow accent
          ────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '12px 20px 0' }}>
        <Link
          href="/mypage/points"
          className="relative block overflow-hidden"
          style={{
            background: V3Dark.bg,
            borderRadius: V3Radius.sm,
            padding: '18px 20px',
            color: V3Dark.fg,
            textDecoration: 'none',
          }}
        >
          {/* 우상단 yellow glow — accent dot 같은 시각 마커 */}
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              top: -40,
              right: -40,
              width: 140,
              height: 140,
              borderRadius: 999,
              background:
                'radial-gradient(circle, rgba(230,185,66,0.22) 0%, transparent 70%)',
            }}
          />

          <div className="relative">
            <div className="flex items-center" style={{ gap: 6, marginBottom: 6 }}>
              <Coins size={14} color={V3.yellow} strokeWidth={2} />
              <Mono color={V3.yellow} size="xxs" weight={600}>
                Points
              </Mono>
            </div>
            <div className="flex items-baseline" style={{ gap: 5 }}>
              <span
                className="tabular-nums"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: V3FontWeight.black,
                  fontSize: 38,
                  color: V3.yellow,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                {pointBalance.toLocaleString()}
              </span>
              <Mono color={V3Dark.fgMute} size="sm" weight={600} letterSpacing="0.08em">
                P
              </Mono>
            </div>

            {profile?.tier && (
              <div
                className="flex items-center"
                style={{
                  marginTop: 14,
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: V3Radius.xs,
                  background: V3Dark.ruleSoft,
                  border: `1px solid ${V3Dark.rule}`,
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>
                  {TIER_EMOJI[profile.tier] ?? '🌱'}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: V3FontWeight.bold,
                      color: V3Dark.fg,
                    }}
                  >
                    {tierMeta(profile.tier).label} 등급 · {tierMeta(profile.tier).earnRate}% 적립
                  </div>
                </div>
                <ChevronRight size={14} color={V3Dark.fgMute} strokeWidth={2} />
              </div>
            )}
          </div>
        </Link>
      </section>

      {/* ──────────────────────────────────────────────────────────────
          Stat grid — orders / subs / coupons / wish (4-col)
          ────────────────────────────────────────────────────────────── */}
      {(orderCount > 0 ||
        subCount > 0 ||
        couponCount > 0 ||
        wishCount > 0) && (
        <section style={{ padding: '10px 20px 0' }}>
          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 0,
              background: V3.paperHi,
              border: `1px solid ${V3.rule}`,
              borderRadius: V3Radius.sm,
              overflow: 'hidden',
            }}
          >
            <StatCell
              href="/mypage/orders"
              kicker="Orders"
              value={orderCount}
              unit="건"
              tone="ink"
              isFirst
            />
            <StatCell
              href="/mypage/subscriptions"
              kicker="Subs"
              value={subCount}
              unit="건"
              tone="sage"
            />
            <StatCell
              href="/mypage/coupons"
              kicker="Coupons"
              value={couponCount}
              unit="장"
              tone="accent"
            />
            <StatCell
              href="/mypage/wishlist"
              kicker="Wish"
              value={wishCount}
              unit="개"
              tone="yellow"
            />
          </div>
        </section>
      )}

      {/* ──────────────────────────────────────────────────────────────
          Menu groups — kicker + paperHi 카드 + ink rule
          ────────────────────────────────────────────────────────────── */}
      <MenuGroup kicker="Orders · 주문 & 배송" topPad={28}>
        <MenuItem href="/mypage/orders" Icon={Package} label="주문 내역" />
        <MenuItem
          href="/mypage/subscriptions"
          Icon={Repeat}
          label="정기배송 관리"
        />
        <MenuItem href="/mypage/addresses" Icon={MapPin} label="배송지 관리" last />
      </MenuGroup>

      <MenuGroup kicker="Benefits · 혜택" topPad={20}>
        <MenuItem href="/mypage/membership" Icon={Crown} label="멤버십 등급" />
        <MenuItem href="/mypage/wishlist" Icon={Heart} label="찜한 상품" />
        <MenuItem href="/mypage/reviews" Icon={Star} label="내 리뷰" />
        <MenuItem
          href="/mypage/coupons"
          Icon={Ticket}
          label="내 쿠폰"
          badge={couponCount}
          last
        />
      </MenuGroup>

      <MenuGroup kicker="Settings · 설정" topPad={20}>
        <MenuItem
          href="/mypage/notifications"
          Icon={Bell}
          label="알림 받기 · 화면 테마"
        />
        <MenuItem href="/mypage/consent" Icon={Mail} label="광고 수신 설정" />
        <MenuItem
          href="/mypage/privacy"
          Icon={Shield}
          label="내 데이터 (열람·다운로드)"
          last
        />
      </MenuGroup>

      <MenuGroup kicker="Help · 도움말" topPad={20}>
        <MenuItem href="/chat" Icon={Sparkles} label="AI 영양사 상담" />
        <MenuItem href="/business" Icon={HelpCircle} label="고객센터" />
        <MenuItem href="/faq" Icon={FileText} label="자주 묻는 질문" />
        <MenuItem
          href="/mypage/referral"
          Icon={UserPlus}
          label="친구 초대 · 적립금"
          last
        />
      </MenuGroup>

      {/* 약관·정책 */}
      <section style={{ padding: '24px 20px 8px' }}>
        <Mono color="inkMute" size="xxs" weight={500} letterSpacing="0.12em">
          <Link href="/legal" style={{ color: V3.inkMute, textDecoration: 'none' }}>
            약관 · 정책
          </Link>
        </Mono>
      </section>

      {/* 로그아웃 */}
      <section style={{ padding: '16px 20px 0' }}>
        <button
          onClick={() => setLogoutOpen(true)}
          className="w-full flex items-center justify-center transition active:scale-[0.98]"
          style={{
            gap: 8,
            padding: '14px 16px',
            background: V3.paperHi,
            border: `1px solid ${V3.rule}`,
            borderRadius: V3Radius.sm,
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            fontWeight: V3FontWeight.semibold,
            color: V3.inkMute,
          }}
        >
          <LogOut size={16} strokeWidth={2} />
          로그아웃
        </button>
      </section>

      {/* Logout 확인 modal — confirm() 대체. */}
      <Modal
        open={logoutOpen}
        onClose={() => !loggingOut && setLogoutOpen(false)}
        title="로그아웃 하시겠어요?"
        dismissOnBackdrop={!loggingOut}
        showClose={!loggingOut}
      >
        <Modal.Body>
          저장된 정보는 그대로 유지돼요. 다시 로그인하면 똑같이 사용할 수 있어요.
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={() => setLogoutOpen(false)}
            disabled={loggingOut}
            style={{
              padding: '10px 18px',
              borderRadius: V3Radius.sm,
              fontSize: 12.5,
              fontWeight: V3FontWeight.bold,
              background: V3.paperHi,
              color: V3.inkMute,
              border: `1px solid ${V3.rule}`,
              cursor: loggingOut ? 'not-allowed' : 'pointer',
              opacity: loggingOut ? 0.5 : 1,
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={performLogout}
            disabled={loggingOut}
            style={{
              padding: '10px 18px',
              borderRadius: V3Radius.sm,
              fontSize: 12.5,
              fontWeight: V3FontWeight.bold,
              background: V3.ink,
              color: V3.paperHi,
              border: 'none',
              cursor: loggingOut ? 'not-allowed' : 'pointer',
              opacity: loggingOut ? 0.7 : 1,
            }}
          >
            {loggingOut ? '로그아웃 중…' : '로그아웃'}
          </button>
        </Modal.Footer>
      </Modal>

      {/* 탈퇴 */}
      <section style={{ padding: '12px 20px 0', textAlign: 'center' }}>
        <Link
          href="/mypage/delete"
          style={{
            fontSize: 11,
            color: V3.inkMute,
            textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}
        >
          회원 탈퇴
        </Link>
      </section>
    </main>
  )
}

// ──────────────────────────────────────────────────────────────
// TierChip — 5단계 등급 시스템 (씨앗/새싹/꽃/열매/단짝)
// ──────────────────────────────────────────────────────────────
function TierChip({ tier }: { tier: string }) {
  const meta = tierMeta(tier)
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 4,
        fontFamily: 'var(--font-sans)',
        fontSize: 11,
        fontWeight: V3FontWeight.black,
        padding: '4px 10px',
        borderRadius: V3Radius.pill,
        background: meta.bg,
        color: meta.ink,
        letterSpacing: '-0.01em',
        border: `1px solid ${V3.rule}`,
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>{TIER_EMOJI[meta.key]}</span>
      {meta.label}
    </span>
  )
}

const TIER_EMOJI: Record<string, string> = {
  seed: '🌱',
  sprout: '🌿',
  bloom: '🌸',
  fruit: '🍎',
  mate: '💛',
}

// ──────────────────────────────────────────────────────────────
// StatCell — 4-col 메트릭 strip 한 cell
// ──────────────────────────────────────────────────────────────
function StatCell({
  href,
  kicker,
  value,
  unit,
  tone,
  isFirst,
}: {
  href: string
  kicker: string
  value: number
  unit: string
  tone: 'ink' | 'sage' | 'accent' | 'yellow'
  isFirst?: boolean
}) {
  const toneColor: Record<typeof tone, string> = {
    ink: V3.ink,
    sage: V3.sage,
    accent: V3.accent,
    yellow: V3.yellow,
  }
  return (
    <Link
      href={href}
      style={{
        padding: '12px 10px',
        borderLeft: isFirst ? 'none' : `1px solid ${V3.rule}`,
        textDecoration: 'none',
        display: 'block',
      }}
    >
      <Mono color="inkMute" size="xxs" weight={500}>
        {kicker}
      </Mono>
      <div className="flex items-baseline" style={{ marginTop: 6, gap: 3 }}>
        <span
          className="tabular-nums"
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 22,
            color: toneColor[tone],
            letterSpacing: '-0.025em',
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <Mono color="inkMute" size="xxs" weight={500} letterSpacing="0.04em">
          {unit}
        </Mono>
      </div>
    </Link>
  )
}

// ──────────────────────────────────────────────────────────────
// MenuGroup — kicker label + paperHi 카드 wrapper
// ──────────────────────────────────────────────────────────────
function MenuGroup({
  kicker,
  topPad,
  children,
}: {
  kicker: string
  topPad: number
  children: React.ReactNode
}) {
  return (
    <section style={{ padding: `${topPad}px 20px 0` }}>
      <div style={{ marginBottom: 8, paddingLeft: 2 }}>
        <Mono color="inkMute" size="xxs" weight={500}>
          {kicker}
        </Mono>
      </div>
      <div
        style={{
          background: V3.paperHi,
          border: `1px solid ${V3.rule}`,
          borderRadius: V3Radius.sm,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </section>
  )
}

// ──────────────────────────────────────────────────────────────
// MenuItem — 단일 row (icon + label + chevron, optional badge)
// ──────────────────────────────────────────────────────────────
function MenuItem({
  href,
  Icon,
  label,
  comingSoon,
  last,
  badge,
}: {
  href?: string
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  label: string
  comingSoon?: boolean
  last?: boolean
  badge?: number
}) {
  const borderBottom = last ? 'none' : `1px solid ${V3.rule}`

  if (comingSoon || !href) {
    return (
      <div
        className="flex items-center justify-between"
        style={{
          padding: '14px 16px',
          borderBottom,
        }}
      >
        <div className="flex items-center" style={{ gap: 12 }}>
          <Icon size={18} color={V3.inkMute} strokeWidth={1.5} />
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: V3FontSize.base,
              fontWeight: V3FontWeight.semibold,
              color: V3.inkMute,
            }}
          >
            {label}
          </span>
        </div>
        <Mono
          color="inkMute"
          size="xxs"
          weight={500}
          letterSpacing="0.08em"
          style={{
            padding: '2px 8px',
            background: V3.paper,
            borderRadius: V3Radius.xs,
          }}
        >
          준비 중
        </Mono>
      </div>
    )
  }

  return (
    <Link
      href={href}
      className="flex items-center justify-between transition"
      style={{
        padding: '14px 16px',
        borderBottom,
        textDecoration: 'none',
      }}
    >
      <div className="flex items-center min-w-0" style={{ gap: 12 }}>
        <Icon size={18} color={V3.ink} strokeWidth={1.5} />
        <span
          className="truncate"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: V3FontSize.base,
            fontWeight: V3FontWeight.semibold,
            color: V3.ink,
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </span>
        {typeof badge === 'number' && badge > 0 && (
          <Badge tone="accent" filled size="sm">
            {badge > 99 ? '99+' : badge}
          </Badge>
        )}
      </div>
      <ChevronRight size={16} color={V3.inkMute} strokeWidth={2} />
    </Link>
  )
}
