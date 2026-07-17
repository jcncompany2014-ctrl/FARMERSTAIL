'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import AdminNav from './AdminNav'

/**
 * AdminShell — 관리자 콘솔 셸 (사이드바 + 본문 프레임).
 *
 * # 왜 만들었나 (2026-07-17 · 사장님: "모바일 웹에서 admin 들어가면 비율 다 깨져")
 *
 * 이전 `app/admin/layout.tsx` 는 **반응형 분기가 0개**였다 — 데스크톱 전용으로
 * 만들어진 뒤 모바일이 고려된 적이 없다. 375px 폰에서:
 *   · 사이드바 `w-60 shrink-0` = 240px **고정·축소불가·숨김불가**
 *   · 본문 `px-8` = 좌우 64px 고정
 *   → 304px 를 껍데기가 먹고 **본문에 71px** 만 남아 내용이 짜부라지고,
 *     표·고정폭 요소가 가로로 밀려 나갔다("개박살").
 *
 * 솔로 운영자가 **폰으로 주문·구독을 확인**해야 하므로 모바일이 필수 경로다.
 *
 * # 구조
 * 사이드바 element 는 **하나**다(데스크톱/모바일 마크업 중복 없음). 화면 폭에 따라
 * 배치만 바뀐다:
 *   · 모바일: `fixed` 드로어 — 기본 `-translate-x-full` 로 숨고 햄버거로 슬라이드인
 *   · 데스크톱(md+): `md:sticky md:translate-x-0` 로 항상 보이는 고정 사이드바
 *
 * layout.tsx 가 서버 컴포넌트(auth 조회)라 드로어 open 상태를 못 가진다 →
 * 셸만 client 로 분리하고 user email·벨은 prop 으로 받는다.
 */
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

  return (
    <div className="min-h-screen bg-[#f6f7f9] md:flex">
      {/* 모바일 드로어 배경 — 열렸을 때만. 데스크톱엔 없음. */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 사이드바 — 모바일=드로어(fixed), 데스크톱=고정(sticky). element 는 하나. */}
      <aside
        id="admin-sidebar"
        aria-label="관리자 사이드바"
        aria-hidden={!open ? undefined : false}
        className={`
          w-60 shrink-0 bg-[#16181d] text-zinc-300 flex flex-col
          fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out
          md:sticky md:top-0 md:h-screen md:z-auto md:transition-none md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="px-5 py-5 border-b border-white/10 shrink-0 flex items-center justify-between gap-2">
          <Link href="/admin" className="block min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-paper.png" alt="Farmer's Tail" className="h-7 w-auto" />
            <p className="text-[10px] text-zinc-500 mt-2 tracking-[0.2em] font-medium">
              ADMIN CONSOLE
            </p>
          </Link>
          {/* 드로어 닫기 — 모바일 전용. 44px 터치 타깃. */}
          <button
            ref={closeBtnRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="메뉴 닫기"
            className="md:hidden -mr-2 w-11 h-11 shrink-0 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 메뉴 링크를 누르면 드로어를 닫는다 — 안 닫으면 이동한 화면이 드로어에
            가려진다. 라우트 변경 effect 로 처리하면 effect 안 setState 가 되어
            cascading render 를 부르므로(eslint react-hooks/set-state-in-effect),
            클릭이 링크에서 났을 때만 닫는 위임 핸들러로 처리. */}
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) setOpen(false)
          }}
        >
          <AdminNav />
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-white/10">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Logged in as</p>
          <p className="text-xs text-zinc-200 mt-0.5 truncate">{userEmail}</p>
          <Link
            href="/dashboard"
            className="mt-3 block text-[11px] text-zinc-400 hover:text-white transition"
          >
            ← 일반 화면으로
          </Link>
        </div>
      </aside>

      {/* 본문 — min-w-0 필수: flex 자식이 내용물 때문에 뷰포트를 밀어내는 것 차단. */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-zinc-200">
          <div className="max-w-6xl mx-auto px-3 md:px-8 h-12 flex items-center gap-3">
            {/* 햄버거 — 모바일 전용. 44px 터치 타깃. */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="메뉴 열기"
              aria-controls="admin-sidebar"
              aria-expanded={open}
              className="md:hidden -ml-2 w-11 h-11 shrink-0 flex items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 transition"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <div className="ml-auto flex items-center gap-3">{bell}</div>
          </div>
        </header>
        {/* px-4(모바일) — 이전 px-8 고정은 375px 에서 본문을 71px 로 만들었다. */}
        <div className="max-w-6xl mx-auto w-full min-w-0 px-4 md:px-8 py-5 md:py-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  )
}
