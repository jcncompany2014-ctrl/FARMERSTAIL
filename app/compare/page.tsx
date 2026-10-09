import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { SkuPersona } from '@/lib/sku-nutrition-matrix'
import type { SkuKey } from '@/lib/allergy-sku-matrix'
import { isAppContextServer } from '@/lib/app-context'
import AuthAwareShell from '@/components/AuthAwareShell'
import CompareView from './CompareView'

/** 앱에서 웹 상세페이지를 외부 브라우저로 열 때 쓸 절대 URL 베이스. */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.farmerstail.kr'

export const metadata: Metadata = {
  title: '4종 비교 — 파머스테일',
  description:
    '치킨·오리·흑돼지·한우 4종 화식의 영양을 한 화면에서 비교해 보세요.',
  // 앱 전용 화면 — 검색에 노출되면 웹 방문자가 들어왔다가 튕긴다.
  robots: { index: false, follow: false },
}

/**
 * /compare — 레시피 4종 영양 비교 (앱 분석 페이지 전용 — 2026-07-15).
 *
 * # 카드
 *   1. 4종 영양 비교 — 레시피마다 단백질·지방 막대 + 국제 최소 기준 눈금(2026-10-09 표 → 막대)
 *   2. 4종 레이더(거미줄) 차트
 *   3. 페르소나별 추천 — 입문·다이어트·알레르기·활동 많음·소화민감·기호성
 *
 * # 데이터
 *   lib/sku-nutrition-matrix.ts (자사 R&D 명세 + 국제 기준 교차검증).
 *
 * # ⛔ 앱 전용 (사장님 2026-07-15 "compare 페이지는 다른 어느 곳에서도 안 뜨고
 *   무조건 앱 내 분석 페이지에서만 뜬다")
 *   유일한 입구 = 앱 분석 페이지의 '4종 비교' 카드. 웹 컨텍스트로 들어오면
 *   홈으로 돌려보낸다(직접 URL·옛 링크·검색 유입 방어). sitemap 미포함 +
 *   robots noindex 도 같은 이유. 새 진입점을 만들 땐 이 규칙부터 확인할 것.
 *
 * # 앱 chrome (2026-10-02 사장님 "뒤로가기 없음")
 *   (main) 그룹 밖 최상위 라우트라 chrome 이 하나도 없었다 — 헤더 ←·하단 탭
 *   없이 iOS 에선 나갈 길이 없었다. /help 처럼 AuthAwareShell 로 감싸 다른 앱 하위
 *   화면과 같은 AppChrome(← 4종 비교 + 하단 탭)을 쓴다. 웹은 위 redirect 로
 *   여기까지 오지 않으므로 웹 화면은 그대로다. ← 의 목적지는 AppChrome
 *   parentForPath — 입구 카드가 실어 보낸 ?dog= 의 분석 화면(없으면 홈).
 *
 * # 2026-10-09 앱 새 디자인('A 포스터', 캔버스 A10)
 *   그리는 부분은 CompareView(+CompareClient) 로 옮겼다 — 점검 화면(/design-check/analysis)이 같은 컴포넌트를 쓴다.
 *   웹 화면은 원래 없다(위 redirect) — 웹 픽셀 변화 없음.
 */
export default async function ComparePage() {
  const isApp = await isAppContextServer()
  if (!isApp) redirect('/')

  const skus: SkuKey[] = ['C01', 'D02', 'P04', 'B05']

  return (
    // w-full + min-w-0 — body 가 flex(column) 컨테이너라 main 은 flex item 이다.
    //  · min-w-0: flex item 의 기본 min-width:auto 는 내용의 min-content 아래로
    //    줄어들지 않아, 넓은 내용이 위로 전파된다.
    //  · w-full: mx-auto(auto 마진)가 교차축 stretch 를 꺼버려서 main 이 내용
    //    크기(max-content)로 부푼다. 가로를 명시해야 375px 에 묶인다.
    // 둘 중 하나만 빠져도 모바일에서 페이지 본문이 통째로 가로 스크롤된다.
    <AuthAwareShell>
      {/* main 은 AppChrome 이 이미 그린다(main 랜드마크 2개·탭바 여백 위 pb-20 중복 — 10차 점검 D). */}
      <CompareView skus={skus} isApp siteUrl={SITE_URL} />
    </AuthAwareShell>
  )
}

// re-export for type-safe persona usage in client
export type { SkuPersona }
