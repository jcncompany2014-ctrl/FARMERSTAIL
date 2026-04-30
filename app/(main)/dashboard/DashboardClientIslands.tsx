'use client'

/**
 * Dashboard 의 클라이언트 전용 "섬" 모듈.
 *
 * 왜 섬인가
 * --------
 * 이전엔 대시보드 page.tsx 전체가 `'use client'` 라서 페이지 마운트 →
 * auth 확인 → 5개 쿼리 순차 실행 → 전체 UI 렌더, 이 동안 풀페이지 스피너가
 * 떠있었다. 측정값: JS 번들 hydration + 5×RTT 후에야 첫 유효 페인트.
 *
 * 여기 있는 건 두 가지 "반드시 클라이언트 JS" 가 필요한 부분뿐:
 *   1) OngoingEvents 가로 스냅 캐러셀 — scroll 이벤트 + rAF + activeIdx 도트
 *   2) WelcomeBenefitModal — 3시간 카운트다운 + ESC 키 + body scroll lock
 *
 * 나머지 (헤더, 다음배송 히어로, 내 강아지, 카테고리, 상품 그리드, 브랜드
 * 패널) 는 모두 순수 JSX 라 서버에서 렌더해 HTML 로 바로 전송한다.
 */

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useCallback,
} from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useModalA11y } from '@/lib/ui/useModalA11y'
import {
  formatEventDateRange,
  type EventItem,
  type EventPalette,
} from '@/lib/events/data'

// Palette 매핑 — page.tsx 의 EVENT_PALETTE 와 동일한 언어. 대시보드 안에서만
// 쓰이므로 여기 컴포넌트에 co-locate.
const EVENT_PALETTE: Record<
  EventPalette,
  { bg: string; text: string; accent: string; body: string; ruleAlpha: string }
> = {
  ink: {
    bg: 'var(--ink)',
    text: 'var(--bg)',
    accent: 'var(--gold)',
    body: 'rgba(245,240,230,0.76)',
    ruleAlpha: 'rgba(245,240,230,0.18)',
  },
  terracotta: {
    bg: 'var(--terracotta)',
    text: 'var(--bg)',
    accent: '#F5E0C2',
    body: 'rgba(245,240,230,0.85)',
    ruleAlpha: 'rgba(245,240,230,0.22)',
  },
  moss: {
    bg: 'var(--moss)',
    text: 'var(--bg)',
    accent: 'var(--gold)',
    body: 'rgba(245,240,230,0.82)',
    ruleAlpha: 'rgba(245,240,230,0.22)',
  },
  gold: {
    bg: 'var(--gold)',
    text: 'var(--ink)',
    accent: 'var(--terracotta)',
    body: 'rgba(30,26,20,0.7)',
    ruleAlpha: 'rgba(30,26,20,0.18)',
  },
}

