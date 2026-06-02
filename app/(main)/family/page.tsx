// B4 — 가족 멤버 관리 페이지 (app-only).
// 가족 초대 (이메일 / 링크), 역할 부여, 멤버 해제. 베타 — 초대 링크만 동작.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ChevronLeft,
  UserPlus,
  Crown,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function FamilyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/family')

  // 성능: profile · invites 는 서로 독립이라 병렬(직렬 RTT 1회 제거).
  const [{ data: profile }, { data: invites }] = await Promise.all([
    supabase.from('profiles').select('name, email').eq('id', user.id).maybeSingle(),
    // R17-E42: 내가 보낸 초대 list + 상태.
    supabase
      .from('dog_invitations')
      .select('id, email, role, accepted_at, declined_at, expires_at, dog_id, created_at')
      .eq('invited_by', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])
  const invitations = (invites ?? []) as Array<{
    id: string
    email: string
    role: string
    accepted_at: string | null
    declined_at: string | null
    expires_at: string
    dog_id: string
    created_at: string
  }>

  // 견 이름 lookup (초대 표시용)
  const dogIds = Array.from(new Set(invitations.map((i) => i.dog_id)))
  let dogNames: Record<string, string> = {}
  if (dogIds.length > 0) {
    const { data: dogs } = await supabase
      .from('dogs')
      .select('id, name')
      .in('id', dogIds)
    dogNames = Object.fromEntries(
      ((dogs ?? []) as Array<{ id: string; name: string }>).map((d) => [
        d.id,
        d.name,
      ]),
    )
  }

  const now = new Date()

  function inviteStatus(inv: typeof invitations[number]):
    | { label: string; tone: string; Icon: typeof Clock }
    | null {
    if (inv.accepted_at)
      return { label: '수락', tone: 'var(--moss)', Icon: CheckCircle }
    if (inv.declined_at)
      return { label: '거절', tone: 'var(--muted)', Icon: XCircle }
    if (new Date(inv.expires_at) < now)
      return { label: '만료', tone: 'var(--muted)', Icon: XCircle }
    return { label: '대기', tone: 'var(--terracotta)', Icon: Clock }
  }

  return (
    <div className="pb-10">
      <div className="px-5 pt-6 pb-2">
        <Link
          href="/mypage"
          className="text-[10.5px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
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
              lineHeight: 1.2,
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
                  fontSize: 13.5,
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
                <p className="text-[10.5px] text-muted mt-0.5">
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
                  fontSize: 13.5,
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

      {/* R17-E42: 내가 보낸 초대 list */}
      {invitations.length > 0 && (
        <section className="px-5 mt-6">
          <h2 className="kicker mb-2">보낸 초대 · {invitations.length}건</h2>
          <div className="space-y-2">
            {invitations.map((inv) => {
              const status = inviteStatus(inv)
              if (!status) return null
              const Icon = status.Icon
              return (
                <div
                  key={inv.id}
                  className="rounded border border-rule bg-bg-3 px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <Icon
                      className="w-4 h-4 shrink-0 mt-0.5"
                      strokeWidth={2}
                      style={{ color: status.tone }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className="font-sans truncate"
                          style={{
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: 'var(--ink)',
                          }}
                        >
                          {inv.email}
                        </p>
                        <span
                          className="text-[10.5px] font-bold uppercase tracking-widest shrink-0"
                          style={{ color: status.tone }}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-muted mt-0.5">
                        {dogNames[inv.dog_id] ?? '강아지'} ·{' '}
                        {inv.role === 'viewer' ? '뷰어' : '공동 보호자'} ·{' '}
                        {new Date(inv.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="px-5 mt-6">
        <p className="text-[10.5px] text-muted leading-relaxed">
          가족 초대 시 견 정보 공유 + 활동 기록 가시화. 역할별 권한은
          확장 중 — 현재는 조회 위주.
        </p>
      </section>
    </div>
  )
}
