// B4 — 가족 멤버 관리 페이지 (app-only).
// 가족 초대 (이메일 / 링크), 역할 부여, 멤버 해제. 베타 — 초대 링크만 동작.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, UserPlus, Crown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function FamilyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/family')

  // 멤버 라우팅 베타 — profiles 의 user_id 가 같은 사람들 묶음.
  // 실제 family_members 테이블이 없으므로 본인만 표시.
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, email')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <main className="pb-10">
      <div className="px-5 pt-6 pb-2">
        <Link
          href="/mypage"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
          내 정보
        </Link>
        <div className="mt-3">
          <span className="kicker inline-block">Family</span>
          <h1
            className="font-sans mt-1.5"
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            가족 멤버
          </h1>
          <p className="text-[12px] text-muted mt-1.5">
            함께 챙기는 가족과 강아지 정보를 공유해 봐요
          </p>
        </div>
      </div>

      <section className="px-5 mt-4">
        <div className="rounded border border-rule bg-bg-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'var(--terracotta)', color: 'white' }}
            >
              <Crown className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="font-sans"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--ink)',
                }}
              >
                {(profile?.name as string | null) ?? '나'}
                <span className="ml-2 text-[10.5px] text-terracotta font-semibold uppercase tracking-widest">
                  보호자
                </span>
              </p>
              {profile?.email && (
                <p className="text-[11px] text-muted mt-0.5">
                  {profile.email as string}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 mt-4">
        <Link
          href="/invitations/new"
          className="block rounded border border-rule bg-bg-3 px-4 py-4 active:scale-[0.99] transition"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background:
                  'color-mix(in srgb, var(--terracotta) 12%, transparent)',
                color: 'var(--terracotta)',
              }}
            >
              <UserPlus className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="font-sans"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--ink)',
                }}
              >
                가족 초대하기
              </p>
              <p className="text-[12px] text-muted mt-0.5">
                초대 링크를 보내면 강아지 정보를 함께 볼 수 있어요
              </p>
            </div>
          </div>
        </Link>
      </section>

      <section className="px-5 mt-6">
        <p className="text-[11px] text-muted leading-relaxed">
          현재 베타 — 1인 보호자만 표시되며, 가족 초대 시 자동으로 멤버
          목록에 추가됩니다. 역할별 권한 (공동보호자 / 뷰어) 은 곧 추가
          예정.
        </p>
      </section>
    </main>
  )
}
