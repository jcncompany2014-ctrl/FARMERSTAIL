'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Share, Plus, X, Smartphone } from 'lucide-react'

// Chrome fires this before the install banner — we intercept and defer it so
// we can wire it to our branded UI instead of the browser default.
type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

const DISMISS_KEY = 'ft_install_prompt_dismissed_at'
// Re-show after 14 days — long enough not to nag, short enough to recover users
// who dismissed reflexively.
const RESURFACE_MS = 14 * 24 * 60 * 60 * 1000
// Only surface after the user has had at least one meaningful navigation to
// avoid popping on a cold first-load.
const MIN_DELAY_MS = 4000

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari
  const navAny = window.navigator as Navigator & { standalone?: boolean }
  return Boolean(navAny.standalone)
}

function detectIOS(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  // iPhone / iPad / iPod; iPadOS reports as Mac with touch so check maxTouchPoints too.
  const isiDevice = /iPad|iPhone|iPod/.test(ua)
  const isiPadOS = ua.includes('Mac') && 'ontouchend' in window
  return isiDevice || isiPadOS
}

function detectInAppBrowser(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  // Kakao/Naver/Instagram/FB/Line in-app browsers — "홈 화면에 추가" is either
  // hidden or unreliable here. Best to ask users to open in their real browser.
  return /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(ua)
}

