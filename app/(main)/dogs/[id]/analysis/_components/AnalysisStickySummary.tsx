/**
 * AnalysisStickySummary — 분석 화면 맨 위 요약 줄 (kcal / g / 체형) + 분석 결과 공유 버튼.
 *
 * 분할 (2026-05-27): AnalysisView.tsx 에서 추출.
 * R-feel(2026-06-10): 상단 뒤로가기를 헤더 ← 로 옮기면서 AnalysisTopNav 가
 * 공유 버튼만 남아 '빈 띠'가 됐던 문제 → 공유 버튼을 이 요약 바로 통합하고
 * AnalysisTopNav 제거. 헤더 바로 아래 빈 공간 사라짐.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 D08·A02): 흰 52px 줄 — 큰 숫자 Anton 20 + 단위, 체형은 말로
 *   ("BCS 4-5" → "알맞은 체형", 사장님 결정 목록). 공유 버튼은 44px.
 *   붙어 있기(sticky): 설문 직후(헤더·탭이 숨는 집중 화면)엔 위 "분석 결과" 줄 바로 아래 붙는다.
 *   평소엔 제자리에 둔다 — 예전 top:0 고정은 앱 머리줄(z-40) 밑으로 들어가 어차피 보이지 않았다.
 *   (머리줄+탭+요약을 한 덩어리로 붙이려면 강아지 탭(DogTabsNav) 높이가 정해져야 한다 — 보고서 참고.)
 */
'use client'

import { useToast } from '@/components/ui/Toast'
import { petName } from '@/lib/korean'
import { V3 } from '@/lib/design/tokens'

type Props = {
  dogName: string
  merKcal: number
  feedG: number
  /** 체형 — 보호자가 아는 말("알맞은 체형"). */
  shapeLabel: string
  analysisDate: string
  /**
   * 설문 직후(fromSurvey) 화면 상단에 "분석 결과" 줄(높이 60 + safe-area)이
   * 있을 때 true — 요약 줄을 그 아래에 붙인다.
   */
  stickyBelowBar?: boolean
}

export default function AnalysisStickySummary({
  dogName,
  merKcal,
  feedG,
  shapeLabel,
  analysisDate,
  stickyBelowBar = false,
}: Props) {
  const toast = useToast()

  async function handleShare() {
    const text = `${petName(dogName)}의 맞춤 영양 분석\n\n• 하루 에너지 ${merKcal.toLocaleString()} kcal\n• 급여량 ${feedG}g/일\n• 체형 ${shapeLabel}\n\n파머스테일 · Farm to Tail`
    const shareData = {
      title: `${dogName} 영양 분석 · 파머스테일`,
      text,
      url: typeof window !== 'undefined' ? window.location.href : '',
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        /* 사용자 취소 */
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      // share 경로와 동일하게 보호 — 비-HTTPS·권한 거부 시 writeText 가 reject
      // 하면 unhandled promise rejection 이 되므로 catch 해 사용자에 안내.
      try {
        await navigator.clipboard.writeText(`${text}\n${shareData.url}`)
        toast.success('분석 요약을 복사했어요')
      } catch {
        toast.error('공유하지 못했어요')
      }
    } else {
      // ★두 경로가 다 없으면 **아무 일도 일어나지 않았다**(2026-08-05).
      //   share 도 clipboard 도 보안 컨텍스트·브라우저에 따라 없을 수 있는데
      //   else 가 없어서 버튼을 눌러도 화면이 그대로였다 — 고객에게 무반응은
      //   고장과 구분되지 않는다. 실패는 실패라고 말한다.
      toast.info('이 브라우저에서는 공유가 안 돼요. 주소창의 링크를 복사해 주세요')
    }
  }

  const sep = <span aria-hidden style={{ width: 1, height: 16, background: '#D5D3D4', flexShrink: 0 }} />

  return (
    <div
      aria-label="분석 요약"
      style={{
        position: stickyBelowBar ? 'sticky' : 'relative',
        // "분석 결과" 줄 = 높이 60 + 아래 선 1 — 그 선을 덮지 않게 61.
        top: stickyBelowBar ? 'calc(env(safe-area-inset-top) + 61px)' : undefined,
        zIndex: 30,
        height: 52,
        boxSizing: 'border-box',
        padding: '0 8px 0 20px',
        background: V3.paper,
        borderBottom: `1px solid ${V3.rule}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        color: V3.ink,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', minWidth: 0 }}>
        <span>
          <span className="ft-num" style={{ fontSize: 20 }}>
            {merKcal.toLocaleString()}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700 }}> kcal</span>
        </span>
        {sep}
        <span>
          <span className="ft-num" style={{ fontSize: 20 }}>
            {feedG}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700 }}> g</span>
        </span>
        {sep}
        <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {shapeLabel}
        </span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: V3.inkMute, whiteSpace: 'nowrap' }}>{analysisDate}</span>
        <button
          type="button"
          onClick={handleShare}
          aria-label="분석 결과 공유"
          className="flex items-center justify-center transition active:scale-95"
          style={{ width: 44, height: 44, border: 0, background: 'transparent', color: V3.ink, cursor: 'pointer' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="18" cy="5.5" r="2.5" />
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="18.5" r="2.5" />
            <path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" />
          </svg>
        </button>
      </span>
    </div>
  )
}
