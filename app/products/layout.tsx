/**
 * /products — 리다이렉트 스텁이다(옛 낱개 카탈로그 → 단품 가게 /store, 308 — page.tsx·[slug]/page.tsx).
 * 화면을 그리지 않으므로 메타·바깥 틀이 필요 없다. 옛 메타("수의영양학 기반 레시피로 만든 우리 아이 맞춤 화식
 * 정기배송")는 렌더되지 않았지만 옛 문구가 저장소에 남아 있어 2026-10-11 점검 때 지웠다(git 이력).
 */
export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children
}
