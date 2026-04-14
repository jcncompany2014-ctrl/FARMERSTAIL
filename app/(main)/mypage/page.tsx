'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function MyPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setEmail(user.email ?? null)
    }
    load()
  }, [supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <main className="px-6 py-10">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-black text-[#3D2B1F] tracking-tight mb-8">
          내 정보
        </h1>

        <div className="bg-white rounded-2xl border-2 border-[#EDE6D8] p-6 mb-4">
          <div className="text-xs font-bold text-[#8A7668] uppercase tracking-wide mb-2">
            계정
          </div>
          <div className="text-[#3D2B1F] font-bold">{email}</div>
        </div>

        <div className="bg-white rounded-2xl border-2 border-[#EDE6D8] p-6 mb-4">
          <h3 className="text-xs font-bold text-[#8A7668] uppercase tracking-wide mb-3">
            메뉴
          </h3>
          <div className="space-y-1 text-sm">
            <Link
              href="/mypage/orders"
              className="flex items-center justify-between py-3 text-[#3D2B1F] font-medium hover:text-[#A0452E] transition"
            >
              <span>📦 주문 내역</span>
              <span className="text-[#8A7668]">→</span>
            </Link>
            <div className="py-3 text-[#8A7668]">🔔 알림 설정 (준비 중)</div>
            <div className="py-3 text-[#8A7668]">📍 배송지 관리 (준비 중)</div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-xl bg-transparent text-[#B83A2E] font-bold text-sm border-2 border-[#B83A2E]/30 hover:border-[#B83A2E] transition"
        >
          로그아웃
        </button>
      </div>
    </main>
  )
}