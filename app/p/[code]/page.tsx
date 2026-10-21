/**
 * 이벤트 화면 /p/코드 — 약국 봉투·전단 QR(2026-10-19 사장님 "A로 가고 … 안내서 넣고").
 *
 *   ① 안내서(받는 순서 네 줄) → ② 앱 첫 화면과 같은 첫 질문(이름·생일·견종·성별·중성화·몸무게·사진, FirstScreenFlow event)
 *   → ③ 도장 '쾅' + 카카오·애플 가입(혜택이 계정에 저장) → ④ /p/코드/done: 강아지만 만들고 앱 설치 + '이미 계정이 있어요 · 로그인' 안내
 *   → 앱에서 로그인하면 설문 안 한 강아지가 있으니 바로 설문으로(lib/auth/surveyPendingDog) → 첫 결제에 이벤트 할인.
 *
 * 왜 /p 인가: 아이폰 유니버설 링크·새 안드로이드 앱 링크가 /p/ 아래 주소를 앱으로 가져가지 않게 이미 비워 둔 자리다(규칙175·204).
 * 옛 /start?p= 는 이미 인쇄된 QR 용으로 그대로 둔다(규칙176).
 * 열려 있는지는 행사표로 판정한다(lib/promotions-load) — 꺼진·끝난·인원이 찬 코드면 '끝났어요'를 보여 거짓 약속을 안 한다.
 * 앱 안에서 열리면(플레이 1.0.10 은 모든 주소를 앱이 가져간다) 앱 첫 화면으로 넘긴다 — 거기서도 ?p= 로 혜택이 이어진다.
 */
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { isAppContextServer } from '@/lib/app-context'
import { normalizePromoCode } from '@/lib/promotions'
import { loadEventPromo } from '@/lib/promotions-load'
import { DEFAULT_HERO_DOG, supporterByCode } from '@/lib/supporters'
import { petName } from '@/lib/korean'
import { createClient, getSafeUser } from '@/lib/supabase/server'
import EventFlow from './EventFlow'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '첫 박스 할인 받기',
  // 행사 링크는 QR 로만 들어온다 — 검색에 걸리면 끝난 행사가 남는다.
  robots: { index: false, follow: false },
}

export default async function EventPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params
  const code = normalizePromoCode(raw)
  if (!code) notFound()
  const supabase = await createClient()
  const user = await getSafeUser(supabase)
  // 앱 안 — 로그아웃이면 앱 첫 화면(?p= 를 초안에 담아 앱 가입 때 저장), 로그인했으면 이 계정에 바로 저장하는 앱 착지로.
  //   (/start 는 로그인한 사람을 /dogs/new 로 돌려보내 ?p= 를 아무도 안 읽는다 — 10/19 검토)
  if (await isAppContextServer()) redirect(user ? `/p/${code}/done` : `/start?p=${code}`)
  const promo = await loadEventPromo(code)
  if (promo.state === 'missing') notFound()
  // 맨 위 사진 — 서포터즈 코드면 그 아이(/link/코드 와 같은 사진), 아니면 기본.
  //   딱지도 — 서포터즈가 자기 팔로워에게 주는 혜택처럼(사장님 10/21).
  const supporter = supporterByCode(code)
  const heroTag = supporter ? `${petName(supporter.name)}네가 드리는 파머스테일 첫 박스 혜택` : '파머스테일 첫 박스 혜택'
  return <EventFlow code={code} promo={promo} signedIn={!!user} heroDog={supporter ?? DEFAULT_HERO_DOG} heroTag={heroTag} />
}
