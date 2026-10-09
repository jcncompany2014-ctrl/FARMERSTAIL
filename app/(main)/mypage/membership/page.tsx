import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MembershipView from './MembershipView'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '멤버십',
  robots: { index: false, follow: false },
}

/**
 * /mypage/membership — 멤버십 hub.
 *
 * 도장판 + 현재 등급 혜택 + 전체 등급(달성 여부) + 나무 등급 등록증 입구 + 등급 산정 안내.
 * /account/profile 의 작은 등급 카드와 분리 — 매일 들어와도 시인성 좋게.
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 M05·I12): 그리는 부분을 MembershipView 로 뺐다 — 점검 화면이 예시 값으로
 * 같은 화면을 그린다. 조회·로그인 확인은 여기 그대로.
 */
export default async function MembershipPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/membership')

  const [{ data: profile }, { data: dogs }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('tier, stamp_count, tier_updated_at')
        .eq('id', user.id)
        .maybeSingle(),
      // 나무 등급일 때 강아지 등록증 입구 list 용. 다른 등급은 사용 안 함.
      supabase
        .from('dogs')
        .select('id, name, breed, photo_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
    ])

  // stampCount 는 도장판·진행률 계산용(살아있는 개수). 등급 배지 정본(profiles.tier ratcheted floor)과의
  // 조합은 MembershipView 가 resolveTierKey 로 한다(강등 없음 2026-07-22).
  const stampCount =
    typeof profile?.stamp_count === 'number' ? profile.stamp_count : 0

  return (
    <MembershipView
      stampCount={stampCount}
      tier={profile?.tier}
      tierUpdatedAt={profile?.tier_updated_at}
      dogs={dogs ?? []}
    />
  )
}
