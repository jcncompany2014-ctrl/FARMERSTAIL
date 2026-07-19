'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AdminNav from './AdminNav'

/**
 * AdminShell — 관리자 콘솔 셸. **네이티브 앱형 대개편 (2026-07-19 사장님
 * "애초부터 어드민 디자인이랑 큰 UI 구조도 마음에 안 들어").**
 *
 * # 구조 (사장님 확정: 네이티브 앱형)
 *  · 모바일(md 미만): **바텀 탭 5개** — 홈·주문·구독·고객·전체. 우리 고객
 *    앱과 같은 문법(feedback_native_app_patterns). '전체' 탭이 풀 메뉴
 *    드로어를 연다(옛 햄버거 대체 — 엄지 닿는 곳으로 이동).
 *  · 데스크톱(md+): 사이드바 유지하되 **다크 폐기 → 밝은 브랜드 크림 톤**
 *    (파머스테일 웹과 같은 계열 — "내 가게 백오피스" 느낌).
 *
 * # 역사
 * 2026-07-17 모바일 드로어화(이전엔 반응형 0개 — 375px에서 본문 71px "개박살").
 * 2026-07-19 바텀 탭 구조로 재개편 + 라이트 톤 전환.
 */

/** 바텀 탭 — 운영 빈도 최상위 4 + 전체 메뉴. */
const TAB_ITEMS = [
  { href: '/admin', label: '홈', icon: HomeIcon },
  { href: '/admin/orders', label: '주문', icon: BoxIcon },
  { href: '/admin/subscriptions', label: '구독', icon: RepeatIcon },
  { href: '/admin/users', label: '고객', icon: UsersIcon },
] as const

export default function AdminShell({
  userEmail,
  bell,
  children,
}: {
  userEmail: string
  /** OrderRealtimeBell — server layout 에서 주입(여기서 import 하면 client 번들에 섞임). */
  bell?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  // 드로어 열림 동안: Esc 로 닫기 + 배경 스크롤 잠금 + 닫기 버튼에 포커스.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtnRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  /** 탭 active — 최장 prefix 매치('/admin'은 정확히 일치할 때만). */
  function tabActive(href: string): boolean {
    if (href === '/admin') return pathname === '/admin'
    return pathname === href || pathname.startsWith(href + '/')
  }
  const anyTabActive = TAB_ITEMS.some((t) => tabActive(t.href))

  return (
    <div className="min-h-screen bg-[#F6F4EE] md:flex">
      {/* 모바일 드로어 배경 — 열렸을 때만. */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 사이드바 — 모바일='전체' 탭이 여는 풀 메뉴 드로어, 데스크톱=고정.
          다크(#16181d) 폐기 → 브랜드 크림. element 는 하나. */}
      <aside
        id="admin-sidebar"
        aria-label="관리자 메뉴"
        className={`
          w-64 shrink-0 bg-[#FBFAF6] border-r border-zinc-200 text-zinc-700 flex flex-col
          fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out
          md:sticky md:top-0 md:h-screen md:z-auto md:transition-none md:translate-x-0
          ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        `}
      >
        <div className="px-5 py-5 border-b border-zinc-200 shrink-0 flex items-center justify-between gap-2">
          <Link href="/admin" className="block min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-ink.png" alt="Farmer's Tail" className="h-7 w-auto" />
            <p className="text-[10px] text-zinc-400 mt-2 tracking-[0.2em] font-semibold">
              운영 콘솔
            </p>
          </Link>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="메뉴 닫기"
            className="md:hidden -mr-2 w-11 h-11 shrink-0 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 링크 클릭 시 드로어 닫기(위임) — 안 닫으면 이동 화면이 가려진다. */}
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) setOpen(false)
          }}
        >
          <AdminNav />
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-zinc-200">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider">로그인 계정</p>
          <p className="text-xs text-zinc-700 mt-0.5 truncate">{userEmail}</p>
          <Link
            href="/dashboard"
            className="mt-3 block text-[11px] text-zinc-500 hover:text-terracotta transition"
          >
            ← 일반 화면으로
          </Link>
        </div>
      </aside>

      {/* 본문 — min-w-0: flex 자식이 뷰포트를 밀어내는 것 차단. */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-[#FBFAF6]/90 backdrop-blur border-b border-zinc-200">
          <div className="max-w-6xl mx-auto px-4 md:px-8 h-12 flex items-center gap-3">
            {/* 모바일 헤더 로고 — 햄버거는 바텀 '전체' 탭이 대체. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-ink.png"
              alt=""
              aria-hidden="true"
              className="md:hidden h-5 w-auto opacity-80"
            />
            <div className="ml-auto flex items-center gap-3">{bell}</div>
          </div>
        </header>
        {/* 모바일: 바텀 탭 높이만큼 하단 여백(pb-24) — 내용이 탭에 안 가리게.
            admin-body = 테이블 모바일 가드 스코프(globals.css) — 테이블 최소폭
            보장으로 셀이 글자 단위로 세로 꺾이는 것 차단(2026-07-19 사장님 폰). */}
        <div className="admin-body max-w-6xl mx-auto w-full min-w-0 px-4 md:px-8 py-5 md:py-8 pb-24 md:pb-8 flex-1">
          {children}
        </div>
      </main>

      {/* ── 바텀 탭 (모바일 전용) — 네이티브 앱 문법 ─────────────────── */}
      <nav
        aria-label="관리자 빠른 이동"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-zinc-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5 h-16">
          {TAB_ITEMS.map((t) => {
            const active = tabActive(t.href)
            const Icon = t.icon
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition ${
                  active ? 'text-terracotta' : 'text-zinc-400'
                }`}
              >
                <Icon />
                {t.label}
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="전체 메뉴 열기"
            aria-controls="admin-sidebar"
            aria-expanded={open}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition ${
              open || !anyTabActive ? 'text-terracotta' : 'text-zinc-400'
            }`}
          >
            <MenuIcon />
            전체
          </button>
        </div>
      </nav>
    </div>
  )
}

/* ── 탭 아이콘 (stroke 아이콘 — 이모지 대신, 네이티브 톤) ───────────── */

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}
function BoxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  )
}
function RepeatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  )
}
function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  )
}
