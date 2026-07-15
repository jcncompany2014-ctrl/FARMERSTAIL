import { redirect } from 'next/navigation'

/**
 * /best — 옛 낱개 커머스의 '베스트' 숏URL.
 *
 * 구독 전용 전환(2026-06-26)으로 /products 가 폐지돼 /start 로 리다이렉트되는데,
 * 여기가 여전히 /products?sort=best 를 가리켜 **죽은 페이지를 거쳐 두 번 튕겼다**
 * (2026-07-16 정리). 목적지를 /start 로 직결. 옛 링크·북마크 방어용으로만 남긴다.
 */
export default function BestAlias() {
  redirect('/start')
}
