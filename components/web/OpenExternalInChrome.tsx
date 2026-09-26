'use client'

/**
 * 인앱 브라우저(안드로이드)에서 외부 링크를 크롬으로 열게 바꾼다.
 *
 * 왜: 인스타그램 안 브라우저에서 스마트스토어를 열면 네이버가 로그인 화면을 띄운다
 * (일반 크롬에선 로그인 없이 열림 — 사장님 2026-09-26 제보). 링크가 인앱 웹뷰 안에서
 * 열리는 한 우리가 고칠 수 없으니, 안드로이드에선 `data-ext="1"` 앵커의 href 를
 * 크롬 intent URL 로 바꿔 아예 크롬에서 열리게 한다. iOS 는 강제 전환이 불가 —
 * InAppBrowserNotice 의 "⋯ 메뉴에서 외부 브라우저로 열기" 안내가 담당.
 *
 * 렌더 없음, 상태 없음 — 마운트 시 DOM 의 href 만 바꾼다(SSR 마크업은 원 URL 그대로라
 * 크롤러·일반 브라우저엔 영향 없음). 감지·URL 변환은 lib/inapp-browser 순수 함수.
 */
import { useEffect } from 'react'
import { chromeIntentUrl, detectInAppBrowser, isAndroidUa } from '@/lib/inapp-browser'

export default function OpenExternalInChrome() {
  useEffect(() => {
    const ua = navigator.userAgent
    const forced = new URLSearchParams(window.location.search).get('inapp') === 'android'
    if (!forced && !(detectInAppBrowser(ua) && isAndroidUa(ua))) return
    const anchors = document.querySelectorAll<HTMLAnchorElement>('a[data-ext="1"]')
    anchors.forEach((a) => {
      const intent = chromeIntentUrl(a.href)
      if (!intent) return
      a.dataset.originalHref = a.href
      a.href = intent
      // intent 는 새 탭 개념이 없다 — target 을 지워야 웹뷰가 그냥 처리한다.
      a.removeAttribute('target')
    })
  }, [])
  return null
}
