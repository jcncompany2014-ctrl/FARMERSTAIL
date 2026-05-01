'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Search,
  ShoppingCart,
  User,
  Menu,
  X,
  ArrowRight,
  Truck,
  Soup,
  Cookie,
  PackageOpen,
  BookOpen,
  Sparkles,
  Flame,
  Tag,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import SiteFooter from '@/components/SiteFooter'
import MiniCartToast from '@/components/products/MiniCartToast'
import { WishlistProvider } from '@/components/products/WishlistContext'

/**
 * WebChrome — Web (브라우저) 사용자용 풀와이드 모바일 쇼핑몰 chrome.
 *
 * 마켓컬리 / 무신사 / SSF 같은 한국 D2C 쇼핑몰 톤. 데스크톱 max-w-screen-2xl
 * 풀와이드 레이아웃, 모바일은 햄버거 헤더로 자연스럽게 반응형.
 *
 * # 구조 (3-tier 헤더)
 *
 *  ┌─ 데스크톱 (≥md) ─────────────────────────────────────────────────────┐
 *  │ Tier 1 (얇은 promo bar) — 무료배송 / 신규 혜택                          │
 *  │ ─────────────────────────────────────────────────────────────────── │
 *  │ Tier 2 (큰 헤더)  [LOGO]   [큰 검색 input]    [내정보] [카트] [앱받기] │
 *  │ ─────────────────────────────────────────────────────────────────── │
 *  │ Tier 3 (카테고리 nav)   화식 · 간식 · 체험팩 · 매거진 · 이벤트         │
 *  └─────────────────────────────────────────────────────────────────────┘
 *
 *  ┌─ 모바일 (<md) ─┐
 *  │ ☰  LOGO  🛒  │   ← 햄버거 + 가운데 로고 + 카트
 *  │ ────────────  │
 *  │ 화식 간식 ...  │   ← 가로 스크롤 chip nav
 *  └────────────────┘
 *
 * # 비교 — AppChrome
 *
 * AppChrome 은 phone-frame 으로 데스크톱에서도 좁은 모바일 카드. WebChrome 은
 * 풀와이드 — 두 chrome 이 완전 다른 시각 언어를 갖도록 한 게 분리 모델 핵심.
 */

/**
 * 카테고리 모델 — 데스크톱 nav / 모바일 chip nav / drawer 모두 한 소스에서.
 *
 * 마켓컬리/SSF/무신사 톤으로 "판매 동선" 중심 재구성:
 *   1) 베스트  — 사회적 증거 (가장 잘 팔리는 것)
 *   2) 신상   — 신선도 (이번 주 새로 들어온 것)
 *   3) 화식 / 간식 / 체험팩 — 제품 카테고리
 *   4) 세일   — 가격 인센티브 (할인 전용 모음)
 *   5) 이벤트 — 시간 제한 혜택
 *
 * 매거진은 footer / drawer 만으로 회수 — top nav 는 commerce 동선 전용.
 *
 * kind:
 *   - "shop"  : 제품 카탈로그
 *   - "feat"  : 큐레이션 모음 (베스트/신상)
 *   - "deal"  : 가격/할인 — 세일 (sale red dot)
 *   - "promo" : 이벤트 — 시간 제한 (terracotta+gold dot)
 */
type CategoryKind = 'shop' | 'feat' | 'deal' | 'promo'
type Category = {
  href: string
  label: string
  en: string
  kind: CategoryKind
  icon: LucideIcon
}

