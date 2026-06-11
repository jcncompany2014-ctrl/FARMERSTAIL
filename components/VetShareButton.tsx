'use client'

import { useState } from 'react'
import {
  Stethoscope,
  Copy,
  Loader2,
  CheckCircle2,
  Trash2,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/v3/useConfirm'

/**
 * VetShareButton — 수의사 read-only 공유 토큰 발급 카드.
 *
 * 클릭하면 POST /api/dogs/[id]/vet-share → token + URL 반환. URL 자동 복사
 * + 만료일 표시. revoke 기능 포함.
 *
 * # voice-guidelines
 * "수의사 진료 전 정보를 미리 공유해두면 진료가 매끄러워요" 톤. 강제 X.
 */
export default function VetShareButton({ dogId, dogName }: { dogId: string; dogName: string | null }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  async function generate() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/dogs/${dogId}/vet-share`, {
        method: 'POST',
      })
      const data = (await res.json()) as {
        ok?: boolean
        url?: string
        expiresAt?: string
        message?: string
      }
      if (!res.ok || !data.ok || !data.url) {
        toast.error(data.message ?? '링크를 만들지 못했어요')
        return
      }
      setUrl(data.url)
      setExpiresAt(data.expiresAt ?? null)
      // 자동 클립보드 복사 시도 — 브라우저 권한 없으면 silent fail
      try {
        await navigator.clipboard.writeText(data.url)
        toast.success('링크를 복사했어요. 수의사에게 전달해주세요')
      } catch {
        toast.info('링크가 만들어졌어요. 길게 눌러 복사해주세요')
      }
    } catch {
      toast.error('잠시 네트워크가 불안정한 것 같아요. 다시 시도해 주세요')
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    if (
      !(await confirm({
        title: '이 공유 링크를 취소할까요?',
        body: '수의사가 더 이상 접근할 수 없게 돼요.',
        confirmLabel: '링크 취소',
        tone: 'destructive',
      }))
    ) {
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/dogs/${dogId}/vet-share`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        toast.error('취소하지 못했어요')
        return
      }
      setUrl(null)
      setExpiresAt(null)
      toast.success('공유 링크를 취소했어요')
    } finally {
      setBusy(false)
    }
  }

  async function copyAgain() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('링크를 다시 복사했어요')
    } catch {
      toast.info('길게 눌러 복사해주세요')
    }
  }

  return (
    <section
      className="rounded-2xl border bg-white px-5 py-4"
      style={{ borderColor: 'var(--rule)' }}
      aria-label="수의사 공유"
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{
            background: 'color-mix(in srgb, var(--terracotta) 12%, white)',
            color: 'var(--terracotta)',
          }}
          aria-hidden
        >
          <Stethoscope className="w-4 h-4" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="kicker" style={{ color: 'var(--terracotta)' }}>
            Vet Share · 수의사 공유
          </span>
          <p
            className="font-serif mt-1 leading-tight"
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
            }}
          >
            진료 전 {dogName ?? '강아지'}의 정보 보내기
          </p>
          <p className="mt-1 text-[11.5px] text-muted leading-relaxed">
            14일 동안 유효한 read-only 링크예요. 분석 결과 + 알레르기 + 최근
            체중을 수의사가 한눈에 볼 수 있어요.
          </p>

          {!url ? (
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
              style={{ background: 'var(--terracotta)' }}
            >
              {busy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  만드는 중...
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" strokeWidth={2.2} />
                  공유 링크 만들기
                </>
              )}
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <div
                className="rounded-lg border px-3 py-2 text-[11.5px] break-all"
                style={{
                  borderColor: 'var(--rule)',
                  background: 'var(--bg)',
                  color: 'var(--ink)',
                }}
              >
                {/* UI audit #2: inline-block icon + 텍스트 baseline 어긋남.
                    inline-flex 로 감싸서 vertical center align. */}
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2
                    className="w-3 h-3 shrink-0"
                    strokeWidth={2.2}
                    style={{ color: 'var(--moss)' }}
                  />
                  <span className="break-all">{url}</span>
                </span>
              </div>
              {expiresAt && (
                <p className="text-[10.5px] text-muted">
                  만료: {expiresAt.slice(0, 10)}
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyAgain}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rule bg-white text-[11px] font-bold text-text hover:border-terracotta hover:text-terracotta transition"
                >
                  <Copy className="w-3 h-3" strokeWidth={2.2} />
                  다시 복사
                </button>
                <button
                  type="button"
                  onClick={revoke}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rule bg-white text-[11px] font-bold text-muted hover:border-sale hover:text-sale transition disabled:opacity-60"
                >
                  <Trash2 className="w-3 h-3" strokeWidth={2.2} />
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
