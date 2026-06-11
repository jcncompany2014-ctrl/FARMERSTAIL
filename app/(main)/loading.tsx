/**
 * (main)/loading.tsx — 모든 앱 화면의 기본 로딩 fallback.
 *
 * Next App Router: 이 세그먼트의 서버 컴포넌트가 데이터 fetch 로 suspend 되면
 * 헤더/탭바는 그대로 두고 본문만 이 화면으로 교체된다 → 파머스테일 로고
 * 스플래시. 특정 화면이 자체 loading.tsx(스켈레톤)를 두면 그쪽이 우선한다.
 */
import BrandLoader from '@/components/v3/BrandLoader'

export default function Loading() {
  return <BrandLoader />
}
