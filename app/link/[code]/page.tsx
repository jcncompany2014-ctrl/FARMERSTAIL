/**
 * /link/코드 — 서포터즈 다섯 아이의 링크 모음(사장님 2026-10-19 "링크 페이지 안에 저걸 넣고 … 따로 주소 만들어서 누가 잘 팔았는지").
 *
 * 기본 링크 모음(/link)과 같은 본문(LinkBody)에 맨 위만 이 아이 사진·영상 + 혜택 카드(→ /p/코드).
 * 아이·사진은 lib/supporters 가 정본이고, 목록에 없는 코드는 404(dynamicParams = false) — 아무 주소나 서포터즈 화면이 되지 않는다.
 * 혜택(할인율·최대 할인 금액)은 행사표(promotions, 코드 같음)에서 읽는다. 행사가 아직 없거나 끝났으면 카드 없이 링크 모음만.
 * 앱 안에서 열리면 app/link/layout 이 "웹에서 열려요" 안내를 띄운다(규칙235 — /link 와 같다).
 * 검색엔 안 건다(같은 본문 다섯 벌 — /link 하나가 검색 정본). 공유 카드는 아이 이름으로.
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { shareCard } from '@/lib/seo/share-card'
import { loadLinkContent } from '@/lib/link-content/load'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { loadEventPromo } from '@/lib/promotions-load'
import { petName } from '@/lib/korean'
import { SUPPORTERS, supporterByCode } from '@/lib/supporters'
import LinkBody from '../LinkBody'

export const revalidate = 300
export const dynamicParams = false

export function generateStaticParams() {
  return SUPPORTERS.map((s) => ({ code: s.code }))
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  const dog = supporterByCode(code)
  if (!dog) return {}
  const title = `${petName(dog.name)}가 먹는 파머스테일`
  const description = '파머스테일 서포터즈 링크 — 신선 화식, 앱 정기배송, 첫 박스 혜택'
  return {
    title,
    description,
    robots: { index: false, follow: true },
    ...shareCard(title, description, `/link/${dog.code}`),
  }
}

export default async function SupporterLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const dog = supporterByCode(code)
  if (!dog) notFound()
  const [content, promo] = await Promise.all([loadLinkContent(todayKstIsoDate()), loadEventPromo(dog.code)])
  return <LinkBody content={content} supporter={{ dog, promo }} />
}
