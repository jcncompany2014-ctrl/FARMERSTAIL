import Link from 'next/link'
import { Sprout, MessageCircle, Ruler, PartyPopper } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { OnboardingPhase } from '@/lib/onboarding/grace-period'
import { V3, V3Radius } from '@/lib/design/tokens'

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
 *
 * 2026-10-09 앱 새 디자인('A 포스터'): 이 카드만의 시안은 없어 같은 화면의 보조 카드 규칙(회색 면 + 왼쪽
 * 6px 머스타드 띠 · 모서리 4)으로 그렸다. 아이콘(먹색) + 제목(17 굵게) · 설명 · 먹색 네모 버튼.
 * 4주차 제목의 이모지("🎉")는 뺐다(사장님 결정 — 이모지 대신 앱 아이콘, 축하 그림은 옆 아이콘이 맡는다).
 */
type PhaseContent = {
  Icon: LucideIcon
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
    title: '첫 주는 천천히, 편하게',
    body: () =>
      '정확한 케어는 데이터가 쌓이면서 좋아져요. 지금은 부담 없이 앱을 둘러보세요.',
    cta: null,
  },
  gentle_checkin: {
    Icon: MessageCircle,
    title: '2주차예요 — 잘 지내고 있나요?',
    body: (n) =>
      `${n ? `${n} ` : '우리 아이 '}밥은 잘 먹는지, 변은 괜찮은지 살짝 체크인해볼까요?`,
    cta: { label: '체크인하기', href: (id) => (id ? `/dogs/${id}/checkin` : '/dashboard') },
  },
  optional_nudge: {
    Icon: Ruler,
    title: '3주차 — 더 정확하게 맞춰볼까요?',
    body: () =>
      '체중을 한 번 재서 기록하면 급여량이 더 정밀해져요. 지금 안 하셔도 괜찮아요.',
    // href 는 onAction 이 없는 호출자(홈 등)용 폴백 — 프로필에서는 action 이 먼저다.
    cta: { label: '체중 기록하기', href: (id) => (id ? `/dogs/${id}` : '/dashboard'), action: 'weight' },
  },
  conservative: {
    Icon: PartyPopper,
    title: '한 달 함께했어요',
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
    marginTop: 12,
    height: 44,
    padding: '0 16px',
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: 'inherit',
    fontSize: 15,
    fontWeight: 800,
    borderRadius: V3Radius.sm,
    background: V3.ink,
    color: '#FFFFFF',
    textDecoration: 'none',
  } as const
  const inPlace = c.cta?.action && onAction

  return (
    <section
      aria-label="첫 4주 안내"
      style={{
        margin: '20px 20px 0',
        padding: '14px 16px 16px',
        borderRadius: V3Radius.sm,
        background: V3.soft,
        borderLeft: `6px solid ${V3.mustard}`,
        color: V3.ink,
      }}
    >
      <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 800, lineHeight: 1.35 }}>
        <Icon size={20} color={V3.ink} strokeWidth={2} aria-hidden style={{ flexShrink: 0 }} />
        {c.title}
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 15, lineHeight: 1.55, color: V3.inkSoft }}>{c.body(dogName)}</p>
      {c.cta && inPlace && (
        <button
          type="button"
          onClick={() => onAction(c.cta!.action!)}
          style={{ ...ctaStyle, border: 0, cursor: 'pointer' }}
        >
          {c.cta.label}
        </button>
      )}
      {c.cta && !inPlace && (
        <Link href={c.cta.href(dogId)} style={ctaStyle}>
          {c.cta.label}
        </Link>
      )}
    </section>
  )
}
