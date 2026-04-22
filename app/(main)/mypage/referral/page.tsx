import Link from 'next/link'
import { redirect } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ReferralView from './ReferralView'

export const dynamic = 'force-dynamic'

type RedemptionRow = {
  id: string
  referee_id: string
  redeemed_at: string
}

export default async function ReferralPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/referral')

  // Mint (or fetch) this user's code via SECURITY DEFINER RPC —
  // idempotent, so it's safe to call on every page view.
  const { data: code, error: codeError } = await supabase.rpc(
    'get_or_create_my_referral_code'
  )

  // Has this user already redeemed someone else's code? If so we hide
  // the input form so they don't get confused.
  const { data: myRedemption } = await supabase
    .from('referral_redemptions')
    .select('id, referrer_id, redeemed_at')
    .eq('referee_id', user.id)
    .maybeSingle()

  // People I referred (RLS: party-based SELECT → rows where I'm
  // referrer are readable; rows where I'm referee are also readable
  // but we filter client-side by column).
  const { data: referredRaw } = await supabase
    .from('referral_redemptions')
    .select('id, referee_id, redeemed_at')
    .eq('referrer_id', user.id)
    .order('redeemed_at', { ascending: false })
    .limit(20)
  const referred: RedemptionRow[] = (referredRaw ?? []) as RedemptionRow[]

  return (
    <main className="pb-10">
      {/* 헤더 */}
      <section className="px-5 pt-6 pb-2">
        <Link
          href="/mypage"
          className="text-[11px] text-muted hover:text-terracotta font-semibold"
        >
          ← 내 정보
        </Link>
        <div className="flex items-center gap-2 mt-3">
          <UserPlus className="w-4 h-4 text-terracotta" strokeWidth={2} />
          <span className="kicker">Refer a Friend · 친구 초대</span>
        </div>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          친구 초대하고 3,000P 받기
        </h1>
        <p className="text-[12px] text-muted mt-1.5 leading-relaxed">
          친구가 내 코드로 가입하면 두 분 모두에게 적립금 3,000P를 드려요.
        </p>
      </section>

      {codeError || !code ? (
        <section className="px-5 mt-6">
          <div className="bg-white rounded-2xl border border-sale/30 px-5 py-6 text-center">
            <p className="text-[13px] font-bold text-sale">
              초대 코드를 불러오지 못했어요
            </p>
            <p className="text-[11px] text-muted mt-1">
              {codeError?.message ?? '잠시 후 다시 시도해 주세요.'}
            </p>
          </div>
        </section>
      ) : (
        <ReferralView
          code={code as string}
          alreadyRedeemed={!!myRedemption}
          referredCount={referred.length}
          recent={referred}
        />
      )}
    </main>
  )
}
