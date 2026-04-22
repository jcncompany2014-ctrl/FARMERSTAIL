'use client'

/**
 * Farmer's Tail — first-launch onboarding carousel.
 *
 * 6 slides, horizontal scroll-snap. Styles live in Onboarding.module.css;
 * design tokens come from globals.css. Ported from the Claude Design
 * handoff at .claude-design/farmerstailapp-handoff/project/onboarding.jsx —
 * where the CTAs in the prototype alerted strings, here they navigate via
 * next/router and mark onboarding complete via lib/onboarding.ts.
 *
 * The OnboardingGate only redirects standalone-mode visitors here on their
 * first install, so this flow is effectively the installed PWA's splash.
 * The skip button (top-right) jumps to the final CTA slide; there is no
 * bypass-to-landing option by design — installed users must sign up or log
 * in to progress.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useRouter } from 'next/navigation'
import { markOnboarded } from '@/lib/onboarding'
import styles from './Onboarding.module.css'

const TOTAL = 6
const LS_INDEX_KEY = 'ft_onb_idx'

/* -------------------------------------------------------------------------
 * Photo tile — matches the handoff's PhotoTile.
 *
 * The original handoff pulled Unsplash URLs as visual-parity placeholders.
 * Those were dropped in favor of the paper-tone `illoFallback` stripe +
 * tint overlay + vignette + kicker-style label, which reads on-brand
 * without any network fetch — important for the PWA's offline first-launch
 * case. When curated brand photography lands, pass it via `src` (optional);
 * next/image + preload hints can be reintroduced at that point.
 * ---------------------------------------------------------------------- */
type Tint = 'cream' | 'terra' | 'moss' | 'gold'
type Size = 'lg' | 'sm' | 'tile'

const TINT: Record<Tint, string> = {
  cream: 'rgba(245,240,230,0.04)',
  terra: 'rgba(160,69,46,0.06)',
  moss: 'rgba(107,127,58,0.06)',
  gold: 'rgba(212,184,114,0.08)',
}

function sizeClass(size: Size): string {
  if (size === 'lg') return styles.illoLg
  if (size === 'sm') return styles.illoSm
  return styles.illoTile
}

