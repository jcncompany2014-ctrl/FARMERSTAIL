'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)
  const [dogCount, setDogCount] = useState(0)

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setEmail(user.email ?? null)

      const { count } = await supabase
        .from('dogs')
        .select('*', { count: 'exact', head: true })
      setDogCount(count ?? 0)
    }
    loadData()
  }, [router, supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[#F5F0E6] px-6 py-10">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🐕</div>
          <h1 className="text-3xl font-black text-[#3D2B1F] tracking-tight">
            환영해요!
          </h1>
          {email && (
            <p className="text-[#8A7668] text-sm mt-3">{email}</p>
          )}
        </div>

        {/* 내 강아지 카드 */}
        <Link
          href="/dogs"
          className="block bg-white rounded-2xl border-2 border-[#EDE6D8] p-6 mb-4 hover:border-[#3D2B1F] hover:shadow-[3px_3px_0_#2A2118] hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-[#8A7668] uppercase tracking-wide mb-1">
                내 강아지
              </div>
              <div className="text-2xl font-black text-[#3D2B1F]">
                {dogCount}마리
              </div>
            </div>
            <div className="text-4xl">🐕</div>
          </div>
        </Link>

        {/* 빠른 액션 */}
        <div className="bg-white rounded-2xl border-2 border-[#EDE6D8] p-5 mb-4">
          <h3 className="font-bold text-[#3D2B1F] mb-3 text-sm">빠른 시작</h3>
          <div className="space-y-2">
            <Link
              href="/dogs/new"
              className="block px-4 py-3 rounded-xl bg-[#F5F0E6] font-semibold text-[#3D2B1F] text-sm hover:bg-[#EDE6D8] transition"
            >
              + 새 강아지 등록
            </Link>
            <Link
              href="/dogs"
              className="block px-4 py-3 rounded-xl bg-[#F5F0E6] font-semibold text-[#3D2B1F] text-sm hover:bg-[#EDE6D8] transition"
            >
              🐕 내 강아지 목록
            </Link>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-xl bg-transparent text-[#8A7668] font-bold text-sm border-2 border-[#D8CCBA] hover:border-[#3D2B1F] hover:text-[#3D2B1F] transition"
        >
          로그아웃
        </button>
      </div>
    </main>
  )
}