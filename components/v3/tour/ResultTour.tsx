'use client'

/**
 * 결과 화면 둘러보기(앱시안 결정 4번 · 2026-10-09 캔버스 TR0~TR4) — 첫 가입 후 첫 결과 화면에서 한 번만, 건너뛰기 없음.
 *
 *   결과 화면: TR0 시작 카드 → TR1 '첫 박스 시작하기'(플랜 고르는 곳) 비추기
 *   홈:        TR2 가운데 기록 버튼 비추기 → TR3 강아지 카드 수치 띠(기록이 쌓이는 곳) 비추기 → '결과로 돌아가기'
 *   결과 화면: TR4 "둘러보기를 마쳤어요" 한 줄(잠깐 뒤 사라짐)
 *
 * 단계는 lib/result-tour(이 폰 저장소)가 들고 다닌다. 비출 곳은 각 화면의 data-tour 표식(plan · record · stats) —
 * 이 부품은 그 자리를 재서 둘레만 밝히고(큰 그림자로 나머지를 어둡게) 그 위에 안내 카드를 띄운다. 화면은 그대로 두고
 * 위에 얹기만 한다(실제 홈·결과 화면 위에서 — 결정 문서). 비출 곳을 못 찾으면 카드만 가운데 띄운다(막히지 않게).
 *
 * 문구는 시안대로, 실제와 다른 곳만 고쳤다: 기록 버튼 설명 "체중·식사·산책·일기" → 기록 메뉴에 산책이 없어
 * "체중·식사·일기·사진"(BottomTabBar RECORD_ACTIONS).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { V3 } from '@/lib/design/tokens'
import { petName } from '@/lib/korean'
import { finishTour, readTour, shouldStartTour, tourSeen, writeTour, type TourState, type TourStep } from '@/lib/result-tour'

const DIM = 'rgba(20,20,20,0.7)'
const RING = '0 0 0 3px #FFFFFF, 0 0 0 10px rgba(232,149,47,0.5)'
const PAD = 6

type Rect = { top: number; left: number; width: number; height: number }

function IconBox({ size, children }: { size: number; children: ReactNode }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 12,
        background: V3.ink,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </span>
  )
}

const ICON_STROKE = { fill: 'none', stroke: '#FFFFFF', strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function BoxIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...ICON_STROKE}>
      <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
    </svg>
  )
}
function PawIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden>
      <ellipse cx="6.2" cy="10" rx="1.9" ry="2.4" />
      <ellipse cx="9.8" cy="6.4" rx="1.9" ry="2.5" />
      <ellipse cx="14.2" cy="6.4" rx="1.9" ry="2.5" />
      <ellipse cx="17.8" cy="10" rx="1.9" ry="2.4" />
      <path d="M12 11.2c-2.6 0-5 2.8-5 5.2 0 1.7 1.3 2.6 2.7 2.6 1 0 1.6-.5 2.3-.5s1.3.5 2.3.5c1.4 0 2.7-.9 2.7-2.6 0-2.4-2.4-5.2-5-5.2z" />
    </svg>
  )
}
function BarsIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...ICON_STROKE}>
      <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />
    </svg>
  )
}
function ArrowRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}
function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  )
}

const PRIMARY = {
  height: 54,
  border: 0,
  borderRadius: 4,
  background: V3.ink,
  color: '#FFFFFF',
  fontFamily: 'inherit',
  fontSize: 17,
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  cursor: 'pointer',
  width: '100%',
} as const

/** 비출 곳의 화면 위치를 따라간다(스크롤·크기 변화). 못 찾으면 null. */
/** canScroll=false — 아래 탭처럼 화면에 붙박인 곳(스크롤해도 제자리라 데려올 필요가 없다). */
function useTargetRect(selector: string | null, canScroll: boolean): { rect: Rect | null; missing: boolean } {
  const [rect, setRect] = useState<Rect | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    if (!selector) return
    let raf = 0
    let lastScroll = 0
    const started = performance.now()
    let last = ''
    const tick = () => {
      const el = document.querySelector<HTMLElement>(selector)
      if (el) {
        // 화면 밖(또는 가장자리)이면 가운데로 — 카드가 위에 들어갈 자리가 생기게. 처음 한 번만이 아니라, 나중에
        // 화면이 밀려(늦게 그려진 사진·글 등) 비출 곳이 밖으로 나가도 다시 데려온다(0.5초에 한 번까지).
        const r0 = el.getBoundingClientRect()
        const now = performance.now()
        if (canScroll && (r0.top < 120 || r0.bottom > window.innerHeight - 40) && now - lastScroll > 500) {
          lastScroll = now
          el.scrollIntoView({ block: 'center', behavior: 'auto' })
        }
        const r = el.getBoundingClientRect()
        const key = `${Math.round(r.top)}:${Math.round(r.left)}:${Math.round(r.width)}:${Math.round(r.height)}`
        if (key !== last) {
          last = key
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
          setMissing(false)
        }
      } else if (performance.now() - started > 2000) {
        setMissing(true)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [selector, canScroll])
  return selector ? { rect, missing } : { rect: null, missing: false }
}

/** 둘러보기 동안 뒤 화면이 손가락에 따라 움직이지 않게. */
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prev
    }
  }, [active])
}

