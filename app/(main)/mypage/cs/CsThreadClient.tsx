'use client'

import { useEffect, useRef, useState } from 'react'
import { userFacingError } from '@/lib/error-message'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { formatKstDateTime } from '@/lib/datetime-kst'
import { V3, V3Radius } from '@/lib/design/tokens'
import { MeCss } from '@/components/v3/me/MeParts'
import { ChatBubbleIcon, SendIcon } from '@/components/v3/me/MeIcons'

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
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 시안 C01 · C02): 받은 말풍선 = 회색 면(왼쪽 위 모서리 4), 내 말풍선 =
 *   크림색(오른쪽 위 모서리 4) · 아래 고정 입력 칸 = 1.5px 먹선 상자 + 먹색 '보내기'. 영어 대문자 머리말·테라코타
 *   색은 뺐다. 시간은 "10.06 14:10" → "10월 6일 오후 2:10"(앱시안 결정). 보내기·되돌리기 로직은 그대로.
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
        // 영문 원본을 보여주느니 아무 말도 안 하는 게 낫다 — 제목이 이미 사유를 말한다.
        description: userFacingError(err, ''),
      })
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      // ★쓴 글을 되돌린다 — 예전엔 입력창을 먼저 비워 최대 2,000자 문의가 통째로 사라졌다(2026-09-26).
      setInput((cur) => (cur.trim() ? cur : text))
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      style={{
        lineHeight: 'normal',
        color: V3.ink,
        wordBreak: 'keep-all',
        minHeight: 'calc(100dvh - var(--ft-header-h, 64px) - var(--ft-tabbar-h, 68px))',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <MeCss />
      <p style={{ margin: '18px 20px 0', fontSize: 16, lineHeight: 1.6, color: V3.inkSoft }}>
        궁금하거나 불편한 점은 직접 답장으로 알려주세요.
      </p>

      {messages.length === 0 ? (
        <div
          style={{
            margin: '18px 20px 0',
            padding: '32px 20px 30px',
            borderRadius: V3Radius.sm,
            background: V3.soft,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 8,
          }}
        >
          <ChatBubbleIcon size={40} color={V3.inkMute} strokeWidth={1.8} />
          <span style={{ marginTop: 4, fontSize: 17, fontWeight: 800 }}>아직 받은 메시지가 없어요</span>
          <span style={{ fontSize: 15, lineHeight: 1.6, color: V3.inkSoft }}>
            궁금한 점이 있으면 아래 입력창에
            <br />
            자유롭게 남겨주세요.
          </span>
        </div>
      ) : (
        <ul
          aria-label="주고받은 메시지"
          style={{ margin: '18px 20px 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {messages.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}
          <div ref={threadEndRef} />
        </ul>
      )}

      <div aria-hidden style={{ flex: 1 }} />

      {/* 입력 form — 아래 탭 바로 위에 붙는다(탭 높이 변수). */}
      <section
        aria-label="메시지 쓰기"
        style={{
          position: 'sticky',
          bottom: 'calc(var(--ft-tabbar-h, 68px) + env(safe-area-inset-bottom))',
          zIndex: 20,
          padding: '14px 20px',
          background: '#FFFFFF',
        }}
      >
        <div
          style={{
            border: `1.5px solid ${V3.ink}`,
            borderRadius: V3Radius.sm,
            padding: '14px 10px 10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background: '#FFFFFF',
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 2000))}
            placeholder="메시지를 입력해 주세요"
            aria-label="메시지"
            rows={2}
            maxLength={2000}
            className="ft-me-cs"
            style={{
              minHeight: 52,
              border: 0,
              padding: 0,
              outline: 'none',
              resize: 'none',
              background: 'transparent',
              fontFamily: 'inherit',
              fontSize: 17,
              lineHeight: 1.5,
              color: V3.ink,
            }}
          />
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 14, color: V3.inkMute }}>영업일 기준 24시간 이내 답변 드려요</span>
            <button
              type="button"
              onClick={send}
              disabled={sending || !input.trim()}
              // 터치 타깃 44px (2026-08-07 감사) — 문의 보내기가 ~28px 였다.
              style={{
                flexShrink: 0,
                height: 44,
                padding: '0 16px',
                border: 0,
                borderRadius: V3Radius.sm,
                background: V3.ink,
                color: '#FFFFFF',
                fontFamily: 'inherit',
                fontSize: 16,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                opacity: sending || !input.trim() ? 0.5 : 1,
              }}
            >
              {sending ? (
                <>
                  <Loader2 className="animate-spin" style={{ width: 18, height: 18 }} strokeWidth={2} />
                  보내는 중
                </>
              ) : (
                <>
                  <SendIcon size={18} strokeWidth={2.2} />
                  보내기
                </>
              )}
            </button>
          </span>
        </div>
      </section>
    </div>
  )
}

/**
 * KST "10월 6일 오후 2:10" (2026-10-09 앱시안 결정 — 예전 "10.06 14:10").
 * toLocaleString 시각은 서버·브라우저 ICU 가 오전/AM 을 다르게 내 hydration mismatch 위험(전수검사 2026-07-25) →
 * 결정적 KST 포맷터(formatKstDateTime "yyyy.mm.dd HH:mm")의 결과를 우리 말 순서로 다시 쓴다.
 */
function formatCsTime(iso: string): string {
  const s = formatKstDateTime(iso)
  const m = /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2})$/.exec(s)
  if (!m) return s
  const h = Number(m[4]) % 24
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${Number(m[2])}월 ${Number(m[3])}일 ${ampm} ${h12}:${m[5]}`
}

function Bubble({ message }: { message: Msg }) {
  const mine = message.sender === 'user'
  return (
    <li style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '82%',
          boxSizing: 'border-box',
          padding: '12px 14px 10px',
          borderRadius: mine ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
          background: mine ? V3.cream : V3.soft,
          color: V3.ink,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {!mine && <span style={{ fontSize: 13, fontWeight: 800 }}>파머스테일</span>}
        <span style={{ fontSize: 16, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'keep-all' }}>{message.body}</span>
        <span style={{ fontSize: 13, color: mine ? V3.inkMute : '#8A8A8A', textAlign: mine ? 'right' : 'left' }}>
          {formatCsTime(message.created_at)}
        </span>
      </div>
    </li>
  )
}
