'use client'

import { useState } from 'react'
import { Send, Loader2, Bell } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

const TEMPLATES: { label: string; title: string; body: string }[] = [
  {
    label: '환불 안내',
    title: '환불 안내드려요',
    body: '요청하신 환불을 처리해 드렸어요. 영업일 기준 3~5일 내 환불됩니다.',
  },
  {
    label: '배송 지연',
    title: '배송이 늦어지고 있어요',
    body: '주문하신 상품의 배송이 다소 지연되고 있어요. 빠르게 도착하도록 챙기겠습니다.',
  },
  {
    label: '쿠폰 지급',
    title: '쿠폰을 보내드렸어요',
    body: '불편을 드려 죄송한 마음으로 쿠폰을 보내드렸어요. 마이페이지에서 확인해 주세요.',
  },
  {
    label: '결제 실패',
    title: '정기배송 결제가 실패했어요',
    body: '카드 정보를 확인해 주세요. 마이페이지 > 정기배송에서 다시 시도할 수 있어요.',
  },
]

export default function MessageComposer({ userId }: { userId: string }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [sending, setSending] = useState(false)
  const [lastResult, setLastResult] =
    useState<{ sent: number; dead: number; reason?: string } | null>(null)

  function applyTemplate(t: (typeof TEMPLATES)[number]) {
    setTitle(t.title)
    setBody(t.body)
  }

  async function send() {
    if (!title.trim() || !body.trim()) {
      toast.error('제목과 본문을 입력해 주세요')
      return
    }
    setSending(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || undefined,
        }),
      })
      const data: {
        ok: boolean
        sent?: number
        dead?: number
        reason?: string
        error?: string
      } = await res.json()
      // 4xx/5xx — 입력 검증 실패 등 명시적 에러
      if (!res.ok) {
        const errLabel: Record<string, string> = {
          unauthorized: '로그인이 필요해요',
          forbidden: '관리자 권한이 없어요',
          cannot_message_self: '본인에게는 발송할 수 없어요',
          url_must_be_relative_path: '이동 URL 은 / 로 시작하는 경로만 가능해요',
          user_not_found: '대상 사용자를 찾을 수 없어요',
          title_and_body_required: '제목과 본문을 입력해 주세요',
        }
        toast.error('발송하지 못했어요', {
          description: errLabel[data.error ?? ''] ?? data.error,
        })
        return
      }
      // 200 인데 ok=false — VAPID 미설정 등 서버 설정 이슈
      if (!data.ok) {
        toast.error('발송하지 못했어요', { description: data.reason })
        return
      }
      setLastResult({
        sent: data.sent ?? 0,
        dead: data.dead ?? 0,
        reason: data.reason,
      })
      if ((data.sent ?? 0) > 0) {
        toast.success(`${data.sent}대 디바이스에 발송했어요`)
      } else {
        toast.info('알림 구독이 없어 발송되지 않았어요', {
          description: '사용자가 알림 동의 후 다시 시도하세요',
        })
      }
      setTitle('')
      setBody('')
      setUrl('')
    } catch (e) {
      toast.error('발송하지 못했어요', {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-5 space-y-4">
      {/* 템플릿 */}
      <div>
        <label className="block text-[10px] font-bold text-muted uppercase tracking-[0.15em] mb-1.5">
          템플릿 (자주 쓰는 메시지)
        </label>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => applyTemplate(t)}
              className="px-3 py-1.5 rounded-full text-[11px] font-bold border border-zinc-200 bg-white text-text hover:border-text transition"
            >
              {t.label}
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
          placeholder="알림 본문"
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
          placeholder="예: /mypage/orders/123 (생략 시 알림 센터)"
          className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 bg-[#FDFDFD] text-[13px] focus:outline-none focus:border-terracotta transition"
        />
      </div>

      {/* preview */}
      {(title || body) && (
        <div className="rounded-xl border border-dashed border-zinc-200-2 p-3.5 bg-bg-2">
          <div className="flex items-start gap-2">
            <div className="shrink-0 w-8 h-8 rounded-full bg-terracotta flex items-center justify-center">
              <Bell className="w-3.5 h-3.5 text-white" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-muted font-bold">
                Preview · 미리보기
              </p>
              <p className="text-[12.5px] font-bold text-text mt-0.5 truncate">
                {title || '(제목)'}
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
            지금 발송
          </>
        )}
      </button>

      {lastResult && (
        <div className="text-[11px] text-muted text-center">
          마지막 발송 결과 · 성공 {lastResult.sent}대 / 만료 토큰 정리{' '}
          {lastResult.dead}대
          {lastResult.reason ? ` · ${lastResult.reason}` : ''}
        </div>
      )}
    </div>
  )
}
