import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AdminShellNext from '@/components/adminui/admin-shell-next'
import { AdminCard, Badge, StatCard } from '@/components/admin/ui'
import PackingChecklist from '@/app/admin/personalization/picking-list/PackingChecklist'

/**
 * /design-check-admin/phone — 어드민을 폰 폭(390)에서 점검하는 화면 (2026-10-15 F-b, 규칙280).
 *
 * 어드민은 로그인·관리자 권한이 있어야 열려서 폰 배치를 헤드리스로 찍을 수 없었다. 실제 부품(어드민 셸 AdminShellNext ·
 * 홈 숫자 카드 StatCard 와 '?' 도움말 · 포장 목록 PackingChecklist · 빨간 배지 Badge)을 예시 값으로 띄운다.
 *  · 홈이 옆으로 밀리는가(셸 본문의 가로 넘침 막기·도움말 말풍선)
 *  · '포장 완료' 단추가 빨간 '보내지 마세요'를 덮는가
 *  · 가장 중요한 경고 글씨 크기
 * **실제 사이트(production)에선 404**, noindex. 예시 이름은 '땅콩'·'보호자님'.
 */
export const metadata: Metadata = {
  title: '디자인 점검 · 어드민 폰',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

const HELP = '최근 14일 결제 합계를 그 전 14일과 비교한 거예요. 2주마다 결제되는 정기배송이라 7일씩 비교하면 매주 빨강·초록이 번갈아 떠요.'

export default function DesignCheckAdminPhonePage() {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const cards = [
    { id: 'a', dog: '땅콩', badge: '고객이 정지 — 미결제, 보내지 마세요' },
    { id: 'b', dog: '초코', badge: '오늘 청구 실패 — 보내지 마세요' },
    { id: 'c', dog: '보리', badge: '인상 동의 없음 — 청구 보류, 보내지 마세요' },
  ]
  return (
    <div className="admin-scope min-h-screen bg-background font-sans text-foreground antialiased">
      <AdminShellNext userEmail="owner@example.com">
        <section>
          <p className="mb-2 text-[13px] font-bold text-muted-foreground">한눈에 보기</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="오늘 매출" value="0원" sub="오늘 결제된 주문 0건" help={HELP} />
            <StatCard label="누적 매출" value="1,200원" sub="지금까지 결제 완료 12건" help={HELP} />
            <StatCard label="발송할 주문" value="6건" sub="결제됐고 아직 안 보낸 박스" tone="amber" help={HELP} />
            <StatCard label="가입 회원" value="24명" sub="탈퇴 회원 제외" help={HELP} />
          </div>
        </section>
        <PackingChecklist shipDate="2026-10-20" subIds={cards.map((c) => c.id)}>
          {cards.map((c) => (
            <AdminCard key={c.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-bold text-foreground">{c.dog}</span>
                <span className="text-[12px] text-muted-foreground">보호자님</span>
                <Badge tone="blue">반반 50%</Badge>
                <Badge tone="red">{c.badge}</Badge>
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground">소고기 레시피 200g × 7팩 · 닭고기 레시피 200g × 7팩</p>
            </AdminCard>
          ))}
        </PackingChecklist>
      </AdminShellNext>
    </div>
  )
}
