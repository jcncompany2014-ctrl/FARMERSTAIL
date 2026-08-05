'use client'

import { useState, useSyncExternalStore } from 'react'
import { Printer, Copy, Check } from 'lucide-react'
import { isStandaloneApp } from '@/lib/standalone'

/**
 * 수의사 리포트 저장 버튼.
 *
 * # 무슨 일이 있었나 (2026-08-05, 사장님 제보)
 * `window.print()` 한 줄이었다. 그런데 **홈 화면에 설치한 앱(standalone)에는
 * 브라우저 인쇄 UI 가 없다** — iOS 에서는 예외도 안 던지고 아무 일도 안 난다.
 * 버튼을 눌러도 화면이 그대로인 게 그 이유였고, 실패 경로가 없으니 안내조차
 * 못 했다. "아무 반응 없음"은 고객에게 고장과 구분되지 않는다.
 *
 * # 지금
 *  · 브라우저 → 그대로 인쇄 대화상자(변화 없음).
 *  · 설치된 앱 → 인쇄를 시도하지 않는다. 대신 **이 페이지 주소를 복사**해서
 *    브라우저에서 열도록 안내한다. 거기서 인쇄·PDF 저장이 된다.
 *    (링크로 수의사에게 바로 보내는 길은 강아지 상세의 '수의사 공유'가 따로
 *     맡는다 — 이 버튼은 "내가 종이/PDF 로 갖는다"가 목적이다.)
 */
/** display-mode 는 설치·해제로 바뀔 수 있다 — 바뀌면 라벨도 따라가게 구독한다. */
function subscribeToDisplayMode(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia('(display-mode: standalone)')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

export default function VetReportPrintButton() {
  const [copied, setCopied] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  // 라벨은 브라우저 환경값이라 서버가 알 수 없다 — 렌더 중에 판정하면
  // 하이드레이션이 어긋난다(서버 '인쇄' vs 클라이언트 '브라우저에서 저장').
  // useSyncExternalStore 는 서버 스냅샷을 따로 받으므로 이 경우의 정석이다.
  const inApp = useSyncExternalStore(
    subscribeToDisplayMode,
    isStandaloneApp,
    () => false, // 서버 스냅샷 — 브라우저로 가정(웹 사용자에게 잘못된 안내 금지)
  )

  async function handleClick() {
    if (!isStandaloneApp()) {
      window.print()
      return
    }
    // 설치된 앱 — 인쇄 UI 가 없다. 주소를 복사해 브라우저로 유도한다.
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setHint('주소를 복사했어요. 사파리·크롬에 붙여넣어 열면 인쇄·PDF 저장이 돼요.')
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      // 복사도 막힌 환경 — 그래도 방법은 알려준다(빈손으로 돌려보내지 않는다).
      setHint('앱에서는 인쇄가 안 돼요. 이 화면 주소를 브라우저에서 열면 저장할 수 있어요.')
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-ink text-white text-[12px] font-bold active:scale-[0.98] transition"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
            주소 복사됨
          </>
        ) : inApp ? (
          <>
            <Copy className="w-3.5 h-3.5" strokeWidth={2.5} />
            브라우저에서 저장하기
          </>
        ) : (
          <>
            <Printer className="w-3.5 h-3.5" strokeWidth={2.5} />
            인쇄 / PDF 저장
          </>
        )}
      </button>
      {hint && (
        <p
          role="status"
          className="text-[10.5px] text-muted text-right max-w-[220px] leading-relaxed"
        >
          {hint}
        </p>
      )}
    </div>
  )
}
