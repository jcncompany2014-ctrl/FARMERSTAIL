import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin')
  }

  // JWT에 들어있는 role 확인 (raw_user_meta_data.role)
  const role = (user.user_metadata as { role?: string })?.role
  if (role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#F5F0E6] flex">
      {/* 사이드바 */}
      <aside className="w-60 shrink-0 bg-[#2A2118] text-[#F5F0E6] min-h-screen sticky top-0">
        <div className="px-6 py-6 border-b border-[#3D2B1F]">
          <Link href="/admin" className="block">
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img
    src="/logo.png"
    alt="Farmer's Tail"
    className="h-12 w-auto brightness-0 invert"
  />
</Link>
<p className="text-[10px] text-[#8A7668] mt-2 tracking-widest">
  ADMIN CONSOLE
</p>
        </div>

        <nav className="px-3 py-4 space-y-1">
          <NavItem href="/admin" icon="📊" label="대시보드" />
          <NavItem href="/admin/orders" icon="📦" label="주문 관리" />
          <NavItem href="/admin/products" icon="🛍️" label="제품 관리" />
          <NavItem href="/admin/users" icon="👥" label="회원 관리" />
        </nav>

        <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-[#3D2B1F]">
          <p className="text-[10px] text-[#8A7668]">LOGGED IN AS</p>
          <p className="text-xs text-white mt-0.5 truncate">{user.email}</p>
          <Link
            href="/dashboard"
            className="mt-3 block text-[10px] text-[#A0452E] hover:text-[#8BA05A] transition"
          >
            ← 일반 화면으로
          </Link>
        </div>
      </aside>

      {/* 본문 */}
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  )
}

function NavItem({
  href,
  icon,
  label,
}: {
  href: string
  icon: string
  label: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#8A7668] hover:bg-[#3D2B1F] hover:text-white transition"
    >
      <span className="text-base">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  )
}