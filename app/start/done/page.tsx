// 웹 가입 완료 착지 화면 — 웹 설문(행사 링크 ?p=코드)으로 가입한 손님이 오는 곳.
//
//   • 앱(PWA/Capacitor) 사용자: /start/claim·login 이 곧장 /dogs/{id}/analysis 로 보내 여기 오지 않는다.
//   • 웹 사용자: 여기로 온다.
//
// ★2026-10-10 웹 리뉴얼(기획서 D1·D2, 사장님 "기획서대로"): 웹 설문·웹 정기배송 신청은 앱으로 옮겼다.
//   예전 화면은 "배송지 → 카드 등록 → 첫 배송"(웹 신청) 단계를 설명하고 [배송지 입력하고 시작하기]로 웹 신청 화면에
//   보냈다 — 그 신청은 이제 앱에서만 한다. 그래서 이 화면은 "가입 끝 → 앱에서 이어서"로 다시 썼다(새 웹 가게 틀).
//   ① 앱이 추천한 구성 요약 — 다음에 볼 앱 화면과 **같은 원천**(loadOrderPageData)에서 읽는다(화면마다 구성·금액이
//      달라 보이던 사고가 여러 번 있었다). 실패하면 통째로 뺀다 — 틀린 구성·금액보다 설명이 적은 편이 낫다.
//   ② 행사 혜택 — 가입할 때 계정에 박힌(claim_promotion) 혜택이 아직 안 쓰였으면 보여 준다. 행사표(promotions)는
//      손님이 직접 못 읽게 잠겨 있어(2026-09-26 이벤트 코드 비공개) 서버가 관리자 권한으로 **이 사람의 기록만** 읽는다(규칙8).
//   ③ 앱 받기(공식 배지) — 같은 계정으로 로그인하면 우리 아이·추천 구성이 그대로 있고, 행사 혜택은 첫 정기배송 결제에 적용된다.

import type { Metadata } from 'next'
import DoneWebView, { type DoneBox, type DonePromo } from './DoneWebView'
import { loadOrderPageData } from '@/lib/subscription/orderPageData'
import { quoteBox } from '@/lib/subscription/boxQuote'
import { createClient, getSafeUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recipeName } from '@/lib/personalization/format'
import { petName } from '@/lib/korean'

export const metadata: Metadata = {
  title: '가입 완료',
  robots: { index: false, follow: false },
}

/**
 * 앱 정기배송 화면과 **같은 원천**으로 추천 구성 요약을 만든다.
 * 실패하면 null — 요약을 통째로 뺀다.
 */
async function loadBoxSummary(dogId: string): Promise<DoneBox | null> {
  if (!dogId) return null
  try {
    const data = await loadOrderPageData(dogId, {})
    if (!data.ok || !data.formula) return null

    const supabase = await createClient()
    const quote = await quoteBox(supabase, {
      // 아직 구독 행이 없다. quoteBox 는 이 값을 품목행을 만들 때만 쓰고 여기선 total 만 읽는다 — 저장하지 않는다.
      subscriptionId: 'preview',
      formula: {
        lineRatios: data.formula.lineRatios,
        toppers: data.formula.toppers,
      },
      dailyKcal: data.formula.dailyKcal,
      freshRatio: data.initialFresh,
    })

    return {
      recipes: recipeName(data.formula),
      dailyGrams: data.formula.dailyGrams ?? null,
      total: quote?.total ?? null,
    }
  } catch {
    return null
  }
}

/**
 * 가입할 때 계정에 박힌 행사 혜택 — 아직 안 썼을 때만. 조회 실패·없음·이미 씀이면 null(화면에서 뺀다).
 * 행사표는 손님이 못 읽으니 관리자 권한으로 읽되, 범위는 코드가 로그인한 본인(user.id)으로 묶는다(규칙8).
 */
async function loadPendingPromo(): Promise<DonePromo | null> {
  try {
    const supabase = await createClient()
    const user = await getSafeUser(supabase)
    if (!user) return null
    const admin = createAdminClient()
    const { data: claim, error: claimErr } = await admin
      .from('promotion_claims')
      .select('promotion_id, redeemed_order_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (claimErr || !claim || claim.redeemed_order_id) return null
    const { data: promo, error: promoErr } = await admin
      .from('promotions')
      .select('name, discount_rate')
      .eq('id', claim.promotion_id)
      .maybeSingle()
    if (promoErr || !promo) return null
    const ratePct = Math.round(Number(promo.discount_rate) * 100)
    if (!(ratePct > 0)) return null
    return { name: String(promo.name), ratePct }
  } catch {
    return null
  }
}

export default async function StartDonePage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; dog?: string }>
}) {
  const sp = await searchParams
  const rawName = (sp.name || '').trim()
  const dogId = (sp.dog || '').trim()
  const [box, promo] = await Promise.all([loadBoxSummary(dogId), loadPendingPromo()])

  // 이름 조사는 정본 헬퍼로(받침 있으면 '이'). 없으면 '우리 아이'.
  const who = rawName ? petName(rawName) : '우리 아이'

  return <DoneWebView who={who} box={box} promo={promo} />
}
