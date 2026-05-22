'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, EyeOff, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { NextAction } from '@/lib/dashboard/next-action'

/**
 * P21 — "왜 이 안내?" reason 매핑.
 * NextAction.type 별 한 줄 설명. voice-guidelines §1 — "신뢰도" 단어 X.
 */
const REASON_BY_TYPE: Record<NextAction['type'], string> = {
  onboarding:
    '강아지 등록 → 첫 분석 → 정기 케어 까지 한 흐름으로 가기 위해 안내해요',
  analyze:
    '설문이 끝난 강아지만 영양 분석이 나와요. 오래 미루면 추천이 맞지 않을 수 있어요',
  approve:
    '제안한 식단을 보호자가 직접 검토하고 승인할 때 비로소 적용돼요',
  'weigh-in':
    '체중이 2주 이상 안 측정되면 추천량이 실제와 멀어질 수 있어요',
  delivery:
    '다음 배송 D-day 가 가까워 미리 알려드려요. 일시 정지·건너뛰기도 자유',
  subscribe:
    '정기배송을 시작하면 사료 양·종류가 자동 조정돼 매번 챙기는 부담이 줄어요',
}

/**
 * Dashboard "오늘 할 일" 카드 — computeNextAction 의 결과 1개를 시각화.
 *
 * # 디자인
 * - tone 별 다른 accent 색 (terracotta=강조, gold=권유, moss=리마인더)
 * - 단일 CTA — 과한 선택지 X. 사용자가 매일 들어와 한 번에 흐름 진입.
 * - 카드 자체가 Link — 모바일 탭 영역 보장.
 *
 * # 견주 자율성 — "이 안내 숨기기"
 * docs/voice-guidelines.md §5 정책. dismiss 는 카드 외곽이 아닌 카드
 * 아래의 별도 텍스트 링크. 카드 안 absolute X 버튼은 CTA pill 과 위치
 * 충돌이 발생해서 footer 패턴으로 변경.
 *
 * type 별 24h dismiss (localStorage). 동일 type 의 안내는 다음 day 부터
 * 다시 표시.
 */
export default function NextActionCard({ action }: { action: NextAction }) {
  const [reasonOpen, setReasonOpen] = useState(false)
  // lazy initializer — useEffect 안에서 setState 호출하면 react-hooks/set-state
  // -in-effect 룰 위반 (cascading render). mount 시 1회만 localStorage 읽고
  // 결정. action.type 변경에 따른 reset 은 server 가 새 컴포넌트 instance
  // 로 마운트하므로 추가 effect 불필요.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const key = `ft:next-action:dismiss:${action.type}`
      const value = localStorage.getItem(key)
      if (!value) return false
      const ts = Number(value)
      return Number.isFinite(ts) && Date.now() - ts < 24 * 60 * 60 * 1000
    } catch {
      return false
    }
  })

  function handleDismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(
        `ft:next-action:dismiss:${action.type}`,
        String(Date.now()),
      )
    } catch {
      /* localStorage 차단 환경은 세션 동안만 숨김 */
    }
  }

  if (dismissed) return null

  const toneColor: Record<NextAction['tone'], string> = {
    terracotta: 'var(--terracotta)',
    gold: 'var(--gold)',
    moss: 'var(--moss)',
  }
  const accent = toneColor[action.tone]

  return (
    <div className="mx-5 mt-3">
      <Link
        href={action.href}
        className="group block px-5 py-4 rounded border bg-bg-3 active:scale-[0.99] transition"
        style={{
          borderColor: 'var(--rule)',
          boxShadow: `inset 4px 0 0 ${accent}`,
        }}
        aria-label={`${action.title} — ${action.cta}`}
      >
        {/* UI audit M1: 좁은 viewport (375px) + 긴 title + 긴 CTA (정기배송 시작하기)
            동시 발생 시 pill 이 title wrap zone 시각 침범. flex-col on <sm.
            기본 layout (sm+): horizontal pill 우측. 모바일: pill 아래. */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <span
              className="kicker"
              style={{ color: accent }}
            >
              오늘의 한 가지
            </span>
            <div
              className="font-serif mt-1.5 leading-tight"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              {action.title}
            </div>
            <p
              className="mt-1 text-[12px] leading-relaxed"
              style={{ color: 'var(--muted)' }}
            >
              {action.subtitle}
            </p>
          </div>
          <span
            className="self-start sm:self-auto shrink-0 sm:mt-0.5 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold transition group-hover:translate-x-0.5"
            style={{
              background: accent,
              color: '#FFFFFF',
            }}
          >
            {action.cta}
            <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
          </span>
        </div>
      </Link>
      {/* P21 — "왜 이 안내?" expandable disclosure (A-19, B-55).
          dismiss 와 같은 inline row 에 배치. */}
      <div className="mt-1.5 ml-1 flex items-center gap-3">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="이 안내 24시간 동안 숨기기"
          className="inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-semibold text-muted/70 hover:text-muted transition"
        >
          <EyeOff className="w-3 h-3" strokeWidth={2} />이 안내 숨기기
        </button>
        <button
          type="button"
          onClick={() => setReasonOpen((v) => !v)}
          aria-expanded={reasonOpen}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-semibold text-muted/70 hover:text-muted transition"
        >
          <HelpCircle className="w-3 h-3" strokeWidth={2} />왜 이 안내?
          {reasonOpen ? (
            <ChevronUp className="w-3 h-3" strokeWidth={2} />
          ) : (
            <ChevronDown className="w-3 h-3" strokeWidth={2} />
          )}
        </button>
      </div>
      {reasonOpen && (
        <p
          className="ml-1 mt-1 text-[11px] leading-relaxed px-3 py-2 rounded-lg"
          style={{ background: 'var(--bg)', color: 'var(--text)' }}
        >
          {REASON_BY_TYPE[action.type]}
        </p>
      )}
    </div>
  )
}
