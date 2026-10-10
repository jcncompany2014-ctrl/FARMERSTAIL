'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { nativeBuildInfo, type NativeBuildInfo } from '@/lib/native-build'
import { APP_STORE_LINKS } from '@/lib/links'
import { V3, V3Radius } from '@/lib/design/tokens'

/**
 * 옛 앱 버전 사용자에게 '새 버전이 나왔어요' (2026-09-26 출시 전 점검 8차).
 *
 * 웹 배포는 모든 설치 버전에 닿지만 네이티브 고침(안드 1.0.11 카카오톡 로그인·카드사 앱 전환, iOS 사진 권한,
 * 오프라인 안내)은 스토어 업데이트로만 간다. 자동 업데이트를 끈 사람은 영영 옛 버전에 남고, 우리도 몰랐다.
 *
 * 기준 빌드는 **환경변수**로만 켠다(기본 꺼짐) — 스토어에 새 버전이 올라가기 전에 "업데이트하세요"라고
 * 하면 누를 곳이 없다. 사장님이 새 빌드를 올린 뒤 Vercel 에
 *   NEXT_PUBLIC_APP_RECOMMENDED_BUILD_ANDROID=12  (1.0.11)
 *   NEXT_PUBLIC_APP_RECOMMENDED_BUILD_IOS=3       (1.0.1)
 * 을 넣고 재배포하면 그보다 낮은 빌드에만 뜬다. 닫으면 같은 기준 빌드로는 다시 안 뜬다.
 * 스토어 링크는 allowNavigation 밖이라 옛 빌드에서도 외부 스토어 앱으로 열린다.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 시안 B02) — 먹색 카드가 아래 탭 바로 위(12px)에 뜬다.
 * 결정 "새 버전 안내는 '업데이트하기' 버튼을 크게" — 예전 오른쪽 작은 알약 버튼 대신 카드 폭 전체의
 * 흰 버튼(+ 내려받기 그림), 닫기 X 는 44px 누르는 칸. 이 부품은 루트 layout 에 붙어 앱 틀
 * (data-ft-chrome="app") **밖**에 그려진다 — 앱 범위 CSS 변수가 닿지 않으므로 색·치수는 값으로 직접 쓴다.
 * 네이티브 앱에서만 뜬다(nativeBuildInfo 가 웹·PWA 에선 null) — 웹 화면엔 영향이 없다.
 */
const RECOMMENDED: Record<NativeBuildInfo['platform'], number> = {
  android: Number(process.env.NEXT_PUBLIC_APP_RECOMMENDED_BUILD_ANDROID) || 0,
  ios: Number(process.env.NEXT_PUBLIC_APP_RECOMMENDED_BUILD_IOS) || 0,
}

function dismissKey(platform: string, build: number) {
  return `ft_update_dismissed_${platform}_${build}`
}

export default function NativeUpdateNotice() {
  const [show, setShow] = useState<{ platform: NativeBuildInfo['platform']; rec: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    void nativeBuildInfo().then((info) => {
      if (cancelled || !info) return
      const rec = RECOMMENDED[info.platform]
      // 기준이 없거나(꺼짐) 빌드를 못 읽었거나(0) 이미 최신이면 조용히.
      if (!rec || !info.build || info.build >= rec) return
      try {
        if (window.localStorage.getItem(dismissKey(info.platform, rec))) return
      } catch {
        /* 저장소를 못 쓰면 그냥 보여 준다 */
      }
      setShow({ platform: info.platform, rec })
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!show) return null

  const close = () => {
    try {
      window.localStorage.setItem(dismissKey(show.platform, show.rec), '1')
    } catch {
      /* 무시 */
    }
    setShow(null)
  }

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        // 아래 탭(높이 68 + 윗선 1.5) 위 12px. 탭 높이 변수(--ft-tabbar-h)는 앱 틀 안에만 있어 값으로 쓴다.
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 82px)',
        zIndex: 60,
        // 태블릿에선 앱 본문 폭(448)을 넘지 않게 가운데로.
        maxWidth: 416,
        marginLeft: 'auto',
        marginRight: 'auto',
        boxSizing: 'border-box',
        padding: '14px 6px 16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        borderRadius: V3Radius.sm,
        background: V3.ink,
        color: V3.paper,
        boxShadow: '0 8px 24px rgba(20,20,20,0.22)',
        wordBreak: 'keep-all',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.25 }}>새 버전이 나왔어요</span>
          <span style={{ fontSize: 15, lineHeight: 1.5, color: 'rgba(255,255,255,0.8)' }}>
            업데이트하면 로그인과 결제가
            <br />
            더 매끄러워져요.
          </span>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="닫기"
          style={{
            flexShrink: 0,
            width: 44,
            height: 44,
            padding: 0,
            border: 0,
            background: 'transparent',
            color: 'rgba(255,255,255,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={20} strokeWidth={2.4} aria-hidden />
        </button>
      </div>
      <a
        href={show.platform === 'ios' ? APP_STORE_LINKS.ios : APP_STORE_LINKS.android}
        target="_blank"
        rel="noreferrer"
        style={{
          marginRight: 12,
          // '크게'(결정) — 시안 48 보다 한 단계 키운 52(누르는 칸).
          height: 52,
          borderRadius: V3Radius.sm,
          background: V3.paper,
          color: V3.ink,
          fontSize: 16,
          fontWeight: 800,
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Download size={18} strokeWidth={2.4} aria-hidden />
        업데이트하기
      </a>
    </div>
  )
}
