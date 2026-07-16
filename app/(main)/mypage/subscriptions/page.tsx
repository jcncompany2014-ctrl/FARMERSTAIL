import { redirect } from 'next/navigation'

// 2026-07-16 — 옛 정기배송 리스트 디자인 삭제(사장님 "거지같은 옛날 디자인 삭제").
// 정기배송 전체 관리는 /account/subscriptions 로 일원화. focus 파라미터는 보존해 전달.
export default async function MySubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; focus?: string }>
}) {
  const sp = await searchParams
  const q = sp.focus ? `?focus=${encodeURIComponent(sp.focus)}` : ''
  redirect(`/account/subscriptions${q}`)
}
