'use client'

import { useEffect, useState } from 'react'
import { Truck } from 'lucide-react'

/**
 * DeliveryCountdownBanner — "오늘 출고 마감까지" 카운트다운 배너.
 *
 * 마켓컬리식 시간-제한 메시징. 매일 KST 13:00 (오후 1시) 까지 결제하면
 * 익일(평일) 출고. 13:00 이후는 다음 영업일 출고로 안내.
 *
 * 성능 메모: 1초마다 re-render 가 일어나면 그 영향이 부모 트리(/cart, /checkout)
 * 까지 흐르면 안 된다 — 그래서 외부 wrapper 는 정적이고, 시간만 바뀌는 inner
 * <Countdown /> 컴포넌트를 분리해 그 안에서만 setInterval 이 돈다.
 */

const CUTOFF_HOUR_KST = 13 // 13:00 KST

function getKstNow(): Date {
  const now = Date.now()
  const kstOffsetMs = 9 * 60 * 60 * 1000
  return new Date(now + kstOffsetMs)
}

function formatRemain(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export default function DeliveryCountdownBanner() {
  // 모드 / urgent 여부는 마운트 시 1회 + 1분마다만 재계산.
  // 초 단위 카운트다운 텍스트는 별도 inner 가 처리 — 부모 트리 re-render 없음.
  const [snapshot, setSnapshot] = useState(() => computeSnapshot())

  useEffect(() => {
    // 1분마다 mode/urgent 만 갱신 (cutoff 경계 / 자정 / 주말 전환 트리거).
    const id = window.setInterval(
      () => setSnapshot(computeSnapshot()),
      60_000,
    )
    return () => window.clearInterval(id)
  }, [])

  const { mode, urgent } = snapshot

  let title: string
  let subtitleStatic: string | null
  if (mode === 'before-cutoff') {
    title = '오늘 결제 시 내일 출고'
    subtitleStatic = null // 카운트다운 inner 가 그림
  } else if (mode === 'weekend') {
    title = '주말은 평일 영업일 기준 출고'
    subtitleStatic = '월요일 오후 1시까지 결제 시 화요일 출고'
  } else {
    title = '오늘 출고 마감'
    subtitleStatic = '내일 오후 1시까지 결제 시 모레 출고'
  }

  return (
    <div
      className="rounded-xl flex items-center gap-3 px-4 py-3 md:px-5 md:py-3.5"
      style={{
        background: urgent
          ? 'color-mix(in srgb, var(--sale) 8%, var(--bg-2))'
          : 'var(--bg-2)',
        boxShadow: urgent
          ? 'inset 0 0 0 1px var(--sale)'
          : 'inset 0 0 0 1px var(--rule)',
      }}
    >
      <span
        className="shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center"
        style={{
          background: urgent ? 'var(--sale)' : 'var(--ink)',
          color: 'var(--bg)',
        }}
      >
        <Truck className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div
          className="text-[12px] md:text-[13.5px] font-bold"
          style={{
            color: urgent ? 'var(--sale)' : 'var(--ink)',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>
        <div
          className="text-[11px] md:text-[12px] mt-0.5 font-mono tabular-nums"
          style={{ color: urgent ? 'var(--sale)' : 'var(--muted)' }}
        >
          {subtitleStatic ?? <Countdown />}
        </div>
      </div>
    </div>
  )
}

type Snapshot = {
  mode: 'before-cutoff' | 'after-cutoff' | 'weekend'
  urgent: boolean
}

function computeSnapshot(): Snapshot {
  const now = getKstNow()
  const cutoff = new Date(now)
  cutoff.setUTCHours(CUTOFF_HOUR_KST, 0, 0, 0)
  const remainMs = cutoff.getTime() - now.getTime()
  const dow = now.getUTCDay()
  const isWeekend = dow === 0 || dow === 6
  if (isWeekend) return { mode: 'weekend', urgent: false }
  if (remainMs > 0) {
    return { mode: 'before-cutoff', urgent: remainMs < 60 * 60 * 1000 }
  }
  return { mode: 'after-cutoff', urgent: false }
}

/**
 * Countdown — 1초마다 자기 자신만 re-render 하는 leaf 컴포넌트.
 * 부모 (DeliveryCountdownBanner) 의 props/state 는 건드리지 않음.
 */
function Countdown() {
  const [text, setText] = useState(() => computeText())
  useEffect(() => {
    const id = window.setInterval(() => setText(computeText()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return <>{text}</>
}

function computeText(): string {
  const now = getKstNow()
  const cutoff = new Date(now)
  cutoff.setUTCHours(CUTOFF_HOUR_KST, 0, 0, 0)
  const remainMs = cutoff.getTime() - now.getTime()
  return `오후 1시까지 · 남은 시간 ${formatRemain(remainMs)}`
}
