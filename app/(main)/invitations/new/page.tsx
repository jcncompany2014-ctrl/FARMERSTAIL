// R15-C24: 가족 초대 발송 페이지. /family 의 "가족 초대하기" → 여기.
// 강아지 선택 + email + role → POST /api/invitations/create → 토큰 URL.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NewInviteClient from './NewInviteClient'

export const dynamic = 'force-dynamic'

export default async function NewInvitationPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/invitations/new')

  const { data: dogRows } = await supabase
    .from('dogs')
    .select('id, name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const dogs = (dogRows ?? []) as Array<{ id: string; name: string }>

  return (
    <div className="pb-10">
      <div className="px-5 pt-6 pb-2">
        <div className="mt-3">
          <span className="kicker inline-block">New invite</span>
          <h1
            className="font-sans mt-1.5"
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            가족 초대
          </h1>
          <p className="text-[12px] text-muted mt-1.5">
            초대 링크를 만들어 가족에게 공유해 보세요. 7일간 유효해요.
          </p>
        </div>
      </div>
      <NewInviteClient dogs={dogs} />
    </div>
  )
}
