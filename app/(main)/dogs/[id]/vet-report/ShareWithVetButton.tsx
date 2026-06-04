'use client'

/**
 * XL-7 (#49) — 수의사 공유 링크 생성 UI.
 *
 * POST /api/dogs/[id]/vet-share → 토큰 URL 반환.
 * 클립보드 복사 + share API (모바일).
 */
import { useState } from 'react'
import { Share2, Copy, Check } from 'lucide-react'

export default function ShareWithVetButton({ dogId }: { dogId: string }) {
  const [state, setState] = useState<{
    url: string | null
    expiresAt: string | null
    error: string | null
    loading: boolean
    copied: boolean
  }>({
    url: null,
    expiresAt: null,
    error: null,
    loading: false,
    copied: false,
  })

  async function generate() {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const r = await fetch(`/api/dogs/${dogId}/vet-share`, {
        method: 'POST',
      })
      const data = await r.json()
      if (!r.ok || !data.ok) {
        setState((s) => ({
          ...s,
          loading: false,
          error: data.message ?? '링크 생성 실패',
        }))
        return
      }
      setState({
        url: data.url,
        expiresAt: data.expiresAt,
        error: null,
        loading: false,
        copied: false,
      })
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : '네트워크가 불안정해요. 다시 시도해 주세요',
      }))
    }
  }

  async function copy() {
    if (!state.url) return
    try {
      await navigator.clipboard.writeText(state.url)
      setState((s) => ({ ...s, copied: true }))
      setTimeout(
        () => setState((s) => ({ ...s, copied: false })),
        2000,
      )
    } catch {
      // ignore
    }
  }

  async function nativeShare() {
    if (!state.url || typeof navigator.share !== 'function') return
    try {
      await navigator.share({
        title: '강아지 진료 보고서',
        text: '동물병원 진료 전 참고용 보고서',
        url: state.url,
      })
    } catch {
      // user cancelled
    }
  }

  if (!state.url) {
    return (
      <div className="no-print">
        <button
          type="button"
          onClick={generate}
          disabled={state.loading}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-line text-[12px] font-bold active:scale-[0.98] transition hover:border-ink"
        >
          <Share2 className="w-3.5 h-3.5" strokeWidth={2.5} />
          {state.loading ? '생성 중…' : '수의사 공유 링크 생성'}
        </button>
        {state.error && (
          <p className="text-[10.5px] text-sale mt-2">{state.error}</p>
        )}
      </div>
    )
  }

  // R57 — container p-3→p-4, input/button padding 늘림, kicker→input mb-1.5
  // → mb-2 (6→8), input→만료 안내 mb-2 → mb-2.5.
  return (
    <div className="no-print rounded border border-line bg-paperHi p-4 max-w-md">
      <p className="text-[10.5px] uppercase tracking-widest font-semibold text-mute mb-2">
        공유 링크 (14일 만료)
      </p>
      <div className="flex items-center gap-2 mb-2.5">
        <input
          readOnly
          aria-label="공유 링크"
          value={state.url}
          className="flex-1 rounded border border-line bg-paper px-3 py-2 text-[10.5px] font-mono text-ink"
          onClick={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          onClick={copy}
          aria-label="링크 복사"
          className="rounded border border-line px-3 py-2 text-[10.5px] font-semibold hover:border-ink active:scale-95"
        >
          {state.copied ? (
            <Check className="w-3.5 h-3.5 inline" strokeWidth={2.5} />
          ) : (
            <Copy className="w-3.5 h-3.5 inline" strokeWidth={2.5} />
          )}
        </button>
        {typeof navigator !== 'undefined' &&
          typeof navigator.share === 'function' && (
            <button
              type="button"
              onClick={nativeShare}
              aria-label="시스템 공유"
              className="rounded border border-line px-3 py-2 text-[10.5px] font-semibold hover:border-ink active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5 inline" strokeWidth={2.5} />
            </button>
          )}
      </div>
      <p className="text-[10.5px] text-mute leading-relaxed">
        만료:{' '}
        {state.expiresAt
          ? new Date(state.expiresAt).toLocaleDateString('ko-KR')
          : '—'}{' '}
        · 수의사가 로그인 없이 열람 가능
      </p>
    </div>
  )
}
