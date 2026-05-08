import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CampaignBuilder from './CampaignBuilder'

export const dynamic = 'force-dynamic'

/**
 * /admin/push-campaigns — 푸시 캠페인 builder + 발송 이력.
 *
 * segment 선택 (전체 / 30일 미주문 / 정기배송 활성) → 제목·본문·URL 작성 →
 * 일괄 발송. 발송 후 recipient_count / sent_count / failed_count 누적.
 */
export default async function AdminPushCampaignsPage() {
  const supabase = await createClient()

  const { data: rawCampaigns } = await supabase
    .from('push_campaigns')
    .select(
      'id, title, body, url, segment, recipient_count, sent_count, failed_count, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(50)

  type Row = {
    id: string
    title: string
    body: string
    url: string | null
    segment: 'all' | 'inactive_30d' | 'active_subscribers'
    recipient_count: number
    sent_count: number
    failed_count: number
    created_at: string
  }
  const campaigns = (rawCampaigns ?? []) as Row[]

  const segmentLabel: Record<Row['segment'], string> = {
    all: '전체 구독자',
    inactive_30d: '30일 미주문 (win-back)',
    active_subscribers: '정기배송 활성',
  }

  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-[11px] text-muted uppercase tracking-widest font-bold">
            Push Campaigns
          </p>
          <h1 className="text-2xl font-black text-text mt-1">푸시 캠페인</h1>
          <p className="text-[12px] text-muted mt-1">
            세그먼트 선택 후 일괄 발송. 마케팅 푸시는 사용자 동의 + 방해금지
            시간대 자동 게이팅됩니다.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-[11px] text-muted hover:text-terracotta font-semibold"
        >
          ← 대시보드
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section>
          <h2 className="text-[13px] font-black text-text mb-3">새 캠페인</h2>
          <CampaignBuilder />
          <div className="mt-3 p-3 rounded-xl bg-bg-2 border border-rule">
            <p className="text-[11px] text-text leading-relaxed">
              ⚠️ 마케팅 푸시 — 정보통신망법 §50④ 에 따라 본문에 자동
              <strong> [광고]</strong> 접두어가 붙고, 사용자가 알림 설정에서
              마케팅을 OFF 했거나 방해금지 시간대(22:00–08:00 등)에는 자동
              제외됩니다. 발송 한도 5,000명/캠페인.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-[13px] font-black text-text mb-3">
            발송 이력 (최근 50건)
          </h2>
          {campaigns.length === 0 ? (
            <div className="bg-white rounded-2xl border border-rule p-8 text-center">
              <p className="text-[12px] text-muted">
                아직 발송한 캠페인이 없어요.
              </p>
            </div>
          ) : (
            <ul className="bg-white rounded-2xl border border-rule overflow-hidden max-h-[600px] overflow-y-auto">
              {campaigns.map((c) => {
                const successRate =
                  c.recipient_count > 0
                    ? (c.sent_count / c.recipient_count) * 100
                    : 0
                return (
                  <li
                    key={c.id}
                    className="border-b border-rule last:border-b-0 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12.5px] font-bold text-text">
                        {c.title}
                      </p>
                      <span className="text-[9px] text-terracotta font-bold uppercase tracking-widest shrink-0">
                        {segmentLabel[c.segment]}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted mt-1 line-clamp-2">
                      {c.body}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] tabular-nums">
                      <span className="text-text">
                        대상 {c.recipient_count.toLocaleString()}명
                      </span>
                      <span className="text-moss font-bold">
                        성공 {c.sent_count.toLocaleString()}
                      </span>
                      {c.failed_count > 0 && (
                        <span className="text-sale font-bold">
                          실패 {c.failed_count}
                        </span>
                      )}
                      <span className="text-terracotta font-bold ml-auto">
                        {successRate.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-[10px] text-muted font-mono mt-1">
                      {new Date(c.created_at).toLocaleString('ko-KR')}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
