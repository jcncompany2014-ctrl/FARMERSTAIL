// /subscribe/* (카드 등록 · 등록 완료 · 등록 실패) 공통 틀 — 서버가 앱 컨텍스트를 판정해 화면에 넘긴다(2026-10-09).
//
// 이 화면들은 웹·앱이 같이 쓰는 최상위 경로라 AppChrome 밖에서 그려진다. 앱 새 디자인('A 포스터', 캔버스 S33~S37·C05)은
// 앱일 때만 입히는데, 클라이언트 훅으로 판정하면 마운트 뒤에야 알 수 있어 웹 모양 → 앱 모양으로 깜빡인다.
// 여기서 쿠키·UA 로 판정해(lib/app-context — 미들웨어·다른 서버 화면과 같은 두 신호) 첫 그림부터 맞춘다.
// 화면 내용은 각 page.tsx 그대로 — 이 틀은 판정값만 싣는다.
import type { ReactNode } from 'react'
import { isAppContextServer } from '@/lib/app-context'
import { ServerAppContextProvider } from '@/components/app/ServerAppContext'

export default async function SubscribeLayout({ children }: { children: ReactNode }) {
  const isApp = await isAppContextServer()
  return <ServerAppContextProvider isApp={isApp}>{children}</ServerAppContextProvider>
}
