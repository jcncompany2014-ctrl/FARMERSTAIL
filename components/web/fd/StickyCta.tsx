/**
 * StickyCta — (비활성) 스크롤이 히어로를 지나면 하단에 고정 등장하던 모바일 CTA.
 * 사장님 2026-06-15 지시로 제거 — 모바일 헤더 스크롤 pill('첫 주문 50% 할인')이
 * 상시 CTA 역할을 대체해 중복이라 하단 고정 바를 없앰.
 * 호출부(마케팅 13페이지)는 그대로 두기 위해 컴포넌트는 남기되 아무것도 렌더하지 않음.
 * 복구하려면 git 이전 버전의 fixed-bottom 바 구현(scrollY>680 reveal)을 참조.
 */
export default function StickyCta({
  href,
  label,
}: {
  href: string
  label?: string
}): null {
  void href
  void label
  return null
}
