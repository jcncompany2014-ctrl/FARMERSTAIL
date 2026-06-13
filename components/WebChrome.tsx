'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  ShoppingCart,
  User,
  Menu,
  X,
  ArrowRight,
  Truck,
  Soup,
  Sprout,
  BookOpen,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react'
import SiteFooter from '@/components/SiteFooter'
import MiniCartToast from '@/components/products/MiniCartToast'
import { WishlistProvider } from '@/components/products/WishlistContext'

/**
 * WebChrome — Web (브라우저) 사용자용 chrome. Phase Q (2026-06-12) 피벗:
 * 쇼핑몰 헤더(검색/카테고리/세일) → 설문 퍼널 사이트 헤더 (더파머스독 뼈대).
 *
 * # 구조
 *
 *  ┌─ 데스크톱 (≥md) ─────────────────────────────────────────────────────┐
 *  │ Tier 1 (얇은 promo bar) — 무료배송 / 체험팩부터                        │
 *  │ ─────────────────────────────────────────────────────────────────── │
 *  │ Tier 2  [LOGO]  우리 밥 · 이야기 · 매거진 · FAQ   [내정보][카트][플랜 CTA] │
 *  └─────────────────────────────────────────────────────────────────────┘
 *
 *  ┌─ 모바일 (<md) ─┐
 *  │ ☰  LOGO  👤🛒 │   ← 햄버거 + 가운데 로고 + 계정/카트
 *  │ ────────────  │
 *  │ 우리 밥 이야기… │   ← 가로 스크롤 tab nav
 *  └────────────────┘
 *
 * 구매 동선은 nav 가 아니라 단일 CTA("우리 아이 플랜 보기")로만 — 카트 아이콘은
 * 기존 주문/체험팩 결제 흐름이 살아 있는 동안 유지.
 *
 * # 비교 — AppChrome
 *
 * AppChrome 은 phone-frame 으로 데스크톱에서도 좁은 모바일 카드. WebChrome 은
 * 풀와이드 — 두 chrome 이 완전 다른 시각 언어를 갖도록 한 게 분리 모델 핵심.
 */

/**
 * 내비 모델 — 데스크톱 nav / 모바일 chip nav / drawer 모두 한 소스에서.
 *
 * Phase Q (2026-06-12) 피벗: 커머스 카테고리(베스트/신상/세일/이벤트…) 폐기.
 * 더파머스독 뼈대 — 페이지마다 "신뢰의 다른 조각"을 담당하는 최소 메뉴:
 *   1) 우리 밥        — 식단 철학 + 공개 가격 (토스 심사 안전핀)
 *   2) 브랜드 이야기   — 농장·창업 스토리
 *   3) 매거진         — 콘텐츠/블로그
 *   4) 자주 묻는 질문  — FAQ
 * 구매 동선은 nav 가 아니라 단일 CTA("우리 아이 플랜 보기" → 설문)로만.
 *
 * kind 는 색 분기 호환용으로 유지 (현재 전부 'shop' = ink 텍스트, dot 없음).
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
    href: '/products',
    label: '우리 밥',
    en: 'Our Food',
    kind: 'shop',
    icon: Soup,
  },
  {
    href: '/about',
    label: '브랜드 이야기',
    en: 'Story',
    kind: 'shop',
    icon: Sprout,
  },
  {
    href: '/blog',
    label: '매거진',
    en: 'Magazine',
    kind: 'shop',
    icon: BookOpen,
  },
  {
    href: '/faq',
    label: '자주 묻는 질문',
    en: 'FAQ',
    kind: 'shop',
    icon: HelpCircle,
  },
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
    void fetchCount()
    const onCartAdd = () => void fetchCount()
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
            <span>30,000원 이상 무료배송 · 구독 강요 없음, 체험팩부터</span>
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
          // Q7 색 블로킹: 헤더는 페이지 종이색과 분리된 "흰 띠" — 본문과
          // 한 끗 차이라 구분이 안 가던 문제 해결 (사장님 지적).
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderColor: 'var(--rule-2)',
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
                fetchPriority="high"
                style={{ filter: 'var(--logo-filter, brightness(0))' }}
              />
            </Link>

            {/* 메인 nav — 검색창 자리 (Phase Q: 커머스 검색 폐기, 최소 메뉴) */}
            <nav
              className="flex-1 flex items-center gap-1"
              aria-label="메뉴"
            >
              {CATEGORIES.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="relative px-4 h-20 flex items-center text-[14px] font-bold transition group"
                  style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}
                >
                  <span className="group-hover:text-terracotta transition">
                    {c.label}
                  </span>
                  <span
                    className="absolute bottom-0 left-2 right-2 h-0.5 opacity-0 group-hover:opacity-100 transition"
                    style={{ background: 'var(--terracotta)' }}
                  />
                </Link>
              ))}
            </nav>

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
                href={isAuthed ? '/dogs/new' : '/signup'}
                className="ml-3 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[12.5px] font-bold transition active:scale-[0.98]"
                style={{
                  background: 'var(--terracotta)',
                  color: '#FFFEFA',
                  letterSpacing: '-0.01em',
                }}
              >
                우리 아이 플랜 보기
                <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
              </Link>
            </div>
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
                fetchPriority="high"
                style={{ filter: 'var(--logo-filter, brightness(0))' }}
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
                    Account
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

              {/* 설문 퍼널 CTA — drawer 하단 강조. 둥근 pill 유지
                  (카테고리가 아니라 conversion CTA 라 의도적으로 다른 도형). */}
              <div className="px-5 mt-5">
                <Link
                  href={isAuthed ? '/dogs/new' : '/signup'}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 py-3.5 rounded-full text-[14px] font-bold"
                  style={{
                    background: 'var(--terracotta)',
                    color: '#FFFEFA',
                    letterSpacing: '-0.01em',
                  }}
                >
                  우리 아이 플랜 보기
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* 본문 — children 페이지가 자체 <main> 을 가지고 있을 수 있어
         WebChrome 은 div 로만 감싸 a11y 중복 차단 (HTML 표준: 페이지당 1개
         <main>). layout.tsx 의 'skip to main' 링크(#main)가 항상 닿도록 이
         래퍼가 #main 앵커를 제공한다 — 개별 에디토리얼 페이지가 <main id>
         를 빠뜨려도 스킵 링크가 동작. (자식 <main> 은 landmark 역할만.) */}
      <div id="main" className="flex-1">{children}</div>

      {/* 푸터 — 사업자 정보 + 고객 문의 */}
      <SiteFooter />

      {/* 전역 미니 카트 토스트 — `ft:cart:add` 이벤트 listen */}
      <MiniCartToast />
    </div>
    </WishlistProvider>
  )
}

// (Phase Q) 커머스 검색 SearchInput 제거 — 퍼널 웹에는 상품 검색 동선이 없다.