export function OngoingEvents({
  events,
  userCreatedAt,
}: {
  events: EventItem[]
  /**
   * 현재 로그인된 유저의 회원가입 시각 (ISO). null 이면 비로그인 상태.
   * 이 값이 있을 때만 WELCOME 카드가 Link (→ /signup) 대신 버튼 (→ 모달 오픈)
   * 으로 바뀐다. 모달은 이 시각을 기준으로 3시간 카운트다운을 보여줌.
   */
  userCreatedAt: string | null
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [welcomeOpen, setWelcomeOpen] = useState(false)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    let raf = 0
    const handle = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const children = Array.from(el.children) as HTMLElement[]
        if (children.length === 0) return
        const center = el.scrollLeft + el.clientWidth / 2
        let best = 0
        let bestDist = Infinity
        children.forEach((child, i) => {
          const c = child.offsetLeft + child.clientWidth / 2
          const d = Math.abs(c - center)
          if (d < bestDist) {
            bestDist = d
            best = i
          }
        })
        setActiveIdx(best)
      })
    }
    el.addEventListener('scroll', handle, { passive: true })
    handle()
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', handle)
    }
  }, [events.length])

  const scrollToIdx = (idx: number) => {
    const el = scrollerRef.current
    if (!el) return
    const target = el.children[idx] as HTMLElement | undefined
    if (!target) return
    el.scrollTo({ left: target.offsetLeft, behavior: 'smooth' })
  }

  if (events.length === 0) return null

  return (
    <section className="mb-8">
      <div className="px-5 flex items-end justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles
              className="w-3.5 h-3.5"
              style={{ color: 'var(--terracotta)' }}
              strokeWidth={2}
            />
            <span className="kicker">Ongoing · 진행중</span>
          </div>
          <h2
            className="font-serif"
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            진행중인 이벤트
          </h2>
        </div>
        <div
          className="text-[10px] font-mono tabular-nums pb-0.5"
          style={{ color: 'var(--muted)', letterSpacing: '0.05em' }}
        >
          {String(activeIdx + 1).padStart(2, '0')}
          <span className="mx-1 opacity-60">/</span>
          {String(events.length).padStart(2, '0')}
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory"
        style={{
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
        }}
      >
        {events.map((event) => {
          if (event.kind === 'welcome' && userCreatedAt) {
            return (
              <EventCard
                key={event.id}
                event={event}
                onClick={() => setWelcomeOpen(true)}
              />
            )
          }
          return <EventCard key={event.id} event={event} />
        })}
      </div>

      {events.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {events.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToIdx(i)}
              aria-label={`${i + 1}번째 이벤트`}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i === activeIdx ? 20 : 5,
                background: i === activeIdx ? 'var(--ink)' : 'var(--rule-2)',
              }}
            />
          ))}
        </div>
      )}

      {welcomeOpen && userCreatedAt && (
        <WelcomeBenefitModal
          userCreatedAt={userCreatedAt}
          onClose={() => setWelcomeOpen(false)}
        />
      )}
    </section>
  )
}

function EventCard({
  event,
  onClick,
}: {
  event: EventItem
  onClick?: () => void
}) {
  const palette = EVENT_PALETTE[event.palette]
  const dateRange = formatEventDateRange(event.startsAt, event.endsAt)

  const wrapperClass =
    'group relative shrink-0 basis-full snap-start overflow-hidden flex flex-col text-left'
  const wrapperStyle: React.CSSProperties = {
    height: 200,
    background: palette.bg,
    color: palette.text,
    ...(onClick
      ? { border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }
      : {}),
  }

  // ⚠️ React 19 의 react-hooks/static-components 룰 때문에 "Wrapper 라는
  // 로컬 컴포넌트 를 render 안에서 정의해 children 을 주입" 하는 패턴은 금지.
  // (children 을 통째로 재마운트시킬 수 있어서.) → onClick 유/무로 바깥 엘리먼트
  // 만 분기하고, 내용은 JSX 조각으로 한 번만 만들어 양쪽에 꽂는다.
  const inner = (
    <>
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 115% -10%, rgba(255,255,255,0.14) 0%, transparent 55%)',
        }}
      />

      <div className="relative z-10 flex items-center justify-between px-5 pt-5">
        <span
          className="inline-flex items-center gap-1.5 text-[9.5px] font-bold px-2.5 py-1 rounded-full"
          style={{
            background: palette.ruleAlpha,
            color: palette.text,
            letterSpacing: '0.08em',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: palette.accent }}
          />
          {event.statusLabel}
        </span>
        <span
          className="font-mono text-[10px] tabular-nums"
          style={{ color: palette.body, letterSpacing: '0.02em' }}
        >
          {dateRange}
        </span>
      </div>

      <div className="relative flex-1 flex items-end justify-between gap-4 px-5 pb-5">
        <div className="min-w-0 flex-1">
          <span
            className="text-[9.5px] font-semibold uppercase"
            style={{
              color: palette.body,
              letterSpacing: '0.18em',
            }}
          >
            {event.kicker}
          </span>
          <div
            className="font-serif mt-1.5 leading-[0.95]"
            style={{
              fontSize: 30,
              fontWeight: 900,
              color: palette.text,
              letterSpacing: '-0.035em',
            }}
          >
            {event.enTitle}
          </div>
          <div
            className="mt-1.5 flex items-baseline gap-2 flex-wrap"
            style={{ letterSpacing: '-0.01em' }}
          >
            <span
              className="italic"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                fontWeight: 500,
                color: palette.body,
              }}
            >
              {event.koSubtitle}
            </span>
            <span
              className="font-serif"
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: palette.accent,
                letterSpacing: '-0.015em',
              }}
            >
              · {event.highlight}
            </span>
          </div>
        </div>
        <div
          aria-hidden
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-active:scale-95"
          style={{
            background: palette.text,
            color: palette.bg,
          }}
        >
          <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
        </div>
      </div>
    </>
  )

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={wrapperClass}
      style={wrapperStyle}
      aria-label={`${event.enTitle} 이벤트 자세히 보기`}
    >
      {inner}
    </button>
  ) : (
    <Link href={event.href} className={wrapperClass} style={wrapperStyle}>
      {inner}
    </Link>
  )
}

