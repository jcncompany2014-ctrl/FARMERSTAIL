// 설문 틀 (2026-10-09 앱 새 디자인('A 포스터'), 캔버스 '설문 (새 틀)' — 새 첫 화면과 같은 카드·같은 버튼 자리).
//
// /survey 는 앱 틀(AppChrome)의 몰입 화면이라 앱 윗줄·아래 탭이 없다 → 설문이 직접 그린다:
//   흰 바탕 + 빛 두 개(왼쪽 위 머스타드 · 오른쪽 아래 세이지)
//   → 위 줄(← · 진행 막대 · 나가기)
//   → 흰 카드(자리·높이 고정 — 모든 단계가 같은 크기, '다음'은 늘 카드 아래쪽 같은 자리)
//   → 카드 아래 알림 자리(답을 안 고르고 '다음'을 눌렀을 때 — 시안 L21).
// 카드에 다 안 들어가는 화면(알레르기 재료·질환 고르기 등)은 **카드 안에서만** 스크롤한다 — 위·아래 흐림과
// 오른쪽 가는 막대가 "더 있다"를 알려 준다(시안 F22·F22b·F24·F27·F32).
// 시안 위치는 844 높이 화면 기준(위 줄 56 · 카드 128~728). 화면이 낮으면 위 여백 → 카드 높이 순으로 줄인다(survey.css).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { petName } from '@/lib/korean'

type ScrollMetrics = { up: boolean; down: boolean; thumbTop: number; thumbH: number }
const NO_SCROLL: ScrollMetrics = { up: false, down: false, thumbTop: 0, thumbH: 0 }

export function SurveyFrame({
  top,
  cta,
  below,
  scrollKey,
  previewScroll,
  children,
}: {
  /** 위 줄 내용 — 분석 중(loading)엔 비운다(자리는 그대로라 카드가 안 움직인다). */
  top: ReactNode
  /** 카드 아래쪽 버튼(들). 없으면 내용이 카드 끝까지. */
  cta: ReactNode
  /** 카드 아래 알림 줄. */
  below: ReactNode
  /** 화면이 바뀌면 카드 안 스크롤을 맨 위로. */
  scrollKey: string
  /** 디자인 점검 전용 — 카드 안 스크롤 위치('end' = 맨 아래). 실제 화면은 넘기지 않는다. */
  previewScroll?: 'end' | number
  children: ReactNode
}) {
  return (
    <div className="s-frame">
      <div className="s-glow s-glow-a" aria-hidden="true" />
      <div className="s-glow s-glow-b" aria-hidden="true" />
      <div className="s-top">{top}</div>
      <section className="s-card">
        <CardScroll scrollKey={scrollKey} previewScroll={previewScroll}>
          {children}
        </CardScroll>
        {cta && <div className="s-cta">{cta}</div>}
      </section>
      <div className="s-below" data-msg={below ? 'true' : undefined}>
        {below}
      </div>
    </div>
  )
}

/** 위 줄 — ← · 진행 막대 · 나가기(시안: 왼쪽 8 · 오른쪽 20 · 높이 44 · 사이 10). */
export function SurveyTopBar({
  progress,
  progressLabel,
  backLabel,
  onBack,
  onExit,
}: {
  progress: number
  progressLabel: string
  backLabel: string
  onBack: () => void
  onExit: () => void
}) {
  return (
    <>
      <button type="button" className="s-back" onClick={onBack} aria-label={backLabel}>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <div
        className="s-progress"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={progressLabel}
      >
        <i style={{ width: `${progress}%` }} />
      </div>
      <button type="button" className="s-exit" onClick={onExit}>
        나가기
      </button>
    </>
  )
}

/**
 * 가입 직후 첫 질문 — 위 줄 자리에 잠깐 뜨는 '가입 완료' 띠(시안 Y7: 화면 기준 위 54 · 좌우 16 · 높이 48 · 모서리 24).
 * 잠깐 뒤 위 줄(← · 막대 · 나가기)로 바뀐다 — 시간·사라짐은 SurveyClient 가 정한다(leaving = 사라지는 중).
 */
export function SurveyWelcome({ name, leaving }: { name: string; leaving: boolean }) {
  return (
    <div className="s-welcome" data-leaving={leaving ? 'true' : undefined} role="status">
      <span className="s-welcome-stamp" aria-hidden="true" />
      <span className="s-welcome-text">가입 완료! 이제 {petName(name)} 설문을 시작해요</span>
    </div>
  )
}

/** 카드 아래 알림 줄 — 빨간 알약(시안 L21). */
export function SurveyAlert({ children }: { children: ReactNode }) {
  return (
    <div className="s-alertbar" role="alert" aria-live="polite">
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5" />
        <circle cx="12" cy="16.4" r="0.9" fill="currentColor" />
      </svg>
      <span>{children}</span>
    </div>
  )
}

/**
 * 카드 안 스크롤 — 기본 스크롤 막대는 숨기고 시안의 가는 막대(오른쪽 7 · 폭 4 · 위 4 · 아래 20 여백)를 그린다.
 * 내용이 넘칠 때만 흐림·막대가 보인다. 크기 재기는 ResizeObserver·scroll 콜백에서만(그리는 중엔 ref 를 읽지 않는다).
 */
function CardScroll({
  scrollKey,
  previewScroll,
  children,
}: {
  scrollKey: string
  previewScroll?: 'end' | number
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const innerRef = useRef<HTMLDivElement | null>(null)
  const [m, setM] = useState<ScrollMetrics>(NO_SCROLL)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const over = el.scrollHeight - el.clientHeight
    if (over <= 1) {
      setM(NO_SCROLL)
      return
    }
    const track = Math.max(0, el.clientHeight - 24)
    const thumbH = Math.max(28, (track * el.clientHeight) / el.scrollHeight)
    const ratio = Math.min(1, Math.max(0, el.scrollTop / over))
    setM({
      up: el.scrollTop > 1,
      down: el.scrollTop < over - 1,
      thumbTop: 4 + (track - thumbH) * ratio,
      thumbH,
    })
  }, [])

  // 내용이 펼쳐지거나(알레르기 '있어요' 등) 화면 높이가 바뀌면 다시 잰다. 처음 observe 때도 한 번 불린다.
  useEffect(() => {
    const el = ref.current
    const inner = innerRef.current
    if (!el || !inner) return
    const ro = new ResizeObserver(() => {
      if (previewScroll !== undefined) {
        el.scrollTop = previewScroll === 'end' ? el.scrollHeight : previewScroll
      }
      measure()
    })
    ro.observe(el)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [measure, previewScroll])

  // 새 질문은 카드 맨 위에서 시작한다(스크롤 이벤트가 다시 재기를 부른다).
  useEffect(() => {
    const el = ref.current
    if (el && previewScroll === undefined) el.scrollTop = 0
  }, [scrollKey, previewScroll])

  return (
    <div className="s-scrollwrap">
      <div className="s-scroll" ref={ref} onScroll={measure}>
        <div ref={innerRef}>{children}</div>
      </div>
      {m.up && <span className="s-fade-top" aria-hidden="true" />}
      {m.down && <span className="s-fade-bottom" aria-hidden="true" />}
      {m.thumbH > 0 && (
        <span className="s-thumb" aria-hidden="true" style={{ top: m.thumbTop, height: m.thumbH }} />
      )}
    </div>
  )
}
