/**
 * InsightNote — 개요 '체중 기록' 카드 하단의 한 줄 인사이트.
 *
 * 사장님 2026-07-14: "개요 부분에 '체형이 살짝 변했다, 활동량을 같이 살펴봐도
 * 좋다' 같은 멘트 하나 넣어주면 딱일 것 같아."
 *
 * 문구 생성은 lib/dog-insight (순수 함수 + 테스트). 여기선 렌더만 한다.
 * tone → 색만 바뀌고 레이아웃은 동일. 'watch' 도 경보가 아니라 '눈여겨볼 변화'
 * 수준의 톤 — 진짜 경보는 건강 알림(급변·개입 푸시)이 담당.
 */
import { Sparkles } from 'lucide-react'
import type { DogInsight } from '@/lib/dog-insight'

const TONE_COLOR: Record<DogInsight['tone'], string> = {
  good: 'var(--moss)',
  watch: 'var(--terracotta)',
  neutral: 'var(--muted)',
  prompt: 'var(--muted)',
}

export default function InsightNote({
  insight,
  className = '',
}: {
  insight: DogInsight
  className?: string
}) {
  const accent = TONE_COLOR[insight.tone]
  return (
    <div
      className={`rounded bg-bg px-3.5 py-3 ${className}`}
      style={{ borderLeft: `2px solid ${accent}` }}
    >
      <div className="flex items-start gap-2">
        <Sparkles
          className="w-3 h-3 mt-[3px] shrink-0"
          strokeWidth={2.5}
          style={{ color: accent }}
          aria-hidden
        />
        <div className="min-w-0">
          <p
            className="text-[12px] font-bold leading-snug"
            style={{ color: accent }}
          >
            {insight.headline}
          </p>
          <p className="text-[11px] text-muted leading-relaxed mt-1">
            {insight.body}
          </p>
          {insight.surveyNote && (
            <p className="text-[10.5px] text-muted/80 leading-relaxed mt-1.5 pt-1.5 border-t border-rule/60">
              {insight.surveyNote}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