type StepCopy = {
  index: 1 | 2 | 3
  kicker: string
  title: string
  body: ReactNode
  icon: ReactNode
  action: string
  actionIcon: ReactNode
  selector: string
  /** 비출 곳이 스크롤과 함께 움직이나(아래 탭은 붙박이 — false). */
  scroll: boolean
  round: boolean
  radius: number
}

function stepCopy(step: TourStep, name: string): StepCopy | null {
  const who = petName(name)
  if (step === 'plan')
    return {
      index: 1,
      kicker: '결과 화면',
      title: '여기서 플랜을 골라요',
      body: (
        <>
          레시피와 화식 양을 고르고
          <br />
          {who} 정기배송을 시작해요.
        </>
      ),
      icon: <BoxIcon />,
      action: '다음',
      actionIcon: <ArrowRight />,
      selector: '[data-tour="plan"]',
      scroll: true,
      round: false,
      radius: 8,
    }
  if (step === 'record')
    return {
      index: 2,
      kicker: '홈 화면',
      title: '매일 기록은 여기서',
      body: (
        <>
          체중·식사·일기·사진을
          <br />이 버튼 하나로 남겨요.
        </>
      ),
      icon: <PawIcon />,
      action: '다음',
      actionIcon: <ArrowRight />,
      selector: '[data-tour="record"]',
      scroll: false,
      round: true,
      radius: 999,
    }
  if (step === 'stats')
    return {
      index: 3,
      kicker: '홈 화면',
      title: '기록이 쌓이는 곳',
      body: (
        <>
          체중을 기록하면 여기서 변화가 보이고,
          <br />
          매일 남기면 연속 일수가 올라가요.
        </>
      ),
      icon: <BarsIcon />,
      action: '결과로 돌아가기',
      actionIcon: <BackIcon />,
      selector: '[data-tour="stats"]',
      scroll: true,
      round: false,
      radius: 4,
    }
  return null
}

