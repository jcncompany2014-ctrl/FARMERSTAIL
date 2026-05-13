'use client'

import { useState } from 'react'
import {
  Share2,
  Loader2,
  Copy,
  CheckCircle2,
  Heart,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isAdvancedUiEnabled } from '@/lib/ui-flags'

/**
 * PhotoRequestButton — 친구·가족에게 강아지 사진 한 장 부탁하는 토큰
 * 발급 카드. (사용자 A-25 / Phase P5)
 *
 * 사용: 보호자가 혼자 측면 사진 찍기 어려울 때 link 보내고 친구가 찍어
 * 올리면 자동으로 dog.photo_url 적용.
 *
 * # 흐름
 *  1) "사진 부탁 링크 만들기" → POST /api/dogs/[id]/photo-request
 *  2) URL 자동 클립보드 복사 + Web Share API 시도 (모바일)
 *  3) 친구가 /photo-upload/[token] 로 진입해 사진 올림
 *  4) submit_photo_request RPC 가 dog.photo_url 자동 적용
 */
export default function PhotoRequestButton({
  dogId,
  dogName,
}: {
  dogId: string
  dogName: string | null
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  // 초기 단계 — 사용자 부담 ↓. default OFF.
  if (!isAdvancedUiEnabled('photo_request')) return null

  async function generate() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/dogs/${dogId}/photo-request`, {
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

      // Web Share API 시도 (모바일)
      const shareText = `${dogName ?? '강아지'}의 측면 사진 한 장 부탁해요`
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: shareText,
            text: shareText,
            url: data.url,
          })
          return
        } catch {
          // 공유 취소 / 미지원 — fallback to clipboard
        }
      }
      try {
        await navigator.clipboard.writeText(data.url)
        toast.success('링크를 복사했어요. 친구에게 보내주세요')
      } catch {
        toast.info('링크가 만들어졌어요. 길게 눌러 복사해주세요')
      }
    } catch {
      toast.error('네트워크 오류가 발생했어요')
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
      aria-label="친구 사진 부탁"
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
          <Heart className="w-4 h-4" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="kicker" style={{ color: 'var(--terracotta)' }}>
            Photo Request · 친구 부탁
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
            가족·친구가 사진 찍어주기
          </p>
          <p className="mt-1 text-[11.5px] text-muted leading-relaxed">
            혼자 측면 사진 찍기 어려울 때 — 링크를 보내면 앱 설치 없이 웹에서
            바로 올릴 수 있어요. 7일 유효.
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
                  <Share2 className="w-3.5 h-3.5" strokeWidth={2.2} />
                  사진 부탁 링크 만들기
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
                <CheckCircle2
                  className="inline-block w-3 h-3 mr-1"
                  strokeWidth={2.2}
                  style={{ color: 'var(--moss)' }}
                />
                {url}
              </div>
              {expiresAt && (
                <p className="text-[10.5px] text-muted">
                  만료: {expiresAt.slice(0, 10)}
                </p>
              )}
              <button
                type="button"
                onClick={copyAgain}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rule bg-white text-[11px] font-bold text-text hover:border-terracotta hover:text-terracotta transition"
              >
                <Copy className="w-3 h-3" strokeWidth={2.2} />
                다시 복사
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
