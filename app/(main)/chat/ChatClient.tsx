'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Loader2, AlertCircle } from 'lucide-react'

/**
 * AI 영양사 chat client (stateless single-turn).
 *
 * - 사용자가 질문 입력 → POST /api/chatbot → 응답 표시
 * - 강아지 select (있으면) — 컨텍스트로 함께 전송
 * - 추천 질문 chip — 시작 시 사용자 질문 거리 안내
 * - history X — 매 질문 독립 (구현 단순화)
 */

const SUGGESTIONS = [
  '닭고기 알러지 있는 강아지에게 뭐 먹여요?',
  '저희 아이 BCS 7 인데 어떤 영양이 좋을까요?',
  '관절 안 좋은 노견 식단 추천해 주세요',
  '신선한 채소 어디까지 줘도 되나요?',
] as const

export default function ChatClient({
  dogs,
}: {
  dogs: Array<{ id: string; name: string }>
}) {
  const [input, setInput] = useState('')
  const [selectedDogId, setSelectedDogId] = useState<string>(
    dogs[0]?.id ?? '',
  )
  const [reply, setReply] = useState<string | null>(null)
  const [question, setQuestion] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const replyRef = useRef<HTMLDivElement | null>(null)

  // 응답 도착 시 자동 스크롤
  useEffect(() => {
    if (reply && replyRef.current) {
      replyRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [reply])

  async function send(message: string) {
    const text = message.trim().slice(0, 500)
    if (!text || loading) return
    setLoading(true)
    setError(null)
    setReply(null)
    setQuestion(text)
    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          dogId: selectedDogId || undefined,
        }),
      })
      const data = (await res.json()) as { reply?: string; message?: string }
      if (!res.ok) {
        throw new Error(data.message ?? '응답에 실패했어요')
      }
      setReply(data.reply ?? '')
      setInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했어요')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* 강아지 선택 (있을 때만) */}
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

      {/* 입력 폼 */}
      <section className="px-5 mt-4">
        <div className="bg-white rounded-2xl border border-rule px-4 py-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 500))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                send(input)
              }
            }}
            rows={3}
            placeholder="우리 아이 식이에 대해 궁금한 점을 적어주세요..."
            className="w-full text-[13px] text-text placeholder:text-muted/60 focus:outline-none resize-none"
          />
          <div className="mt-2 flex items-center justify-between">
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

      {/* 추천 질문 (응답 없을 때만) */}
      {!reply && !loading && !error && (
        <section className="px-5 mt-4">
          <div className="text-[10.5px] font-bold text-muted uppercase tracking-widest mb-2">
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
        </section>
      )}

      {/* 응답 영역 */}
      {(reply || loading || error) && (
        <section ref={replyRef} className="px-5 mt-5">
          {/* 사용자 질문 */}
          {question && (
            <div
              className="bg-white rounded-2xl border border-rule px-4 py-3 mb-3"
              style={{ borderLeft: '3px solid var(--rule-2)' }}
            >
              <div className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">
                You
              </div>
              <p className="text-[12.5px] text-text leading-relaxed whitespace-pre-line">
                {question}
              </p>
            </div>
          )}

          {/* AI 응답 */}
          <div
            className="rounded-2xl border-2 px-4 py-4"
            style={{
              background: 'color-mix(in srgb, var(--moss) 4%, white)',
              borderColor: 'color-mix(in srgb, var(--moss) 35%, transparent)',
            }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles
                className="w-3.5 h-3.5"
                style={{ color: 'var(--moss)' }}
                strokeWidth={2}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--moss)' }}
              >
                AI 영양사
              </span>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-[12px] text-muted py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                답변을 생각하고 있어요...
              </div>
            ) : error ? (
              <div className="flex items-start gap-2 text-[12px] text-sale">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : reply ? (
              <p className="text-[13px] text-text leading-relaxed whitespace-pre-line">
                {reply}
              </p>
            ) : null}
          </div>

          {/* 다시 묻기 */}
          {reply && !loading && (
            <button
              type="button"
              onClick={() => {
                setReply(null)
                setQuestion(null)
                setInput('')
              }}
              className="w-full mt-3 py-2.5 rounded-xl border border-rule text-[12px] font-bold text-text hover:border-text transition"
            >
              새 질문 하기
            </button>
          )}
        </section>
      )}
    </>
  )
}
