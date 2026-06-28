import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ChevronRight,
  Package,
  Repeat,
  Dog,
  Gift,
  Activity,
  Smartphone,
  UserCog,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import LogoutButton from '@/components/account/LogoutButton'
import TierBadge from '@/components/account/TierBadge'
import { isAppContextServer } from '@/lib/app-context'
import { Container, Display, Eyebrow } from '@/components/web/fd/ui'

/**
 * /account — 웹 사용자용 마이페이지 hub.
 *
 * (main)/mypage 는 AppChrome 로 감싸진 모바일 전용 hub. 웹 사용자도 자기 정보
 * 일부는 봐야 하니 별도 hub.
 *
 * # 정보 위계 (2026-06-27 개편, 사장님)
 *   - 메인 카드: 주문 내역 · 정기배송 관리(/account/subscriptions) ·
 *     우리 아이(/account/dogs) · 내 프로필 — 웹 구독결제가 되므로 구독/강아지도
 *     웹에서 직접.
 *   - 얕은 링크(박스 X, 비중↓): 고객센터 · 자주 묻는 질문 · 환불 정책 —
 *     중요도 낮은 정보라 카드로 안 키우고 텍스트 링크로.
 *   - 뉴스레터 구독은 hub 에서 제외(사장님).
 *   - 앱 전용 CTA: 적립금 · 일일 케어/분석 (정기배송은 이제 웹에서 가능 →
 *     앱 카드에서 빠짐).
 *
 * 디자인: FD 랜딩과 동일 프리미티브(Container/Display/Eyebrow)·리듬·타이포.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차151).
  title: '내 계정',
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

  // 카드 표시용 카운트 — 주문(전체/미수령) · 활성 구독 · 강아지
  const [
    { count: totalOrders },
    { count: pendingOrders },
    { count: activeSubs },
    { count: dogCount },
  ] = await Promise.all([
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
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active'),
    supabase
      .from('dogs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, email, tier, cumulative_spend')
    .eq('id', user.id)
    .maybeSingle()

  // 메인 카드 — 웹에서 직접 하는 핵심 동선
  const primaryItems: SectionItem[] = [
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
      href: '/account/subscriptions',
      icon: Repeat,
      label: '정기배송 관리',
      description: activeSubs
        ? `구독 중 ${activeSubs}건 · 주기·해지`
        : '주기 변경 · 일시정지 · 해지',
      badge: activeSubs ? String(activeSubs) : undefined,
    },
    {
      href: '/account/dogs',
      icon: Dog,
      label: '우리 아이',
      description: dogCount ? `${dogCount}마리` : '등록한 반려견',
      badge: dogCount ? String(dogCount) : undefined,
    },
    {
      href: '/account/profile',
      icon: UserCog,
      label: '내 프로필',
      description: '이름·연락처',
    },
  ]

  // 비중↓ — 박스 대신 얕은 텍스트 링크 (중요도 낮은 정보)
  const helpLinks: { href: string; label: string }[] = [
    { href: '/business', label: '고객센터' },
    { href: '/faq', label: '자주 묻는 질문' },
    { href: '/legal/refund', label: '환불 정책' },
  ]

  const appOnlyItems: SectionItem[] = [
    {
      href: '/app-required',
      icon: Gift,
      label: '적립금',
      description: '적립금 사용 · 적립 내역',
    },
    {
      href: '/app-required',
      icon: Activity,
      label: '일일 케어 · 분석',
      description: '기록 · 산책 · 영양 분석',
    },
  ]

  const displayName = profile?.name ?? user.email?.split('@')[0] ?? '회원'

  return (
    <AuthAwareShell>
      <main
        className="pb-16 md:pb-24"
        style={{ background: 'var(--fd-offwhite)', minHeight: '72vh' }}
      >
        <Container size="lg" className="pt-4 md:pt-6">
          {/* breadcrumb */}
          <nav
            aria-label="현재 위치"
            className="flex items-center gap-1 text-[11px] md:text-[12px]"
            style={{ color: 'var(--fd-muted)' }}
          >
            <Link href="/" className="hover:opacity-70 transition">
              홈
            </Link>
            <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
            <span style={{ color: 'var(--fd-pine)', fontWeight: 700 }}>내 계정</span>
          </nav>

          {/* Hero — FD Display 헤드라인 */}
          <header className="pt-8 md:pt-14 pb-8 md:pb-12">
            <Eyebrow>My Account</Eyebrow>
            <Display as="h1" size="md" className="mt-3 md:mt-4" style={{ color: 'var(--fd-pine)' }}>
              {displayName} 님,
              <br />
              <span style={{ color: 'var(--fd-coral-text)' }}>오늘도 좋은 한 끼.</span>
            </Display>
            <p
              className="mt-4 text-[12.5px] md:text-[14px]"
              style={{ color: 'var(--fd-muted)' }}
            >
              {profile?.email ?? user.email}
            </p>
          </header>

          {/* 회원 등급 */}
          <div className="mb-7 md:mb-9">
            <TierBadge
              tier={(profile as { tier?: string | null } | null)?.tier ?? 'seed'}
              cumulativeSpend={
                (profile as { cumulative_spend?: number | null } | null)?.cumulative_spend ?? 0
              }
            />
          </div>

          {/* 바로가기 카드 */}
          <Eyebrow className="block mb-3 md:mb-4">바로가기</Eyebrow>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-3.5">
            {primaryItems.map((it) => (
              <ItemCard key={it.label} item={it} />
            ))}
          </div>

          {/* 앱 전용 안내 — 앱에서는 이미 다 가능하니 웹에서만 노출 */}
          {!isApp && (
            <div
              className="mt-10 md:mt-16 rounded-[14px] overflow-hidden"
              style={{ background: 'var(--fd-pine)', color: '#FFFFFF' }}
            >
              <div className="px-6 py-7 md:px-10 md:py-10">
                <div className="flex items-center gap-2 mb-3">
                  <Smartphone
                    className="w-4 h-4 md:w-[18px] md:h-[18px]"
                    strokeWidth={2}
                    color="var(--fd-green-soft)"
                  />
                  <Eyebrow color="var(--fd-green-soft)">App Only</Eyebrow>
                </div>
                <Display as="h2" size="sm" style={{ color: '#FFFFFF' }}>
                  적립금 · 일일 케어는 앱에서
                </Display>
                <p
                  className="mt-3.5 text-[13px] md:text-[15px] leading-relaxed"
                  style={{ color: 'rgba(245,240,230,0.8)', maxWidth: 580 }}
                >
                  적립금 사용, 일일 케어 기록, 산책·영양 분석은 모바일 앱에서
                  더 빠르게 도와드려요.
                </p>
                <div className="mt-5 md:mt-6 grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-3">
                  {appOnlyItems.map((it) => {
                    const Icon = it.icon
                    return (
                      <Link
                        key={it.label}
                        href={it.href}
                        className="flex items-center gap-3 rounded-[10px] px-4 py-3.5 transition hover:brightness-110 active:scale-[0.99]"
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          color: '#FFFFFF',
                        }}
                      >
                        <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
                        <div className="min-w-0 flex-1">
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
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 도움말 — 비중↓ 얕은 텍스트 링크 (박스 X) */}
          <div className="mt-10 md:mt-14">
            <Eyebrow className="block mb-1.5">도움말</Eyebrow>
            <div>
              {helpLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center justify-between py-3 transition hover:opacity-70"
                  style={{ borderBottom: '1px solid var(--fd-line)' }}
                >
                  <span className="text-[13px]" style={{ color: 'var(--fd-muted)' }}>
                    {l.label}
                  </span>
                  <ChevronRight
                    className="w-3.5 h-3.5"
                    strokeWidth={2}
                    style={{ color: 'var(--fd-muted)' }}
                  />
                </Link>
              ))}
            </div>
          </div>

          {/* 로그아웃 */}
          <div className="mt-8 md:mt-12">
            <LogoutButton />
          </div>
        </Container>
      </main>
    </AuthAwareShell>
  )
}