/** 안내 카드 + 비추기(TR1~TR3). */
function SpotStep({ copy, onAction }: { copy: StepCopy; onAction: () => void }) {
  const { rect, missing } = useTargetRect(copy.selector, copy.scroll)
  const cardRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [cardH, setCardH] = useState(220)
  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight)
  }, [copy])
  useEffect(() => {
    btnRef.current?.focus()
  }, [copy])

  const vh = typeof window === 'undefined' ? 844 : window.innerHeight
  const vw = typeof window === 'undefined' ? 390 : window.innerWidth
  const spot = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null
  // 카드 자리 — 비추는 곳 위가 넉넉하면 위, 아니면 아래. 못 찾았으면 가운데.
  const above = spot ? spot.top - 18 - cardH >= 12 : false
  const cardStyle = spot
    ? above
      ? { bottom: vh - spot.top + 18 }
      : { top: spot.top + spot.height + 18 }
    : { top: Math.max(24, (vh - cardH) / 2) }
  const centerX = spot ? spot.left + spot.width / 2 : vw / 2
  const arrowLeft = Math.min(Math.max(centerX - 16 - 9, 20), vw - 32 - 38)

  return (
    <>
      {/* 비추기 — 둘레만 밝히고 나머지는 큰 그림자로 어둡게. 못 찾으면 화면 전체를 어둡게. */}
      {spot && !missing ? (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            zIndex: 1000,
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            borderRadius: copy.round ? 999 : copy.radius,
            boxShadow: `${RING}, 0 0 0 2400px ${DIM}`,
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 1000, background: DIM, pointerEvents: 'none' }} />
      )}
      {/* 뒤 화면 누르기 막기 — 건너뛰기 없음(결정 4번). */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 1001, touchAction: 'none' }} />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`앱 둘러보기 ${copy.index}단계`}
        style={{
          position: 'fixed',
          zIndex: 1002,
          left: 16,
          right: 16,
          ...cardStyle,
          padding: 16,
          borderRadius: 16,
          background: '#FFFFFF',
          color: V3.ink,
          lineHeight: 'normal',
          boxShadow: '0 16px 40px rgba(0,0,0,0.28)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          visibility: rect || missing ? 'visible' : 'hidden',
        }}
      >
        {spot && !missing && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: arrowLeft,
              ...(above ? { bottom: -8 } : { top: -8 }),
              width: 18,
              height: 18,
              background: '#FFFFFF',
              transform: 'rotate(45deg)',
              borderRadius: 3,
            }}
          />
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            aria-label={`3단계 중 ${copy.index}단계`}
            style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}
          >
            {[1, 2, 3].map((i) => (
              <span key={i} style={{ height: 4, borderRadius: 2, background: i <= copy.index ? V3.mustard : '#E5E2DE' }} />
            ))}
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: V3.inkSoft, whiteSpace: 'nowrap' }}>{copy.index} / 3</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <IconBox size={44}>{copy.icon}</IconBox>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{copy.kicker}</span>
            <span className="ft-poster" style={{ fontSize: 23, lineHeight: 1.22 }}>
              {copy.title}
            </span>
            <span style={{ marginTop: 2, fontSize: 16, lineHeight: 1.55, color: V3.inkSoft, wordBreak: 'keep-all' }}>{copy.body}</span>
          </span>
        </span>
        <button ref={btnRef} type="button" onClick={onAction} className="active:opacity-80" style={PRIMARY}>
          {copy.action === '결과로 돌아가기' ? (
            <>
              {copy.actionIcon}
              {copy.action}
            </>
          ) : (
            <>
              {copy.action}
              {copy.actionIcon}
            </>
          )}
        </button>
      </div>
    </>
  )
}

/** TR0 — 시작 카드(화면 전체 어둡게). */
function IntroStep({ name, onStart }: { name: string; onStart: () => void }) {
  const btnRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    btnRef.current?.focus()
  }, [])
  const rows = [
    { icon: <BoxIcon size={22} />, title: '플랜 고르는 곳', where: '결과 화면' },
    { icon: <PawIcon size={22} />, title: '매일 기록하는 곳', where: '홈 화면' },
    { icon: <BarsIcon size={22} />, title: '기록이 쌓이는 곳', where: '홈 화면' },
  ]
  return (
    <>
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 1000, background: DIM, touchAction: 'none' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="앱 둘러보기 시작"
        style={{
          position: 'fixed',
          zIndex: 1002,
          left: 16,
          right: 16,
          top: 'max(24px, calc(50% - 250px))',
          padding: '24px 20px 20px',
          borderRadius: 16,
          background: '#FFFFFF',
          color: V3.ink,
          lineHeight: 'normal',
          boxShadow: '0 16px 40px rgba(0,0,0,0.28)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 작은 도장 그림(같은 출처 정적 파일). */}
        <img src="/logo-stamp.png" alt="" width={60} height={60} style={{ width: 60, height: 60, display: 'block' }} />
        <span className="ft-poster" style={{ marginTop: 14, fontSize: 28, lineHeight: 1.2 }}>
          {petName(name)} 맞춤 결과가
          <br />
          나왔어요
        </span>
        <span style={{ marginTop: 8, fontSize: 16, lineHeight: 1.6, color: V3.inkSoft }}>
          결과를 보기 전에 꼭 필요한 곳만
          <br />
          잠깐 둘러볼게요.
        </span>
        <div style={{ marginTop: 16, borderTop: `1.5px solid ${V3.ink}` }}>
          {rows.map((r, i) => (
            <div key={r.title} style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #EFEDEE' }}>
              <IconBox size={40}>{r.icon}</IconBox>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 17, fontWeight: 800 }}>{r.title}</span>
                <span style={{ fontSize: 14, color: '#6B675F' }}>{r.where}</span>
              </span>
              <span className="ft-num" style={{ fontSize: 18, color: '#C9C5BF' }}>
                {i + 1}
              </span>
            </div>
          ))}
        </div>
        <button ref={btnRef} type="button" onClick={onStart} className="active:opacity-80" style={{ ...PRIMARY, height: 56, marginTop: 20 }}>
          둘러보기 시작
          <ArrowRight />
        </button>
      </div>
    </>
  )
}

