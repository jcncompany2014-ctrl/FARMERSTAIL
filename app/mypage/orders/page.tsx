import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import SiteShell from '@/components/store/SiteShell'
import { isAppContextServer } from '@/lib/app-context'
import OrdersAppView, { type OrderRow as AppOrderRow } from './OrdersAppView'

/**
 * 주문 내역 — 웹·앱이 같이 쓰는 주소.
 * ★2026-10-10 웹 리뉴얼: 웹도 앱 새 디자인 목록(OrdersAppView — 필터 탭·주문 카드)을 새 웹 가게 틀(SiteShell)에 담는다.
 *  웹은 제목 한 줄을 더하고, 빈 화면 안내는 가게로(variant 'web'). 예전 웹 판(통계 칩·에디토리얼 목록)은 git 이력에 있다.
 *  웹 가게 주문(FTS-)·정기배송 주문이 같은 목록에 보인다(같은 계정).
 */
// (cache-bust: Turbopack 가 편집 중간 파스 실패 청크를 캐시해 강제 재컴파일)
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '주문 내역',
  description: '내 주문 내역',
  robots: { index: false, follow: false },
}

export default async function OrdersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/mypage/orders')

  // 앱: 상단 헤더(← 주문 내역)가 제목/뒤로가기를 담당 → 본문 제목 없음. 웹: 본문 제목 한 줄.
  const isApp = await isAppContextServer()

  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      `
      id,
      order_number,
      total_amount,
      payment_status,
      order_status,
      created_at,
      order_items (
        id,
        product_id,
        product_name,
        product_image_url,
        quantity,
        unit_price
      )
    `
    )
    .eq('user_id', user.id)
    // ★ '결제 완료한 것만' 노출 (사장님 2026-07-22). 결제된 적 없는 유령 주문
    //   (체크아웃하다 만 것·실패·미결제 취소 = paid_at NULL)은 숨긴다 — 사용자가
    //   "결제한 적 없는 주문이 뜬다"고 반복해서 답답해한 부분. paid_at 은 결제가
    //   실제로 완료돼야 세팅되고 환불돼도 유지되므로, paid/부분환불/환불(=결제 후
    //   이력)은 남고 pending·failed·미결제 cancelled 만 빠진다. payment_status enum
    //   ('cancelled'가 미결제인지 결제후취소인지)보다 견고한 정본 신호.
    .not('paid_at', 'is', null)
    .order('created_at', { ascending: false })
    // 최근 50건만 — 장기 구독 고객의 전체 주문+아이템 무제한 로드로 목록 진입이
    // 점점 느려지던 것 방지(2026-07-17 perf). 2주 배송 기준 ~2년치. 더 필요하면
    // range 페이지네이션은 후속.
    .limit(50)

  const title = !isApp && (
    <h1 className="d" style={{ margin: 0, padding: '28px 20px 0', fontSize: 34, lineHeight: 1.1 }}>
      주문 내역
    </h1>
  )

  if (error) {
    // 고객에게는 안 보여주되 나는 알아야 한다 — 원본은 Sentry 로만.
    Sentry.captureException(new Error(`[mypage.orders] ${error.message}`), { tags: { area: 'mypage-orders' } })
    // 앱엔 '마이페이지'라는 이름이 없다(앱시안 결정 3번 '동작'). 정기배송 탭의 불러오기 실패(S14)와 같은 꼴 — 웹도 같은 꼴.
    return (
      <SiteShell>
        <main className="pb-8">
          {title}
          <section
            role="alert"
            style={{
              margin: '24px 20px 0',
              padding: '22px 20px 20px',
              border: '1.5px solid #C63D2A',
              borderRadius: 4,
              display: 'flex',
              flexDirection: 'column',
              color: '#141414',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 26, lineHeight: 1.25 }}>주문 내역을 불러오지 못했어요</h2>
            <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.6, color: '#3D3D3D' }}>
              잠시 뒤에 다시 열어 봐 주세요. 계속 이러면 고객센터로 알려 주시면 바로 확인할게요.
            </p>
            <Link
              href={isApp ? '/help' : '/contact'}
              style={{
                marginTop: 18,
                height: 56,
                borderRadius: 4,
                background: '#141414',
                color: '#FFFFFF',
                fontSize: 17,
                fontWeight: 800,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              고객센터로 가기
            </Link>
          </section>
        </main>
      </SiteShell>
    )
  }

  return (
    <SiteShell>
      <main className="pb-8">
        {title}
        <OrdersAppView orders={(orders ?? []) as unknown as AppOrderRow[]} variant={isApp ? 'app' : 'web'} />
      </main>
    </SiteShell>
  )
}
