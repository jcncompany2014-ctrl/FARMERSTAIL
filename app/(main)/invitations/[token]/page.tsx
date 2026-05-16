import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InviteAccept from './InviteAccept'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '가족 초대',
  robots: { index: false, follow: false },
}

type Params = Promise<{ token: string }>

/**
 * /invitations/[token] — magic link 클릭 시 진입.
 *
 * server 에서 토큰 정보를 fetch 해 초대 컨텍스트 (강아지 이름, 초대자,
 * role, 만료) 를 미리 보여주고, 클라이언트 컴포넌트가 "수락" 버튼을 처리.
 *
 * RLS: dog_invitations.select 정책이 (invited_by 본인 OR email 매칭) 이라
 *  메일 받은 본인이 로그인한 상태면 RLS 통과. 다른 사람이 토큰을 알아도
 *  자기 email 이 안 맞으면 row 안 보임 → guess 차단.
 */
export default async function InvitationPage({ params }: { params: Params }) {
  const { token } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    // 로그인 후 다시 돌아오게 next 보존
    redirect(`/login?next=/invitations/${encodeURIComponent(token)}`)
  }

  // audit #67: RLS 강화로 받은 사람은 row SELECT 불가 → RPC 로 token 조회.
  // token 자체가 access control. lookup_invitation_by_token RPC 가 SECURITY DEFINER.
  const { data: invRows } = await supabase.rpc('lookup_invitation_by_token', {
    p_token: token,
  })
  const inv = Array.isArray(invRows) && invRows.length > 0 ? invRows[0] : null

  let dogName: string | null = null
  let inviterName: string | null = null
  let invalidReason: string | null = null

  if (!inv) {
    invalidReason =
      '유효하지 않은 초대 링크예요. 보내주신 분께 다시 보내달라고 부탁해보세요.'
  } else {
    const invRow = inv as {
      dog_id: string
      email: string
      role: 'member' | 'viewer'
      expires_at: string
      accepted_at: string | null
      declined_at: string | null
      invited_by: string
    }

    if (invRow.accepted_at) {
      invalidReason = '이미 수락한 초대예요'
    } else if (invRow.declined_at) {
      invalidReason = '거절된 초대예요'
    } else if (new Date(invRow.expires_at) < new Date()) {
      invalidReason = '만료된 초대예요. 다시 받아보세요.'
    } else if (
      invRow.email.toLowerCase() !== (user.email ?? '').toLowerCase()
    ) {
      invalidReason = `이 초대는 ${invRow.email} 으로 발송됐어요. 해당 계정으로 로그인 후 다시 시도해 주세요.`
    } else {
      // dog name — dog_invitations RLS 가 통과해도 dogs RLS 는 별도라 직접 조회
      const { data: dog } = await supabase
        .from('dogs')
        .select('name')
        .eq('id', invRow.dog_id)
        .maybeSingle()
      dogName = (dog as { name: string | null } | null)?.name ?? null

      // inviter 이름
      const { data: inviter } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', invRow.invited_by)
        .maybeSingle()
      inviterName =
        (inviter as { name: string | null } | null)?.name ?? '가족 한 분'
    }
  }

  return (
    <InviteAccept
      token={token}
      dogName={dogName}
      inviterName={inviterName}
      role={(inv as { role?: 'member' | 'viewer' } | null)?.role ?? null}
      expiresAt={
        (inv as { expires_at?: string } | null)?.expires_at ?? null
      }
      invalidReason={invalidReason}
    />
  )
}