function ItemCard({ item }: { item: SectionItem }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className="group flex items-center gap-4 rounded-[12px] px-5 py-4 md:px-6 md:py-5 transition hover:-translate-y-[1px] active:scale-[0.99]"
      style={{
        background: '#FFFFFF',
        boxShadow: 'inset 0 0 0 1px var(--fd-line)',
      }}
    >
      <span
        className="inline-flex w-11 h-11 md:w-12 md:h-12 rounded-full items-center justify-center shrink-0"
        style={{ background: 'var(--fd-cream)' }}
      >
        <Icon
          className="w-[18px] h-[18px]"
          strokeWidth={2}
        />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div
            className="text-[14.5px] md:text-[16px]"
            style={{
              fontWeight: 800,
              color: 'var(--fd-pine)',
              letterSpacing: '-0.015em',
            }}
          >
            {item.label}
          </div>
          {item.badge && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                background: 'var(--fd-coral)',
                color: '#FFFFFF',
                fontWeight: 700,
              }}
            >
              {item.badge}
            </span>
          )}
        </div>
        {item.description && (
          <div
            className="mt-0.5 text-[11.5px] md:text-[13px]"
            style={{ color: 'var(--fd-muted)' }}
          >
            {item.description}
          </div>
        )}
      </div>
      <ChevronRight
        className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
        strokeWidth={2}
        style={{ color: 'var(--fd-muted)' }}
      />
    </Link>
  )
}
