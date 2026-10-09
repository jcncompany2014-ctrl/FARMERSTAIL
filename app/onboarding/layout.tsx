// /onboarding/* (14세 확인) 공통 틀 — 서버가 앱 컨텍스트를 판정해 화면에 넘긴다(2026-10-09 앱 새 디자인 'A 포스터', 캔버스 W13·W26).
//
// 카카오·애플 가입자는 웹 퍼널에서도 앱에서도 이 화면을 거친다(auth/callback → 출생 연도 없으면 여기). 앱일 때만 새 모양을
// 입히는데, 클라이언트 훅으로 판정하면 첫 그림이 웹 모양이었다가 바뀐다. 쿠키·UA 로(lib/app-context) 판정해 첫 그림부터 맞춘다.
// 화면 내용은 page.tsx 그대로 — 이 틀은 판정값만 싣는다.
import type { ReactNode } from 'react'
import { isAppContextServer } from '@/lib/app-context'
import { ServerAppContextProvider } from '@/components/app/ServerAppContext'

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const isApp = await isAppContextServer()
  return <ServerAppContextProvider isApp={isApp}>{children}</ServerAppContextProvider>
}
