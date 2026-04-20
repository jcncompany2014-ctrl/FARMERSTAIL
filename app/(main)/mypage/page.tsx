'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  name: string | null
  phone: string | null
}

export default function MyPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [orderCount, setOrderCount] = useState(0)
  const [subCount, setSubCount] = useState(0)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email ?? null)

      const { data: prof } = await supabase
        .from('profiles')
        .select('name, phone')
        .eq('id', user.id)
        .single()
      if (prof) setProfile(prof)

      const { count: oCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
      setOrderCount(oCount ?? 0)

      const { count: sCount } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'active')
      setSubCount(sCount ?? 0)
    }
    load()
  }, [supabase])

  async function handleLogout() {
    if (!confirm('로그아웃 하시겠어요?')) return
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName =
    profile?.name || (email ? email.split('@')[0] : null) || '고객'

  return (
    <main className="pb-8">
      {/* 헤더 */}
      <section className="px-5 pt-5 pb-1">
        <h1 className="text-lg font-black text-[#3D2B1F] tracking-tight">
          내 정보
        </h1>
        <p className="text-[11px] text-[#8A7668] mt-0.5">
          계정과 주문 정보를 관리해요
        </p>
      </section>

      {/* 프로필 카드 */}
      <section className="px-5 mt-3">
        <div className="bg-white rounded-xl border border-[#EDE6D8] px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#F5F0E6] flex items-center justify-center text-2xl">
              👤
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-black text-[#3D2B1F] truncate">
                {displayName}님
              </div>
              <div className="text-[11px] text-[#8A7668] truncate mt-0.5">
                {email ?? '—'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 요약 통계 */}
      <section className="px-5 mt-3">
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/mypage/orders"
            className="bg-white rounded-xl border border-[#EDE6D8] px-4 py-4 hover:border-[#3D2B1F] transition-all"
          >
            <div className="text-[10px] text-[#8A7668] font-bold">주문 내역</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-[20px] font-black text-[#3D2B1F]">
                {orderCount}
              </span>
              <span className="text-[11px] text-[#8A7668]">건</span>
            </div>
          </Link>
          <Link
            href="/mypage/subscriptions"
            className="bg-white rounded-xl border border-[#EDE6D8] px-4 py-4 hover:border-[#3D2B1F] transition-all"
          >
            <div className="text-[10px] text-[#8A7668] font-bold">정기배송</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-[20px] font-black text-[#6B7F3A]">
                {subCount}
              </span>
              <span className="text-[11px] text-[#8A7668]">건 활성</span>
            </div>
          </Link>
        </div>
      </section>

      {/* 메뉴 리스트 */}
      <section className="px-5 mt-5">
        <h2 className="text-[13px] font-black text-[#3D2B1F] mb-3">메뉴</h2>
        <div className="bg-white rounded-xl border border-[#EDE6D8] overflow-hidden">
          <Link
            href="/mypage/orders"
            className="flex items-center justify-between px-4 py-3.5 border-b border-[#EDE6D8] hover:bg-[#F5F0E6] transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-base">📦</span>
              <span className="text-[13px] font-bold text-[#3D2B1F]">
                주문 내역
              </span>
            </div>
            <span className="text-[#8A7668] text-xs">›</span>
          </Link>
          <Link
            href="/mypage/subscriptions"
            className="flex items-center justify-between px-4 py-3.5 border-b border-[#EDE6D8] hover:bg-[#F5F0E6] transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-base">🔁</span>
              <span className="text-[13px] font-bold text-[#3D2B1F]">
                정기배송 관리
              </span>
            </div>
            <span className="text-[#8A7668] text-xs">›</span>
          </Link>
          <Link
            href="/dogs"
            className="flex items-center justify-between px-4 py-3.5 border-b border-[#EDE6D8] hover:bg-[#F5F0E6] transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-base">🐕</span>
              <span className="text-[13px] font-bold text-[#3D2B1F]">
                내 아이들
              </span>
            </div>
            <span className="text-[#8A7668] text-xs">›</span>
          </Link>
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#EDE6D8]">
            <div className="flex items-center gap-3">
              <span className="text-base opacity-50">🔔</span>
              <span className="text-[13px] font-bold text-[#8A7668]">
                알림 설정
              </span>
            </div>
            <span className="text-[10px] text-[#8A7668] bg-[#F5F0E6] px-2 py-0.5 rounded-md">
              준비 중
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="text-base opacity-50">📍</span>
              <span className="text-[13px] font-bold text-[#8A7668]">
                배송지 관리
              </span>
            </div>
            <span className="text-[10px] text-[#8A7668] bg-[#F5F0E6] px-2 py-0.5 rounded-md">
              준비 중
            </span>
          </div>
        </div>
      </section>

      {/* 로그아웃 */}
      <section className="px-5 mt-4">
        <button
          onClick={handleLogout}
          className="w-full py-3.5 rounded-xl bg-white border border-[#EDE6D8] text-[13px] font-bold text-[#8A7668] hover:text-[#B83A2E] hover:border-[#B83A2E] transition active:scale-[0.98]"
        >
          로그아웃
        </button>
      </section>
    </main>
  )
}
