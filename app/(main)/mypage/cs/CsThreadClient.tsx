'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, MessageCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type Msg = {
  id: string
  sender: 'admin' | 'user'
  body: string
  read_at: string | null
  created_at: string
}

/**
 * 사용자 ↔ admin 1:1 CS thread UI.
 *
 * 좌측(어드민) / 우측(나) 챗 bubble 패턴. 입력 → POST /api/cs/reply → optimistic
 * append. 새 메시지마다 자동 스크롤.
 */
export default function CsThreadClient({ initial }: { initial: Msg[] }) {
  const toast = useToast()
  const [messages, setMessages] = useState<Msg[]>(initial)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const threadEndRef = useRef<HTMLDivElement | null>(null)

  // 스크롤 자동 맨 아래.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  async function send() {
    const text = input.trim().slice(0, 2000)
    if (!text || sending) return
    setSending(true)
    // optimistic — 전송 즉시 thread 에 표시.
    const tempId = `temp-${Date.now()}`
    const optimistic: Msg = {
      id: tempId,
      sender: 'user',
      body: text,
      read_at: null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setInput('')

    try {
      const res = await fetch('/api/cs/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'failed')
      }
      // 성공 — 그대로 두고 다음 GET 에서 정확한 ID 로 교체될 것.
    } catch (err) {
      toast.error('보내지 못했어요', {
        description: err instanceof Error ? err.message : undefined,
      })
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="pb-32 min-h-screen flex flex-col">
      {/* 헤더 */}
      <section className="px-5 pt-6 pb-3">
        <h1
          className="font-sans mt-3"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          고객센터 메시지
        </h1>
        <p className="text-[10.5px] text-muted mt-1">
          궁금하거나 불편한 점은 직접 답장으로 알려주세요.
        </p>
      </section>

      {/* thread */}
      <section className="flex-1 px-5 mt-3">
        {messages.length === 0 ? (
          <div className="bg-bg-3 rounded border border-rule p-8 text-center">
            <MessageCircle
              className="w-9 h-9 text-muted mx-auto mb-3"
              strokeWidth={1.3}
            />
            <p className="text-[12px] text-muted">
              아직 받은 메시지가 없어요.
            </p>
            <p className="text-[10.5px] text-muted/70 mt-1">
              궁금한 점이 있으면 아래 입력창에 자유롭게 남겨주세요.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
            <div ref={threadEndRef} />
          </ul>
        )}
      </section>

      {/* 입력 form — sticky bottom */}
      <section className="sticky bottom-[calc(88px+env(safe-area-inset-bottom))] z-10 px-5 mt-4">
        <div className="bg-bg-3 rounded border border-rule px-4 py-3 shadow-sm">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 2000))}
            placeholder="메시지를 입력해 주세요"
            rows={2}
            maxLength={2000}
            className="w-full text-[13.5px] text-text placeholder:text-muted/60 focus:outline-none resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10.5px] text-muted">
              영업일 기준 24시간 이내 답변 드려요
            </span>
            <button
              type="button"
              onClick={send}
              disabled={sending || !input.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-terracotta text-white text-[10.5px] font-bold active:scale-[0.97] transition disabled:opacity-50"
            >
              {sending ? (
                <>
                  <Loader2
                    className="w-3 h-3 animate-spin"
                    strokeWidth={2}
                  />
                  보내는 중
                </>
              ) : (
                <>
                  <Send className="w-3 h-3" strokeWidth={2.5} />
                  보내기
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function Bubble({ message }: { message: Msg }) {
  const mine = message.sender === 'user'
  return (
    <li className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded px-3.5 py-2.5 ${
          mine
            ? 'bg-terracotta text-white rounded-br-md'
            : 'bg-bg-3 border border-rule text-text rounded-bl-md'
        }`}
      >
        {!mine && (
          <p className="text-[9.5px] font-bold text-terracotta uppercase tracking-widest mb-0.5">
            파머스테일
          </p>
        )}
        <p className="text-[12px] leading-relaxed whitespace-pre-wrap break-keep">
          {message.body}
        </p>
        <p
          className={`text-[9.5px] mt-1 ${
            mine ? 'text-white/70' : 'text-muted'
          }`}
        >
          {new Date(message.created_at).toLocaleString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </li>
  )
}
