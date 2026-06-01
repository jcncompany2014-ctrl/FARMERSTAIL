import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReferralView from './ReferralView'

export const dynamic = 'force-dynamic'

type RedemptionRow = {
  id: string
  referee_id: string
  redeemed_at: string
}

/**
 * /mypage/referral — 추천 hub.
 *
 * 솔로 D2C 의 CAC 핵심 — 친구 초대로 가입 유입. UI 가 짜치지 않게
 * 이벤트 페이지 톤 (밝고 따뜻한 hero, 단계별 보상 progress, 큰 공유 CTA).
 */
export default async function ReferralPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/referral')

  const [
    { data: code, error: codeError },
    { data: myRedemption },
    { data: referredRaw },
    { data: referralPoints },
    { data: dogsRaw },
  ] = await Promise.all([
    supabase.rpc('get_or_create_my_referral_code'),
    supabase
      .from('referral_redemptions')
      .select('id, referrer_id, redeemed_at')
      .eq('referee_id', user.id)
      .maybeSingle(),
    supabase
      .from('referral_redemptions')
      .select('id, referee_id, redeemed_at')
      .eq('referrer_id', user.id)
      .order('redeemed_at', { ascending: false })
      .limit(20),
    // 추천으로 누적 적립한 포인트 합 — referral / referral_milestone 둘 다.
    supabase
      .from('point_ledger')
      .select('delta, reference_type')
      .eq('user_id', user.id)
      .in('reference_type', ['referral', 'referral_milestone'])
      .gt('delta', 0),
    // 강아지 list — 강아지별 공유 카드 진입점.
    supabase
      .from('dogs')
      .select('id, name, photo_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
  ])

  const referred: RedemptionRow[] = (referredRaw ?? []) as RedemptionRow[]
  const totalEarned =
    ((referralPoints ?? []) as Array<{ delta: number }>).reduce(
      (s, r) => s + (r.delta ?? 0),
      0,
    ) ?? 0

  return (
    <div className="pb-10">
      {codeError || !code ? (
        <section className="px-5 mt-6">
          <Link
            href="/mypage"
            className="text-[11px] text-muted hover:text-terracotta font-semibold"
          >
            ← 내 정보
          </Link>
          <div className="bg-bg-3 rounded border border-sale/30 px-5 py-6 text-center mt-4">
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
          totalEarned={totalEarned}
          recent={referred}
          dogs={
            (dogsRaw ?? []) as Array<{
              id: string
              name: string
              photo_url: string | null
            }>
          }
        />
      )}
    </div>
  )
}
