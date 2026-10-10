'use client'

import { useState, useRef, useEffect, type RefObject } from 'react'
import { userFacingError } from '@/lib/error-message'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/v3'
import type { ChatNudge } from '@/lib/chat/proactive-nudges'
import { V3 } from '@/lib/design/tokens'
import DogPawMark from '@/components/DogPawMark'

/**
 * AI 영양사 chat client (history 보존 thread).
 *
 * - mount 시 GET /api/chatbot?dogId=... 로 최근 30개 history 로드
 * - 사용자 질문 → POST /api/chatbot → reply
 * - 둘 다 thread 에 append
 * - 강아지 select 변경 시 conversation 분리 (다시 fetch)
 * - "대화 지우기" 버튼 — DELETE 호출 + thread 비움
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 A13·A12·I04·I05):
 *   그리는 부분을 ChatView 로 나눴다(같은 파일) — 불러오기·보내기(스트림)·지우기 로직은 ChatClient 그대로.
 *   점검 화면(/design-check/analysis)이 ChatView 에 예시 대화·오류를 넣어 로그인 없이 본다.
 *   · 강아지 칩: 알약 → 48px 네모(고른 것 = 먹색). '🐶' 이모지 → 발바닥 원(사진이 오면 사진).
 *   · 질문 예시: 알약 → 52px 네모 버튼 세로 목록. 내 말풍선 = 옅은 주황, 답 말풍선 = 흰 바탕 먹선.
 *   · 오류 안내는 대화 아래·입력창 위 한 곳(빨간 면). 예전엔 대화가 하나도 없을 때(첫 질문이 막혔을 때)
 *     오류 칸이 그려지지 않아 아무 말 없이 질문만 입력창에 돌아왔다.
 */

export type Message = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

export type ChatDog = { id: string; name: string; photoUrl?: string | null }

const SUGGESTIONS = [
  '닭고기 알레르기 있는 강아지에게 뭐 먹여요?',
  '저희 아이가 좀 통통한 편인데 어떤 영양이 좋을까요?',
  '관절 안 좋은 노견 식단 추천해 주세요',
  '신선한 채소 어디까지 줘도 되나요?',
] as const

export default function ChatClient({
  dogs,
}: {
  dogs: ChatDog[]
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
        throw new Error(data.message ?? '응답을 받지 못했어요')
      }

      // SSE 파싱 — data: <JSON>\n\n  형식. {delta} 또는 [DONE].
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let aborted = false
      // ★스트림 중 오류·빈 답변을 삼키지 않는다(2026-09-26 점검 7차). 예전엔 안쪽 try 가
      //   throw 를 잡아 console 로만 보내 빈(또는 잘린) 말풍선만 남았다.
      let streamError: string | null = null
      let received = ''
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
              streamError = obj.error
              continue
            }
            if (obj.delta) {
              received += obj.delta
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
      if (!received) {
        // 한 글자도 못 받았으면 실패로 — 아래 catch 가 말풍선을 치우고 안내한다.
        throw new Error(streamError ?? '답변을 받지 못했어요. 다시 물어봐 주세요.')
      }
      if (streamError) {
        // 일부만 받았으면 받은 데까지 두고 끊겼다고 덧붙인다.
        const note = `\n\n(${streamError})`
        setMessages((prev) => {
          const next = prev.slice()
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + note }
          }
          return next
        })
      }
    } catch (err) {
      if (sentDogKey !== selectedDogId) return
      setError(userFacingError(err, '잠시 문제가 있었어요. 다시 시도해 주세요'))
      // 실패 시 user + 빈 assistant placeholder 둘 다 제거.
      setMessages((prev) => prev.slice(0, -2))
      // 쓴 질문은 되돌린다 — 입력창을 먼저 비워 두었다(2026-09-26).
      setInput((cur) => (cur.trim() ? cur : text))
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
    <ChatView
      dogs={dogs}
      selectedDogId={selectedDogId}
      onSelectDog={setSelectedDogId}
      messages={messages}
      historyLoading={historyLoading}
      loading={loading}
      error={error}
      nudge={nudge && !nudgeDismissed ? nudge : null}
      onDismissNudge={dismissNudge}
      onUseNudgePrompt={(p) => setInput(p)}
      input={input}
      onInputChange={setInput}
      onSend={(t) => void send(t)}
      onClearHistory={() => void clearHistory()}
      threadEndRef={threadEndRef}
    />
  )
}

