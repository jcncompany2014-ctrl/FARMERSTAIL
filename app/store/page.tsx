import type { Metadata } from 'next'
import StoreShell from '@/components/store/StoreShell'
import StoreBrowse from '@/components/store/StoreBrowse'
import { storeSalesPaused } from '@/lib/store/toss-widget'
import { STORE_RECIPES, TRIAL_ITEM, storeItem } from '@/lib/store/catalog'

/** 스토어 — 웹 시안 Store. ?tab=trial 이면 체험팩 탭으로 연다(홈·메뉴의 체험팩 링크). */
const won = (n: number) => n.toLocaleString('ko-KR')
const FROM = Math.min(...STORE_RECIPES.map((r) => storeItem(`${r}-500g`).price))

const STORE_DESCRIPTION = `닭고기·오리고기·흑돼지·한우 화식 500g ${won(FROM)}원부터, 4종 체험팩 ${won(TRIAL_ITEM.price)}원. 100g 팩으로 나눠 담아 얼린 채로 보내드려요.`
export const metadata: Metadata = {
  title: '스토어 — 화식 4종·체험팩',
  description: STORE_DESCRIPTION,
  alternates: { canonical: '/store' },
  // 공유 카드 — 페이지가 openGraph 를 두면 루트의 것을 통째로 갈아끼우므로(얕은 병합) 이름·언어·그림도 같이 둔다.
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/store',
    title: '스토어 — 화식 4종·체험팩 | 파머스테일',
    description: STORE_DESCRIPTION,
    images: [{ url: '/og', width: 1200, height: 630, alt: '파머스테일' }],
  },
  twitter: { card: 'summary_large_image', title: '스토어 — 화식 4종·체험팩 | 파머스테일', description: STORE_DESCRIPTION, images: ['/og'] },
}

export default async function StorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const initialTab = sp.tab === 'trial' ? 'trial' : 'recipes'
  return (
    <StoreShell>
      <StoreBrowse initialTab={initialTab} paused={storeSalesPaused()} />
    </StoreShell>
  )
}
