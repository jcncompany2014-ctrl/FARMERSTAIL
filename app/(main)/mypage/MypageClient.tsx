'use client'

// audit #101 — MypageClient: 로그아웃 버튼 + tier chip / stat / menu 렌더링.
// page.tsx (server) 가 auth, profile, orders/subs/points/wish/coupons 카운트를
// 모두 prefetch → 여기에 prop drill. 로그아웃은 supabase client auth.signOut.
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

  async function handleLogout() {
    if (!confirm('로그아웃 하시겠어요?')) return
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName =
    profile?.name || (email ? email.split('@')[0] : null) || '고객'

  return (
    <main className="pb-8">
      {/* 헤더 — kicker + sans h1 */}
      <section className="px-5 pt-6 pb-2">
        <span className="kicker">My Account</span>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          내 정보
        </h1>
      </section>

      {/* 프로필 카드 */}
      <section className="px-5 mt-4">
        <div className="bg-white rounded-2xl border border-rule px-5 py-5">
          <div className="flex items-center gap-3">
            <Link
              href="/account/profile"
              aria-label="프로필 수정"
              className="w-12 h-12 rounded-full bg-bg flex items-center justify-center shrink-0 hover:bg-rule transition"
            >
              <User
                className="w-5 h-5 text-muted"
                strokeWidth={1.5}
              />
            </Link>
            <Link
              href="/account/profile"
              className="flex-1 min-w-0 group"
            >
              {/* UI audit H1: flex-wrap 제거 — 내부 child 가 단일이라 wrap 의미 X.
                  긴 한국어 이름 시 wrap 이 truncate 와 충돌해 tier chip 이 2번째 줄로
                  밀려나던 issue. truncate 단독 적용으로 단순화. */}
              <div className="text-[14px] font-bold text-text truncate group-hover:text-terracotta transition">
                {displayName}님
              </div>
              <div className="text-[11px] text-muted truncate mt-0.5">
                {email ?? '—'}
              </div>
              <div className="text-[10px] text-terracotta font-bold mt-1">
                프로필 / 비밀번호 →
              </div>
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

      {/* 포인트 + 등급 hero — mypage/points 페이지와 동일 디자인.
          gradient + radial accent + 등급 chip + 다음 등급 안내. */}
      <section className="px-5 mt-3">
        <Link
          href="/mypage/points"
          className="relative block overflow-hidden rounded-3xl px-6 pt-5 pb-5 text-white hover:shadow-md transition-all"
          style={{
            background:
              'linear-gradient(135deg, #1E1A14 0%, #3a2f1d 60%, #5b4720 100%)',
          }}
        >
          {/* 우상단 골드 글로우 */}
          <div
            aria-hidden
            className="absolute -top-12 -right-10 w-44 h-44 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(212,169,74,0.25) 0%, transparent 70%)',
            }}
          />
          <div
            aria-hidden
            className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full pointer-events-none"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          />

          <div className="relative">
            <div className="flex items-center gap-2 mb-1.5">
              <Coins className="w-3.5 h-3.5 text-gold" strokeWidth={2} />
              <span className="kicker kicker-gold">Points</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className="font-serif leading-none tabular-nums text-gold"
                style={{
                  fontSize: 36,
                  fontWeight: 800,
                  letterSpacing: '-0.025em',
                }}
              >
                {pointBalance.toLocaleString()}
              </span>
              <span className="text-[14px] text-white/85 font-bold">P</span>
            </div>

            {profile?.tier && (
              <div className="mt-3 flex items-center gap-2.5 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <span className="text-[18px] leading-none">
                  {TIER_EMOJI[profile.tier] ?? '🌱'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-white">
                    {tierMeta(profile.tier).label} 등급 · {tierMeta(profile.tier).earnRate}% 적립
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-white/70" strokeWidth={2} />
              </div>
            )}
          </div>
        </Link>
      </section>

      {/* 요약 통계 */}
      {(orderCount > 0 ||
        subCount > 0 ||
        couponCount > 0 ||
        wishCount > 0) && (
        <section className="px-5 mt-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {orderCount > 0 && (
              <StatCard
                href="/mypage/orders"
                kicker="Orders"
                value={orderCount}
                unit="건"
                valueColor="var(--ink)"
              />
            )}
            {subCount > 0 && (
              <StatCard
                href="/mypage/subscriptions"
                kicker="Subs"
                value={subCount}
                unit="건"
                valueColor="var(--moss)"
              />
            )}
            {couponCount > 0 && (
              <StatCard
                href="/mypage/coupons"
                kicker="Coupons"
                value={couponCount}
                unit="장"
                valueColor="var(--terracotta)"
              />
            )}
            {wishCount > 0 && (
              <StatCard
                href="/mypage/wishlist"
                kicker="Wish"
                value={wishCount}
                unit="개"
                valueColor="var(--gold)"
              />
            )}
          </div>
        </section>
      )}

      {/* 그룹 1: 주문 & 배송 */}
      <MenuGroup kicker="Orders · 주문 & 배송" className="mt-6">
        <MenuItem href="/mypage/orders" Icon={Package} label="주문 내역" />
        <MenuItem
          href="/mypage/subscriptions"
          Icon={Repeat}
          label="정기배송 관리"
        />
        <MenuItem href="/mypage/addresses" Icon={MapPin} label="배송지 관리" last />
      </MenuGroup>

      {/* 그룹 2: 혜택 & 활동 */}
      <MenuGroup kicker="Benefits · 혜택" className="mt-5">
        <MenuItem
          href="/mypage/membership"
          Icon={Crown}
          label="멤버십 등급"
        />
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

      {/* 그룹 3: 설정 */}
      <MenuGroup kicker="Settings · 설정" className="mt-5">
        <MenuItem
          href="/mypage/notifications"
          Icon={Bell}
          label="알림 받기 설정"
        />
        <MenuItem
          href="/mypage/consent"
          Icon={Mail}
          label="광고 수신 설정"
        />
        <MenuItem
          href="/mypage/privacy"
          Icon={Shield}
          label="내 데이터 (열람·다운로드)"
          last
        />
      </MenuGroup>

      {/* 그룹 4: 도움말 */}
      <MenuGroup kicker="Help · 도움말" className="mt-5">
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
      <section className="px-5 mt-6 mb-2">
        <div className="text-[10.5px] text-muted">
          <Link href="/legal" className="hover:text-text">
            약관 · 정책
          </Link>
        </div>
      </section>

      {/* 로그아웃 */}
      <section className="px-5 mt-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white border border-rule text-[13px] font-semibold text-muted hover:text-sale hover:border-sale transition active:scale-[0.98]"
        >
          <LogOut className="w-4 h-4" strokeWidth={2} />
          로그아웃
        </button>
      </section>

      {/* 탈퇴 */}
      <section className="px-5 mt-3 text-center">
        <Link
          href="/mypage/delete"
          className="inline-block text-[11px] text-muted hover:text-sale transition underline underline-offset-2"
        >
          회원 탈퇴
        </Link>
      </section>
    </main>
  )
}

