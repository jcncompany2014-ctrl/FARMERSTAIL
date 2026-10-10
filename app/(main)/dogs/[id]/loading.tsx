/**
 * /dogs/[id] 강아지 상세 로딩 폴백 (audit #108).
 *
 * 2026-08-07: 실제 화면(DogDetailClient)은 96px 원형 사진이 **중앙 정렬**된
 * 카드인데 스켈레톤은 좌측 아바타 + 우측 텍스트 **가로 배치**였다 —
 * 로딩에서 실제로 넘어갈 때 헤더가 통째로 옮겨 앉았다.
 *
 * 2026-10-09 'A 포스터' — 같은 이유로 새 상세 배치(시안 AppDog '개요')를 본떴다. 이 화면만의 뼈대 시안은
 * 없어 홈·목록 뼈대(B06·B07)와 같은 규칙으로 그렸다 — 색 면은 회색 면, 카드는 옅은 회색 테두리.
 *   머리 띠   (옅은 주황 → 회색 면) 여백 22/20 · 사진 동그라미 96 · 머리말·이름(40)·견종 · 오른쪽 수정 칸 44
 *   정보 칸   3열 · 간격 6 · 칸 5개(이름·값 두 줄)
 *   보호자님께 카드  머리말 · 제목 · 본문 두 줄
 * 위의 탭(개요·기록·분석)은 [id]/layout 이 그대로 그린다.
 */
import { V3, V3Radius } from '@/lib/design/tokens'
import AppSkeleton, { SKELETON_FILL, SkeletonBlock } from '@/components/v3/system/AppSkeleton'

export default function DogDetailLoading() {
  return (
    <AppSkeleton>
      {/* 1. 머리 띠 — 사진 · 머리말·이름·견종 · 수정 칸 */}
      <section
        style={{
          padding: '22px 20px',
          display: 'grid',
          gridTemplateColumns: '96px 1fr 44px',
          columnGap: 16,
          alignItems: 'center',
          background: V3.soft,
        }}
      >
        <SkeletonBlock width={96} height={96} round />
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBlock width={64} height={14} />
          <SkeletonBlock width="62%" height={36} />
          <SkeletonBlock width="80%" height={16} />
        </span>
        <SkeletonBlock width={44} height={44} style={{ alignSelf: 'flex-start' }} />
      </section>

      {/* 2. 정보 칸 — 성별·나이·체중·중성화·활동량 */}
      <div
        style={{
          margin: '20px 20px 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 6,
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              padding: 12,
              borderRadius: V3Radius.sm,
              background: V3.soft,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <SkeletonBlock width="45%" height={13} />
            <SkeletonBlock width="70%" height={18} />
          </div>
        ))}
      </div>

      {/* 3. 보호자님께 카드 */}
      <section
        style={{
          margin: '26px 20px 0',
          padding: 18,
          border: `1.5px solid ${SKELETON_FILL}`,
          borderRadius: V3Radius.sm,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <SkeletonBlock width={88} height={14} />
        <SkeletonBlock width="72%" height={22} />
        <SkeletonBlock width="100%" height={16} style={{ marginTop: 4 }} />
        <SkeletonBlock width="84%" height={16} />
      </section>
    </AppSkeleton>
  )
}
