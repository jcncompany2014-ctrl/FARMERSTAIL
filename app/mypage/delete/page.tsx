import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import DeleteAppView from './DeleteAppView'
import DeleteWebView from './DeleteWebView'
import { isAppContextServer } from '@/lib/app-context'

/**
 * /mypage/delete — 회원 탈퇴. **웹·앱 공용** (2026-07-31 이관).
 *
 * # 왜 앱 전용에서 뺐나
 * 공개·색인되는 개인정보처리방침(/legal/privacy)이 "회원 탈퇴(동의 철회) 요구"
 * 항목에서 이 경로로 링크한다. 그런데 이 화면이 `app/(main)/` 안에 있고
 * proxy.ts 의 APP_ONLY_PREFIXES 에도 있어서, **웹 방문자는 탈퇴 링크를 누르면
 * '앱을 설치하세요' 벽**을 맞았다. 개인정보처리방침이 약속한 권리를 그 문서를
 * 읽는 화면에서 행사할 수 없는 상태였다.
 *
 * `/mypage/orders` 와 같은 top-level 공유 라우트로 옮기고 AuthAwareShell 로
 * chrome 을 분기한다. 본문이 쓰는 토큰(--text·--muted·--terracotta·--bg-3)은
 * 웹/앱 스코프에서 각자 값으로 풀리므로 톤은 자동으로 맞는다.
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 M16·M17): 앱이면 DeleteAppView 를 그린다(조회는 아래 그대로 공유).
 * 웹 마크업은 이 파일 아래쪽 그대로 — 한 픽셀도 바꾸지 않았다(AGENTS.md R14).
 */

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
  const { data: openOrders, error: openOrdersErr } = await supabase
    .from('orders')
    .select('id, order_number, order_status')
    .eq('user_id', user.id)
    .in('order_status', ['preparing', 'shipping'])

  // ★규칙1 — 조회 실패를 "진행 중 주문 없음"으로 읽지 않는다(2026-08-12 반증감사).
  //   실패했는데 0건처럼 보이면 배송 중인 고객에게 탈퇴 버튼을 그대로 내주게 된다.
  //   모르면 막는 쪽으로(안전한 방향) 판정한다 — API 도 같은 이유로 500 을 낸다.
  const hasOpen = openOrdersErr ? true : (openOrders ?? []).length > 0

  // Give the user a summary of what will happen so there's no
  // surprise. These counts come from tables the user can read; we
  // rely on RLS.
  const [{ count: orderCount }, { count: dogCount }] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('dogs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  if (await isAppContextServer()) {
    return (
      <AuthAwareShell>
        <DeleteAppView
          hasOpen={hasOpen}
          openOrders={openOrders ?? []}
          orderCount={orderCount ?? 0}
          dogCount={dogCount ?? 0}
        />
      </AuthAwareShell>
    )
  }

  // 웹 = 웹 시안 WEB-A17·A18(2026-10-10 웹 리뉴얼) — DeleteWebView(새 웹 가게 틀). 예전 웹 판은 git 이력.
  return <DeleteWebView hasOpen={hasOpen} openOrders={openOrders ?? []} orderCount={orderCount ?? 0} dogCount={dogCount ?? 0} />
}
