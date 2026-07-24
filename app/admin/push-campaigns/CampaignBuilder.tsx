'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2, Bell } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type Segment = 'all' | 'inactive_30d' | 'active_subscribers'

const SEGMENTS: { key: Segment; label: string; desc: string }[] = [
  {
    key: 'all',
    label: '전체 구독자',
    desc: '알림을 켠 모든 고객',
  },
  {
    key: 'inactive_30d',
    label: '30일 미주문',
    desc: '마지막 결제 후 30일 넘게 지난 고객 · 재구매 유도용',
  },
  {
    key: 'active_subscribers',
    label: '정기배송 중',
    desc: '정기배송을 1건 이상 진행 중인 고객',
  },
]

/**
 * 푸시 캠페인 작성 form. segment 선택 + title + body + URL.
 *
 * 발송 후 router.refresh() 로 이력 list 즉시 반영.
 */
export default function CampaignBuilder() {
  const router = useRouter()
  const toast = useToast()
  const [segment, setSegment] = useState<Segment>('inactive_30d')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    if (!title.trim() || !body.trim()) {
      toast.error('제목과 본문을 입력해 주세요')
      return
    }
    if (!confirm('정말 일괄 발송할까요? 되돌릴 수 없습니다.')) return

    setSending(true)
    try {
      const res = await fetch('/api/admin/push-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || undefined,
          segment,
        }),
      })
      const data: {
        ok: boolean
        recipientCount?: number
        sent?: number
        failed?: number
        error?: string
        count?: number
        limit?: number
      } = await res.json()

      if (!res.ok || !data.ok) {
        const errLabel: Record<string, string> = {
          unauthorized: '로그인이 필요해요',
          forbidden: '관리자 권한이 없어요',
          url_must_be_relative_path: 'URL 은 / 로 시작하는 경로만 가능해요',
          too_many_recipients: `대상이 너무 많아요 (${data.count}명, 한도 ${data.limit}명)`,
          insert_failed: '캠페인 기록을 저장하지 못했어요',
        }
        toast.error('발송하지 못했어요', {
          description: errLabel[data.error ?? ''] ?? data.error,
        })
        return
      }

      toast.success(
        `${data.recipientCount}명 중 ${data.sent}대에 발송했어요`,
        {
          description:
            data.failed && data.failed > 0
              ? `${data.failed}건 실패`
              : undefined,
        },
      )
      setTitle('')
      setBody('')
      setUrl('')
      router.refresh()
    } catch (err) {
      toast.error('발송하지 못했어요', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-5 space-y-4">
      {/* Segment 선택 */}
      <div>
        <label className="block text-[10px] font-bold text-muted uppercase tracking-[0.15em] mb-1.5">
          보낼 대상
        </label>
        <div className="space-y-1.5">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSegment(s.key)}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition ${
                segment === s.key
                  ? 'border-terracotta bg-terracotta/5'
                  : 'border-zinc-200 hover:border-text'
              }`}
            >
              <p className="text-[12px] font-bold text-text">{s.label}</p>
              <p className="text-[10.5px] text-muted mt-0.5">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-muted uppercase tracking-[0.15em] mb-1.5">
          제목 <span className="text-muted/70">({title.length}/80)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          maxLength={80}
          placeholder="알림 제목"
          className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 bg-[#FDFDFD] text-[13px] focus:outline-none focus:border-terracotta transition"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-muted uppercase tracking-[0.15em] mb-1.5">
          본문 <span className="text-muted/70">({body.length}/240)</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 240))}
          maxLength={240}
          rows={4}
          placeholder="알림 본문 — 자동으로 [광고] 접두어가 붙어요"
          className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 bg-[#FDFDFD] text-[13px] focus:outline-none focus:border-terracotta transition resize-none"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-muted uppercase tracking-[0.15em] mb-1.5">
          이동할 URL (선택)
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="예: /events/welcome (생략 시 알림 센터)"
          className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 bg-[#FDFDFD] text-[13px] focus:outline-none focus:border-terracotta transition"
        />
      </div>

      {(title || body) && (
        <div className="rounded-xl border border-dashed border-zinc-200 p-3.5 bg-zinc-50">
          <div className="flex items-start gap-2">
            <div className="shrink-0 w-8 h-8 rounded-full bg-terracotta flex items-center justify-center">
              <Bell className="w-3.5 h-3.5 text-white" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-muted font-bold">
                Preview · 사용자가 보게 될 모습
              </p>
              <p className="text-[12.5px] font-bold text-text mt-0.5">
                {title ? `[광고] ${title}` : '(제목)'}
              </p>
              <p className="text-[11px] text-muted mt-0.5 line-clamp-3">
                {body || '(본문)'}
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={send}
        disabled={sending || !title.trim() || !body.trim()}
        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-text text-white text-[13px] font-black active:scale-[0.98] transition disabled:opacity-50"
      >
        {sending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
            발송 중...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" strokeWidth={2} />
            일괄 발송
          </>
        )}
      </button>
    </div>
  )
}
