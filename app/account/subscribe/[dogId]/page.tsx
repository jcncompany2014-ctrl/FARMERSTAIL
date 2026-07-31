import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import { loadOrderPageData } from '@/lib/subscription/orderPageData'
import OrderClient, {
  type OrderProduct,
} from '@/app/(main)/dogs/[id]/order/OrderClient'
import { business } from '@/lib/business'
import EnsureFormula from './EnsureFormula'

/**
 * /account/subscribe/[dogId] — **웹 사용자용 정기배송 신청.**
 *
 * # 왜 생겼나 (2026-07-31, 사장님 지시)
 * "웹에서도 기본 설문은 있으니 그걸 토대로 제품 구독과 간단한 해지·변경·결제
 * 목록 보기 정도는 되어야 한다."
 * 확인해 보니 해지·일시정지·재개·카드재등록(`/account/subscriptions`)과 결제·주문
 * 목록(`/mypage/orders`)은 **이미 웹에서 된다.** 없는 건 **신청 하나**였다 —
 * 앱 화면 `/dogs/[id]/order` 가 app-only prefix 라 웹에서 못 들어간다.
 * 카드 등록(`/subscribe/billing-auth`)은 이미 웹에서 열리므로, 이 화면 하나만
 * 있으면 웹 신청이 끝까지 이어진다.
 *
 * # 왜 화면을 복사하지 않았나
 * `OrderClient` 는 1160줄이고 그 안에 **금액 계산·주소 저장·토스 창 열기·첫
 * 배송일 산정**이 다 들어 있다. 복사본을 만들면 한쪽만 고쳐지는 순간 **청구와
 * 화면이 갈라진다** — 오늘 하루에만 그 부류(같은 규칙이 두 곳에 살다 한쪽만
 * 고쳐짐)를 네 번 고쳤다(메일 CTA · 웹 구독 조회 · 일괄푸시 명단 · D+7 광고 푸시).
 * 그래서 **같은 컴포넌트를 그대로 쓰고**, 갈라지는 건 세 가지뿐이다:
 *   ① 서버 데이터 — `loadOrderPageData` 공용(Phase 1 에서 추출)
 *   ② 돌려보낼 곳 — 앱은 /dogs, 웹은 /account/dogs
 *   ③ 시각 — 아래 토큰 스왑
 *
 * # 톤 — CSS 를 고치지 않고 변수만 바꾼다
 * `order.css`(922줄)는 `--ink`·`--muted`·`--rule`·`--terracotta` 같은 **소수의
 * 변수만** 쓴다(175회). 그 변수를 이 래퍼에서 FD 값으로 재정의하면 스타일시트
 * 한 줄 안 고치고 전체가 웹 톤이 된다 — `/account/subscriptions` 가 반대 방향
 * (웹 컴포넌트를 앱 톤으로)으로 쓰는 것과 같은 수법이다.
 * 폭도 이미 `max-width: 480px` 라 데스크톱에서 결제 폼으로 자연스럽다.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '정기배송 신청',
  description: '우리 아이 맞춤 화식 정기배송을 신청합니다.',
  alternates: { canonical: '/account/subscribe' },
  robots: { index: false, follow: false },
}

export default async function WebSubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ dogId: string }>
  searchParams: Promise<{ fresh?: string; recipes?: string }>
}) {
  const { dogId } = await params
  const sp = await searchParams
  const data = await loadOrderPageData(dogId, sp)

  if (!data.ok) {
    if (data.reason === 'unauthenticated') {
      redirect(`/login?next=/account/subscribe/${dogId}`)
    }
    if (data.reason === 'dog_not_found') {
      redirect('/account/dogs')
    }
    /**
     * ★ 상담 필요 — 앱은 분석 화면(/dogs/*)의 상담 안내로 보내지만 그건 웹에서
     * 앱 설치 벽이다. 여기선 **이 자리에서 설명하고 문의로** 보낸다.
     * 판매 중인 레시피가 전부 알레르기라 자동 추천이 불가한 경우이므로,
     * 결제로 넘기면 안 된다(2026-07-24: 이 게이트가 없어 알레르기 박스가
     * 결제까지 갔다).
     */
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect(`/login?next=/account/subscribe/${dogId}`)
    return (
      <AuthAwareShell>
        <main className="min-h-screen" style={{ background: 'var(--fd-offwhite)' }}>
          <div className="mx-auto max-w-2xl px-5 py-16">
            <div
              className="px-6 py-8 rounded-[14px]"
              style={{
                background: '#FFFFFF',
                boxShadow: 'inset 0 0 0 1px var(--fd-line)',
              }}
            >
              <h1
                className="text-[17px] font-bold"
                style={{ color: 'var(--fd-pine)' }}
              >
                이 아이는 상담이 필요해요
              </h1>
              <p
                className="mt-2 text-[13.5px] leading-relaxed"
                style={{ color: 'var(--fd-muted)' }}
              >
                지금 판매 중인 레시피가 모두 알레르기 성분과 겹쳐서, 자동으로
                식단을 정해 드릴 수가 없어요. 안전하게 드릴 방법을 함께 찾아야
                해서 신청을 여기서 멈췄습니다 — 편하게 문의 주세요.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={business.kakaoChannelUrl || '/contact'}
                  className="inline-flex items-center px-4 py-2.5 rounded-full text-[13px] font-bold"
                  style={{ background: 'var(--fd-coral)', color: '#FFFFFF' }}
                >
                  문의하기
                </Link>
                <Link
                  href="/account/dogs"
                  className="inline-flex items-center px-4 py-2.5 rounded-full text-[13px] font-bold"
                  style={{
                    color: 'var(--fd-pine)',
                    boxShadow: 'inset 0 0 0 1px var(--fd-line)',
                  }}
                >
                  우리 아이 보기
                </Link>
              </div>
            </div>
          </div>
        </main>
      </AuthAwareShell>
    )
  }

  return (
    <AuthAwareShell>
      <div
        style={{
          background: 'var(--fd-offwhite)',
          minHeight: '72vh',
          /*
            order.css 가 쓰는 앱 토큰을 이 스코프에서만 FD 값으로 바꾼다.
            스타일시트는 한 줄도 안 고친다 — 앱 화면은 이 래퍼 밖이라 영향 0.
            (변수 목록은 order.css 실측: terracotta 38 · muted 32 · ink 28 ·
             rule 20 · moss 14 · surface-card-elevated 12 · bg-2 9 · text 7.)
            moss 는 레시피 슬롯의 의미색이라 그대로 둔다 — 색이 정보다.
          */
          '--ink': 'var(--fd-pine)',
          '--text': 'var(--fd-pine)',
          '--muted': 'var(--fd-muted)',
          '--rule': 'var(--fd-line)',
          '--rule-2': 'var(--fd-line)',
          '--terracotta': 'var(--fd-coral)',
          '--bg': 'var(--fd-offwhite)',
          '--bg-2': 'var(--fd-cream)',
        } as React.CSSProperties}
      >
        {/*
          ★ 처방이 없으면 **여기서 만든다** (2026-07-31 사장님 제보: 웹에서 설문하고
          강아지를 등록했는데 "추천 박스가 없다").

          웹 설문 경로는 `dog_formulas` 를 만들지 않는다 — 화면의 추천은
          `computeStartTeaser`(localStorage 초안으로 브라우저에서 계산한 티저)라
          DB 엔 없다. 앱은 분석 화면의 RecommendationBox 가 마운트될 때 compute 를
          부르는데, **웹엔 그 화면이 없어서 아무도 안 불렀다.**
          OrderClient 에 formula=null 로 넘기면 "아직 박스 추천이 없어요" 만 뜨고
          고객은 갈 곳이 없다 — 그 자리에서 만들어 주고 다시 그린다.
        */}
        {data.formula === null ? (
          <EnsureFormula dogId={dogId} />
        ) : (
        <OrderClient
          isApp={false}
          dogId={dogId}
          userId={data.userId}
          dogName={data.dogName}
          formula={data.formula}
          products={data.products as Record<string, OrderProduct>}
          profile={data.profile}
          initialFresh={data.initialFresh}
          pickedRecipes={data.pickedRecipes}
        />
        )}
      </div>
    </AuthAwareShell>
  )
}
