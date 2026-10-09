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
 * 조회는 그대로 — 강아지 칩 사진은 이 조회가 id·name 만 읽어 발바닥 원으로 그린다(보고서 참고).
 */
export default async function ChatPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/chat')

  const { data: dogs } = await supabase
    .from('dogs')
    .select('id, name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return (
    // 줄 높이는 시안과 같은 기본값(normal).
    <div style={{ paddingBottom: 28, lineHeight: 'normal' }}>
      <ChatHero />

      <ChatClient
        dogs={(dogs ?? []) as Array<{ id: string; name: string }>}
      />

      <ChatCaution />
    </div>
  )
}
