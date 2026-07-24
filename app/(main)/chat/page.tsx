import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ChatClient from './ChatClient'

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
    <div className="pb-10">
      {/* Hero */}
      <section className="px-5 pt-6">
        <div
          className="relative overflow-hidden rounded-[12px] px-6 pt-6 pb-7 text-white"
          style={{
            background:
              'linear-gradient(135deg, var(--moss) 0%, var(--sage-soft) 100%)',
          }}
        >
          <div
            aria-hidden
            className="absolute -top-12 -right-10 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: 'rgba(255,255,255,0.10)' }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-gold" strokeWidth={2} />
              <span className="kicker kicker-gold">AI</span>
            </div>
            <h1
              className="font-sans leading-tight"
              style={{
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              궁금한 게 있나요?
            </h1>
            <p className="text-[12px] text-white/80 mt-2 leading-relaxed">
              식이 · 알레르기 · 영양에 대해 물어보세요.
              <br />
              NRC / FEDIAF 기반 답변.
            </p>
          </div>
        </div>
      </section>

      <ChatClient
        dogs={(dogs ?? []) as Array<{ id: string; name: string }>}
      />

      <section className="px-5 mt-6">
        <div className="rounded bg-bg-2 px-4 py-3 text-[10.5px] text-muted leading-relaxed">
          <p className="font-bold text-text mb-1">⚠️ 주의</p>
          <p>
            AI 상담은 수의사 진료를 대체하지 않아요. 의학적 진단·처방·응급 상황은
            반드시 수의사를 만나주세요. 답변은 일반 영양 가이드 참고용이에요.
          </p>
        </div>
      </section>
    </div>
  )
}
