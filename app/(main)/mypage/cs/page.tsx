import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CsThreadClient from './CsThreadClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '고객센터 메시지',
}

/**
 * /mypage/cs — 사용자 ↔ admin 1:1 양방향 thread.
 *
 * 진입 시 어드민이 보낸 미확인 메시지를 일괄 read 처리. 그 다음 메시지 list 와
 * reply 입력 form 을 client component (CsThreadClient) 에서 렌더.
 *
 * 메시지가 없으면 "아직 받은 메시지가 없어요" empty state.
 */
export default async function CustomerSupportPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/cs')

  // 미확인 admin 메시지 read 처리. RLS 가 자기 thread 만 허용.
  await supabase
    .from('cs_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('sender', 'admin')
    .is('read_at', null)

  const { data } = await supabase
    .from('cs_messages')
    .select('id, sender, body, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(100)

  type Msg = {
    id: string
    sender: 'admin' | 'user'
    body: string
    read_at: string | null
    created_at: string
  }
  const messages = ((data ?? []) as unknown) as Msg[]

  return <CsThreadClient initial={messages} />
}
