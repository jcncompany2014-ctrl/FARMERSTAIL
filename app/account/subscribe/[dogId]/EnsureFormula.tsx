'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { fetchComputedFormula } from '@/lib/personalization/formulaCache'

/**
 * 처방이 아직 없을 때 **그 자리에서 만들어** 준다.
 *
 * # 왜 필요한가 (2026-07-31, 사장님 제보)
 * "모바일 웹에서 설문하고 강아지 등록해서 추천 레시피가 떴는데, 그게 결제로 안
 * 이어지고 우리 아이 페이지에서 신청하려 해도 **추천 박스가 없다**고 한다."
 *
 * 원인: **웹 설문 경로는 `dog_formulas` 를 만들지 않는다.**
 * 웹에서 보이는 추천은 `computeStartTeaser` — localStorage 초안으로 **브라우저에서
 * 계산한 티저**다. DB 에는 처방이 없다. 강아지를 만드는 `applyAutosignupDraft` 도,
 * 완료 화면 `/start/done` 도 compute 를 부르지 않는다.
 * 앱에서는 분석 화면의 `RecommendationBox` 가 마운트될 때 POST
 * `/api/personalization/compute` 를 불러 cycle 1 을 read-or-create 한다 —
 * **웹엔 그 화면이 없으니 아무도 안 불렀다.**
 * 그래서 신청 화면(`loadOrderPageData`, cycle 1 고정)이 빈손이 된다.
 *
 * # 왜 여기서 부르나
 * 신청 화면은 **처방이 반드시 있어야 하는 자리**다. 여기서 보장하면
 *  · 어떤 경로로 왔든(웹 설문·앱·직접 링크) 처방이 채워지고,
 *  · 이미 만들어진 강아지(사장님 계정처럼)도 다음 진입에서 복구된다.
 * `/start/claim` 같은 중간 지점에 넣으면 그 경로로 안 온 강아지는 계속 빈손이다.
 *
 * compute 는 **read-or-create** 라 이미 있으면 그대로 돌려준다 — 중복 생성 없음.
 * 호출은 `formulaCache` 를 거쳐 같은 강아지에 대한 동시 호출이 합쳐진다.
 */
export default function EnsureFormula({ dogId }: { dogId: string }) {
  const router = useRouter()
  const [state, setState] = useState<'working' | 'failed'>('working')
  const [reason, setReason] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { httpOk, body } = await fetchComputedFormula(dogId)
        if (cancelled) return
        if (httpOk && body && 'formula' in body) {
          // 서버가 만들었으니 화면을 다시 그린다 — 이번엔 처방이 있다.
          router.refresh()
          return
        }
        // 설문이 없거나 상담이 필요한 경우 등 — 만들 수 없는 이유가 있다.
        setReason(
          (body as { message?: string } | null)?.message ??
            '아직 식단을 만들 수 없어요',
        )
        setState('failed')
      } catch {
        if (!cancelled) {
          setReason('식단을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
          setState('failed')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dogId, router])

  if (state === 'working') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Loader2
          className="w-5 h-5 animate-spin"
          strokeWidth={2}
          style={{ color: 'var(--fd-muted)' }}
        />
        <p className="text-[13px]" style={{ color: 'var(--fd-muted)' }}>
          우리 아이 식단을 준비하고 있어요…
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16 text-center">
      <p className="text-[15px] font-bold" style={{ color: 'var(--fd-pine)' }}>
        아직 식단을 만들 수 없어요
      </p>
      <p
        className="mt-2 text-[13px] leading-relaxed"
        style={{ color: 'var(--fd-muted)' }}
      >
        {reason}
      </p>
      <Link
        href="/start"
        className="mt-6 inline-flex items-center px-5 py-3 rounded-full text-[13px] font-bold"
        style={{ background: 'var(--fd-coral)', color: '#FFFFFF' }}
      >
        설문 다시 하기
      </Link>
    </div>
  )
}
