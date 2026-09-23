import Link from 'next/link'
import { Sprout, MessageCircle, Ruler, PartyPopper } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { OnboardingPhase } from '@/lib/onboarding/grace-period'
import { V3, V3FontSize, V3FontWeight, V3Radius } from '@/lib/design/tokens'

/**
 * GracePeriodBanner — 첫 4주 온보딩 여정 카드 (lib/onboarding/grace-period 연결).
 *
 * 신규 구독자 첫 4주 이탈률 60% → 그 기간을 "숨기는 정책"이 아니라 "안내받는
 * 여정"으로. phase 별로 톤을 바꿔 부담을 낮추고 자연스레 정밀도를 끌어올린다.
 * 'normal'(29일+)은 null → 자동 졸업. presentation only(서버 컴포넌트 OK).
 *
 * ★2026-09-23 사장님 제보(땅콩이 프로필): 3주차 "체중 기록하기"가 눌러도 아무 일이
 *   없었다. 링크가 `/dogs/{id}` 였는데, 이 카드는 2026-07-24 부터 **그 프로필 페이지
 *   안에** 그려진다 — 자기 자신으로 가는 링크라 화면이 안 바뀌었다. 홈에 있던 시절의
 *   목적지가 그대로 남은 것. 지금은 `action: 'weight'` 로 표시하고 호출자가
 *   `onAction` 으로 그 자리의 체중 입력 모달을 연다(규칙87).
 */
type PhaseContent = {
  Icon: LucideIcon
  iconColor: string
  title: string
  body: (dogName: string | null) => string
  cta:
    | {
        label: string
        href: (dogId: string | null) => string
        /** 페이지 이동이 아니라 호출자가 그 자리에서 처리해야 하는 동작. */
        action?: 'weight'
      }
    | null
}

const CONTENT: Record<Exclude<OnboardingPhase, 'normal'>, PhaseContent> = {
  silent: {
    Icon: Sprout,
    iconColor: V3.sage,
    title: '첫 주는 천천히, 편하게',
    body: () =>
      '정확한 케어는 데이터가 쌓이면서 좋아져요. 지금은 부담 없이 앱을 둘러보세요.',
    cta: null,
  },
  gentle_checkin: {
    Icon: MessageCircle,
    iconColor: V3.accent,
    title: '2주차예요 — 잘 지내고 있나요?',
    body: (n) =>
      `${n ? `${n} ` : '우리 아이 '}밥은 잘 먹는지, 변은 괜찮은지 살짝 체크인해볼까요?`,
    cta: { label: '체크인하기', href: (id) => (id ? `/dogs/${id}/checkin` : '/dashboard') },
  },
  optional_nudge: {
    Icon: Ruler,
    iconColor: V3.accent,
    title: '3주차 — 더 정확하게 맞춰볼까요?',
    body: () =>
      '체중을 한 번 재서 기록하면 급여량이 더 정밀해져요. 지금 안 하셔도 괜찮아요.',
    // href 는 onAction 이 없는 호출자(홈 등)용 폴백 — 프로필에서는 action 이 먼저다.
    cta: { label: '체중 기록하기', href: (id) => (id ? `/dogs/${id}` : '/dashboard'), action: 'weight' },
  },
  conservative: {
    Icon: PartyPopper,
    iconColor: V3.accent,
    title: '한 달 함께했어요 🎉',
    body: () =>
      '이제 데이터가 쌓였어요. 다음 박스부터 조금씩 더 정밀하게 맞춰드릴게요.',
    cta: null,
  },
}

export default function GracePeriodBanner({
  phase,
  dogName,
  dogId,
  onAction,
}: {
  phase: OnboardingPhase
  dogName: string | null
  dogId: string | null
  /** CTA 가 페이지 이동 대신 그 자리 동작이어야 할 때(프로필: 체중 모달 열기). */
  onAction?: (action: 'weight') => void
}) {
  if (phase === 'normal') return null
  const c = CONTENT[phase]
  const { Icon } = c
  const ctaStyle = {
    marginTop: 10,
    gap: 5,
    padding: '10px 18px',
    fontSize: V3FontSize.sm,
    fontWeight: V3FontWeight.bold,
    borderRadius: V3Radius.pill,
    background: V3.ink,
    color: V3.paperHi,
    textDecoration: 'none',
  } as const
  const inPlace = c.cta?.action && onAction

  return (
    <section style={{ padding: '12px 20px 0' }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          borderRadius: V3Radius.sm,
          border: `1px solid ${V3.rule}`,
          background: V3.paperHi,
          padding: '14px 16px',
        }}
      >
        <span
          className="flex items-center justify-center shrink-0"
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            background: V3.paper,
            border: `1px solid ${V3.rule}`,
          }}
        >
          <Icon size={18} color={c.iconColor} strokeWidth={1.7} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.bold,
              fontSize: V3FontSize.base,
              color: V3.ink,
              letterSpacing: '-0.015em',
            }}
          >
            {c.title}
          </h3>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: V3FontSize.sm,
              color: V3.inkMute,
              lineHeight: 1.5,
            }}
          >
            {c.body(dogName)}
          </p>
          {c.cta && inPlace && (
            <button
              type="button"
              onClick={() => onAction(c.cta!.action!)}
              className="inline-flex items-center active:scale-[0.98] transition"
              style={{ ...ctaStyle, border: 0, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {c.cta.label}
            </button>
          )}
          {c.cta && !inPlace && (
            <Link
              href={c.cta.href(dogId)}
              className="inline-flex items-center active:scale-[0.98] transition"
              style={ctaStyle}
            >
              {c.cta.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
