import { permanentRedirect } from 'next/navigation'

/**
 * /why-app — 옛 앱 소개(AppShowcase).
 *
 * ★2026-10-10 웹 리뉴얼(기획서 §5.1): 앱 소개는 /app 하나로 — 옛 주소는 308. 예전 화면은 git 이력에 있다.
 */
export default function WhyAppPage() {
  permanentRedirect('/app')
}
