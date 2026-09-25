'use client'

import { useState } from 'react'

/**
 * /link 커버의 공유 버튼 — Web Share API(모바일 공유 시트), 미지원 데스크톱은
 * 링크 복사로 대체. 공유 URL 은 현재 주소가 아니라 정본 주소로 고정한다
 * (인앱 브라우저·쿼리 딸린 진입에서도 깨끗한 링크가 퍼지게).
 */
const SHARE_URL = 'https://www.farmerstail.kr/link'

export default function ShareButton() {
  const [copied, setCopied] = useState(false)

  async function share() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '파머스테일', url: SHARE_URL })
      } catch {
        /* 사용자가 공유 시트를 닫음 — 복사로 대체하지 않는다 */
      }
      return
    }
    try {
      await navigator.clipboard.writeText(SHARE_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* 클립보드 권한 거부 — 조용히 무시 */
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? '링크가 복사되었어요' : '페이지 공유'}
      className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-[#1E1A14] shadow-[0_2px_10px_rgba(0,0,0,0.12)] backdrop-blur transition active:scale-95"
    >
      {copied ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 12 5 5L20 7" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v13" />
          <path d="m7 8 5-5 5 5" />
          <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
        </svg>
      )}
    </button>
  )
}
