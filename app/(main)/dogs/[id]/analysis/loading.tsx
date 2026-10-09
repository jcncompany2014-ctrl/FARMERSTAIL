/**
 * /dogs/[id]/analysis 로딩 폴백 (audit #108).
 *
 * 설문 직후 진입하는 가장 기대치 높은 페이지. layout shift 최소화 위해 큰
 * 차트/추천 박스 영역 placeholder.
 *
 * 2026-10-09 앱 새 디자인('A 포스터') — 새 분석 배치(캔버스 D08)를 본떴다. 홈·우리 아이 뼈대(B06·B07)와 같은
 * 규칙: 색 면(옅은 주황 머리 띠·머스타드 에너지 카드)은 회색 면·옅은 회색 테두리로 그린다.
 *   요약 줄 52 → 머리 띠(사진 140 · 이름 · 한 줄) → 분석 한 줄 카드 → 에너지 카드 → 추천 레시피 줄 둘
 * AnalysisView 가 데이터를 받는 동안에도 이 뼈대를 그대로 쓴다(덜컹임 없이 이어지게).
 */
import { V3 } from '@/lib/design/tokens'
import AppSkeleton, { SKELETON_FILL, SkeletonBlock } from '@/components/v3/system/AppSkeleton'

export default function AnalysisLoading() {
  return (
    <AppSkeleton label="분석을 불러오는 중">
      <div
        style={{
          height: 52,
          padding: '0 20px',
          borderBottom: `1px solid ${V3.rule}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <SkeletonBlock width={180} height={20} />
        <SkeletonBlock width={80} height={16} />
      </div>
      <section
        style={{
          padding: '26px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          background: V3.soft,
        }}
      >
        <SkeletonBlock width={96} height={14} />
        <SkeletonBlock width={140} height={140} round />
        <SkeletonBlock width={180} height={36} />
        <SkeletonBlock width={220} height={16} />
      </section>
      <section style={{ margin: '22px 20px 0', padding: 18, borderRadius: 4, background: V3.soft, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ display: 'flex', gap: 6 }}>
          <SkeletonBlock width={48} height={30} style={{ background: '#E5E3E4' }} />
          <SkeletonBlock width={84} height={30} style={{ background: '#E5E3E4' }} />
        </span>
        <SkeletonBlock width="86%" height={20} style={{ background: '#E5E3E4' }} />
        <SkeletonBlock width="70%" height={20} style={{ background: '#E5E3E4' }} />
      </section>
      <section
        style={{
          margin: '22px 20px 0',
          padding: '18px 18px 16px',
          border: `2px solid ${SKELETON_FILL}`,
          borderRadius: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <SkeletonBlock width={110} height={14} />
        <SkeletonBlock width={180} height={80} />
        <SkeletonBlock width="100%" height={8} />
        <SkeletonBlock width="100%" height={72} />
      </section>
      <section style={{ margin: '28px 20px 0', paddingTop: 14, borderTop: `2px solid ${SKELETON_FILL}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonBlock width={200} height={26} />
        {[0, 1].map((i) => (
          <span key={i} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', columnGap: 12, alignItems: 'center' }}>
            <SkeletonBlock width={52} height={52} round />
            <SkeletonBlock width="70%" height={18} />
          </span>
        ))}
      </section>
    </AppSkeleton>
  )
}
