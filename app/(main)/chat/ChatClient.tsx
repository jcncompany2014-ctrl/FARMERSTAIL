'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Send,
  Sparkles,
  Loader2,
  AlertCircle,
  Trash2,
  User as UserIcon,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/v3'
import type { ChatNudge } from '@/lib/chat/proactive-nudges'

/**
 * AI 영양사 chat client (history 보존 thread).
 *
 * - mount 시 GET /api/chatbot?dogId=... 로 최근 30개 history 로드
 * - 사용자 질문 → POST /api/chatbot → reply
 * - 둘 다 thread 에 append
 * - 강아지 select 변경 시 conversation 분리 (다시 fetch)
 * - "대화 지우기" 버튼 — DELETE 호출 + thread 비움
 */

type Message = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

const SUGGESTIONS = [
  '닭고기 알레르기 있는 강아지에게 뭐 먹여요?',
  '저희 아이 BCS 7 인데 어떤 영양이 좋을까요?',
  '관절 안 좋은 노견 식단 추천해 주세요',
  '신선한 채소 어디까지 줘도 되나요?',
] as const

export default function ChatClient({
  dogs,
}: {
  dogs: Array<{ id: string; name: string }>
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [input, setInput] = useState('')
  const [selectedDogId, setSelectedDogId] = useState<string>(
    dogs[0]?.id ?? '',
  )
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const threadEndRef = useRef<HTMLDivElement | null>(null)
  // 챗봇 능동 개입 — history 0건일 때만 1건 nudge 표시. 사용자 입력
  // 1건이라도 들어오면 자동 hide (messages.length > 0).
  // dogId 별 24h dismiss 는 localStorage.
  const [nudge, setNudge] = useState<ChatNudge | null>(null)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)

  // history 로드 (selectedDogId 변경 시마다 다시)
  useEffect(() => {
    let cancelled = false
    setHistoryLoading(true)
    setError(null)
    setMessages([])
    setNudge(null)

    // 24h dismiss 키 — dogId 별 별도
    const dismissKey = `ft:chat-nudge:dismiss:${selectedDogId || 'general'}`
    let dismissed = false
    try {
      const ts = Number(localStorage.getItem(dismissKey))
      if (Number.isFinite(ts) && Date.now() - ts < 24 * 3600 * 1000) {
        dismissed = true
      }
    } catch {
      /* localStorage 차단 환경은 그냥 보여줌 */
    }
    setNudgeDismissed(dismissed)

    ;(async () => {
      try {
        const url = selectedDogId
          ? `/api/chatbot?dogId=${selectedDogId}`
          : '/api/chatbot'
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { messages: Message[] }
        if (cancelled) return
        const list = data.messages ?? []
        setMessages(list)
        // history 가 비어있고 dismiss 안 됐을 때만 nudge fetch
        if (list.length === 0 && !dismissed) {
          try {
            const nudgeUrl = selectedDogId
              ? `/api/chatbot/nudge?dogId=${selectedDogId}`
              : '/api/chatbot/nudge'
            const nres = await fetch(nudgeUrl, { cache: 'no-store' })
            if (nres.ok && !cancelled) {
              const nd = (await nres.json()) as { nudge: ChatNudge | null }
              setNudge(nd.nudge ?? null)
            }
          } catch {
            /* nudge fetch 실패 — silent */
          }
        }
      } catch {
        // history 로드 실패는 silent — 새 대화로 시작
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedDogId])

  function dismissNudge() {
    setNudgeDismissed(true)
    try {
      const key = `ft:chat-nudge:dismiss:${selectedDogId || 'general'}`
      localStorage.setItem(key, String(Date.now()))
    } catch {
      /* noop */
    }
  }

  // 새 메시지 도착 시 자동 스크롤
  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages.length, loading])

  async function send(message: string) {
    const text = message.trim().slice(0, 500)
    if (!text || loading) return
    // 현재 대화 key (dogId or '') snapshot. fetch 도중 사용자가 강아지를
    // 전환하면 response 가 엉뚱한 대화에 append 되는 race 방지용.
    const sentDogKey = selectedDogId
    setLoading(true)
    setError(null)
    // optimistic — user message + 빈 assistant placeholder
    // R17-C30: streaming 패턴 — placeholder 의 content 를 chunk 마다 append.
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ])
    setInput('')
    try {
      const res = await fetch('/api/chatbot/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          dogId: selectedDogId || undefined,
        }),
      })
      if (!res.ok || !res.body) {
        const data = (await res
          .json()
          .catch(() => ({}))) as { message?: string }
        throw new Error(data.message ?? '응답에 실패했어요')
      }

      // SSE 파싱 — data: <JSON>\n\n  형식. {delta} 또는 [DONE].
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let aborted = false
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        if (sentDogKey !== selectedDogId) {
          aborted = true
          break
        }
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const ev of events) {
          const m = /^data:\s*(.+)$/m.exec(ev)
          if (!m) continue
          const body = m[1]
          if (!body || body === '[DONE]') continue
          try {
            const obj = JSON.parse(body) as { delta?: string; error?: string }
            if (obj.error) {
              throw new Error(obj.error)
            }
            if (obj.delta) {
              setMessages((prev) => {
                const next = prev.slice()
                const last = next[next.length - 1]
                if (last && last.role === 'assistant') {
                  next[next.length - 1] = {
                    ...last,
                    content: last.content + obj.delta,
                  }
                }
                return next
              })
            }
          } catch (e) {
            console.error('chatbot stream parse', e)
          }
        }
      }
      if (aborted) return
    } catch (err) {
      if (sentDogKey !== selectedDogId) return
      setError(err instanceof Error ? err.message : '잠시 문제가 있었어요. 다시 시도해 주세요')
      // 실패 시 user + 빈 assistant placeholder 둘 다 제거.
      setMessages((prev) => prev.slice(0, -2))
    } finally {
      // loading 은 stale 하더라도 항상 false 로 — 다음 send 가능하게.
      setLoading(false)
    }
  }

  async function clearHistory() {
    const ok = await confirm({
      title: '이 대화를 삭제할까요?',
      body: '되돌릴 수 없어요.',
      confirmLabel: '삭제',
      tone: 'destructive',
    })
    if (!ok) return
    try {
      const url = selectedDogId
        ? `/api/chatbot?dogId=${selectedDogId}`
        : '/api/chatbot'
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) throw new Error('삭제 실패')
      setMessages([])
      toast.success('대화를 지웠어요')
    } catch {
      toast.error('삭제하지 못했어요')
    }
  }

  return (
    <>
      {/* 강아지 선택 */}
      {dogs.length > 0 && (
        <section className="px-5 mt-3">
          <div className="text-[10.5px] font-bold text-muted uppercase tracking-widest mb-1.5">
            강아지 선택
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedDogId('')}
              className="px-3 py-1.5 rounded-full text-[11px] font-bold transition"
              style={{
                background: selectedDogId === '' ? 'var(--ink)' : 'white',
                color: selectedDogId === '' ? 'white' : 'var(--text)',
                border: '1px solid var(--rule)',
              }}
            >
              일반
            </button>
            {dogs.map((d) => {
              const active = selectedDogId === d.id
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDogId(d.id)}
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold transition"
                  style={{
                    background: active ? 'var(--ink)' : 'white',
                    color: active ? 'white' : 'var(--text)',
                    border: '1px solid var(--rule)',
                  }}
                >
                  🐶 {d.name}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* 대화 thread */}
      <section className="px-5 mt-4 space-y-3">
        {historyLoading ? (
          <div className="flex items-center gap-2 text-[12px] text-muted py-6 justify-center">
            <Spinner size={14} />
            대화를 불러오는 중...
          </div>
        ) : messages.length === 0 ? (
          <>
            {/* 능동 개입 nudge — assistant 톤 카드. dismiss 24h. CTA 가 있으면
                input 에 자동 주입하지만, 사용자가 그대로 send 할지 직접
                고치든 자유 — 자율성 유지 (voice-guidelines §5). */}
            {nudge && !nudgeDismissed && (
              <div
                className="rounded border-2 px-4 py-3"
                style={{
                  background: 'color-mix(in srgb, var(--terracotta) 5%, white)',
                  borderColor:
                    'color-mix(in srgb, var(--terracotta) 28%, transparent)',
                }}
                aria-label="영양사 도우미 안내"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--terracotta)', color: 'white' }}
                    aria-hidden
                  >
                    <Sparkles className="w-3.5 h-3.5" strokeWidth={2.2} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[12.5px] leading-relaxed"
                      style={{ color: 'var(--ink)' }}
                    >
                      {nudge.message}
                    </p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {nudge.promptSuggestion && (
                        <button
                          type="button"
                          onClick={() => {
                            setInput(nudge.promptSuggestion ?? '')
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold text-white"
                          style={{ background: 'var(--terracotta)' }}
                        >
                          이 질문으로 시작
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={dismissNudge}
                        className="text-[11px] font-bold text-muted hover:text-text transition"
                      >
                        괜찮아요
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="text-[10.5px] font-bold text-muted uppercase tracking-widest">
              이런 질문은 어때요?
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-full text-[11px] text-text bg-bg-2 border border-rule hover:border-text transition text-left max-w-full"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {messages.map((m, i) => (
              <MessageBubble key={m.id ?? `${i}-${m.role}`} message={m} />
            ))}
            {loading && (
              <div
                className="rounded border-2 px-4 py-3"
                style={{
                  background: 'color-mix(in srgb, var(--moss) 4%, white)',
                  borderColor:
                    'color-mix(in srgb, var(--moss) 35%, transparent)',
                }}
              >
                <div className="flex items-center gap-2 text-[12px] text-muted">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  답변을 생각하고 있어요...
                </div>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 text-[12px] text-sale rounded bg-sale/8 px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div ref={threadEndRef} />
            {messages.length >= 2 && !loading && (
              <button
                type="button"
                onClick={clearHistory}
                className="inline-flex items-center gap-1 text-[10.5px] text-muted hover:text-sale transition"
              >
                <Trash2 className="w-3 h-3" strokeWidth={2} />
                이 대화 지우기
              </button>
            )}
          </>
        )}
      </section>

      {/* 입력 폼 — 항상 하단 */}
      <section className="px-5 mt-4 sticky bottom-[calc(88px+env(safe-area-inset-bottom))] z-10">
        <div className="bg-bg-3 rounded border border-rule px-4 py-3 shadow-sm">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 500))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void send(input)
              }
            }}
            rows={2}
            placeholder={
              messages.length === 0
                ? '우리 아이 식이에 대해 궁금한 점을 적어주세요...'
                : '이어서 질문하기...'
            }
            className="w-full text-[16px] text-text placeholder:text-muted/60 focus:outline-none resize-none"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] text-muted">
              {input.length}/500
            </span>
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold transition disabled:opacity-40"
              style={{ background: 'var(--terracotta)', color: 'white' }}
            >
              {loading ? (
                <>
                  <Loader2
                    className="w-3.5 h-3.5 animate-spin"
                    strokeWidth={2}
                  />
                  생각 중
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" strokeWidth={2.5} />
                  보내기
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div
      className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5`}
        style={{
          background: isUser
            ? 'var(--bg-2)'
            : 'color-mix(in srgb, var(--moss) 12%, white)',
        }}
      >
        {isUser ? (
          <UserIcon
            className="w-3.5 h-3.5 text-text"
            strokeWidth={2}
          />
        ) : (
          <Sparkles
            className="w-3.5 h-3.5"
            style={{ color: 'var(--moss)' }}
            strokeWidth={2}
          />
        )}
      </div>
      <div
        className={`flex-1 min-w-0 max-w-[80%] rounded px-3.5 py-2.5 ${
          isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'
        }`}
        style={{
          background: isUser
            ? 'white'
            : 'color-mix(in srgb, var(--moss) 4%, white)',
          border: isUser
            ? '1px solid var(--rule)'
            : '1px solid color-mix(in srgb, var(--moss) 35%, transparent)',
        }}
      >
        <p className="text-[13px] text-text leading-relaxed whitespace-pre-line">
          {message.content}
        </p>
      </div>
    </div>
  )
}
