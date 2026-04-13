'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setChecking(false)
    }
    check()
  }, [router, supabase])

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F5F0E6]">
        <div className="text-[#8A7668]">로딩 중...</div>
      </main>
    )
  }

  const tabs = [
    { href: '/dashboard', label: '홈', icon: '🏠' },
    { href: '/dogs', label: '강아지', icon: '🐕' },
    { href: '/products', label: '제품', icon: '🛍️' },
    { href: '/mypage', label: '내 정보', icon: '👤' },
  ]

  return (
    <div className="min-h-screen bg-[#F5F0E6] pb-24">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-40 bg-[#F5F0E6]/95 backdrop-blur-md border-b border-[#EDE6D8]">
        <div className="max-w-md mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="font-black text-[#3D2B1F] text-lg tracking-tight">
            FARMER&apos;S TAIL
          </Link>
        </div>
      </header>

      {/* 페이지 컨텐츠 */}
      <div>
        {children}
      </div>

      {/* 하단 탭 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-[#EDE6D8]">
        <div className="max-w-md mx-auto px-2 py-2 grid grid-cols-4 gap-1">
          {tabs.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition ${
                  active
                    ? 'bg-[#F5F0E6] text-[#3D2B1F]'
                    : 'text-[#8A7668] hover:bg-[#FDFDFD]'
                }`}
              >
                <span className="text-2xl mb-0.5">{tab.icon}</span>
                <span className={`text-[10px] font-bold ${active ? 'text-[#3D2B1F]' : 'text-[#8A7668]'}`}>
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}