'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않아요')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#F5F0E6] px-6">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt="Farmer's Tail"
            className="w-20 h-20 mx-auto rounded-2xl mb-4"
          />
          <h1 className="text-xl font-black text-[#3D2B1F] tracking-tight">
            FARMER&apos;S TAIL
          </h1>
          <p className="text-[11px] text-[#8A7668] mt-1">Farm to Tail · 프리미엄 반려견 식품</p>
        </div>

        {/* 폼 */}
        <div className="bg-white rounded-xl border border-[#EDE6D8] px-5 py-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-[#5C4A3A] mb-1.5">
                이메일
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-[#EDE6D8] bg-[#FDFDFD] text-[#2A2118] text-sm focus:outline-none focus:border-[#A0452E] transition"
                placeholder="example@email.com"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#5C4A3A] mb-1.5">
                비밀번호
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-[#EDE6D8] bg-[#FDFDFD] text-[#2A2118] text-sm focus:outline-none focus:border-[#A0452E] transition"
                placeholder="비밀번호를 입력하세요"
              />
            </div>

            {error && (
              <div className="text-[12px] text-[#B83A2E] font-bold bg-[#B83A2E]/5 border border-[#B83A2E]/20 rounded-lg px-3.5 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#A0452E] text-white font-bold text-[14px] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>

        {/* 하단 링크 */}
        <div className="text-center mt-5 text-[12px] text-[#8A7668]">
          아직 계정이 없으신가요?{' '}
          <Link href="/signup" className="text-[#A0452E] font-bold">
            회원가입
          </Link>
        </div>
      </div>
    </main>
  )
}