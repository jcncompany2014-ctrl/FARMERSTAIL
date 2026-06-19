'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  ShoppingCart,
  User,
  ArrowRight,
  Truck,
} from 'lucide-react'
import SiteFooter from '@/components/SiteFooter'
import FdFooter from '@/components/web/fd/FdFooter'
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
}

// FD 실제 헤더 내비 순서 복제(2026-06-13): Our Food · Reviews · About Us · FAQ ·
// Vet Professionals. "수의사 전문가"는 우리 수의영양 근거 페이지(/science)로 연결.
const CATEGORIES: readonly Category[] = [
  { href: '/our-food', label: '우리 음식', en: 'Our Food', kind: 'shop' },
  { href: '/reviews', label: '후기', en: 'Reviews', kind: 'shop' },
  { href: '/about', label: '브랜드 이야기', en: 'About', kind: 'shop' },
  { href: '/faq', label: '자주 묻는 질문', en: 'FAQ', kind: 'shop' },
  { href: '/science', label: '수의사 전문가', en: 'Vet Pros', kind: 'shop' },
] as const

// FD 프로모바 — 정적 단일 → 사실 메시지 회전(회차40). 가짜 숫자·할인% 없음.
const PROMO_MESSAGES = [
  '첫 주문 50% 할인 · 신선 화식 체험팩으로 시작',
  '3만원 이상 무료배송 · 구독 강요 없음, 체험팩부터',
  '수의영양 기준으로 설계한 화식 · 사람이 먹는 등급 원물',
  '언제든 해지 · 첫 회차 미개봉 시 7일 내 환불',
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
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const menuCloseRef = useRef<HTMLDivElement>(null)
  // 드로어 a11y: Escape 닫기 + 열면 닫기버튼으로 포커스 이동, 닫으면 트리거로 복귀(dialog 표준).
  useEffect(() => {
    if (!mobileMenuOpen) return
    const trigger = menuTriggerRef.current // 항상 마운트되는 헤더 버튼 — cleanup서 안전
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden' // 풀스크린 메뉴 열린 동안 본문 스크롤 잠금
    menuCloseRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      trigger?.focus()
    }
  }, [mobileMenuOpen])
  const [cartCount, setCartCount] = useState(cartCountProp ?? 0)
  // 회차11 C섹션: FD 헤더 스크롤 elevation — 상단에선 연한 배경/그림자 없음,
  // 스크롤 내리면 불투명 배경 + 그림자(AppChrome 와 동일 grammar). reduced-motion
  // 시 globals.css 전역 net 이 transition 억제, 상태 전환은 즉시 적용.
  const [scrolled, setScrolled] = useState(false)
  // condensed = 헤더 응축(scrollY>96): 모바일 가운데 로고 → 설문 pill 전환(FD 스크롤 동작).
  const [condensed, setCondensed] = useState(false)
  // FD 프로모바 — 메시지 회전 인덱스(회차40).
  const [promoIdx, setPromoIdx] = useState(0)
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

  // 헤더 스크롤 elevation (FD 동작). scrollY>4 기준, passive 리스너.
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      setScrolled(y > 4)
      // 스크롤 내리면 로고 → 설문 pill 응축.
      setCondensed(y > 96)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // FD 프로모바 메시지 회전(4.5초). 텍스트 교체라 reduced-motion 영향 없음.
  useEffect(() => {
    const id = setInterval(
      () => setPromoIdx((i) => (i + 1) % PROMO_MESSAGES.length),
      4500,
    )
    return () => clearInterval(id)
  }, [])

  // 모바일 가운데: 상단(또는 메뉴 열림)=로고, 스크롤 내리면=설문 pill. 크로스페이드.
  const showLogo = mobileMenuOpen || !condensed

  return (
    <WishlistProvider>
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--fd-offwhite)' }}>
      {/* ── Tier 1 (데스크톱만) — 얇은 promo bar ───────────────────────── */}
      <div
        className="hidden md:block border-b"
        style={{
          background: 'var(--fd-pine)',
          color: '#FFFFFF',
          borderColor: 'var(--fd-pine)',
        }}
      >
        <div className="max-w-[1280px] mx-auto px-6 h-9 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5" style={{ letterSpacing: '-0.005em' }}>
            <Truck className="w-3.5 h-3.5" strokeWidth={2} />
            {/* 비필수 자동회전 프로모 — aria-live 제거(매 회전 SR 가로채기 방지). 텍스트는 탐색 시 읽힘. */}
            <span>{PROMO_MESSAGES[promoIdx]}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/legal/privacy"
              className="hover:underline transition"
              style={{ color: 'var(--fd-offwhite)', opacity: 0.85 }}
            >
              개인정보처리방침
            </Link>
            <Link
              href="/business"
              className="hover:underline transition"
              style={{ color: 'var(--fd-offwhite)', opacity: 0.85 }}
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
          // 헤더 = 본문 종이색(--fd-offwhite #F7F5F0)보다 살짝 밝은 웜 화이트 띠.
          // FD 처럼 상단메뉴와 본문 배경에 미묘한 색차를 둠(사장님 2026-06-15).
          // 스크롤 시 더 불투명 + 그림자 + 진한 구분선(elevation), 상단에서도 옅은 하단선 유지.
          background: scrolled ? 'rgba(254, 253, 250, 0.97)' : 'rgba(254, 253, 250, 0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderColor: scrolled ? 'var(--fd-line)' : 'rgba(220, 214, 196, 0.45)',
          boxShadow: scrolled
            ? '0 6px 22px -10px rgba(22,20,15,0.28), 0 1px 1px rgba(22,20,15,0.04)'
            : 'none',
          transition: 'box-shadow 220ms ease, background 220ms ease, border-color 220ms ease',
        }}
      >
        {/* 데스크톱 메인 헤더 */}
        <div className="hidden md:block">
          <div className="max-w-[1280px] mx-auto px-6 h-20 flex items-center gap-8">
            {/* 로고 — 데스크톱에선 더 크고 prominent */}
            <Link href="/" className="flex items-center shrink-0" aria-label="홈">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-mark.png"
                alt="Farmer's Tail"
                className="h-9 w-auto"
                fetchPriority="high"
              />
            </Link>

            {/* 메인 nav — 검색창 자리 (Phase Q: 커머스 검색 폐기, 최소 메뉴) */}
            <nav
              className="flex-1 flex items-center gap-1"
              aria-label="메뉴"
            >
              {CATEGORIES.map((c) => {
                const active = pathname === c.href || pathname.startsWith(`${c.href}/`)
                return (
                <Link
                  key={c.href}
                  href={c.href}
                  aria-current={active ? 'page' : undefined}
                  className="relative px-4 h-20 flex items-center text-[14px] font-bold transition group"
                  style={{ color: 'var(--fd-pine)', letterSpacing: '-0.01em' }}
                >
                  <span className={active ? 'transition' : 'group-hover:opacity-70 transition'}>
                    {c.label}
                  </span>
                  <span
                    className={`absolute bottom-0 left-2 right-2 h-0.5 transition ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    style={{ background: 'var(--fd-coral)' }}
                  />
                </Link>
                )
              })}
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
                  style={{ color: 'var(--fd-pine)' }}
                  strokeWidth={1.75}
                />
                <span
                  className="mt-0.5"
                  style={{ fontSize: 10, color: 'var(--fd-pine)', fontWeight: 600 }}
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
                  style={{ color: 'var(--fd-pine)' }}
                  strokeWidth={1.75}
                />
                <span
                  className="mt-0.5"
                  style={{ fontSize: 10, color: 'var(--fd-pine)', fontWeight: 600 }}
                >
                  장바구니
                </span>
                {cartCount > 0 && (
                  <span
                    className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                    style={{ background: 'var(--fd-coral)' }}
                  >
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>
              <Link
                href={isAuthed ? '/dogs/new' : '/start'}
                className="ml-3 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[12.5px] font-bold transition hover:brightness-[0.94] active:scale-[0.98]"
                style={{
                  background: 'var(--fd-coral)',
                  color: '#FFFFFF',
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
            {/* 좌: 햄버거 ↔ X 모핑 토글 (순수 CSS·no deps). reduced-motion 은
                globals 전역 net 이 transition 0 으로 만들어 즉시 전환(접근성). */}
            <button
              ref={menuTriggerRef}
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center"
            >
              <span className="relative block w-[22px] h-[16px]" aria-hidden>
                <span
                  className={`absolute left-0 h-[2px] w-full rounded-full transition-all duration-300 ${mobileMenuOpen ? 'top-[7px] rotate-45' : 'top-0'}`}
                  style={{ background: 'var(--fd-pine)' }}
                />
                <span
                  className={`absolute left-0 top-[7px] h-[2px] w-full rounded-full transition-all duration-200 ${mobileMenuOpen ? 'opacity-0' : 'opacity-100'}`}
                  style={{ background: 'var(--fd-pine)' }}
                />
                <span
                  className={`absolute left-0 h-[2px] w-full rounded-full transition-all duration-300 ${mobileMenuOpen ? 'top-[7px] -rotate-45' : 'top-[14px]'}`}
                  style={{ background: 'var(--fd-pine)' }}
                />
              </span>
            </button>

            {/* 가운데: 스크롤에 따라 로고 ↔ 설문 pill 크로스페이드 (FD: 상단=로고,
                내리면=CTA pill). 메뉴 열림 중엔 항상 로고. showLogo=메뉴열림||!condensed. */}
            {/* 로고 — 상단/메뉴열림 시. 헤더 아래로 살짝 spill, z-10 으로 콘텐츠 위. */}
            <Link
              href="/"
              aria-label="홈"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden={!showLogo}
              tabIndex={showLogo ? undefined : -1}
              className="absolute left-1/2 top-1/2 z-10 flex items-center"
              style={{
                // 로고는 헤더 가운데 + 아래로 살짝 침범(spill). 스크롤 시 opacity 로
                // pill 과 크로스페이드(순수 opacity = 버벅임 없음).
                transform: 'translate(-50%, -50%)',
                opacity: showLogo ? 1 : 0,
                pointerEvents: showLogo ? 'auto' : 'none',
                transition: 'opacity 220ms ease-out',
                willChange: 'opacity',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-mark.png"
                alt="Farmer's Tail"
                className="h-8 w-auto block select-none"
                fetchPriority="high"
              />
            </Link>
            {/* CTA pill — 스크롤 내리면 로고 자리에 등장(FD 'Redeem 50% off' pill 대응).
                '첫 주문 50% 할인'=실구현 첫 박스 50% 쿠폰(Round B) 실제 프로모라 정직성 OK.
                링크=signup→설문→첫 주문에 쿠폰 적용(사장님 2026-06-15). */}
            <Link
              href={isAuthed ? '/dogs/new' : '/start'}
              aria-hidden={showLogo}
              tabIndex={showLogo ? -1 : undefined}
              className="absolute left-1/2 top-1/2 z-10 inline-flex items-center justify-center whitespace-nowrap rounded-full px-7 h-10 text-[14px] font-extrabold no-underline"
              style={{
                transform: 'translate(-50%, -50%)',
                opacity: showLogo ? 0 : 1,
                pointerEvents: showLogo ? 'none' : 'auto',
                transition: 'opacity 220ms ease-out',
                willChange: 'opacity',
                background: 'var(--fd-coral)',
                color: '#FFFFFF',
                letterSpacing: '-0.01em',
              }}
            >
              첫 주문 50% 할인
            </Link>

            {/* 우: 닫힘=로그인만 (FD: Log In). 장바구니 제거 — 사장님 지시(2026-06-15)
                로 헤더 카트 게이트 해제, FD 구독모델식 무카트 헤더로 정리. */}
            {!mobileMenuOpen && (
              <Link
                href={isAuthed ? '/account' : '/login'}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center px-1 h-10 text-[15px] font-bold no-underline"
                style={{ color: 'var(--fd-pine)' }}
              >
                {isAuthed ? '내 계정' : '로그인'}
              </Link>
            )}
          </div>

          {/* FD 모바일 패턴(회차194): 카테고리는 햄버거 드로어 단일 진입으로 통일.
              기존 상시 가로 chip 바는 FD엔 없어(이중 표출) 제거 — thefarmersdog.com
              모바일은 로고+로그인+햄버거만, 항목은 메뉴 패널 안에. */}
        </div>
      </header>

      {/* 모바일 메뉴 drawer */}
      {mobileMenuOpen && (
        <div
          ref={menuCloseRef}
          id="mobile-menu"
          tabIndex={-1}
          className="md:hidden fixed inset-0 z-30 flex flex-col outline-none fv-drawer-panel"
          role="dialog"
          aria-modal="true"
          aria-label="메뉴"
          style={{ background: '#FEFDFA' }}
        >
          {/* 헤더(sticky z-40)가 상단 64px 의 [X][로고]를 보여줌. 로고가 헤더 아래로
              살짝 넘치므로(~72px) 메뉴 항목은 더 아래(pt-24)부터 — 겹침 방지·FD 여백. */}
          <nav className="flex-1 overflow-y-auto pt-24" aria-label="주 메뉴">
            {CATEGORIES.map((c) => {
              const active = pathname === c.href || pathname.startsWith(`${c.href}/`)
              return (
                <Link
                  key={c.href}
                  href={c.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className="flex items-center px-6 py-4 transition active:opacity-60"
                  style={{ borderBottom: '1px solid var(--fd-line)' }}
                >
                  <span
                    className="text-[17px] font-bold"
                    style={{
                      color: active ? 'var(--fd-coral)' : 'var(--fd-pine)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {c.label}
                  </span>
                </Link>
              )
            })}
            {/* 인증상태 1행 (FD: Log In) */}
            <Link
              href={isAuthed ? '/account' : '/login'}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center px-6 py-4 transition active:opacity-60"
              style={{ borderBottom: '1px solid var(--fd-line)' }}
            >
              <span
                className="text-[17px] font-bold"
                style={{ color: 'var(--fd-pine)', letterSpacing: '-0.01em' }}
              >
                {isAuthed ? '내 계정' : '로그인'}
              </span>
            </Link>
          </nav>

          {/* 하단 풀폭 그린 pill — 설문 CTA (FD bottom CTA 대응) */}
          <div className="p-4" style={{ borderTop: '1px solid var(--fd-line)' }}>
            <Link
              href={isAuthed ? '/dogs/new' : '/start'}
              onClick={() => setMobileMenuOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-full py-4 text-[15px] font-extrabold no-underline"
              style={{
                background: 'var(--fd-green)',
                color: '#FFFFFF',
                letterSpacing: '-0.01em',
              }}
            >
              2분 설문 시작하기
              <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      )}

      {/* 본문 — children 페이지가 자체 <main> 을 가지고 있을 수 있어
         WebChrome 은 div 로만 감싸 a11y 중복 차단 (HTML 표준: 페이지당 1개
         <main>). layout.tsx 의 'skip to main' 링크(#main)가 항상 닿도록 이
         래퍼가 #main 앵커를 제공한다 — 개별 에디토리얼 페이지가 <main id>
         를 빠뜨려도 스킵 링크가 동작. (자식 <main> 은 landmark 역할만.) */}
      <div id="main" className="flex-1">{children}</div>

      {/* FD 마케팅 푸터 (nav/브랜드) → 그 아래 법정 SiteFooter(불변) */}
      <FdFooter planHref={isAuthed ? '/dogs/new' : '/start'} />
      {/* 푸터 — 사업자 정보 + 고객 문의 */}
      <SiteFooter />

      {/* 전역 미니 카트 토스트 — `ft:cart:add` 이벤트 listen */}
      <MiniCartToast />
    </div>
    </WishlistProvider>
  )
}

// (Phase Q) 커머스 검색 SearchInput 제거 — 퍼널 웹에는 상품 검색 동선이 없다.
