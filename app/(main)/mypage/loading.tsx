/**
 * /mypage 로딩 폴백 (audit #108).
 *
 * 2026-10-09 'A 포스터' — 시안 B08(내 정보) 치수 그대로. 예전엔 같은 높이 막대 6개였는데, 새 내 정보는
 * 이름 줄 → 도장판 카드(10칸) → 수치 두 칸 → 메뉴 목록이라 막대로는 다 불러올 때 화면이 통째로 밀린다.
 *   이름 줄    제목(112×34) + 오른쪽 한 줄 — 아래 끝 맞춤
 *   도장판     옅은 회색 테두리 2 · 머리 줄 · 회색 면 안 5×2 동그라미 · 안내 한 줄
 *   수치 두 칸  테두리 1.5 · 가운데 세로선 · 이름·숫자
 *   메뉴 목록  묶음 이름 · 위 선 1.5 · 64 높이 줄 3개(글자 + 오른쪽 화살표 자리)
 * 화면 이름('내 정보')은 윗줄이 그린다.
 */
import { V3, V3Radius } from '@/lib/design/tokens'
import AppSkeleton, { SKELETON_FILL, SkeletonBlock } from '@/components/v3/system/AppSkeleton'

export default function MypageLoading() {
  return (
    <AppSkeleton>
      {/* 1. 이름 줄 */}
      <div
        style={{
          margin: '22px 20px 0',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <SkeletonBlock width={112} height={34} />
        <SkeletonBlock width={124} height={16} />
      </div>

      {/* 2. 도장판 카드 */}
      <div
        style={{
          margin: '18px 20px 0',
          padding: 18,
          border: `2px solid ${SKELETON_FILL}`,
          borderRadius: V3Radius.sm,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <SkeletonBlock width={90} height={16} />
          <SkeletonBlock width={60} height={16} />
        </div>
        <div
          style={{
            padding: 14,
            borderRadius: V3Radius.sm,
            background: V3.soft,
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 10,
          }}
        >
          {Array.from({ length: 10 }, (_, i) => (
            <SkeletonBlock key={i} width="100%" height="auto" round style={{ aspectRatio: '1' }} />
          ))}
        </div>
        <SkeletonBlock width="86%" height={15} />
      </div>

      {/* 3. 수치 두 칸 */}
      <div
        style={{
          margin: '16px 20px 0',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          border: `1.5px solid ${SKELETON_FILL}`,
          borderRadius: V3Radius.sm,
        }}
      >
        {[40, 56].map((w, i) => (
          <div
            key={w}
            style={{
              padding: '14px 16px',
              borderLeft: i === 1 ? `1px solid ${SKELETON_FILL}` : undefined,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <SkeletonBlock width={w} height={14} />
            <SkeletonBlock width={64} height={24} />
          </div>
        ))}
      </div>

      {/* 4. 메뉴 목록 */}
      <section style={{ margin: '28px 20px 0' }}>
        <SkeletonBlock width={78} height={15} style={{ marginBottom: 8 }} />
        <div style={{ borderTop: `1.5px solid ${SKELETON_FILL}`, display: 'flex', flexDirection: 'column' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 64,
                boxSizing: 'border-box',
                borderBottom: `1px solid ${SKELETON_FILL}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <SkeletonBlock width="44%" height={17} />
              <SkeletonBlock width={14} height={14} />
            </div>
          ))}
        </div>
      </section>
    </AppSkeleton>
  )
}
