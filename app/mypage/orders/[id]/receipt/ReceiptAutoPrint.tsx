'use client'

import { useEffect } from 'react'

/**
 * `?print=1` 으로 진입하면 마운트 직후 한 번 `window.print()` 호출.
 *
 * 폰트 / 이미지 로딩 전에 print 다이얼로그가 뜨면 빈 페이지로 인쇄될 수 있어
 * `requestAnimationFrame` 으로 한 프레임 양보. 모바일 / iOS Safari 도 정상 동작.
 *
 * 사용자가 인쇄 다이얼로그를 닫으면 그대로 영수증 페이지에 머무름 — 다시
 * 인쇄하려면 본문의 "인쇄" 버튼을 누르면 됨 (페이지 새로고침 X).
 */
export default function ReceiptAutoPrint() {
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      try {
        window.print()
      } catch {
        /* 브라우저가 차단해도 silent — 사용자가 수동 버튼으로 다시 시도 가능. */
      }
    })
    return () => window.cancelAnimationFrame(id)
  }, [])
  return null
}
