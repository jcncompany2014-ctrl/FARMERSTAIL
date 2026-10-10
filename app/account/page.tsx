import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAppContextServer } from '@/lib/app-context'
import AccountWebView from './AccountWebView'

/**
 * /account — 웹 내 계정 허브(웹 시안 WEB-A19, 2026-10-10 웹 리뉴얼). 새 웹 가게 틀.
 *
 * # 정보 위계 (2026-06-27 개편, 사장님 — 그대로)
 *   - 등급·도장판: 등급 기준이 도장 개수라 이름 바로 밑(정본 lib/tiers·lib/stamps — 앱 내 정보와 같은 계산).
 *   - 바로가기: 주문 내역 · 정기배송 관리(/account/subscriptions — 웹으로 가입했던 고객의 관리 화면은 유지, 기획서 §2) ·
 *     우리 아이 · 내 프로필 · 알림·수신 설정(메일 푸터 수신거부가 여기로 온다).
 *   - 앱 전용 안내(일일 케어·분석) · 얕은 도움말 링크 · 로그아웃.
 * 앱의 계정 허브는 '내 정보'(/mypage) — 앱에서 이 주소가 열리면 그리로 보낸다(앱에선 이 화면으로 오는 링크가 없다).
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차151).
  title: '내 계정',
  description: '주문 내역, 구독, 고객센터를 한 곳에서 확인하세요.',
  alternates: { canonical: '/account' },
  robots: { index: false, follow: false },
}

export default async function AccountPage() {
  if (await isAppContextServer()) redirect('/mypage')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/account')
  }

  // 카드 표시용 카운트 — 주문(전체/미수령) · 활성 구독 · 강아지
  //
  // ★`paid_at IS NOT NULL` 로 거른다(2026-08-03 검수). 이 필터가 없어서 이 화면은
  //   "주문 내역 **4**" 를 보여주는데 눌러서 들어간 목록은 "아직 주문 내역이
  //   없어요" 였다 — 결제된 적 없는 유령 주문(체크아웃하다 만 것·실패)을 세고
  //   있었던 것. 목록(app/mypage/orders)은 이미 그 4건을 일부러 숨긴다.
  //   `paid_at` 이 정본 신호인 이유도 그쪽 주석에 적혀 있다(환불돼도 유지되므로
  //   payment_status enum 보다 견고).
  const [
    { count: totalOrders },
    { count: pendingOrders },
    { count: activeSubs },
    { count: dogCount },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('paid_at', 'is', null),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('paid_at', 'is', null)
      // FSM 의 실제 enum: pending → preparing → shipping → delivered.
      .in('order_status', ['pending', 'preparing', 'shipping']),
    // '진짜 구독 중'만 카운트 = subscriptionState()==='active' 와 동일한 SQL 조건.
    // 카드 없이 status=active 인 '유령 활성'·결제 실패건 제외(사장님 2026-07-16).
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active')
      .not('billing_key', 'is', null)
      .eq('requires_billing_key_renewal', false)
      .eq('failed_charge_count', 0),
    supabase
      .from('dogs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, email, tier, stamp_count')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <AccountWebView
      name={profile?.name ?? user.email?.split('@')[0] ?? '회원'}
      email={profile?.email ?? user.email ?? ''}
      stamps={(profile as { stamp_count?: number | null } | null)?.stamp_count ?? 0}
      tierRaw={(profile as { tier?: string | null } | null)?.tier ?? null}
      totalOrders={totalOrders ?? 0}
      pendingOrders={pendingOrders ?? 0}
      activeSubs={activeSubs ?? 0}
      dogCount={dogCount ?? 0}
    />
  )
}
