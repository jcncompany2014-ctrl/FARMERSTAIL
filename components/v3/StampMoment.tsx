'use client'

/**
 * StampMoment — 앱 전용 "도장 쾅" 보상 모먼트 (2026-07-09, de-AI 시그니처).
 *
 * 일기 저장 등 "기록이 남는" 순간에 화면 중앙으로 검수 도장이 찍히는 오버레이.
 * 브랜드 최고 고유 자산(실물 스탬프)을 인터랙션의 보상으로 승격한다.
 *
 * # 사용
 *   const [token, setToken] = useState(0)
 *   // 저장 성공 시: setToken((t) => t + 1)
 *   <StampMoment token={token} sub={todayMd} />
 *
 * # 원칙
 *  - token 이 0 → 양수로 증가할 때마다 한 번 재생(0 은 초기 마운트, 재생 안 함).
 *  - 시각 오버레이는 aria-hidden + pointer-events:none — UI 를 막지 않는다.
 *    접근성 안내(스크린리더)는 이 컴포넌트를 쓰는 쪽의 sr-only 라이브 리전이 담당.
 *  - prefers-reduced-motion: 슬램 애니메이션 없이 정적 표시 후 페이드아웃.
 *  - 모션 예산상 앱 전체에서 신규 모션은 이 하나뿐(DESIGN_DEAI_PLAN 가드 5).
 */

import { useEffect, useState } from 'react'
import InkStamp from '@/components/brand/InkStamp'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function StampMoment({
  token,
  sub,
  lines = ['기록 완료'],
}: {
  /** 0 이상으로 증가할 때마다 도장을 한 번 재생. 0 은 초기 마운트(재생 안 함). */
  token: number
  /** 하단 작은 줄(예: 오늘 날짜 "7.9"). */
  sub?: string
  /** 도장 본문 1~2줄. 기본 "기록 완료". */
  lines?: [string] | [string, string]
}) {
  const [lastToken, setLastToken] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'in' | 'out'>('idle')
  // 애니메이션 여부(reduced-motion). className 이 이 값에 의존 → ref 아닌 state.
  const [animate, setAnimate] = useState(true)

  // 트리거 — token 변화 시 렌더 중(효과 아님) 상태 조정. React 의 "prop 변화 시
  // 상태 리셋" 정석 패턴이라 set-state-in-effect 룰에 걸리지 않고, 동기 트리거를
  // 커밋 전에 반영한다. token===0 은 초기 마운트 → 재생 안 함.
  if (token !== lastToken) {
    setLastToken(token)
    if (token !== 0) {
      setPhase('in')
      setAnimate(!prefersReducedMotion())
    }
  }

  // 페이즈 진행 타이머 — setState 는 전부 setTimeout 콜백(비동기) 안에서만 호출
  // (동기 setState-in-effect 회피). 각 페이즈는 '자기 다음' 전이만 예약해,
  // 클린업이 다음 타이머를 조기 제거하지 않게 한다.
  useEffect(() => {
    if (phase === 'idle') return
    if (phase === 'in') {
      // 지원 기기 한정 햅틱(사용자 제스처=저장 흐름 안이라 안전).
      navigator.vibrate?.(10)
      const t = setTimeout(() => setPhase('out'), animate ? 1150 : 520)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setPhase('idle'), 260)
    return () => clearTimeout(t)
  }, [phase, animate])

  if (phase === 'idle') return null

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'none',
        zIndex: 100,
        opacity: phase === 'out' ? 0 : 1,
        transition: 'opacity 260ms ease',
      }}
    >
      <div
        className={animate ? 'ft-stamp-slam' : undefined}
        style={{
          position: 'relative',
          width: 150,
          height: 150,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {/* 도장이 내려앉는 밝은 종이 메달리언 — 사진 위에서도 잉크가 읽히게. */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 8,
            borderRadius: 999,
            background: 'var(--paper-hi)',
            boxShadow: '0 10px 34px rgba(22,20,15,0.16)',
          }}
        />
        <InkStamp
          lines={lines}
          sub={sub}
          size={116}
          rotate={0}
          label="기록 완료 도장"
          style={{ position: 'relative' }}
        />
      </div>
    </div>
  )
}
