import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import DeleteAccountForm from './DeleteAccountForm'

export const dynamic = 'force-dynamic'

export default async function DeleteAccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/delete')

  // Pre-check for blocking conditions so we can show them inline —
  // the API will re-check, but a prominent warning beats a rejection
  // toast after the confirm flow.
  const { data: openOrders } = await supabase
    .from('orders')
    .select('id, order_number, order_status')
    .eq('user_id', user.id)
    .in('order_status', ['preparing', 'shipping'])

  const hasOpen = (openOrders ?? []).length > 0

  // Give the user a summary of what will happen so there's no
  // surprise. These counts come from tables the user can read; we
  // rely on RLS.
  const [
    { count: orderCount },
    { count: dogCount },
    { count: wishCount },
    { count: reviewCount },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('dogs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('wishlists')
      .select('product_id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  return (
    <main className="pb-10">
      <section className="px-5 pt-6 pb-2">
        <Link
          href="/mypage"
          className="text-[11px] text-muted hover:text-terracotta font-semibold"
        >
          ← 내 정보
        </Link>
        <div className="flex items-center gap-2 mt-3">
          <AlertTriangle
            className="w-4 h-4 text-sale"
            strokeWidth={2.25}
          />
          <span className="kicker" style={{ color: 'var(--sale)' }}>
            Delete Account · 회원 탈퇴
          </span>
        </div>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          회원 탈퇴
        </h1>
        <p className="text-[12px] text-muted mt-1.5 leading-relaxed">
          탈퇴 후에는 계정을 복구할 수 없어요. 아래 내용을 꼭 확인해 주세요.
        </p>
      </section>

      {/* 진행 중 주문이 있으면 차단 */}
      {hasOpen && (
        <section className="px-5 mt-4">
          <div className="bg-sale/5 border border-sale/30 rounded-2xl px-5 py-4">
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="w-4 h-4 text-sale shrink-0 mt-0.5"
                strokeWidth={2.25}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-sale">
                  진행 중인 주문이 있어요
                </p>
                <p className="text-[11px] text-text mt-1 leading-relaxed">
                  배송이 진행 중인 주문이 있으면 탈퇴할 수 없어요. 배송
                  완료 후 다시 시도해 주세요.
                </p>
                <ul className="mt-2 space-y-1">
                  {(openOrders ?? []).map((o) => (
                    <li
                      key={o.id}
                      className="text-[11px] text-text font-mono"
                    >
                      • {o.order_number} ·{' '}
                      <span className="text-muted">
                        {o.order_status === 'preparing' ? '준비중' : '배송중'}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/mypage/orders"
                  className="inline-block mt-3 text-[11px] font-bold text-terracotta hover:underline"
                >
                  주문 내역 보기 →
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 탈퇴 후 처리 안내 */}
      <section className="px-5 mt-4">
        <div className="bg-white rounded-2xl border border-rule px-5 py-5">
          <h2
            className="font-serif mb-3"
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            탈퇴 시 처리되는 내용
          </h2>
          <dl className="space-y-2.5 text-[12px]">
            <div className="flex items-start gap-2">
              <span className="text-moss font-bold w-14 shrink-0">삭제</span>
              <span className="text-text leading-relaxed">
                이름·연락처·주소, 반려견 프로필 {dogCount ?? 0}건, 찜{' '}
                {wishCount ?? 0}개, 장바구니, 알림 구독, 초대 코드, 건강
                일지·분석 기록
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-terracotta font-bold w-14 shrink-0">
                보관
              </span>
              <span className="text-text leading-relaxed">
                주문 내역 {orderCount ?? 0}건, 작성하신 리뷰{' '}
                {reviewCount ?? 0}건, 적립금 내역은 전자상거래법에 따라
                5년간 익명 상태로 보관돼요
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-muted font-bold w-14 shrink-0">
                차단
              </span>
              <span className="text-text leading-relaxed">
                동일 계정으로 로그인할 수 없게 돼요. 재가입 시 별도 계정이
                생성됩니다.
              </span>
            </div>
          </dl>
        </div>
      </section>

      {!hasOpen && <DeleteAccountForm />}

      {hasOpen && (
        <section className="px-5 mt-4">
          <Link
            href="/mypage"
            className="block text-center py-3 rounded-full bg-white border border-rule text-[13px] font-bold text-text hover:bg-bg transition"
          >
            돌아가기
          </Link>
        </section>
      )}
    </main>
  )
}
