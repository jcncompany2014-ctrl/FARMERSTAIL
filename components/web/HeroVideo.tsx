'use client'

/**
 * 맨 위 칸의 세로 영상 — 소리 없이 반복. React 는 muted 를 HTML 속성으로 내보내지 않아(서버 그림) 아이폰 자동 재생이 막힐 수 있어,
 * 붙은 뒤 직접 muted 를 켜고 재생한다. 저전력 모드(아이폰 웹뷰·사파리)·움직임 줄이기 설정이면 재생하지 않고 poster 가 남는다
 * (reference_ios_low_power_video — play() 거절은 오류가 아니다).
 */
import { useEffect, useRef } from 'react'

export default function HeroVideo({ src, poster, label, className }: { src: string; poster: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    let reduce = false
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      /* 없음 */
    }
    if (reduce) return
    v.play().catch(() => {
      /* 저전력 모드 등 — poster 가 그대로 보인다 */
    })
  }, [])
  return <video ref={ref} className={className} src={src} poster={poster} muted loop playsInline preload="metadata" aria-label={label} />
}
