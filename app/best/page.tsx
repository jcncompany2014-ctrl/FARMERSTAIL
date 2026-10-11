import { permanentRedirect } from 'next/navigation'

/**
 * /best — 옛 낱개 커머스의 '베스트' 숏URL. 옛 링크·북마크 방어용으로만 남긴다.
 *
 * 2026-07-16: 죽은 /products 를 거쳐 두 번 튕기던 것을 /start 로 직결.
 * 2026-10-11 웹 리뉴얼: 웹 /start 가 앱 소개로 넘기게 되어(규칙176) 다시 두 번 튕겼다 — 단품을 파는 가게(/store)로 직결.
 */
export default function BestAlias() {
  permanentRedirect('/store')
}