/** 그리기 — 상태는 위 ChatClient 가 들고 있다. 점검 화면이 예시 상태를 넣어 쓴다. */
export function ChatView({
  dogs,
  selectedDogId,
  onSelectDog,
  messages,
  historyLoading,
  loading,
  error,
  nudge,
  onDismissNudge,
  onUseNudgePrompt,
  input,
  onInputChange,
  onSend,
  onClearHistory,
  threadEndRef,
}: {
  dogs: ChatDog[]
  selectedDogId: string
  onSelectDog: (id: string) => void
  messages: Message[]
  historyLoading: boolean
  loading: boolean
  error: string | null
  /** 보여 줄 안내(닫았으면 null). */
  nudge: ChatNudge | null
  onDismissNudge: () => void
  onUseNudgePrompt: (prompt: string) => void
  input: string
  onInputChange: (v: string) => void
  onSend: (text: string) => void
  onClearHistory: () => void
  threadEndRef?: RefObject<HTMLDivElement | null>
}) {
  return (
    <>
      {/* 강아지 선택 */}
      {dogs.length > 0 && (
        <section aria-label="강아지 선택" style={{ margin: '22px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute }}>강아지 선택</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <DogChip label="일반" active={selectedDogId === ''} onClick={() => onSelectDog('')} />
            {dogs.map((d) => (
              <DogChip
                key={d.id}
                label={d.name}
                active={selectedDogId === d.id}
                onClick={() => onSelectDog(d.id)}
                photo={d.photoUrl ?? null}
                withAvatar
              />
            ))}
          </div>
        </section>
      )}

      {/* 대화 thread */}
      <section
        aria-label="대화"
        style={{
          margin: '26px 20px 0',
          paddingTop: 18,
          borderTop: `1px solid ${V3.rule}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {historyLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0', fontSize: 15, color: V3.inkMute }}>
            <Spinner size={14} />
            대화를 불러오는 중...
          </div>
        ) : messages.length === 0 ? (
          <>
            {/* 능동 개입 nudge — assistant 톤 카드. dismiss 24h. CTA 가 있으면
                input 에 자동 주입하지만, 사용자가 그대로 send 할지 직접
                고치든 자유 — 자율성 유지 (voice-guidelines §5). */}
            {nudge && (
              <div
                aria-label="영양 도우미 안내"
                style={{
                  padding: 16,
                  borderRadius: 4,
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr',
                  columnGap: 12,
                  background: V3.soft,
                  borderLeft: `6px solid ${V3.mustard}`,
                }}
              >
                <SparkAvatar />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, wordBreak: 'keep-all' }}>{nudge.message}</p>
                  <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    {nudge.promptSuggestion && (
                      <button
                        type="button"
                        onClick={() => onUseNudgePrompt(nudge.promptSuggestion ?? '')}
                        style={{
                          height: 44,
                          padding: '0 14px',
                          border: 0,
                          borderRadius: 4,
                          background: V3.ink,
                          color: '#FFFFFF',
                          fontSize: 15,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        이 질문으로 시작
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onDismissNudge}
                      style={{
                        height: 44,
                        padding: '0 4px',
                        border: 0,
                        background: 'transparent',
                        color: V3.inkMute,
                        fontSize: 15,
                        fontWeight: 700,
                        textDecoration: 'underline',
                        textUnderlineOffset: 4,
                        cursor: 'pointer',
                      }}
                    >
                      괜찮아요
                    </button>
                  </span>
                </span>
              </div>
            )}

            <span style={{ marginTop: nudge ? 6 : 0, fontSize: 14, fontWeight: 700, color: V3.inkMute }}>이런 질문은 어때요?</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSend(s)}
                  disabled={loading}
                  style={{
                    minHeight: 52,
                    padding: '10px 14px',
                    border: '1.5px solid #D5D3D4',
                    borderRadius: 4,
                    background: '#FFFFFF',
                    color: V3.ink,
                    fontSize: 16,
                    fontWeight: 600,
                    lineHeight: 1.45,
                    textAlign: 'left',
                    cursor: 'pointer',
                    wordBreak: 'keep-all',
                  }}
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
              <div role="status" style={{ display: 'flex', gap: 10 }}>
                <SparkAvatar />
                <span
                  style={{
                    padding: '12px 14px',
                    borderRadius: 4,
                    border: `1.5px solid ${V3.ink}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 16,
                    color: V3.inkMute,
                  }}
                >
                  <Spinner size={14} />
                  답변을 생각하고 있어요...
                </span>
              </div>
            )}
            {/* 자동 스크롤 표식 — 묶음 간격(14)을 먹지 않게 위로 당긴다. */}
            <div ref={threadEndRef} style={{ marginTop: -14, height: 0 }} />
            {messages.length >= 2 && !loading && (
              <button
                type="button"
                onClick={onClearHistory}
                style={{
                  alignSelf: 'flex-start',
                  height: 48,
                  padding: '0 8px 0 0',
                  border: 0,
                  background: 'transparent',
                  color: V3.inkMute,
                  fontSize: 15,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                </svg>
                이 대화 지우기
              </button>
            )}
          </>
        )}
      </section>

      {/* 오류 — 대화 아래·입력창 위 한 곳(대화가 비어 있어도 보인다). */}
      {error && (
        <div
          role="alert"
          style={{
            margin: '14px 20px 0',
            padding: '12px 14px',
            borderRadius: 4,
            background: '#FBE7E2',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <span style={{ flexShrink: 0, marginTop: 2 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={V3.sale} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5.5" />
              <circle cx="12" cy="16.4" r="0.9" fill={V3.sale} />
            </svg>
          </span>
          <span style={{ fontSize: 16, lineHeight: 1.55, fontWeight: 600, color: '#7A2A1E', wordBreak: 'keep-all' }}>{error}</span>
        </div>
      )}

      {/* 입력 폼 — 항상 하단 */}
      <section
        aria-label="질문 쓰기"
        className="sticky bottom-[calc(var(--ft-tabbar-h,68px)+16px+env(safe-area-inset-bottom))] z-10"
        style={{ margin: '14px 20px 0' }}
      >
        <div
          style={{
            padding: 14,
            border: `2px solid ${V3.ink}`,
            borderRadius: 4,
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value.slice(0, 500))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                onSend(input)
              }
            }}
            rows={2}
            aria-label="AI 영양 도우미에게 질문 입력"
            placeholder={
              messages.length === 0
                ? '우리 아이 식이에 대해 궁금한 점을 적어주세요...'
                : '이어서 질문하기...'
            }
            className="w-full focus:outline-none resize-none placeholder:text-[#8A8A8A]"
            style={{ minHeight: 52, border: 0, padding: 0, fontSize: 17, lineHeight: 1.5, color: V3.ink, background: 'transparent' }}
          />
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: V3.inkMute }}>{input.length}/500</span>
            <button
              type="button"
              onClick={() => onSend(input)}
              disabled={!input.trim() || loading}
              style={{
                height: 48,
                padding: '0 18px',
                border: 0,
                borderRadius: 4,
                background: V3.ink,
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: !input.trim() || loading ? 0.4 : 1,
                cursor: 'pointer',
              }}
            >
              {loading ? (
                <>
                  <Spinner size={14} />
                  생각 중
                </>
              ) : (
                <>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 12l16-8-6 16-3-7z" />
                  </svg>
                  보내기
                </>
              )}
            </button>
          </span>
        </div>
      </section>
    </>
  )
}

