/**
 * /dashboard 로딩 폴백.
 *
 * # 왜 다시 그렸나 (2026-08-07 앱 화면 감사)
 * 이 스켈레톤은 **폐기된 커머스 홈**을 그리고 있었다 — "카테고리 3 그리드" +
 * `ProductGridSkeleton count={4}`(전체 상품). 그런데 실제 홈은 구독 전용 전환
 * 후 Greeting → ActiveDogCard → ThisWeek 7일 그리드 → MyDogs 로 바뀌었고
 * 상품 섹션은 2026-06-11 에 제거됐다. 스켈레톤이 사라진 레이아웃을 붙잡고
 * 있어서 로딩 → 실제 전환에서 **화면 절반이 재배치**됐다.
 *
 * 스켈레톤의 존재 이유가 layout shift 최소화이므로, 실제 섹션과 어긋난
 * 스켈레톤은 없느니만 못하다.
 *
 * # 2026-10-09 'A 포스터' — 새 홈 배치(시안 B06)로 다시 맞췄다
 * 같은 이유다(결정: "불러오는 중 뼈대는 새 홈 배치에 맞춤 — 다 불러왔을 때 덜컹 안 움직이게").
 * 치수는 시안 B06 값 그대로:
 *   인사말          여백 24/20 · 머스타드 8px 네모 + 날짜 · 제목 2줄(34) · 한 줄 카피
 *   이번 박스 카드  머리 줄 · 강아지별 줄 2개(동그라미 32 · 이름·레시피 · 상태 칩 · 진행 막대 · 안내 한 줄)
 *   우리 아이       섹션 제목 · 강아지 탭 2개(92×48) · 강아지 카드(사진 76 · 이름·한 줄 2개 · 아래 수치 띠)
 * 머스타드 박스 카드는 회색 테두리, 옅은 주황 강아지 띠는 회색 면으로 그린다(components/v3/system/AppSkeleton).
 * 윗줄(로고·알림 종)과 아래 탭은 layout 이 그대로 그린다.
 */
import { V3, V3Radius } from '@/lib/design/tokens'
import AppSkeleton, { SKELETON_FILL, SkeletonBlock } from '@/components/v3/system/AppSkeleton'

export default function DashboardLoading() {
  return (
    <AppSkeleton>
      {/* 1. 인사말 — 머스타드 네모 + 날짜 · 제목 2줄 · 한 줄 카피 */}
      <section style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden style={{ width: 8, height: 8, flexShrink: 0, background: V3.mustard }} />
          <SkeletonBlock width={118} height={15} />
        </span>
        <SkeletonBlock width="70%" height={34} style={{ marginTop: 12 }} />
        <SkeletonBlock width="42%" height={34} style={{ marginTop: 8 }} />
        <SkeletonBlock width="78%" height={17} style={{ marginTop: 14 }} />
      </section>

      {/* 2. 이번 박스 카드 — 머리 줄 + 강아지별 줄 2개 */}
      <section
        style={{
          margin: '22px 20px 0',
          border: `2px solid ${SKELETON_FILL}`,
          borderRadius: V3Radius.sm,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '16px 18px 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <SkeletonBlock width={120} height={22} />
          <SkeletonBlock width={110} height={15} />
        </div>
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              borderBottom: i === 0 ? `1px solid ${SKELETON_FILL}` : undefined,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SkeletonBlock width={32} height={32} round />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SkeletonBlock width="46%" height={16} />
                <SkeletonBlock width="62%" height={13} />
              </span>
              <SkeletonBlock width={64} height={28} />
            </div>
            <SkeletonBlock width="100%" height={6} />
            <SkeletonBlock width="70%" height={13} />
          </div>
        ))}
      </section>

      {/* 3. 우리 아이 — 섹션 제목 · 강아지 탭 · 강아지 카드 */}
      <div style={{ margin: '30px 20px 0' }}>
        <SkeletonBlock width={84} height={20} />
      </div>
      <div style={{ margin: '12px 20px 0', display: 'flex', gap: 8 }}>
        <SkeletonBlock width={92} height={48} />
        <SkeletonBlock width={92} height={48} />
      </div>
      <div
        style={{
          margin: '12px 20px 0',
          border: `1.5px solid ${SKELETON_FILL}`,
          borderRadius: V3Radius.sm,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <SkeletonBlock width={76} height={76} round />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonBlock width="48%" height={28} />
            <SkeletonBlock width="80%" height={15} />
            <SkeletonBlock width="40%" height={14} />
          </span>
        </div>
        <div style={{ height: 62, background: V3.soft }} />
      </div>
    </AppSkeleton>
  )
}
