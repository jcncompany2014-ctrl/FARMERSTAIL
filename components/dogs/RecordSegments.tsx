/**
 * RecordSegments — "기록" 허브 상단 세그먼트 토글 [일상 | 건강일지].
 *
 * 2026-07-09 (사장님 지시): 일상(/diary, 사진 일기)과 건강일지(/health)가 서로
 * 다른 진입점에서 따로 떠서 헷갈렸던 문제 해결. 두 화면 상단에 같은 토글을 얹어
 * 어디서 들어오든 하나의 "기록" 허브처럼 보이고 즉시 전환된다.
 *
 * 앱 전용(v3 토큰 --paper-* / --ink*). Link 만 사용 — 훅 없음. active prop 으로
 * 현재 세그먼트를 명시(서버/클라 양쪽 안전). 데이터 페칭은 각 라우트가 그대로.
 */
import Link from 'next/link'
import { Camera, HeartPulse } from 'lucide-react'

export default function RecordSegments({
  dogId,
  active,
  className,
}: {
  dogId: string
  active: 'diary' | 'health'
  className?: string
}) {
  const segs = [
    { key: 'diary', label: '일상', href: `/dogs/${dogId}/diary`, Icon: Camera },
    { key: 'health', label: '건강일지', href: `/dogs/${dogId}/health`, Icon: HeartPulse },
  ] as const

  return (
    <nav className={className} aria-label="기록 종류">
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: 4,
          background: 'var(--paper-deep)',
          borderRadius: 12,
        }}
      >
        {segs.map(({ key, label, href, Icon }) => {
          const on = key === active
          return (
            <Link
              key={key}
              href={href}
              aria-current={on ? 'page' : undefined}
              className="flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
              style={{
                flex: 1,
                padding: '9px 8px',
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: on ? 700 : 600,
                letterSpacing: '-0.01em',
                textDecoration: 'none',
                color: on ? 'var(--ink)' : 'var(--ink-mute)',
                background: on ? 'var(--paper-hi)' : 'transparent',
                boxShadow: on ? '0 1px 3px rgba(22,20,15,0.10)' : 'none',
              }}
            >
              <Icon style={{ width: 15, height: 15 }} strokeWidth={on ? 2.4 : 2} aria-hidden />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
