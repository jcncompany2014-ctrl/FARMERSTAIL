'use client'

/**
 * 앱 안에서 링크 모음(/link) 주소가 열렸을 때 — "링크 모음은 웹에서 열려요" + 폰 브라우저로 넘기기(2026-10-14, 규칙235).
 *
 * 안드로이드 14 이하는 앱 링크 제외(매니페스트 uri-relative-filter-group — 안드로이드 15 부터, 규칙204)가 안 먹어, 앱이 깔린
 * 폰에서 인스타 프로필 링크(/link)를 누르면 앱이 열리고 웹 화면(흰 가게 틀 · '앱에서 맞춤 정기배송' 버튼)이 앱 안에 그대로 떴다
 * — 앱을 쓰는 사람에게 앱을 받으라는 화면이다. 가게 안내(app/store/StoreInAppNotice, 규칙205)와 같은 앱 모양 조각(AuthAppParts)·
 * 같은 브라우저 열기 방식(lib/external-browser — 안드로이드 = 크롬 intent, 빌드 번호 문지기 / 아이폰·설치형 = target="_blank")이다.
 * 아이폰은 AASA 가 /link 를 이미 빼므로(규칙175) 보통 여기 오지 않는다. 첫 버튼(/app — 규칙165)은 웹 화면 쪽 이야기라 그대로다.
 */

import { useState, type MouseEvent } from 'react'
import { AuthAppMain, AuthIconBox, AuthOutlineLink, AuthPrimaryAnchor, AuthResultPanel } from '@/components/v3/auth/AuthAppParts'
import { getPlatform, isNativeApp } from '@/lib/capacitor'
import { buildAtLeast, nativeBuildInfo, NATIVE_FEATURE_MIN_BUILD } from '@/lib/native-build'
import { androidChromeIntentUrl, LINK_WEB_URL, linkWebUrl } from '@/lib/external-browser'
import { V3 } from '@/lib/design/tokens'

export default function LinkInAppNotice() {
  // 옛 안드로이드 앱(intent 링크를 못 여는 빌드)에서 눌렀을 때만 켜지는 안내.
  const [oldAndroid, setOldAndroid] = useState(false)

  function openInBrowser(e: MouseEvent<HTMLAnchorElement>) {
    const url = linkWebUrl(window.location.search)
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
    // 아이폰 앱·설치형 PWA — target="_blank" 가 사파리/브라우저로 연다. 검색어(인스타 utm 등)만 지금 주소 그대로 붙인다.
    e.currentTarget.href = url
  }

  return (
    <AuthAppMain>
      <AuthResultPanel
        icon={
          <AuthIconBox>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={V3.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" />
              <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
            </svg>
          </AuthIconBox>
        }
        title="링크 모음은 웹에서 열려요"
        titleSize={38}
        body={
          <>
            인스타그램 프로필의 링크 모음(소식·스마트스토어 바로 가기)은 폰 브라우저에서 보는 화면이에요.
            <br />
            아래 버튼을 누르면 브라우저로 이어서 열려요.
          </>
        }
        action={
          <>
            {oldAndroid && (
              <p role="status" style={{ margin: '0 0 14px', fontSize: 16, lineHeight: 1.55, fontWeight: 700, color: V3.ink }}>
                지금 쓰시는 앱 버전에서는 바로 열 수 없어요. 앱을 최신 버전으로 업데이트하거나, 브라우저 주소창에
                www.farmerstail.kr/link 를 입력해 주세요.
              </p>
            )}
            <AuthPrimaryAnchor href={LINK_WEB_URL} target="_blank" rel="noopener noreferrer" onClick={openInBrowser}>
              브라우저로 링크 모음 열기
            </AuthPrimaryAnchor>
            <AuthOutlineLink href="/dashboard" style={{ marginTop: 12 }}>
              앱 홈으로
            </AuthOutlineLink>
          </>
        }
        note={<>버튼이 안 되면 브라우저 주소창에 www.farmerstail.kr/link 를 입력해 주세요.</>}
      />
    </AuthAppMain>
  )
}
