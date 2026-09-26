'use client'

import { useEffect, useState } from 'react'
import { nativeBuildInfo, type NativeBuildInfo } from '@/lib/native-build'
import { APP_STORE_LINKS } from '@/lib/links'
import { V3, V3FontSize, V3FontWeight } from '@/lib/design/tokens'

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
        left: 12,
        right: 12,
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 12,
        background: V3.ink,
        color: V3.paperHi,
        boxShadow: '0 8px 24px rgba(22,20,15,0.25)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: V3FontSize.sm, fontWeight: V3FontWeight.bold }}>새 버전이 나왔어요</div>
        <div style={{ fontSize: V3FontSize.xs, opacity: 0.8, marginTop: 2, wordBreak: 'keep-all' }}>
          업데이트하면 로그인과 결제가 더 매끄러워져요.
        </div>
      </div>
      <a
        href={show.platform === 'ios' ? APP_STORE_LINKS.ios : APP_STORE_LINKS.android}
        target="_blank"
        rel="noreferrer"
        style={{
          flexShrink: 0,
          padding: '8px 14px',
          borderRadius: 999,
          background: V3.paperHi,
          color: V3.ink,
          fontSize: V3FontSize.sm,
          fontWeight: V3FontWeight.bold,
          textDecoration: 'none',
        }}
      >
        업데이트
      </a>
      <button
        type="button"
        onClick={close}
        aria-label="닫기"
        style={{
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          color: V3.paperHi,
          opacity: 0.7,
          fontSize: 18,
          lineHeight: 1,
          padding: 4,
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  )
}
