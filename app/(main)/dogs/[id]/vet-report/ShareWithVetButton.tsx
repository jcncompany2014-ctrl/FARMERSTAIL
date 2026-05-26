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
        error: e instanceof Error ? e.message : '네트워크 오류',
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
          <p className="text-[11px] text-sale mt-2">{state.error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="no-print rounded border border-line bg-paperHi p-3 max-w-md">
      <p className="text-[10px] uppercase tracking-widest font-semibold text-mute mb-1.5">
        공유 링크 (14일 만료)
      </p>
      <div className="flex items-center gap-2 mb-2">
        <input
          readOnly
          value={state.url}
          className="flex-1 rounded border border-line bg-paper px-2.5 py-1.5 text-[11px] font-mono text-ink"
          onClick={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          onClick={copy}
          className="rounded border border-line px-3 py-1.5 text-[11px] font-semibold hover:border-ink active:scale-95"
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
              className="rounded border border-line px-3 py-1.5 text-[11px] font-semibold hover:border-ink active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5 inline" strokeWidth={2.5} />
            </button>
          )}
      </div>
      <p className="text-[10px] text-mute">
        만료:{' '}
        {state.expiresAt
          ? new Date(state.expiresAt).toLocaleDateString('ko-KR')
          : '—'}{' '}
        · 수의사가 로그인 없이 열람 가능
      </p>
    </div>
  )
}