function PhotoTile({
  src,
  label,
  tint = 'cream',
  size = 'lg',
}: {
  /** Optional brand photo. When omitted, the paper-tone stripe is used. */
  src?: string
  label: string
  tint?: Tint
  size?: Size
}) {
  const tileSize = size === 'tile'
  return (
    <div className={`${styles.illo} ${sizeClass(size)}`}>
      <div className={styles.illoFallback} aria-hidden />
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.illoPhoto}
          src={src}
          alt=""
          loading="lazy"
          onError={(e) => {
            // Hide broken image — fallback stripe stays visible behind it.
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
      <div
        className={styles.illoTint}
        style={{ background: TINT[tint] }}
        aria-hidden
      />
      <div className={styles.illoVignette} aria-hidden />
      <span
        className={`${styles.illoLabel} ${
          tileSize ? styles.illoLabelTile : ''
        }`}
      >
        {label}
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------
 * Slide shells
 * ---------------------------------------------------------------------- */
type Align = 'center' | 'top' | 'bottom'

function alignClass(align: Align): string {
  if (align === 'top') return styles.alignTop
  if (align === 'bottom') return styles.alignBottom
  return styles.alignCenter
}

function SlideFrame({
  children,
  align = 'center',
}: {
  children: React.ReactNode
  align?: Align
}) {
  return (
    <section className={styles.slide}>
      <div className={`${styles.slideInner} ${alignClass(align)}`}>
        {children}
      </div>
    </section>
  )
}

function Slide01() {
  return (
    <SlideFrame>
      <div className={styles.illoWrap}>
        <PhotoTile label="WELCOME" tint="terra" />
      </div>
      <div className={styles.copy}>
        <h1 className={styles.headline}>
          안녕, 우리 아이의
          <br />
          새로운 한 끼
        </h1>
        <p className={styles.sub}>파머스테일에 오신 걸 환영합니다</p>
      </div>
    </SlideFrame>
  )
}

function Slide02() {
  return (
    <SlideFrame>
      <div className={styles.illoWrap}>
        <PhotoTile label="RECIPE" tint="moss" />
      </div>
      <div className={styles.copy}>
        <h1 className={styles.headline}>
          수의영양학 기반
          <br />
          레시피
        </h1>
        <p className={styles.sub}>
          수의사와 함께 설계한 맞춤 식단.
          <br />
          품종·연령·컨디션에 맞춰 고르세요.
        </p>
      </div>
    </SlideFrame>
  )
}

type LineupItem = {
  ko: string
  en: string
  copy: string
  label: string
}

const LINEUP: LineupItem[] = [
  {
    ko: '화식',
    en: 'FRESH',
    copy: '매일의 한 끼',
    label: 'FRESH',
  },
  {
    ko: '동결건조',
    en: 'FREEZE-DRIED',
    copy: '가벼운 간식 · 트래블',
    label: 'FREEZE-DRIED',
  },
  {
    ko: '냉동 토퍼',
    en: 'FROZEN TOPPER',
    copy: '사료 위에 올려 영양 추가',
    label: 'FROZEN TOPPER',
  },
]

function Slide03() {
  return (
    <SlideFrame align="top">
      <div className={`${styles.copy} ${styles.copyTop}`}>
        <h1 className={styles.headline}>
          세 가지 방식으로,
          <br />
          기호에 맞게
        </h1>
        <p className={styles.sub}>
          화식 · 동결건조 · 냉동 토퍼
          <br />
          오늘 컨디션과 취향에 맞춰 급여하세요.
        </p>
      </div>
      <div className={styles.lineup}>
        {LINEUP.map((it, i) => (
          <div
            key={it.en}
            className={`${styles.lineupRow} ${
              i === 0 ? '' : styles.lineupRowDivider
            }`}
          >
            <div className={styles.lineupPh}>
              <PhotoTile label={it.label} size="tile" />
            </div>
            <div className={styles.lineupText}>
              <div className={styles.lineupLabel}>
                <span className={styles.lineupKo}>{it.ko}</span>
                <span className={styles.lineupEn}>/ {it.en}</span>
              </div>
              <div className={styles.lineupCopy}>{it.copy}</div>
            </div>
          </div>
        ))}
      </div>
    </SlideFrame>
  )
}

function Slide04() {
  return (
    <SlideFrame>
      <div className={styles.illoWrap}>
        <PhotoTile label="JOURNAL" tint="gold" />
      </div>
      <div className={styles.copy}>
        <h1 className={styles.headline}>
          우리 아이의 건강을
          <br />
          기록하세요
        </h1>
        <p className={styles.sub}>
          체중·급식·배변·산책을 가볍게 남기면,
          <br />
          AI 수의영양사가 분석 리포트를 보내드려요.
        </p>
      </div>
    </SlideFrame>
  )
}

function Slide05() {
  return (
    <SlideFrame>
      <div className={styles.illoWrap}>
        <PhotoTile label="SUBSCRIBE" tint="terra" />
      </div>
      <div className={styles.copy}>
        <h1 className={styles.headline}>
          딱 맞는 주기로,
          <br />
          자동으로
        </h1>
        <p className={styles.sub}>
          떨어질 때쯤 다음 패키지가 도착해요.
          <br />
          예방접종·건강검진 알림도 놓치지 마세요.
        </p>
      </div>
    </SlideFrame>
  )
}

function Slide06({
  variant = 'with-illo',
  onStart,
  onLogin,
}: {
  variant?: 'with-illo' | 'cta-only'
  onStart: () => void
  onLogin: () => void
}) {
  return (
    <SlideFrame align="bottom">
      <div className={styles.s6Head}>
        {variant === 'with-illo' && (
          <div className={`${styles.illoWrap} ${styles.illoWrapSm}`}>
            <PhotoTile label="BEGIN" tint="terra" size="sm" />
          </div>
        )}
        <div className={styles.copy}>
          <h1 className={styles.headline}>지금 시작하기</h1>
          <p className={styles.sub}>
            첫 주문 20% 할인 + 체험팩 프리셋 제공
          </p>
        </div>
      </div>
      <div className={styles.ctaStack}>
        <button
          type="button"
          className={`${styles.cta} ${styles.ctaPrimary}`}
          onClick={onStart}
        >
          시작하기
        </button>
        <button
          type="button"
          className={`${styles.cta} ${styles.ctaGhost}`}
          onClick={onLogin}
        >
          이미 계정이 있어요
        </button>
        <p className={styles.micro}>
          계속 진행하시면 이용약관·개인정보처리방침에
          <br />
          동의하게 됩니다.
        </p>
      </div>
    </SlideFrame>
  )
}

/* -------------------------------------------------------------------------
 * Carousel
 * ---------------------------------------------------------------------- */
export default function Onboarding({
  slide6Variant = 'with-illo',
}: {
  slide6Variant?: 'with-illo' | 'cta-only'
}) {
  const router = useRouter()
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // Restore last-seen slide index so reloads resume mid-flow. Initializer
  // reads localStorage exactly once; we keep `ft_onboarded` (separate key)
  // as the completion flag so resume + gate-dismiss stay independent.
  const [idx, setIdx] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    try {
      const saved = Number(window.localStorage.getItem(LS_INDEX_KEY))
      return Number.isFinite(saved) && saved >= 0 && saved < TOTAL ? saved : 0
    } catch {
      return 0
    }
  })

  // Persist current slide for resume. Written eagerly so even an abrupt
  // quit (user kills the PWA mid-onboarding) survives.
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_INDEX_KEY, String(idx))
    } catch {
      /* private mode / quota — harmless */
    }
  }, [idx])

  // Jump to saved slide on mount without triggering a visible scroll
  // animation. Smooth scrolling is added AFTER the initial jump so the
  // programmatic `goTo` during steady-state gets the nice animation but
  // the first paint lands already-positioned.
  const [smooth, setSmooth] = useState(false)
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    if (idx !== 0) {
      el.scrollLeft = idx * el.clientWidth
    }
    // Next frame — after the instant jump — enable smooth behavior.
    const raf = requestAnimationFrame(() => setSmooth(true))
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Observe scroll → sync idx. Uses scroll-math (Math.round) rather than
  // IntersectionObserver because scroll-snap guarantees integer positions
  // at rest; this avoids the observer's "mostly visible" fuzziness and
  // the extra subscription.
  const onScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const w = el.clientWidth
    if (w === 0) return
    const i = Math.round(el.scrollLeft / w)
    setIdx((prev) => (i !== prev ? i : prev))
  }, [])

  const goTo = useCallback((i: number) => {
    const el = scrollerRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(TOTAL - 1, i))
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' })
  }, [])

  const skipToEnd = useCallback(() => goTo(TOTAL - 1), [goTo])
  const next = useCallback(() => goTo(idx + 1), [goTo, idx])

  // Completion exits — clear the resume index so a future reinstall
  // doesn't dump the user back into slide N; onboarding is one-and-done
  // via the `ft_onboarded` flag in lib/onboarding.ts.
  const complete = useCallback(
    (to: '/signup' | '/login') => {
      try {
        window.localStorage.removeItem(LS_INDEX_KEY)
      } catch {
        /* noop */
      }
      markOnboarded()
      router.replace(to)
    },
    [router]
  )

  return (
    <div className={styles.root}>
      {/* Top chrome — progress segments + No. + skip */}
      <div className={styles.top}>
        <div
          className={styles.progress}
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={TOTAL}
          aria-valuenow={idx + 1}
          aria-label="온보딩 진행도"
        >
          {Array.from({ length: TOTAL }).map((_, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.seg} ${i <= idx ? styles.segOn : ''}`}
              onClick={() => goTo(i)}
              aria-label={`${i + 1}번 슬라이드로 이동`}
            />
          ))}
        </div>
        <div className={styles.topbar}>
          <div className={styles.slideNo} aria-live="polite">
            <span className={styles.noSer}>No.</span>
            <span className={styles.noNum}>
              {String(idx + 1).padStart(2, '0')}
            </span>
          </div>
          <button
            type="button"
            className={styles.skip}
            style={
              { visibility: idx < TOTAL - 1 ? 'visible' : 'hidden' } as CSSProperties
            }
            onClick={skipToEnd}
          >
            건너뛰기
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div
        ref={scrollerRef}
        className={`${styles.scroller} ${smooth ? styles.scrollerSmooth : ''}`}
        onScroll={onScroll}
      >
        <Slide01 />
        <Slide02 />
        <Slide03 />
        <Slide04 />
        <Slide05 />
        <Slide06
          variant={slide6Variant}
          onStart={() => complete('/signup')}
          onLogin={() => complete('/login')}
        />
      </div>

      {/* Bottom next-hint — hidden on final slide where CTAs take over */}
      <div className={styles.bottom}>
        <button
          type="button"
          className={styles.nextHint}
          style={
            {
              opacity: idx < TOTAL - 1 ? 1 : 0,
              pointerEvents: idx < TOTAL - 1 ? 'auto' : 'none',
            } as CSSProperties
          }
          onClick={next}
          aria-hidden={idx >= TOTAL - 1}
          tabIndex={idx < TOTAL - 1 ? 0 : -1}
        >
          다음 →
        </button>
      </div>
    </div>
  )
}
