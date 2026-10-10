/**
 * 분석 맞춤도 화면 머리 — page.tsx 와 점검 화면(/design-check/analysis)이 같이 쓴다.
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 A14): 머스타드 네모 머리말 "정확도" + 본문 17.
 */

import { V3 } from '@/lib/design/tokens'

export default function AccuracyIntro({ silent }: { silent: boolean }) {
  return (
    <section style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: V3.inkMute }}>
        <span aria-hidden style={{ width: 8, height: 8, background: V3.mustard }} />
        정확도
      </span>
      <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: V3.inkSoft, wordBreak: 'keep-all' }}>
        {silent
          ? '지금은 맞춤 데이터가 쌓이는 중이에요. 급하게 뭔가 안 하셔도 괜찮아요 — 정밀도는 다음 주부터 차근차근 보여드릴게요.'
          : '체중·활동·급여를 어떻게 측정했는지에 따라 맞춤 분석의 정밀도가 달라져요. 약한 항목의 측정 도구를 바꾸면 더 정확한 추천을 받을 수 있어요.'}
      </p>
    </section>
  )
}
