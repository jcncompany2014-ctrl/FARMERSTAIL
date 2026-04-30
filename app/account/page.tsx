import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ChevronRight,
  Package,
  Mail,
  HelpCircle,
  FileText,
  RotateCcw,
  Gift,
  ShoppingBag,
  LogOut,
  Smartphone,
  UserCog,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import LogoutButton from '@/components/account/LogoutButton'
import WelcomeCouponBanner from '@/components/account/WelcomeCouponBanner'
import TierBadge from '@/components/account/TierBadge'
import { isAppContextServer } from '@/lib/app-context'

/**
 * /account — 웹 사용자용 마이페이지 hub.
 *
 * (main)/mypage 는 AppChrome 로 감싸진 모바일 전용 hub. 웹 사용자도 자기 정보
 * 일부는 봐야 하니 별도 hub 가 필요. 웹에서 의미 있는 것만 선별:
 *   - 주문 내역 (/mypage/orders)
 *   - 뉴스레터 구독 (/newsletter)
 *   - 고객센터 (/business)
 *   - 자주 묻는 질문 (/faq)
 *   - 환불 정책 (/legal/refund)
 *   - 앱 다운로드 (/app-required)
 *
 * 그 외 (정기배송 / 포인트 / 쿠폰 / 위시리스트 / 정기배송 / 우리 아이) 는
 * 모바일 앱 전용으로 분리되어 있음 — 이 hub 에선 "앱에서 보기" CTA 만 노출.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '내 계정 | 파머스테일',
  description: '주문 내역, 구독, 고객센터를 한 곳에서 확인하세요.',
  alternates: { canonical: '/account' },
  robots: { index: false, follow: false },
}

type SectionItem = {
  href: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  description?: string
  badge?: string
}

export default async function AccountPage() {
  const isApp = await isAppContextServer()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/account')
  }

  // 주문 카운트 (간단한 카드 표시용 — 미수령 + 전체)
  const [{ count: totalOrders }, { count: pendingOrders }] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      // FSM 의 실제 enum: pending → preparing → shipping → delivered.
      // 'confirmed', 'shipped' 는 존재하지 않는 값이라 매번 0건 반환했음.
      .in('order_status', ['pending', 'preparing', 'shipping']),
  ])

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, email, tier, cumulative_spend')
    .eq('id', user.id)
    .maybeSingle()

  const webItems: SectionItem[] = [
    {
      href: '/mypage/orders',
      icon: Package,
      label: '주문 내역',
      description: pendingOrders
        ? `진행 중 ${pendingOrders}건`
        : '결제부터 배송까지 한눈에',
      badge: totalOrders ? String(totalOrders) : undefined,
    },
    {
      href: '/account/profile',
      icon: UserCog,
      label: '내 프로필',
      description: '이름·연락처·생일',
    },
    {
      href: '/newsletter',
      icon: Mail,
      label: '뉴스레터 구독',
      description: '월 1회 농장 + 신상 + 케어 인사이트',
    },
    {
      href: '/business',
      icon: HelpCircle,
      label: '고객센터',
      description: '문의 / 제휴 / 단체 주문',
    },
    {
      href: '/faq',
      icon: FileText,
      label: '자주 묻는 질문',
    },
    {
      href: '/legal/refund',
      icon: RotateCcw,
      label: '환불 정책',
    },
  ]

  const appOnlyItems: SectionItem[] = [
    {
      href: '/app-required',
      icon: ShoppingBag,
      label: '정기배송 관리',
      description: '앱에서 주기 변경 · 일시정지 · 해지',
    },
    {
      href: '/app-required',
      icon: Gift,
      label: '포인트 / 쿠폰',
      description: '적립금 사용 · 쿠폰 받기',
    },
  ]

  const displayName = profile?.name ?? user.email?.split('@')[0] ?? '회원'

  return (
    <AuthAwareShell>
    <main
      className="pb-12 md:pb-20 mx-auto"
      style={{ background: 'var(--bg)', maxWidth: 1280 }}
    >
      <div className="px-5 md:px-8 pt-4 md:pt-6">
        <nav
          aria-label="현재 위치"
          className="flex items-center gap-1 text-[11px] md:text-[12px]"
          style={{ color: 'var(--muted)' }}
        >
          <Link href="/" className="hover:text-terracotta transition">
            홈
          </Link>
          <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>내 계정</span>
        </nav>
      </div>

      <section className="px-5 md:px-8 pt-6 md:pt-12 pb-6 md:pb-10">
        <span
          className="font-mono text-[10px] md:text-[12px] tracking-[0.22em] uppercase"
          style={{ color: 'var(--terracotta)' }}
        >
          My Account · 내 계정
        </span>
        <h1
          className="font-serif mt-3 md:mt-4 text-[26px] md:text-[40px]"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
          }}
        >
          {displayName} 님,
          <br />
          <span style={{ color: 'var(--terracotta)' }}>오늘도 좋은 한 끼.</span>
        </h1>
        <p
          className="mt-2 md:mt-3 text-[12px] md:text-[14px]"
          style={{ color: 'var(--muted)' }}
        >
          {profile?.email ?? user.email}
        </p>
      </section>

      {/* 회원 등급 */}
      <section className="px-5 md:px-8">
        <TierBadge
          tier={(profile as { tier?: string | null } | null)?.tier ?? 'bronze'}
          cumulativeSpend={
            (profile as { cumulative_spend?: number | null } | null)?.cumulative_spend ?? 0
          }
        />
      </section>

      {/* 환영 쿠폰 (첫 구매 전) */}
      <section className="px-5 md:px-8">
        <WelcomeCouponBanner userId={user.id} />
      </section>

      {/* 주요 카드 */}
      <section className="px-5 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {webItems.map((it) => (
            <ItemCard key={it.label} item={it} />
          ))}
        </div>
      </section>

      {/* 앱 전용 안내 — 앱에서는 이미 다 가능하니 웹에서만 노출 */}
      {!isApp && (
      <section className="px-5 md:px-8 mt-8 md:mt-12">
        <div
          className="rounded-2xl px-5 py-5 md:px-8 md:py-7"
          style={{ background: 'var(--ink)', color: 'var(--bg)' }}
        >
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <Smartphone
              className="w-4 h-4 md:w-5 md:h-5"
              strokeWidth={2}
              color="var(--gold)"
            />
            <span
              className="font-mono text-[10px] md:text-[11px] tracking-[0.22em] uppercase"
              style={{ color: 'var(--gold)' }}
            >
              App Only
            </span>
          </div>
          <h2
            className="font-serif text-[18px] md:text-[24px]"
            style={{ fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            정기배송 · 포인트 · 우리 아이 케어는 앱에서
          </h2>
          <p
            className="mt-2 md:mt-3 text-[12px] md:text-[14px] leading-relaxed"
            style={{ color: 'rgba(245,240,230,0.78)' }}
          >
            반려동물 등록, 일일 케어 분석, 정기배송 일정 관리는 모바일 앱에서
            더 빠르게 도와드려요.
          </p>
          <div className="mt-4 md:mt-5 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
            {appOnlyItems.map((it) => {
              const Icon = it.icon
              return (
                <Link
                  key={it.label}
                  href={it.href}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 transition active:scale-[0.99]"
                  style={{
                    background: 'rgba(245,240,230,0.08)',
                    color: 'var(--bg)',
                  }}
                >
                  <Icon
                    className="w-4 h-4 shrink-0"
                    strokeWidth={2}
                  />
                  <div className="min-w-0">
                    <div className="text-[13px] md:text-[14px] font-bold">
                      {it.label}
                    </div>
                    {it.description && (
                      <div
                        className="text-[10.5px] md:text-[11.5px] mt-0.5"
                        style={{ color: 'rgba(245,240,230,0.6)' }}
                      >
                        {it.description}
                      </div>
                    )}
                  </div>
                  <ChevronRight
                    className="w-3.5 h-3.5 ml-auto shrink-0"
                    strokeWidth={2}
                  />
                </Link>
              )
            })}
          </div>
        </div>
      </section>
      )}

      {/* 로그아웃 */}
      <section className="px-5 md:px-8 mt-6 md:mt-10">
        <LogoutButton />
      </section>
    </main>
    </AuthAwareShell>
  )
}

function ItemCard({ item }: { item: SectionItem }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className="group flex items-center gap-4 rounded-2xl px-5 py-4 md:px-6 md:py-5 transition active:scale-[0.99]"
      style={{
        background: 'var(--bg-2)',
        boxShadow: 'inset 0 0 0 1px var(--rule)',
      }}
    >
      <span
        className="inline-flex w-10 h-10 md:w-12 md:h-12 rounded-full items-center justify-center shrink-0"
        style={{ background: 'var(--bg)' }}
      >
        <Icon
          className="w-4 h-4 md:w-[18px] md:h-[18px]"
          strokeWidth={2}
        />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div
            className="font-serif text-[14px] md:text-[16px]"
            style={{
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            {item.label}
          </div>
          {item.badge && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
              style={{
                background: 'var(--terracotta)',
                color: 'var(--bg)',
              }}
            >
              {item.badge}
            </span>
          )}
        </div>
        {item.description && (
          <div
            className="mt-0.5 text-[11.5px] md:text-[13px]"
            style={{ color: 'var(--muted)' }}
          >
            {item.description}
          </div>
        )}
      </div>
      <ChevronRight
        className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
        strokeWidth={2}
        style={{ color: 'var(--muted)' }}
      />
    </Link>
  )
}
