/**
 * /dogs 목록 로딩 폴백 (audit #108).
 *
 * 강아지 목록은 보통 1-2개라 카드 2개 placeholder.
 *
 * 2026-10-09 'A 포스터' — 시안 B07 치수 그대로. 화면 이름('우리 아이')은 윗줄이 그리므로 뼈대는 카드만:
 * 옅은 회색 테두리 1.5 · 높이 88 이상 · 사진 동그라미 60 · 이름(24)·한 줄(15).
 */
import { V3Radius } from '@/lib/design/tokens'
import AppSkeleton, { SKELETON_FILL, SkeletonBlock } from '@/components/v3/system/AppSkeleton'

export default function DogsLoading() {
  return (
    <AppSkeleton>
      <div style={{ margin: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              minHeight: 88,
              boxSizing: 'border-box',
              padding: '14px 16px',
              border: `1.5px solid ${SKELETON_FILL}`,
              borderRadius: V3Radius.sm,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <SkeletonBlock width={60} height={60} round />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SkeletonBlock width="38%" height={24} />
              <SkeletonBlock width="70%" height={15} />
            </span>
          </div>
        ))}
      </div>
    </AppSkeleton>
  )
}