/** TR4 — 끝 한 줄(잠깐 뒤 사라짐). */
function FinishToast({ name }: { name: string }) {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 4500)
    return () => clearTimeout(t)
  }, [])
  if (!show) return null
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        zIndex: 1002,
        left: 16,
        right: 16,
        bottom: 'calc(28px + env(safe-area-inset-bottom))',
        minHeight: 60,
        boxSizing: 'border-box',
        padding: '10px 16px 10px 10px',
        borderRadius: 4,
        background: V3.ink,
        color: '#FFFFFF',
        lineHeight: 'normal',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 8px 24px rgba(20,20,20,0.22)',
      }}
    >
      <span
        aria-hidden
        style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 20, background: '#FFFFFF url(/logo-stamp.png) center / 30px no-repeat' }}
      />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 16, fontWeight: 800 }}>둘러보기를 마쳤어요</span>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)' }}>이제 {petName(name)} 결과를 확인해 보세요</span>
      </span>
    </div>
  )
}

/**
 * place='result' — 결과 화면(시작·1단계·끝). eligible = 설문 직후 + 그 강아지의 첫 분석(AnalysisView 가 판정해 넘긴다).
 * place='home'   — 홈(2·3단계). 진행 중인 둘러보기가 그 단계일 때만 뜬다.
 */
export default function ResultTour({
  place,
  dogName = '',
  fromSurvey = false,
  analysisCount = 0,
}: {
  place: 'result' | 'home'
  dogName?: string
  fromSurvey?: boolean
  analysisCount?: number
}) {
  const router = useRouter()
  const [state, setState] = useState<TourState | null>(null)
  const [finishName, setFinishName] = useState<string | null>(null)

  // 화면에 들어올 때 단계를 읽는다(이 폰 저장소). 결과 화면이면 새로 시작할지도 여기서.
  // 저장소(바깥 상태)를 마운트 뒤 한 번 읽어 맞춘다 — 서버 그림엔 저장소가 없어 첫 그림은 늘 빈 상태(어긋남 없음).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const cur = readTour()
    if (place === 'result') {
      if (cur?.step === 'finish') {
        finishTour()
        setFinishName(cur.dogName)
        return
      }
      if (cur && (cur.step === 'intro' || cur.step === 'plan')) {
        setState(cur)
        return
      }
      if (shouldStartTour({ fromSurvey, analysisCount, seen: tourSeen(), inProgress: !!cur })) {
        const next: TourState = {
          step: 'intro',
          dogName,
          backHref: window.location.pathname + window.location.search,
          startedAt: Date.now(),
        }
        writeTour(next)
        setState(next)
      }
      return
    }
    if (cur && (cur.step === 'record' || cur.step === 'stats')) setState(cur)
  }, [place, dogName, fromSurvey, analysisCount])
  /* eslint-enable react-hooks/set-state-in-effect */

  const go = useCallback(
    (step: TourStep) => {
      setState((s) => {
        if (!s) return s
        const next = { ...s, step }
        writeTour(next)
        return next
      })
    },
    [],
  )

  const active = !!state && ((place === 'result' && (state.step === 'intro' || state.step === 'plan')) || (place === 'home' && (state.step === 'record' || state.step === 'stats')))
  useScrollLock(active)

  if (finishName !== null) return <FinishToast name={finishName} />
  if (!state || !active) return null

  if (state.step === 'intro') return <IntroStep name={state.dogName} onStart={() => go('plan')} />

  const copy = stepCopy(state.step, state.dogName)
  if (!copy) return null
  const onAction = () => {
    if (state.step === 'plan') {
      writeTour({ ...state, step: 'record' })
      router.push('/dashboard')
      return
    }
    if (state.step === 'record') {
      go('stats')
      return
    }
    // stats → 결과로 돌아가기
    writeTour({ ...state, step: 'finish' })
    router.push(state.backHref)
  }
  return <SpotStep key={state.step} copy={copy} onAction={onAction} />
}
