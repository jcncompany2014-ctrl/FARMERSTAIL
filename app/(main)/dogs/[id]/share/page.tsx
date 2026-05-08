import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ShareClient from './ShareClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '친구에게 공유',
  robots: { index: false, follow: false },
}

type Params = Promise<{ id: string }>

/**
 * /dogs/[id]/share — 강아지 프로필 + 추천 코드 공유 페이지.
 *
 * 솔로 D2C CAC 핵심 그로스 surface — 사용자가 자기 강아지 사진 + 짧은 한마디
 * + 추천 코드를 한 묶음으로 카카오톡 / 인스타에 공유. 받는 친구는 강아지
 * 사진을 본 신뢰감 + 가입 적립금 → 전환율 ↑.
 *
 * # 보안
 * - 본인 강아지만 (RLS + dog.user_id 확인)
 * - 추천 코드는 본인 자체 발급 (get_or_create_my_referral_code RPC)
 * - 공유 URL: /signup?ref=CODE — public, ref 만 노출, dog 정보는 OG 에만
 */
export default async function ShareDogPage({ params }: { params: Params }) {
  const { id: dogId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/share`)

  const [{ data: dog }, { data: code }] = await Promise.all([
    supabase
      .from('dogs')
      .select('id, name, breed, photo_url, age_value, age_unit')
      .eq('id', dogId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.rpc('get_or_create_my_referral_code'),
  ])

  if (!dog) notFound()

  return (
    <ShareClient
      dog={{
        id: dog.id,
        name: dog.name,
        breed: dog.breed ?? null,
        photoUrl: dog.photo_url ?? null,
        ageLabel:
          dog.age_value && dog.age_unit
            ? `${dog.age_value}${dog.age_unit === 'year' ? '살' : '개월'}`
            : null,
      }}
      referralCode={(code as string | null) ?? ''}
    />
  )
}