const WELCOME_WINDOW_MS = 3 * 60 * 60 * 1000 // 3시간

function WelcomeBenefitModal({
  userCreatedAt,
  onClose,
}: {
  userCreatedAt: string
  onClose: () => void
}) {
  const expiresAtMs = new Date(userCreatedAt).getTime() + WELCOME_WINDOW_MS
  const [now, setNow] = useState(() => Date.now())
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Esc / focus trap / body scroll lock / focus restore — useModalA11y 가 처리.
  useModalA11y({ open: true, onClose, containerRef: dialogRef })

  const remaining = Math.max(0, expiresAtMs - now)
  const expired = remaining === 0
  const hh = Math.floor(remaining / 3600000)
  const mm = Math.floor((remaining % 3600000) / 60000)
  const ss = Math.floor((remaining % 60000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      tabIndex={-1}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center px-5 outline-none"
      style={{
        background: 'rgba(20, 16, 12, 0.56)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'welcomeModalFadeIn .22s ease-out',
      }}
    >
      <style>{`
        @keyframes welcomeModalFadeIn {
          from { opacity: 0 }
          to { opacity: 1 }
        }
        @keyframes welcomeModalPopIn {
          from { opacity: 0; transform: translateY(8px) scale(.98) }
          to { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden"
        style={{
          background: 'var(--terracotta)',
          color: 'var(--bg)',
          borderRadius: 20,
          boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          animation: 'welcomeModalPopIn .28s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 115% -10%, rgba(255,255,255,0.18) 0%, transparent 55%)',
          }}
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 z-10 w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(245,240,230,0.16)',
            color: 'var(--bg)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1.5 1.5l11 11m0-11l-11 11"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="relative px-6 pt-8 pb-7">
          <span
            className="text-[9.5px] font-semibold uppercase"
            style={{
              color: 'rgba(245,240,230,0.78)',
              letterSpacing: '0.2em',
            }}
          >
            First Order · 첫 주문 혜택
          </span>

          <h3
            id="welcome-modal-title"
            className="font-serif mt-2 leading-[0.95]"
            style={{
              fontSize: 34,
              fontWeight: 900,
              letterSpacing: '-0.035em',
            }}
          >
            {expired ? '시간이 지났어요.' : 'WELCOME.'}
          </h3>

          {!expired && (
            <p
              className="font-serif italic mt-2"
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: '#F5E0C2',
                letterSpacing: '-0.01em',
              }}
            >
              처음이신가요?
            </p>
          )}

          <div
            className="mt-5"
            style={{
              paddingTop: 16,
              borderTop: '1px solid rgba(245,240,230,0.22)',
            }}
          >
            {expired ? (
              <p
                className="leading-relaxed"
                style={{
                  fontSize: 13,
                  color: 'rgba(245,240,230,0.88)',
                }}
              >
                아쉽지만 첫 주문 혜택은 <strong>가입 후 3시간</strong>만 유효
                합니다. 다음 이벤트 소식은 홈에서 계속 전해드릴게요.
              </p>
            ) : (
              <>
                <div
                  className="text-[9.5px] font-semibold uppercase"
                  style={{
                    color: 'rgba(245,240,230,0.78)',
                    letterSpacing: '0.2em',
                  }}
                >
                  Benefit
                </div>
                <div
                  className="font-serif mt-1"
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: '#F5E0C2',
                    letterSpacing: '-0.025em',
                  }}
                >
                  ₩5,000 + 무료배송
                </div>
                <p
                  className="mt-2 leading-relaxed"
                  style={{
                    fontSize: 12.5,
                    color: 'rgba(245,240,230,0.88)',
                  }}
                >
                  첫 주문에 자동 적용돼요. 수의영양학 기반 라인 전체에 사용
                  가능합니다.
                </p>
              </>
            )}
          </div>

          {!expired && (
            <div
              className="mt-5 flex items-center justify-between"
              style={{
                paddingTop: 14,
                borderTop: '1px dashed rgba(245,240,230,0.28)',
              }}
            >
              <span
                className="text-[10px] font-semibold uppercase"
                style={{
                  color: 'rgba(245,240,230,0.72)',
                  letterSpacing: '0.18em',
                }}
              >
                남은 시간
              </span>
              <span
                className="font-mono tabular-nums"
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--bg)',
                  letterSpacing: '0.02em',
                }}
                aria-live="polite"
              >
                {pad(hh)}:{pad(mm)}:{pad(ss)}
              </span>
            </div>
          )}

          <div className="mt-6">
            {expired ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-full py-3.5 text-[13px] font-semibold"
                style={{
                  background: 'var(--bg)',
                  color: 'var(--terracotta)',
                  letterSpacing: '-0.01em',
                }}
              >
                확인
              </button>
            ) : (
              <Link
                href="/products?welcome=1"
                onClick={onClose}
                className="w-full rounded-full py-3.5 text-[13px] font-semibold flex items-center justify-center gap-2"
                style={{
                  background: 'var(--bg)',
                  color: 'var(--terracotta)',
                  letterSpacing: '-0.01em',
                }}
              >
                지금 장보러 가기
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// 데이트 스탬프 로직은 `lib/dateStamp.ts` 로 이전 — Dashboard 마스트헤드와
// AppChrome 헤더가 같은 stamp 를 쓰기 때문에 SSOT 로 추출. 기존 동작 동일.
import { EMPTY_SUBSCRIBE } from '@/lib/dateStamp'

function computeGreeting(): string {
  const h = new Date().getHours()
  return h >= 5 && h < 11
    ? '좋은 아침이에요.'
    : h >= 11 && h < 17
      ? '좋은 오후예요.'
      : h >= 17 && h < 21
        ? '좋은 저녁이에요.'
        : '편안한 밤이에요.'
}

/**
 * 시간대 인사말 — 서버/클라 불일치 방지를 위해 클라이언트에서만 계산.
 * page.tsx 의 h1 안에 inline 으로 들어가는 용도.
 */
export function DashboardGreeting() {
  const getClient = useCallback(() => computeGreeting(), [])
  const getServer = useCallback(() => '', [])
  const greeting = useSyncExternalStore<string>(
    EMPTY_SUBSCRIBE,
    getClient,
    getServer,
  )

  // hydration 전엔 nbsp 하나로 자리 확보 → layout shift 최소화.
  return <>{greeting || '\u00a0'}</>
}
