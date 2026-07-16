import { redirect } from 'next/navigation'

// 2026-07-16 — 배송지 목록을 프로필(/account/profile)로 편입(사장님). 이 경로는
// 프로필로 리다이렉트. 추가/수정 폼(/mypage/addresses/new·[id])은 그대로 유지.
export default async function AddressesRedirect() {
  redirect('/account/profile')
}
