'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User,
  Package,
  Repeat,
  Dog,
  Bell,
  MapPin,
  ChevronRight,
  LogOut,
  Star,
  Heart,
  Coins,
  Ticket,
  UserPlus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  name: string | null
  phone: string | null
}

export default function MyPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [orderCount, setOrderCount] = useState(0)
  const [subCount, setSubCount] = useState(0)
  const [pointBalance, setPointBalance] = useState(0)
  const [wishCount, setWishCount] = useState(0)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email ?? null)

      const { data: prof } = await supabase
        .from('profiles')
        .select('name, phone')
        .eq('id', user.id)
        .single()
      if (prof) setProfile(prof)

      const { count: oCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
      setOrderCount(oCount ?? 0)

      const { count: sCount } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'active')
      setSubCount(sCount ?? 0)

      // Latest point balance (latest ledger row's balance_after)
      const { data: ledger } = await supabase
        .from('point_ledger')
        .select('balance_after')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setPointBalance(ledger?.balance_after ?? 0)

      // Wishlist count
      const { count: wCount } = await supabase
        .from('wishlists')
        .select('product_id', { count: 'exact', head: true })
        .eq('user_id', user.id)
      setWishCount(wCount ?? 0)
    }
    load()
  }, [supabase])

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
      {/* 헤더 — kicker + sans h1 (landing/auth와 같은 조판 언어) */}
      <section className="px-5 pt-6 pb-2">
        <span className="kicker">My Account · 내 정보</span>
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
            <div className="w-12 h-12 rounded-full bg-bg flex items-center justify-center">
              <User
                className="w-5 h-5 text-muted"
                strokeWidth={1.5}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold text-text truncate">
                {displayName}님
              </div>
              <div className="text-[11px] text-muted truncate mt-0.5">
                {email ?? '—'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 포인트 하이라이트 — ink 배경 + kicker-gold */}
      <section className="px-5 mt-3">
        <Link
          href="/mypage/points"
          className="block rounded-2xl px-5 py-4 text-white hover:shadow-md transition-all"
          style={{ background: 'var(--ink)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="kicker kicker-gold">Points</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span
                  className="font-serif leading-none"
                  style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}
                >
                  {pointBalance.toLocaleString()}
                </span>
                <span className="text-[12px] text-white/80">P</span>
              </div>
              <p className="text-[10px] text-white/70 mt-1">
                리뷰 작성·친구 초대로 적립
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
              <Coins className="w-5 h-5 text-gold" strokeWidth={2} />
            </div>
          </div>
        </Link>
      </section>

      {/* 요약 통계 — 3열 stat card. 하나의 조판 언어로 반복. */}
      <section className="px-5 mt-2.5">
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            href="/mypage/orders"
            kicker="Orders"
            value={orderCount}
            unit="건"
            valueColor="var(--ink)"
          />
          <StatCard
            href="/mypage/subscriptions"
            kicker="Subs"
            value={subCount}
            unit="건"
            valueColor="var(--moss)"
          />
          <StatCard
            href="/mypage/wishlist"
            kicker="Wish"
            value={wishCount}
            unit="개"
            valueColor="var(--terracotta)"
          />
        </div>
      </section>

      {/* 메뉴 리스트 */}
      <section className="px-5 mt-6">
        <div className="mb-2">
          <span className="kicker kicker-muted">Menu</span>
        </div>
        <div className="bg-white rounded-2xl border border-rule overflow-hidden">
          <MenuItem href="/mypage/orders" Icon={Package} label="주문 내역" />
          <MenuItem
            href="/mypage/subscriptions"
            Icon={Repeat}
            label="정기배송 관리"
          />
          <MenuItem href="/mypage/wishlist" Icon={Heart} label="찜한 상품" />
          <MenuItem href="/mypage/reviews" Icon={Star} label="내 리뷰" />
          <MenuItem href="/mypage/coupons" Icon={Ticket} label="내 쿠폰" />
          <MenuItem href="/mypage/points" Icon={Coins} label="적립금" />
          <MenuItem href="/mypage/referral" Icon={UserPlus} label="친구 초대" />
          <MenuItem href="/dogs" Icon={Dog} label="내 아이들" />
          <MenuItem
            href="/mypage/notifications"
            Icon={Bell}
            label="알림 설정"
          />
          <MenuItem Icon={MapPin} label="배송지 관리" comingSoon last />
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

      {/* 탈퇴 — App Store & 개인정보보호법 요구사항. 눈에 띄지 않게 하단에. */}
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
 * 3열 통계 카드 — kicker + 큰 숫자 + 단위. Dashboard 상단 stat와 같은 문법.
 * valueColor는 의미적 액센트 (주문=ink, 정기=moss, 찜=terracotta).
 */
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

function MenuItem({
  href,
  Icon,
  label,
  comingSoon,
  last,
}: {
  href?: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  comingSoon?: boolean
  last?: boolean
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
      <div className="flex items-center gap-3">
        <Icon
          className="w-[18px] h-[18px] text-text"
          strokeWidth={1.5}
        />
        <span className="text-[13px] font-semibold text-text">
          {label}
        </span>
      </div>
      <ChevronRight
        className="w-4 h-4 text-muted"
        strokeWidth={2}
      />
    </Link>
  )
}
