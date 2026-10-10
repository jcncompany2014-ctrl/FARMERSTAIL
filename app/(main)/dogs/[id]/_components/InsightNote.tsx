/**
 * InsightNote — 개요 '체중 기록' 카드 하단의 한 줄 인사이트.
 *
 * 사장님 2026-07-14: "개요 부분에 '체형이 살짝 변했다, 활동량을 같이 살펴봐도
 * 좋다' 같은 멘트 하나 넣어주면 딱일 것 같아."
 *
 * 문구 생성은 lib/dog-insight (순수 함수 + 테스트). 여기선 렌더만 한다.
 * tone → 색만 바뀌고 레이아웃은 동일. 'watch' 도 경보가 아니라 '눈여겨볼 변화'
 * 수준의 톤 — 진짜 경보는 건강 알림(급변·개입 푸시)이 담당.
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 AppDog): 기록 목록 바로 아래 굵은 한 줄(15px 먹색 700) +
 * 회색 설명. 테두리·아이콘은 뺐다. '눈여겨볼 변화'(watch)만 앞에 머스타드 네모 하나.
 */
import type { DogInsight } from '@/lib/dog-insight'
import { V3 } from '@/lib/design/tokens'

export default function InsightNote({ insight }: { insight: DogInsight }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ margin: 0, display: 'flex', gap: 8, fontSize: 15, fontWeight: 700, lineHeight: 1.45, color: V3.ink }}>
        {insight.tone === 'watch' && (
          <span aria-hidden style={{ flexShrink: 0, width: 6, height: 6, marginTop: 8, background: V3.mustard }} />
        )}
        {insight.headline}
      </p>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: V3.inkMute }}>{insight.body}</p>
      {insight.surveyNote && (
        <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.55, color: V3.inkMute }}>{insight.surveyNote}</p>
      )}
    </div>
  )
}
