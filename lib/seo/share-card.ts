import type { Metadata } from 'next'

/**
 * 공유 카드(openGraph·twitter) 한 벌 — 간단한 화면용.
 *
 * Next 메타데이터는 openGraph 를 **얕게** 합친다: 자기 openGraph 가 없는 화면은 루트 것을 통째로 물려받아, 링크 모음·약관을
 * 공유해도 홈 제목·설명·주소가 떴다(2026-10-12 점검 — 링크 모음·약관 화면의 og:url 이 홈). 자기 카드를 달 때 locale·siteName·
 * 그림도 같이 넣어야 한다(얕은 병합이라 안 물려받음). 그림은 루트와 같은 /og.
 */
export function shareCard(title: string, description: string, path: string): Pick<Metadata, 'openGraph' | 'twitter'> {
  const t = `${title} | 파머스테일`
  return {
    openGraph: {
      title: t,
      description,
      type: 'website',
      locale: 'ko_KR',
      siteName: '파머스테일',
      url: path,
      images: [{ url: '/og', width: 1200, height: 630, alt: '파머스테일' }],
    },
    twitter: { card: 'summary_large_image', title: t, description, images: ['/og'] },
  }
}
