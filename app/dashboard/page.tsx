'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setEmail(user.email ?? null)
    }
    checkUser()
  }, [router, supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[#F5F0E6] px-6 py-12">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🐕</div>
          <h1 className="text-3xl font-black text-[#3D2B1F] tracking-tight">
            환영해요!
          </h1>
          {email && (
            <p className="text-[#8A7668] text-sm mt-3">
              {email}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border-2 border-[#EDE6D8] p-6 mb-4">
          <h2 className="font-bold text-[#3D2B1F] mb-2">🎉 회원가입 성공</h2>
          <p className="text-sm text-[#8A7668]">
            곧 강아지 등록, 맞춤 설문 등 더 많은 기능이 추가될 거예요!
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-xl bg-[#3D2B1F] text-white font-bold text-base border-2 border-[#2A2118] shadow-[3px_3px_0_#2A2118] hover:shadow-[4px_4px_0_#2A2118] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
        >
          로그아웃
        </button>
      </div>
    </main>
  )
}