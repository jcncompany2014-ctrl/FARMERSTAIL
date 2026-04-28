import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Coins, TrendingUp, TrendingDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '적립금',
  robots: { index: false, follow: false },
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function PointsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/points')

  const { data: entries } = await supabase
    .from('point_ledger')
    .select('id, delta, balance_after, reason, reference_type, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const balance = entries && entries.length > 0 ? entries[0].balance_after : 0

  let earned = 0
  let used = 0
  for (const e of entries ?? []) {
    if (e.delta > 0) earned += e.delta
    else used += -e.delta
  }

  return (
    <main className="pb-8">
      <section className="px-5 pt-6 pb-2">
        <Link
          href="/mypage"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 내 정보
        </Link>
        <span className="kicker mt-3 block">Points · 적립금</span>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          적립금
        </h1>
      </section>

      {/* 현재 잔액 */}
      <section className="px-5 mt-3">
        <div
          className="rounded-2xl px-6 py-6 text-white"
          style={{ background: 'var(--ink)' }}
        >
          <div className="flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-gold" strokeWidth={2} />
            <span className="kicker kicker-gold">
              사용 가능한 포인트
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className="font-serif leading-none"
              style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              {balance.toLocaleString()}
            </span>
            <span className="text-[14px] text-white/80">P</span>
          </div>
        </div>
      </section>

      {/* 요약 */}
      <section className="px-5 mt-3 grid grid-cols-2 gap-2.5">
        <div className="bg-white rounded-xl border border-rule px-4 py-3.5">
          <div className="inline-flex items-center gap-1 text-[10px] font-bold text-moss">
            <TrendingUp className="w-3 h-3" strokeWidth={2.5} />
            누적 적립
          </div>
          <div
            className="mt-1 font-serif"
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            {earned.toLocaleString()}
            <span className="text-[10px] text-muted ml-0.5 font-sans">P</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-rule px-4 py-3.5">
          <div className="inline-flex items-center gap-1 text-[10px] font-bold text-terracotta">
            <TrendingDown className="w-3 h-3" strokeWidth={2.5} />
            누적 사용
          </div>
          <div
            className="mt-1 font-serif"
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            {used.toLocaleString()}
            <span className="text-[10px] text-muted ml-0.5 font-sans">P</span>
          </div>
        </div>
      </section>

      {/* 내역 */}
      <section className="px-5 mt-4">
        <div className="mb-2">
          <span className="kicker kicker-muted">Ledger · 내역</span>
        </div>
        {!entries || entries.length === 0 ? (
          <div
            className="rounded-xl border px-5 py-10 text-center"
            style={{
              background: 'var(--bg-2)',
              borderColor: 'var(--rule-2)',
              borderStyle: 'dashed',
            }}
          >
            <Coins
              className="w-7 h-7 text-muted mx-auto mb-2"
              strokeWidth={1.3}
            />
            <p className="text-[12px] font-bold text-text">
              아직 포인트 내역이 없어요
            </p>
            <p className="text-[10px] text-muted mt-1">
              리뷰·주문·친구 초대로 포인트를 적립해보세요
            </p>
          </div>
        ) : (
          <ul className="bg-white rounded-xl border border-rule overflow-hidden divide-y divide-rule">
            {entries.map((e) => {
              const earn = e.delta > 0
              return (
                <li key={e.id} className="px-4 py-3.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-text">
                      {e.reason}
                    </p>
                    <p className="text-[10px] text-muted mt-0.5">
                      {formatDateTime(e.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div
                      className="font-serif"
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: earn ? 'var(--moss)' : 'var(--terracotta)',
                        letterSpacing: '-0.015em',
                      }}
                    >
                      {earn ? '+' : ''}
                      {e.delta.toLocaleString()}P
                    </div>
                    <div className="text-[10px] text-muted mt-0.5">
                      잔액 {e.balance_after.toLocaleString()}P
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
