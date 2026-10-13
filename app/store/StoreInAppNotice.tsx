'use client'

/**
 * 앱 안에서 가게(/store/*) 주소가 열렸을 때 — "가게는 웹에서 열려요" + 폰 브라우저로 넘기기(2026-10-13, 규칙205).
 *
 * 앱은 단품을 팔지 않는다(웹/앱 분리). 예전엔 app/store/layout 이 앱 홈(/dashboard)으로 바로 돌려보내, 앱이 깔린 안드로이드
 * 14 이하 폰에서 가게 링크(인스타·카톡)를 누른 손님은 가게로 갈 길이 없었다(앱 링크 제외는 안드로이드 15 부터 —
 * AndroidManifest 규칙204). 무엇으로 브라우저를 여는지는 lib/external-browser 머리말에 근거를 적었다.
 * 앱 모양(흰 바탕·먹색)은 오프라인 화면과 같은 조각(AuthAppParts)으로 — 웹 가게 화면(.fts)이 앱에 보이면 안 된다.
 */

import { useState, type MouseEvent } from 'react'
import { AuthAppMain, AuthIconBox, AuthOutlineLink, AuthPrimaryAnchor, AuthResultPanel } from '@/components/v3/auth/AuthAppParts'
import { getPlatform, isNativeApp } from '@/lib/capacitor'
import { buildAtLeast, nativeBuildInfo, NATIVE_FEATURE_MIN_BUILD } from '@/lib/native-build'
import { androidChromeIntentUrl, STORE_WEB_HOME, storeWebUrl } from '@/lib/external-browser'
import { V3 } from '@/lib/design/tokens'

export default function StoreInAppNotice() {
  // 옛 안드로이드 앱(intent 링크를 못 여는 빌드)에서 눌렀을 때만 켜지는 안내.
  const [oldAndroid, setOldAndroid] = useState(false)

  function openInBrowser(e: MouseEvent<HTMLAnchorElement>) {
    const url = storeWebUrl(window.location.pathname, window.location.search)
    if (isNativeApp() && getPlatform() === 'android') {
      // 안드로이드 WebView 는 target="_blank" 를 같은 화면에서 연다 — 크롬 intent 로 넘긴다(옛 빌드는 오류 화면이라 막는다).
      e.preventDefault()
      void nativeBuildInfo().then((info) => {
        const intent = androidChromeIntentUrl(url)
        if (intent && info && buildAtLeast(info.build, NATIVE_FEATURE_MIN_BUILD.androidIntentLinks)) {
          window.location.href = intent
        } else {
          setOldAndroid(true)
        }
      })
      return
    }
    // 아이폰 앱·설치형 PWA — target="_blank" 가 사파리/브라우저로 연다. 주소만 지금 보던 가게 화면으로 맞춘다.
    e.currentTarget.href = url
  }

  return (
    <AuthAppMain>
      <AuthResultPanel
        icon={
          <AuthIconBox>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={V3.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 9.5L5 4h14l1.5 5.5" />
              <path d="M3.5 9.5h17a3 3 0 0 1-5.7 1.3A3 3 0 0 1 12 12.5a3 3 0 0 1-2.8-1.7A3 3 0 0 1 3.5 9.5z" />
              <path d="M5 12.3V20h14v-7.7" />
              <path d="M10 20v-4.5h4V20" />
            </svg>
          </AuthIconBox>
        }
        title="가게는 웹에서 열려요"
        titleSize={38}
        body={
          <>
            낱개 상품은 폰 브라우저의 파머스테일 가게에서 살 수 있어요.
            <br />
            아래 버튼을 누르면 브라우저로 이어서 열려요.
          </>
        }
        action={
          <>
            {oldAndroid && (
              <p role="status" style={{ margin: '0 0 14px', fontSize: 16, lineHeight: 1.55, fontWeight: 700, color: V3.ink }}>
                지금 쓰시는 앱 버전에서는 바로 열 수 없어요. 앱을 최신 버전으로 업데이트하거나, 브라우저 주소창에
                www.farmerstail.kr/store 를 입력해 주세요.
              </p>
            )}
            <AuthPrimaryAnchor href={STORE_WEB_HOME} target="_blank" rel="noopener noreferrer" onClick={openInBrowser}>
              브라우저로 가게 열기
            </AuthPrimaryAnchor>
            <AuthOutlineLink href="/dashboard" style={{ marginTop: 12 }}>
              앱 홈으로
            </AuthOutlineLink>
          </>
        }
        note={<>버튼이 안 되면 브라우저 주소창에 www.farmerstail.kr/store 를 입력해 주세요.</>}
      />
    </AuthAppMain>
  )
}
