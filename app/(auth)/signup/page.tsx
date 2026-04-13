'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    if (data.user) {
      router.push('/dashboard')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F5F0E6] px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">🐕</div>
          <h1 className="text-3xl font-black text-[#3D2B1F] tracking-tight">
            FARMER'S TAIL
          </h1>
          <p className="text-[#8A7668] text-sm mt-2">회원가입</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#5C4A3A] mb-2 uppercase tracking-wide">
              이메일
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-[#EDE6D8] bg-white text-[#2A2118] focus:outline-none focus:border-[#3D2B1F] transition"
              placeholder="example@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#5C4A3A] mb-2 uppercase tracking-wide">
              비밀번호
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-[#EDE6D8] bg-white text-[#2A2118] focus:outline-none focus:border-[#3D2B1F] transition"
              placeholder="6자 이상"
            />
          </div>

          {error && (
            <div className="text-sm text-[#B83A2E] font-semibold bg-[#FFF5F3] border-2 border-[#B83A2E]/20 rounded-xl px-4 py-3">
              ⚠ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#A0452E] text-white font-bold text-base border-2 border-[#2A2118] shadow-[3px_3px_0_#2A2118] hover:shadow-[4px_4px_0_#2A2118] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-[#8A7668]">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-[#3D2B1F] font-bold underline">
            로그인
          </Link>
        </div>
      </div>
    </main>
  )
}