'use client'

/**
 * XL-7 (#49) — 수의사 공유 링크 생성 UI.
 *
 * POST /api/dogs/[id]/vet-share → 토큰 URL 반환.
 * 클립보드 복사 + 시스템 공유 시트.
 *
 * # 공유는 lib/capacitor 의 nativeShare 를 쓴다 (2026-07-16 정정)
 * 예전엔 여기서 `navigator.share` 를 직접 부르고, 없으면 버튼을 숨겼다. 그런데
 * Capacitor 웹뷰에선 Web Share API 를 못 믿는다 — **정작 앱에서 시스템 공유 시트가
 * 안 뜨는** 상태였다. lib/capacitor 의 nativeShare 가 바로 그것 때문에 만들어졌는데
 * (앱 → @capacitor/share · 웹 → navigator.share · 그 외 → 클립보드 3단 폴백)
 * 아무도 안 쓰고 있었다.
 */
import { useEffect, useState } from 'react'
import { Share2, Copy, Check } from 'lucide-react'
import { isNativeApp, nativeShare } from '@/lib/capacitor'

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

  // 앱이면 @capacitor/share 가 항상 뜨므로 navigator.share 유무와 무관하게 노출.
  // 클라이언트에서만 판정 — 서버 렌더 결과와 어긋나지 않게 mount 후 세운다.
  const [canShare, setCanShare] = useState(false)
  useEffect(() => {
    setCanShare(isNativeApp() || typeof navigator.share === 'function')
  }, [])

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

  async function share() {
    if (!state.url) return
    // nativeShare 는 앱/웹/클립보드 중 뭘 탔는지 알려주지 않는다. 시트가 떴는데
    // '복사됨' 체크를 띄우면 거짓말이 되므로 결과 표시는 하지 않는다.
    await nativeShare({
      title: '강아지 진료 보고서',
      text: '동물병원 진료 전 참고용 보고서',
      url: state.url,
    })
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
      <p className="text-[10.5px] uppercase tracking-widest font-semibold text-muted mb-2">
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
        {canShare && (
          <button
            type="button"
            onClick={share}
            aria-label="시스템 공유"
            className="rounded border border-line px-3 py-2 text-[10.5px] font-semibold hover:border-ink active:scale-95"
          >
            <Share2 className="w-3.5 h-3.5 inline" strokeWidth={2.5} />
          </button>
        )}
      </div>
      <p className="text-[10.5px] text-muted leading-relaxed">
        만료:{' '}
        {state.expiresAt
          ? new Date(state.expiresAt).toLocaleDateString('ko-KR')
          : '—'}{' '}
        · 수의사가 로그인 없이 열람 가능
      </p>
    </div>
  )
}
