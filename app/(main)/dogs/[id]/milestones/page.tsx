// B8 — 마일스톤 standalone 페이지. dashboard 의 카드와 다르게 모든 도달한
// 마일스톤 + 다음 마일스톤까지의 진행률을 timeline 으로 보여준다.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, PartyPopper, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { MILESTONES, type Milestone } from '@/lib/dashboard/milestones'

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86400000)
}

const TONE_COLOR: Record<Milestone['tone'], string> = {
  gold: 'var(--gold)',
  terracotta: 'var(--terracotta)',
  moss: 'var(--moss)',
}

export default async function MilestonesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: dogId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/milestones`)

  const { data: dog } = await supabase
    .from('dogs')
    .select('id, name, created_at')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) redirect('/dogs')

  const now = new Date()
  const since = new Date(dog.created_at as string)
  const days = daysBetween(since, now)

  return (
    <main className="pb-10">
      <div className="px-5 pt-6 pb-2">
        <Link
          href={`/dogs/${dogId}`}
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
          {dog.name as string}
        </Link>
        <div className="mt-3">
          <span className="kicker inline-block">Milestones</span>
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
            함께한 시간
          </h1>
          <p className="text-[12px] text-muted mt-1.5">
            {dog.name as string}와 함께한 <strong>{days}일</strong> 동안의 마일스톤
          </p>
        </div>
      </div>

      <section className="px-5 mt-4">
        <ol className="relative" style={{ paddingLeft: 28 }}>
          {/* 세로 line */}
          <span
            aria-hidden
            className="absolute"
            style={{
              left: 12,
              top: 0,
              bottom: 0,
              width: 1,
              background: 'var(--rule)',
            }}
          />
          {MILESTONES.map((m) => {
            const reached = days >= m.daysSince
            const accent = TONE_COLOR[m.tone]
            return (
              <li key={m.daysSince} className="relative mb-4">
                <span
                  aria-hidden
                  className="absolute inline-flex items-center justify-center"
                  style={{
                    left: -22,
                    top: 6,
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: reached ? accent : 'var(--bg-3)',
                    border: reached
                      ? `2px solid ${accent}`
                      : '1.5px solid var(--rule)',
                    color: reached ? 'white' : 'var(--muted)',
                  }}
                >
                  {reached ? (
                    <PartyPopper className="w-3 h-3" strokeWidth={2.5} />
                  ) : (
                    <Lock className="w-3 h-3" strokeWidth={2.5} />
                  )}
                </span>
                <div
                  className="rounded px-4 py-3"
                  style={{
                    background: reached
                      ? `color-mix(in srgb, ${accent} 8%, white)`
                      : 'var(--bg-3)',
                    border: `1px solid ${reached ? 'color-mix(in srgb, ' + accent + ' 28%, transparent)' : 'var(--rule)'}`,
                  }}
                >
                  <span
                    className="kicker"
                    style={{ color: reached ? accent : 'var(--muted)' }}
                  >
                    {m.kicker} · {m.daysSince}일
                  </span>
                  <p
                    className="font-sans mt-1 leading-snug"
                    style={{
                      fontSize: 14,
                      fontWeight: reached ? 700 : 600,
                      color: reached ? 'var(--ink)' : 'var(--muted)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {m.label}
                  </p>
                  <p
                    className="mt-1 text-[12px] leading-relaxed"
                    style={{ color: 'var(--muted)' }}
                  >
                    {m.message.replace('{name}', dog.name as string)}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </main>
  )
}