/**
 * 등급 chip — 프로필 카드에 인라인.
 * lib/tiers 의 5단계 시스템 (씨앗/새싹/꽃/열매/단짝) 통합.
 */
function TierChip({ tier }: { tier: string }) {
  const meta = tierMeta(tier)
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full"
      style={{
        background: meta.bg,
        color: meta.ink,
        letterSpacing: '-0.01em',
        boxShadow: '0 1px 0 rgba(30,26,20,0.05)',
      }}
    >
      <span className="text-[14px] leading-none">{TIER_EMOJI[meta.key]}</span>
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

function StatCard({
  href,
  kicker,
  value,
  unit,
  valueColor,
}: {
  href: string
  kicker: string
  value: number
  unit: string
  valueColor: string
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-2xl border border-rule px-3 py-3 hover:border-text transition-all"
    >
      <span className="kicker kicker-muted" style={{ fontSize: 9 }}>
        {kicker}
      </span>
      <div className="mt-1.5 flex items-baseline gap-0.5">
        <span
          className="font-serif leading-none"
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: valueColor,
            letterSpacing: '-0.015em',
          }}
        >
          {value}
        </span>
        <span className="text-[10px] text-muted">{unit}</span>
      </div>
    </Link>
  )
}

function MenuGroup({
  kicker,
  className,
  children,
}: {
  kicker: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={`px-5 ${className ?? ''}`}>
      <div className="mb-2 px-1">
        <span className="kicker kicker-muted">{kicker}</span>
      </div>
      <div className="bg-white rounded-2xl border border-rule overflow-hidden">
        {children}
      </div>
    </section>
  )
}

function MenuItem({
  href,
  Icon,
  label,
  comingSoon,
  last,
  badge,
}: {
  href?: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  comingSoon?: boolean
  last?: boolean
  badge?: number
}) {
  const borderCls = last ? '' : 'border-b border-rule'

  if (comingSoon || !href) {
    return (
      <div
        className={`flex items-center justify-between px-4 py-3.5 ${borderCls}`}
      >
        <div className="flex items-center gap-3">
          <Icon
            className="w-[18px] h-[18px] text-muted"
            strokeWidth={1.5}
          />
          <span className="text-[13px] font-semibold text-muted">
            {label}
          </span>
        </div>
        <span className="text-[10px] text-muted bg-bg px-2 py-0.5 rounded-md">
          준비 중
        </span>
      </div>
    )
  }

  return (
    <Link
      href={href}
      className={`flex items-center justify-between px-4 py-3.5 hover:bg-bg transition ${borderCls}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Icon
          className="w-[18px] h-[18px] text-text"
          strokeWidth={1.5}
        />
        <span className="text-[13px] font-semibold text-text truncate">
          {label}
        </span>
        {typeof badge === 'number' && badge > 0 && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{
              background: 'var(--terracotta)',
              color: 'white',
            }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <ChevronRight
        className="w-4 h-4 text-muted"
        strokeWidth={2}
      />
    </Link>
  )
}