/** 영양 도우미 동그라미 — 먹색 원 + 흰 반짝이(시안 A12·A13). */
function SparkAvatar() {
  return (
    <span
      aria-hidden
      style={{
        flexShrink: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        background: V3.ink,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFFFFF">
        <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      </svg>
    </span>
  )
}

function DogChip({
  label,
  active,
  onClick,
  photo = null,
  withAvatar = false,
}: {
  label: string
  active: boolean
  onClick: () => void
  photo?: string | null
  withAvatar?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="ft-no-press"
      style={{
        height: 48,
        padding: withAvatar ? '0 16px 0 8px' : '0 16px',
        border: `1.5px solid ${active ? V3.ink : '#D5D3D4'}`,
        borderRadius: 4,
        background: active ? V3.ink : '#FFFFFF',
        color: active ? '#FFFFFF' : V3.ink,
        fontSize: 16,
        fontWeight: active ? 800 : 700,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
      }}
    >
      {withAvatar &&
        (photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" style={{ width: 30, height: 30, borderRadius: 15, objectFit: 'cover', display: 'block' }} />
        ) : (
          <span
            aria-hidden
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              background: V3.soft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DogPawMark size={17} color={V3.inkFaint} />
          </span>
        ))}
      {label}
    </button>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: 10 }}>
      {isUser ? (
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: 16,
            background: V3.soft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={V3.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
          </svg>
        </span>
      ) : (
        <SparkAvatar />
      )}
      <p
        style={{
          margin: 0,
          // 시안처럼 최대 폭은 글자 칸 기준(content-box) — 여백·선은 그 바깥.
          boxSizing: 'content-box',
          maxWidth: isUser ? '78%' : '82%',
          minWidth: 0,
          padding: '12px 14px',
          borderRadius: 4,
          background: isUser ? V3.cream : '#FFFFFF',
          border: isUser ? 0 : `1.5px solid ${V3.ink}`,
          color: V3.ink,
          fontSize: 17,
          lineHeight: isUser ? 1.6 : 1.65,
          whiteSpace: 'pre-line',
          wordBreak: 'keep-all',
          overflowWrap: 'anywhere',
        }}
      >
        <span className="sr-only">{isUser ? '나: ' : 'AI 영양 도우미: '}</span>
        {message.content}
      </p>
    </div>
  )
}
