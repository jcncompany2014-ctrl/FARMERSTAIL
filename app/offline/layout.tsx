// /offline 틀 — 서버가 앱 컨텍스트를 판정해 화면에 넘긴다(2026-10-09 앱 새 디자인 'A 포스터', 캔버스 W18).
//
// 서비스 워커는 웹 방문자에게도 등록돼(components/ServiceWorkerRegister) 이 화면이 웹에서도 뜬다 — 앱일 때만 새 모양.
// 서비스 워커가 미리 담아 두는 /offline 응답에도 쿠키가 실려(같은 출처 요청) 앱 사용자 폰엔 앱 모양이 담긴다.
// 화면 내용은 page.tsx 그대로 — 이 틀은 판정값과 '다시 시도하기' 인라인 스크립트만 싣는다.
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { isAppContextServer } from '@/lib/app-context'
import { ServerAppContextProvider } from '@/components/app/ServerAppContext'
import { OFFLINE_RETRY_SCRIPT } from '@/lib/offline-retry'

// 화면(page.tsx)이 클라이언트 부품이라 제목은 여기서 단다 — 예전엔 사이트 기본값(영어 섞인 'Farmer's Tail')으로 떴다.
export const metadata: Metadata = { title: '오프라인', robots: { index: false, follow: false } }

export default async function OfflineLayout({ children }: { children: ReactNode }) {
  const isApp = await isAppContextServer()
  return (
    <ServerAppContextProvider isApp={isApp}>
      {children}
      {/* 오프라인이면 스크립트 묶음이 안 와 하이드레이션이 안 된다(규칙200) — '다시 시도하기' 링크 주소 맞추기와
          인터넷 복구 시 다시 불러오기는 HTML 안 인라인 스크립트가 맡는다. 링크(<a>)보다 **뒤**에 있어야 링크를 찾는다. */}
      <script dangerouslySetInnerHTML={{ __html: OFFLINE_RETRY_SCRIPT }} />
    </ServerAppContextProvider>
  )
}