const CATEGORIES: readonly Category[] = [
  {
    href: '/products?sort=best',
    label: '베스트',
    en: 'Best',
    kind: 'feat',
    icon: Flame,
  },
  {
    href: '/products?sort=new',
    label: '신상',
    en: 'New',
    kind: 'feat',
    icon: Zap,
  },
  {
    href: '/products?category=화식',
    label: '화식',
    en: 'Meals',
    kind: 'shop',
    icon: Soup,
  },
  {
    href: '/products?category=간식',
    label: '간식',
    en: 'Snacks',
    kind: 'shop',
    icon: Cookie,
  },
  {
    href: '/products?category=체험팩',
    label: '체험팩',
    en: 'Trial',
    kind: 'shop',
    icon: PackageOpen,
  },
  {
    href: '/products?on_sale=1',
    label: '세일',
    en: 'Sale',
    kind: 'deal',
    icon: Tag,
  },
  {
    href: '/events',
    label: '이벤트',
    en: 'Events',
    kind: 'promo',
    icon: Sparkles,
  },
] as const

/** 메인 nav 외 보조 진입로 — drawer 하단에 별도 그룹으로 노출. */
const SECONDARY_LINKS: readonly { href: string; label: string; en: string; icon: LucideIcon }[] = [
  { href: '/blog', label: '매거진', en: 'Magazine', icon: BookOpen },
] as const

