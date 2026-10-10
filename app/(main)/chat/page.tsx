import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatClient from './ChatClient'
import { ChatCaution, ChatHero } from './ChatParts'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'AI 영양 상담',
  robots: { index: false, follow: false },
}

/**
 * /chat — AI 영양사 간이 상담.
 *
 * stateless single-turn — 사용자가 질문 → AI 답변 (history X).
 * 페이지가 서버에서 강아지 list 가져와 client 가 컨텍스트로 사용.
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 캔버스 A13·A12·I04·I05): 머리·주의 상자는 ChatParts, 대화는 ChatClient(ChatView).
 * 강아지 칩은 사진을 같이 읽어 시안(A13)처럼 사진 원으로 그린다(사진이 없는 아이는 발바닥 원, 2026-10-10).
 */
export default async function ChatPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/chat')

  const { data: dogs, error: dogsErr } = await supabase
    .from('dogs')
    .select('id, name, photo_url')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
  // 조회 실패는 기록만 — 칩 없이도 대화는 된다(예전과 같은 동작).
  if (dogsErr) console.error('[chat] 강아지 목록 조회 실패:', dogsErr.message)

  return (
    // 줄 높이는 시안과 같은 기본값(normal).
    <div style={{ paddingBottom: 28, lineHeight: 'normal' }}>
      <ChatHero />

      <ChatClient
        dogs={((dogs ?? []) as Array<{ id: string; name: string; photo_url: string | null }>).map((d) => ({
          id: d.id,
          name: d.name,
          photoUrl: d.photo_url,
        }))}
      />

      <ChatCaution />
    </div>
  )
}
