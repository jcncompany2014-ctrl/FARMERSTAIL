/**
 * RecordSegments — "기록" 허브 상단 세그먼트 토글 [일상 | 건강일지].
 *
 * 2026-07-09 (사장님 지시): 일상(/diary, 사진 일기)과 건강일지(/health)가 서로
 * 다른 진입점에서 따로 떠서 헷갈렸던 문제 해결. 두 화면 상단에 같은 토글을 얹어
 * 어디서 들어오든 하나의 "기록" 허브처럼 보이고 즉시 전환된다.
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 D01·D05): 회색 면(#F6F4F5) 안 두 칸 · 높이 48 · 모서리 4.
 * 켜진 칸 = 흰 바탕 + 1.5px 먹선 + 먹색 800, 꺼진 칸 = 회색 600. 아이콘은 시안 선 그림(사진기·맥박 하트).
 * 바깥 여백(위 18 · 좌우 20)은 이 부품이 가진다 — 두 화면이 같은 자리에 놓이게.
 *
 * 앱 전용. Link 만 사용 — 훅 없음. active prop 으로 현재 세그먼트를 명시(서버/클라 양쪽 안전).
 * 데이터 페칭은 각 라우트가 그대로.
 */
import Link from 'next/link'
import { V3, V3Radius } from '@/lib/design/tokens'
import { CameraIcon, HeartPulseIcon } from '@/components/v3/dog/DogIcons'

export default function RecordSegments({
  dogId,
  active,
}: {
  dogId: string
  active: 'diary' | 'health'
}) {
  const segs = [
    { key: 'diary', label: '일상', href: `/dogs/${dogId}/diary`, Icon: CameraIcon },
    { key: 'health', label: '건강일지', href: `/dogs/${dogId}/health`, Icon: HeartPulseIcon },
  ] as const

  return (
    <nav aria-label="기록 종류" style={{ margin: '18px 20px 0' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 4,
          padding: 4,
          background: V3.soft,
          borderRadius: V3Radius.sm,
        }}
      >
        {segs.map(({ key, label, href, Icon }) => {
          const on = key === active
          return (
            <Link
              key={key}
              href={href}
              aria-current={on ? 'page' : undefined}
              className="flex items-center justify-center ft-no-press"
              style={{
                height: 48,
                boxSizing: 'border-box',
                gap: 7,
                borderRadius: V3Radius.sm,
                border: on ? `1.5px solid ${V3.ink}` : 0,
                background: on ? '#FFFFFF' : 'transparent',
                fontSize: 17,
                fontWeight: on ? 800 : 600,
                color: on ? V3.ink : V3.inkMute,
                textDecoration: 'none',
              }}
            >
              <Icon size={19} strokeWidth={on ? 2.2 : 2} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
