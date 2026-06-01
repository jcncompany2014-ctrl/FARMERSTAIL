'use client'

import { useEffect, useState } from 'react'
import { Share2, Check, Link as LinkIcon } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

/**
 * ShareButton — 공유 버튼.
 *
 * 동선
 * ────
 * 1. 모바일/지원 브라우저: Web Share API (`navigator.share`) — OS native sheet.
 *    Safari iOS, Chrome Android, Edge Desktop, Firefox Desktop (limited) 등이 지원.
 * 2. 미지원 브라우저: 클립보드 복사로 폴백 + "URL 복사됨" 토스트.
 *
 * Kakao 연동
 * ──────────
 * `window.Kakao` 가 init 되어있으면 (즉, 형이 NEXT_PUBLIC_KAKAO_JS_KEY 를 넣고
 * `<KakaoScript />` 를 \_app 에 삽입했으면) 카카오톡 공유 popup 을 우선 사용.
 * 없으면 위 1)/2) 폴백.
 *
 * 사용처: PDP, blog, events, collections.
 */

declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean
      init: (key: string) => void
      Share?: {
        sendDefault: (options: unknown) => void
      }
    }
  }
}

export type ShareButtonProps = {
  /** 절대 URL 또는 상대경로. 상대면 origin 자동 추가. */
  url: string
  title: string
  description?: string
  /** 카카오톡 공유 카드용 이미지 (선택). 없으면 OG 이미지로 fallback. */
  imageUrl?: string
  /** 버튼 라벨 (기본: 공유) */
  label?: string
  /** 작은 아이콘만 (라벨 없이) */
  iconOnly?: boolean
  className?: string
  style?: React.CSSProperties
}

export default function ShareButton({
  url,
  title,
  description,
  imageUrl,
  label = '공유',
  iconOnly = false,
  className,
  style,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const toast = useToast()

  function resolveAbsoluteUrl(): string {
    if (typeof window === 'undefined') return url
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    return new URL(url, window.location.origin).toString()
  }

  async function copyToClipboard(absoluteUrl: string) {
    try {
      await navigator.clipboard.writeText(absoluteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('주소를 복사했어요. 원하는 곳에 붙여넣으세요.')
    } catch {
      // 일부 환경(권한 차단/non-HTTPS)에서 clipboard 거부 — Toast 로 URL 표시.
      // audit 2-7: 이전 window.prompt 는 사용자가 알아채기 어려운 모달 → 보이는
      // 토스트 + 액션 버튼으로 대체. 사용자가 select-all 한 뒤 수동 복사 가능.
      toast.show({
        intent: 'info',
        title: '주소를 길게 눌러 복사해 주세요',
        description: absoluteUrl,
        duration: 8000,
      })
    }
  }

  async function handleClick() {
    const absoluteUrl = resolveAbsoluteUrl()

    // 1) Kakao 우선 — 한국 사용자 대다수 카톡으로 공유
    if (
      typeof window !== 'undefined' &&
      window.Kakao &&
      window.Kakao.isInitialized() &&
      window.Kakao.Share?.sendDefault
    ) {
      try {
        window.Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title,
            description: description ?? '',
            imageUrl: imageUrl ?? '',
            link: {
              mobileWebUrl: absoluteUrl,
              webUrl: absoluteUrl,
            },
          },
          buttons: [
            {
              title: '자세히 보기',
              link: {
                mobileWebUrl: absoluteUrl,
                webUrl: absoluteUrl,
              },
            },
          ],
        })
        return
      } catch {
        // fallthrough
      }
    }

    // 2) Web Share API
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title,
          text: description ?? title,
          url: absoluteUrl,
        })
        return
      } catch (err) {
        // 사용자 취소면 무시
        if (
          err instanceof Error &&
          (err.name === 'AbortError' || err.message?.includes('cancel'))
        ) {
          return
        }
        // 그 외에는 폴백
      }
    }

    // 3) 폴백: 클립보드 복사
    await copyToClipboard(absoluteUrl)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={iconOnly ? `${label} - ${title}` : undefined}
      className={
        className ??
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] md:text-[13px] font-bold transition active:scale-[0.97]'
      }
      style={
        style ?? {
          background: 'var(--bg-2)',
          color: 'var(--ink)',
          boxShadow: 'inset 0 0 0 1px var(--rule)',
          letterSpacing: '-0.01em',
        }
      }
    >
      {copied ? (
        <Check className="w-3.5 h-3.5" strokeWidth={2.25} />
      ) : (
        <Share2 className="w-3.5 h-3.5" strokeWidth={2.25} />
      )}
      {!iconOnly && (
        <span>{copied ? 'URL 복사됨' : label}</span>
      )}
    </button>
  )
}

/**
 * KakaoInitScript — root layout 또는 app/layout.tsx 의 <head> 에 삽입.
 * NEXT_PUBLIC_KAKAO_JS_KEY 가 없으면 noop. 키가 들어오면 즉시 활성화.
 */
export function KakaoInitScript() {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
  // 이전: JSX 로 raw <script> 2개를 렌더 → 'use client' 컴포넌트라 React 가
  // client 렌더 때마다 "Encountered a script tag while rendering React component"
  // 경고를 냈다(dev 콘솔 23x). prod 빌드에선 제거되지만 마스터피스 콘솔 청결을
  // 위해 useEffect 로 SDK 를 DOM 에 직접 주입한다(멱등 — id 체크). 동작 동일.
  useEffect(() => {
    if (!key) return
    if (document.getElementById('kakao-sdk')) return
    const s = document.createElement('script')
    s.id = 'kakao-sdk'
    s.async = true
    s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'
    s.crossOrigin = 'anonymous'
    s.onload = () => {
      const k = window.Kakao
      if (k && !k.isInitialized()) {
        try {
          k.init(key)
        } catch {
          // SDK init 실패는 공유 폴백(클립보드)으로 흡수 — 치명적 아님.
        }
      }
    }
    document.head.appendChild(s)
  }, [key])
  return null
}

/**
 * LinkCopyButton — Web Share / Kakao 우회. URL 복사만.
 * editor 류 페이지에서 "복사" 만 필요한 자리에 사용.
 */
export function LinkCopyButton({
  url,
  className,
  label = 'URL 복사',
}: {
  url: string
  className?: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)
  const toast = useToast()

  async function copy() {
    const absoluteUrl =
      typeof window !== 'undefined' && !url.startsWith('http')
        ? new URL(url, window.location.origin).toString()
        : url
    try {
      await navigator.clipboard.writeText(absoluteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('주소를 복사했어요')
    } catch {
      toast.show({
        intent: 'info',
        title: '주소를 길게 눌러 복사해 주세요',
        description: absoluteUrl,
        duration: 8000,
      })
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ??
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-bold transition'
      }
      style={{
        background: 'var(--bg-2)',
        color: 'var(--ink)',
        boxShadow: 'inset 0 0 0 1px var(--rule)',
      }}
    >
      {copied ? (
        <Check className="w-3 h-3" strokeWidth={2.5} />
      ) : (
        <LinkIcon className="w-3 h-3" strokeWidth={2.5} />
      )}
      {copied ? '복사됨' : label}
    </button>
  )
}