export default function WebChrome({
  children,
  cartCount: cartCountProp,
}: {
  children: React.ReactNode
  /** 서버에서 prefetch 한 초기 카트 수량 (선택). 마운트 후 client refetch 가
      이 값을 덮어쓴다. */
  cartCount?: number
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [cartCount, setCartCount] = useState(cartCountProp ?? 0)
  // 헤더의 마이페이지/로그인 아이콘 분기용. null = 미확인 (서버 렌더 직후), false = 비로그인, true = 로그인
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null)
  const pathname = usePathname()
  const supabase = createClient()

  // Cart count — pathname change 또는 ft:cart:add 이벤트 시 refetch.
  // getSession() 사용 — getUser() 는 매번 JWT 검증 위해 Supabase 로 RTT 발생.
  // 여기선 "로그인 됐나" UI 신호만 필요해 cookie 로컬 read 로 충분 (50~200ms 절약).
  // 카트 데이터 자체는 RLS 가 user_id 검증하므로 spoof 우려 없음.
  useEffect(() => {
    let mounted = true
    async function fetchCount() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!mounted) return
      const user = session?.user ?? null
      setIsAuthed(!!user)
      if (!user) {
        setCartCount(0)
        return
      }
      const { data } = await supabase
        .from('cart_items')
        .select('quantity')
        .eq('user_id', user.id)
      if (!mounted) return
      const total = ((data ?? []) as { quantity: number }[]).reduce(
        (s: number, it) => s + it.quantity,
        0,
      )
      setCartCount(total)
    }
    fetchCount()
    const onCartAdd = () => fetchCount()
    window.addEventListener('ft:cart:add', onCartAdd)
    return () => {
      mounted = false
      window.removeEventListener('ft:cart:add', onCartAdd)
    }
  }, [supabase, pathname])

  return (
    <WishlistProvider>
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* ── Tier 1 (데스크톱만) — 얇은 promo bar ───────────────────────── */}
      <div
        className="hidden md:block border-b"
        style={{
          background: 'var(--ink)',
          color: 'var(--bg)',
          borderColor: 'var(--ink)',
        }}
      >
        <div className="max-w-[1280px] mx-auto px-6 h-9 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5" style={{ letterSpacing: '-0.005em' }}>
            <Truck className="w-3.5 h-3.5" strokeWidth={2} />
            <span>30,000원 이상 무료배송 · 신규 가입 첫 주문 10% 할인</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/legal/privacy"
              className="hover:underline transition"
              style={{ color: 'var(--bg)', opacity: 0.85 }}
            >
              개인정보처리방침
            </Link>
            <Link
              href="/business"
              className="hover:underline transition"
              style={{ color: 'var(--bg)', opacity: 0.85 }}
            >
              사업자정보
            </Link>
          </div>
        </div>
      </div>

      {/* ── Tier 2 — 메인 헤더 ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{
          background: 'rgba(245,240,230,0.96)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderColor: 'var(--rule)',
        }}
      >
        {/* 데스크톱 메인 헤더 */}
        <div className="hidden md:block">
          <div className="max-w-[1280px] mx-auto px-6 h-20 flex items-center gap-8">
            {/* 로고 — 데스크톱에선 더 크고 prominent */}
            <Link href="/" className="flex items-center shrink-0" aria-label="홈">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Farmer's Tail"
                className="h-12 w-auto"
                style={{ filter: 'brightness(0)' }}
              />
            </Link>

            {/* 큰 검색 input — 가운데 차지 */}
            <div className="flex-1 max-w-2xl">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                size="lg"
              />
            </div>

            {/* 우측 액션 */}
            <div className="flex items-center gap-1 shrink-0">
              <Link
                href="/account"
                aria-label="내 계정"
                className="flex flex-col items-center justify-center w-14 h-14 rounded-lg hover:bg-white transition"
              >
                <User
                  className="w-5 h-5"
                  style={{ color: 'var(--ink)' }}
                  strokeWidth={1.75}
                />
                <span
                  className="mt-0.5"
                  style={{ fontSize: 10, color: 'var(--ink)', fontWeight: 600 }}
                >
                  내 계정
                </span>
              </Link>
              <Link
                href="/cart"
                aria-label="장바구니"
                className="relative flex flex-col items-center justify-center w-14 h-14 rounded-lg hover:bg-white transition"
              >
                <ShoppingCart
                  className="w-5 h-5"
                  style={{ color: 'var(--ink)' }}
                  strokeWidth={1.75}
                />
                <span
                  className="mt-0.5"
                  style={{ fontSize: 10, color: 'var(--ink)', fontWeight: 600 }}
                >
                  장바구니
                </span>
                {cartCount > 0 && (
                  <span
                    className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                    style={{ background: 'var(--terracotta)' }}
                  >
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>
              <Link
                href="/app-required"
                className="ml-3 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[12px] font-bold transition active:scale-[0.98]"
                style={{
                  background: 'var(--ink)',
                  color: 'var(--bg)',
                  letterSpacing: '-0.01em',
                }}
              >
                앱 받기
                <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Tier 3 (데스크톱) — 카테고리 nav ────────────────────────── */}
        <div className="hidden md:block border-t" style={{ borderColor: 'var(--rule)' }}>
          <div className="max-w-[1280px] mx-auto px-6">
            <nav
              className="flex items-center h-12 gap-1"
              aria-label="카테고리"
            >
              {CATEGORIES.map((c) => {
                const isDeal = c.kind === 'deal'
                const isPromo = c.kind === 'promo'
                const isFeat = c.kind === 'feat'

                let dotColor: string | null = null
                let dotRing: string | null = null
                let labelColor = 'var(--ink)'
                if (isDeal) {
                  dotColor = 'var(--sale)'
                  labelColor = 'var(--sale)'
                } else if (isPromo) {
                  dotColor = 'var(--terracotta)'
                  dotRing =
                    '0 0 0 3px color-mix(in srgb, var(--terracotta) 18%, transparent)'
                  labelColor = 'var(--terracotta)'
                } else if (isFeat) {
                  dotColor = 'var(--ink)'
                }

                return (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="relative px-4 h-full flex items-center gap-2 text-[13.5px] font-bold transition group"
                    style={{ color: labelColor, letterSpacing: '-0.01em' }}
                  >
                    {dotColor && (
                      <span
                        aria-hidden
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: dotColor,
                          ...(dotRing ? { boxShadow: dotRing } : null),
                        }}
                      />
                    )}
                    <span className="group-hover:text-terracotta transition">
                      {c.label}
                    </span>
                    <span
                      className="absolute bottom-0 left-2 right-2 h-0.5 opacity-0 group-hover:opacity-100 transition"
                      style={{ background: 'var(--terracotta)' }}
                    />
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>

        {/* ── 모바일 헤더 ─────────────────────────────────────────────── */}
        <div className="md:hidden">
          {/*
            로고 정렬 메모:
            햄버거(좌)와 카트(우) 위젯이 비슷한 폭(40px)이지만 카트는 cartCount 뱃지로
            optical 무게가 살짝 다르다. justify-between 으로 잡으면 카트 폭에 따라
            로고가 미세하게 좌우로 흔들린다. 그래서 로고는 절대 center 로 박아두고
            햄버거/카트는 양 끝에 absolute 로 배치 — 어떤 상태에서도 로고가 정확히
            화면 중앙에 떨어지도록.
          */}
          <div className="relative h-16 flex items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="메뉴 열기"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center"
            >
              <Menu
                className="w-[22px] h-[22px]"
                style={{ color: 'var(--ink)' }}
                strokeWidth={2}
              />
            </button>

            <Link
              href="/"
              className="absolute left-1/2 -translate-x-1/2 flex items-center"
              aria-label="홈"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Farmer's Tail"
                className="h-11 w-auto block"
                style={{ filter: 'brightness(0)' }}
              />
            </Link>

            {/* 우측 액션 그룹: 마이페이지/로그인 + 장바구니. 카트 아이콘 폭에
                관계없이 로고 중앙 정렬 유지하려고 absolute right 로 묶음. */}
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
              <Link
                href={isAuthed ? '/account' : '/login?next=/account'}
                aria-label={isAuthed ? '내 계정' : '로그인'}
                className="w-10 h-10 flex items-center justify-center"
              >
                <User
                  className="w-[20px] h-[20px]"
                  style={{ color: 'var(--ink)' }}
                  strokeWidth={1.75}
                />
              </Link>
              <Link
                href="/cart"
                aria-label="장바구니"
                className="relative w-10 h-10 flex items-center justify-center"
              >
                <ShoppingCart
                  className="w-[22px] h-[22px]"
                  style={{ color: 'var(--ink)' }}
                  strokeWidth={1.75}
                />
                {cartCount > 0 && (
                  <span
                    className="absolute top-1 right-0 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                    style={{ background: 'var(--terracotta)' }}
                  >
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* 모바일 검색바 */}
          <div className="px-4 pb-3">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              size="md"
            />
          </div>

          {/*
            모바일 카테고리 nav — 마켓컬리/무신사 톤의 flat tab.
            기존 둥근 pill chip 은 "원형 느낌" 으로 둥둥 떠 있었다. 쇼핑몰 헤더는
            지면 (헤더 base line) 에 붙어 흐름이 빠르게 읽혀야 함 → tab style 로 전환:
              • 카드/배경 없음 — 텍스트만, 충분한 hit area (px-3 py-3 = 44px+ 행 높이)
              • 활성 (URL 매칭) 은 굵은 하단 underline (terracotta)
              • 시각 신호는 텍스트 색 + 하단 dot (deal=sale red, promo=terracotta)
              • 가로 scroll snap 으로 7개가 한 화면에서 자연스럽게 흐름
            결과: 시각 무게 1/3 로 줄고 "쇼핑몰 헤더" 톤으로 통일.
          */}
          <div
            className="relative border-t"
            style={{ borderColor: 'var(--rule)' }}
          >
            {/* 우측 가로 스크롤 fade — 더 있다는 시각 hint */}
            <div
              aria-hidden
              className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10"
              style={{
                background:
                  'linear-gradient(to right, transparent, var(--bg) 70%)',
              }}
            />
          <nav
            className="overflow-x-auto scrollbar-hide"
            aria-label="카테고리"
          >
            <div className="flex items-stretch px-1 pr-7 whitespace-nowrap">
              {CATEGORIES.map((c) => {
                const isDeal = c.kind === 'deal'
                const isPromo = c.kind === 'promo'

                // 색 분기 — chip 배경 제거, 텍스트 색 + 보조 dot 으로만 의도 전달.
                //   deal (세일)  : sale red 텍스트 + 빨간 점
                //   promo (이벤트): terracotta 텍스트 + terracotta 점
                //   feat / shop : ink 텍스트, dot 없음
                const labelColor = isDeal
                  ? 'var(--sale)'
                  : isPromo
                    ? 'var(--terracotta)'
                    : 'var(--ink)'
                const showDot = isDeal || isPromo
                const dotColor = isDeal ? 'var(--sale)' : 'var(--terracotta)'

                return (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="relative inline-flex items-center gap-1 px-3.5 py-3 text-[13px] font-bold transition active:opacity-70"
                    style={{
                      color: labelColor,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {c.label}
                    {showDot && (
                      <span
                        aria-hidden
                        className="w-1 h-1 rounded-full -mt-2"
                        style={{ background: dotColor }}
                      />
                    )}
                  </Link>
                )
              })}
            </div>
          </nav>
          </div>
        </div>
      </header>

      {/* 모바일 메뉴 drawer */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="메뉴"
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(46,31,20,0.5)' }}
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            className="relative w-[300px] h-full overflow-y-auto"
            style={{ background: 'var(--bg)' }}
          >
            <div className="flex items-center justify-between px-5 h-14 border-b" style={{ borderColor: 'var(--rule)' }}>
              <span
                className="font-serif"
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-0.02em',
                }}
              >
                메뉴
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="메뉴 닫기"
                className="w-9 h-9 -mr-2 flex items-center justify-center"
              >
                <X className="w-4 h-4" style={{ color: 'var(--muted)' }} strokeWidth={2.25} />
              </button>
            </div>

            {/*
              Drawer 카테고리 — 원형 아이콘 칩 제거. 마켓컬리/SSF 톤의 flat list 로 전환.
              아이콘 박스 대신 행 좌측에 색 dot (4px) 만 두고, 라벨 = serif 14.5,
              우측 EN = mono 9 (caps). promo/deal 만 dot 색으로 차별.
            */}
            <nav className="py-1" aria-label="카테고리">
              {CATEGORIES.map((c) => {
                const isDeal = c.kind === 'deal'
                const isPromo = c.kind === 'promo'
                const labelColor = isDeal
                  ? 'var(--sale)'
                  : isPromo
                    ? 'var(--terracotta)'
                    : 'var(--ink)'
                const dotColor = isDeal
                  ? 'var(--sale)'
                  : isPromo
                    ? 'var(--terracotta)'
                    : 'transparent'

                return (
                  <Link
                    key={c.href}
                    href={c.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 py-3 px-5 transition active:bg-bg-2"
                    style={{
                      borderBottom: '1px solid var(--rule)',
                    }}
                  >
                    <span
                      aria-hidden
                      className="w-1 h-1 rounded-full shrink-0"
                      style={{ background: dotColor }}
                    />
                    <span
                      className="flex-1 min-w-0 font-serif text-[14.5px]"
                      style={{
                        fontWeight: 700,
                        letterSpacing: '-0.015em',
                        color: labelColor,
                      }}
                    >
                      {c.label}
                    </span>
                    <span
                      className="font-mono shrink-0 text-[9px]"
                      style={{
                        letterSpacing: '0.2em',
                        color: 'var(--muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {c.en}
                    </span>
                  </Link>
                )
              })}

              {/* 보조 진입 — 매거진 / 추후 콘텐츠 채널 */}
              {SECONDARY_LINKS.length > 0 && (
                <div className="pt-2">
                  {SECONDARY_LINKS.map((s) => (
                    <Link
                      key={s.href}
                      href={s.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 py-3 px-5 transition active:bg-bg-2"
                      style={{
                        color: 'var(--muted)',
                        borderBottom: '1px solid var(--rule)',
                      }}
                    >
                      <span
                        aria-hidden
                        className="w-1 h-1 rounded-full shrink-0"
                        style={{ background: 'transparent' }}
                      />
                      <span
                        className="flex-1 min-w-0 font-serif text-[14px]"
                        style={{
                          fontWeight: 600,
                          letterSpacing: '-0.015em',
                        }}
                      >
                        {s.label}
                      </span>
                      <span
                        className="font-mono shrink-0 text-[9px]"
                        style={{
                          letterSpacing: '0.2em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {s.en}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {/* 계정 / 주문 — 카테고리와 같은 flat row 언어 */}
              <div className="pt-2">
                <Link
                  href="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 py-3 px-5 transition active:bg-bg-2"
                  style={{
                    borderBottom: '1px solid var(--rule)',
                    color: 'var(--text)',
                  }}
                >
                  <span aria-hidden className="w-1 h-1 shrink-0" />
                  <span
                    className="flex-1 min-w-0 font-serif text-[14px]"
                    style={{ fontWeight: 600, letterSpacing: '-0.015em' }}
                  >
                    내 계정
                  </span>
                  <span
                    className="font-mono shrink-0 text-[9px]"
                    style={{
                      letterSpacing: '0.2em',
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Orders
                  </span>
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 py-3 px-5 transition active:bg-bg-2"
                  style={{
                    borderBottom: '1px solid var(--rule)',
                    color: 'var(--text)',
                  }}
                >
                  <span aria-hidden className="w-1 h-1 shrink-0" />
                  <span
                    className="flex-1 min-w-0 font-serif text-[14px]"
                    style={{ fontWeight: 600, letterSpacing: '-0.015em' }}
                  >
                    로그인 / 회원가입
                  </span>
                  <span
                    className="font-mono shrink-0 text-[9px]"
                    style={{
                      letterSpacing: '0.2em',
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Sign In
                  </span>
                </Link>
              </div>

              {/* 앱 받기 — drawer 하단 sticky 느낌으로 강조 CTA. 둥근 pill 유지
                  (이건 카테고리가 아니라 conversion CTA 라 의도적으로 다른 도형). */}
              <div className="px-5 mt-5">
                <Link
                  href="/app-required"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 py-3.5 rounded-full text-[14px] font-bold"
                  style={{
                    background: 'var(--ink)',
                    color: 'var(--bg)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  앱 받기
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* 본문 */}
      <main className="flex-1">{children}</main>

      {/* 푸터 — 사업자 정보 + 고객 문의 */}
      <SiteFooter />

      {/* 전역 미니 카트 토스트 — `ft:cart:add` 이벤트 listen */}
      <MiniCartToast />
    </div>
    </WishlistProvider>
  )
}

function SearchInput({
  value,
  onChange,
  size = 'md',
  className,
}: {
  value: string
  onChange: (v: string) => void
  size?: 'md' | 'lg'
  className?: string
}) {
  const heights = { md: 'h-10', lg: 'h-12' }
  const iconSize = { md: 'w-4 h-4', lg: 'w-[18px] h-[18px]' }
  const padding = { md: 'pl-10 pr-4', lg: 'pl-12 pr-5' }
  const fontSize = { md: 14, lg: 15 }

  return (
    <form
      role="search"
      action="/products"
      method="get"
      className={`relative flex items-center w-full ${className ?? ''}`}
    >
      <Search
        className={`absolute pointer-events-none ${iconSize[size]}`}
        style={{
          color: 'var(--muted)',
          left: size === 'lg' ? 16 : 14,
        }}
        strokeWidth={2}
      />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="상품명, 카테고리로 검색"
        aria-label="제품 검색"
        autoComplete="off"
        inputMode="search"
        className={`w-full ${heights[size]} ${padding[size]} rounded-full focus:outline-none transition`}
        style={{
          background: 'var(--bg-2)',
          color: 'var(--ink)',
          border: '1.5px solid transparent',
          fontSize: fontSize[size],
          fontWeight: 500,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--ink)'
          e.currentTarget.style.background = 'white'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'transparent'
          e.currentTarget.style.background = 'var(--bg-2)'
        }}
      />
    </form>
  )
}