function wasDismissedRecently(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const ts = Number(raw)
    if (!Number.isFinite(ts)) return false
    return Date.now() - ts < RESURFACE_MS
  } catch {
    return false
  }
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [iosSheetOpen, setIosSheetOpen] = useState(false)
  useEffect(() => {
    // useEffect never runs on the server, so `window` is guaranteed present here.
    if (isStandalone()) return
    if (wasDismissedRecently()) return

    const detectedIos = detectIOS()
    const inApp = detectInAppBrowser()

    // Non-iOS path: wait for beforeinstallprompt, then show our banner.
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      window.setTimeout(() => setVisible(true), MIN_DELAY_MS)
    }

    function onAppInstalled() {
      setVisible(false)
      setDeferredPrompt(null)
      try {
        window.localStorage.removeItem(DISMISS_KEY)
      } catch {
        /* noop */
      }
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    // iOS path: beforeinstallprompt never fires. Show the instructional banner
    // after the delay, unless we're trapped in an in-app webview.
    let iosTimer: number | undefined
    if (detectedIos && !inApp) {
      iosTimer = window.setTimeout(() => setVisible(true), MIN_DELAY_MS)
    }

    return () => {
      if (iosTimer !== undefined) window.clearTimeout(iosTimer)
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const dismiss = useCallback(() => {
    setVisible(false)
    setIosSheetOpen(false)
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* noop */
    }
  }, [])

  const install = useCallback(async () => {
    // No captured beforeinstallprompt means we surfaced on the iOS path; open
    // the Safari "share → 홈 화면에 추가" instructional sheet instead.
    if (!deferredPrompt) {
      setIosSheetOpen(true)
      return
    }
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setVisible(false)
        setDeferredPrompt(null)
      } else {
        dismiss()
      }
    } catch {
      dismiss()
    }
  }, [deferredPrompt, dismiss])

  if (!visible) return null

  // On iOS we never capture a beforeinstallprompt event — so visibility without
  // a deferredPrompt means we're in the iOS instructional path.
  const ios = !deferredPrompt

  return (
    <>
      {/* 하단 설치 배너.
          모바일: viewport 전폭. 데스크톱(≥md): 폰 프레임 위에 맞게 센터링.
          AppChrome 하단 탭바와 동일한 `md:left-1/2 md:-translate-x-1/2
          md:max-w-md` 패턴으로 폰 프레임 폭(448px) 안에 정렬. */}
      <div
        role="dialog"
        aria-live="polite"
        aria-label="앱 설치 안내"
        className="fixed left-0 right-0 z-[60] px-4 md:left-1/2 md:right-auto md:w-full md:max-w-md md:-translate-x-1/2"
        style={{
          // Bottom tab nav height (~72px) + safe area. Sits just above the tab bar.
          bottom: 'calc(88px + env(safe-area-inset-bottom))',
        }}
      >
        <div
          className="max-w-md mx-auto bg-white rounded-2xl overflow-hidden"
          style={{
            border: '1px solid var(--rule)',
            boxShadow: '0 10px 30px -12px rgba(61,43,31,0.35)',
          }}
        >
          <div className="flex items-start gap-3 px-4 py-3.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--bg)' }}
            >
              <Smartphone
                className="w-5 h-5"
                style={{ color: 'var(--terracotta)' }}
                strokeWidth={1.75}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-[13px] font-bold leading-tight"
                style={{ color: 'var(--ink)' }}
              >
                파머스테일을 앱처럼{' '}
                쓰세요
              </div>
              <div
                className="text-[11px] mt-1 leading-snug"
                style={{ color: 'var(--muted)' }}
              >
                {ios
                  ? '홈 화면에 추가하면 바로 실행돼요'
                  : '홈 화면에 추가해서 더 빠르게 만나보세요'}
              </div>
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={install}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition active:scale-[0.97]"
                  style={{
                    background: 'var(--ink)',
                    color: 'var(--bg)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={2.25} />
                  {ios ? '설치 방법 보기' : '설치하기'}
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="px-2.5 py-1.5 text-[11px] font-semibold transition"
                  style={{ color: 'var(--muted)' }}
                >
                  나중에
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="닫기"
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition"
              style={{ background: 'transparent' }}
            >
              <X
                className="w-4 h-4"
                style={{ color: 'var(--muted)' }}
                strokeWidth={2}
              />
            </button>
          </div>
        </div>
      </div>

      {/* iOS 설치 방법 시트 */}
      {iosSheetOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="iOS 설치 방법"
        >
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(30,26,20,0.4)' }}
            onClick={() => setIosSheetOpen(false)}
          />
          <div
            className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 pb-[calc(24px+env(safe-area-inset-bottom))] sm:pb-5 shadow-xl"
            style={{
              border: '1px solid var(--rule)',
              animation: 'ftInstallSheetIn 280ms cubic-bezier(.2,.9,.25,1)',
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="kicker">Install · 홈 화면 추가</span>
                <h2
                  className="font-serif mt-1.5"
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  홈 화면에 추가하기
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIosSheetOpen(false)}
                aria-label="닫기"
                className="w-9 h-9 flex items-center justify-center rounded-full"
              >
                <X
                  className="w-4 h-4"
                  style={{ color: 'var(--muted)' }}
                  strokeWidth={2}
                />
              </button>
            </div>

            <ol className="mt-5 space-y-3.5">
              {IOS_STEPS.map((step) => (
                <li key={step.n} className="flex items-start gap-3">
                  <StepNum n={step.n} />
                  <div className="flex-1">
                    <div
                      className="text-[13px] font-bold"
                      style={{ color: 'var(--ink)' }}
                    >
                      {step.title}
                    </div>
                    {step.chip && (
                      <div
                        className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px]"
                        style={{
                          background: 'var(--bg)',
                          color: 'var(--text)',
                        }}
                      >
                        <step.chip.Icon
                          className="w-3.5 h-3.5"
                          strokeWidth={step.chip.stroke}
                        />
                        {step.chip.label}
                      </div>
                    )}
                    {step.note && (
                      <div
                        className="text-[11px] mt-1 leading-snug"
                        style={{ color: 'var(--muted)' }}
                      >
                        {step.note}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            <button
              type="button"
              onClick={dismiss}
              className="mt-5 w-full py-3.5 rounded-full text-[13px] font-bold transition active:scale-[0.98]"
              style={{
                background: 'var(--ink)',
                color: 'var(--bg)',
                letterSpacing: '-0.01em',
              }}
            >
              확인했어요
            </button>
          </div>

          <style jsx>{`
            @keyframes ftInstallSheetIn {
              from {
                transform: translateY(18px);
                opacity: 0;
              }
              to {
                transform: translateY(0);
                opacity: 1;
              }
            }
          `}</style>
        </div>
      )}
    </>
  )
}

/**
 * iOS Safari의 "공유 → 홈 화면에 추가" 플로우를 3 step으로 분해.
 * 데이터로 빼서 JSX 반복을 없애고, 나중에 Android Chrome 시트가 추가될 때
 * 동일 패턴으로 확장하기 쉬운 형태로 유지.
 */
const IOS_STEPS: Array<{
  n: number
  title: string
  chip?: { Icon: typeof Share; label: string; stroke: number }
  note?: string
}> = [
  {
    n: 1,
    title: 'Safari 하단의 공유 아이콘을 누르세요',
    chip: { Icon: Share, label: '공유', stroke: 1.75 },
  },
  {
    n: 2,
    title: "'홈 화면에 추가' 선택",
    chip: { Icon: Plus, label: '홈 화면에 추가', stroke: 2 },
  },
  {
    n: 3,
    title: "우측 상단 '추가' 버튼을 탭하면 완료!",
    note: '홈 화면에서 파머스테일 아이콘으로 바로 실행할 수 있어요',
  },
]

function StepNum({ n }: { n: number }) {
  return (
    <div
      className="w-7 h-7 rounded-full text-[12px] font-black flex items-center justify-center shrink-0"
      style={{ background: 'var(--ink)', color: 'var(--bg)' }}
    >
      {n}
    </div>
  )
}
