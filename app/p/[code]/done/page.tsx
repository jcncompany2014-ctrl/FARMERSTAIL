/**
 * 이벤트 가입 완료 /p/코드/done — 카카오·애플 가입 뒤 착지(FirstScreenFlow event 의 next).
 *
 * 화면(EventDone)이 한 번: ① 이 코드의 혜택을 계정에 저장(claim_promotion) ② 웹 초안으로 **강아지만** 만든다(createDogFromDraft —
 * 설문·분석은 만들지 않는다. /start/claim 의 applyAutosignupDraft 는 답하지 않은 기본값으로 분석까지 만들어 앱이 '남은 설문'을
 * 안 묻게 된다) ③ 고른 광고 수신 동의를 저장(set_marketing_consent). 그 뒤 새로 고쳐 이 서버가 계정에 저장된 혜택을 다시 읽는다.
 * 그리고 앱 설치 → 앱 첫 화면 아래 '이미 계정이 있어요 · 로그인' → 같은 방법(카카오·애플)으로 로그인 → 설문 순서를 안내한다.
 */
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { isAppContextServer } from '@/lib/app-context'
import { normalizePromoCode } from '@/lib/promotions'
import { loadPendingPromo } from '@/lib/promotions-load'
import { createClient, getSafeUser } from '@/lib/supabase/server'
import { isFreshAccount } from '@/lib/survey/welcome'
import EventDone from './EventDone'
import AppEventClaim from './AppEventClaim'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '가입 완료 · 앱에서 이어서',
  robots: { index: false, follow: false },
}

export default async function EventDonePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params
  const code = normalizePromoCode(raw)
  if (!code) notFound()
  const supabase = await createClient()
  const user = await getSafeUser(supabase)
  // 앱 안 — 웹 안내(앱 설치)는 필요 없다. 로그인했으면 이 계정에 혜택만 저장하고 홈·설문으로, 아니면 앱 첫 화면(?p=)으로.
  if (await isAppContextServer()) {
    if (!user) redirect(`/start?p=${code}`)
    return <AppEventClaim code={code} />
  }
  const pending = user ? await loadPendingPromo(user.id) : null
  const provider = (user?.app_metadata as { provider?: string } | undefined)?.provider ?? null
  return <EventDone code={code} signedIn={!!user} pendingPct={pending?.pct ?? null} pendingCap={pending?.maxDiscount ?? null} provider={provider} fresh={isFreshAccount(user?.created_at)} />
}
