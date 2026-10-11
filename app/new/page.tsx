import { permanentRedirect } from 'next/navigation'

/**
 * /new — 옛 낱개 커머스의 '신상품' 숏URL(구독 전용 전환 때 지워져 404 였다).
 * 옛 링크·검색 색인 정리용으로 /best 와 같이 단품 가게(/store)로 영구 이동(2026-10-11 점검).
 */
export default function NewAlias() {
  permanentRedirect('/store')
}
