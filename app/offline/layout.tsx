// /offline 틀 — 서버가 앱 컨텍스트를 판정해 화면에 넘긴다(2026-10-09 앱 새 디자인 'A 포스터', 캔버스 W18).
//
// 서비스 워커는 웹 방문자에게도 등록돼(components/ServiceWorkerRegister) 이 화면이 웹에서도 뜬다 — 앱일 때만 새 모양.
// 서비스 워커가 미리 담아 두는 /offline 응답에도 쿠키가 실려(같은 출처 요청) 앱 사용자 폰엔 앱 모양이 담긴다.
// 화면 내용은 page.tsx 그대로 — 이 틀은 판정값만 싣는다.
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { isAppContextServer } from '@/lib/app-context'
import { ServerAppContextProvider } from '@/components/app/ServerAppContext'

// 화면(page.tsx)이 클라이언트 부품이라 제목은 여기서 단다 — 예전엔 사이트 기본값(영어 섞인 'Farmer's Tail')으로 떴다.
export const metadata: Metadata = { title: '오프라인', robots: { index: false, follow: false } }

export default async function OfflineLayout({ children }: { children: ReactNode }) {
  const isApp = await isAppContextServer()
  return <ServerAppContextProvider isApp={isApp}>{children}</ServerAppContextProvider>
}
