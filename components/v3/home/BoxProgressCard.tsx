/**
 * BoxProgressCard — 결제된 정기배송 박스가 지금 어디쯤인지 (홈, 2026-10-01 사장님).
 *
 * "홈 화면에 결제한 사람들 중에 발송 시작한 사람한테는 그 가는 과정이 이쁘게 시각적으로 잘 담기게 하나
 *  떴으면 좋겠어. 발송 준비, 발송, 배송 중, 배송 완료"
 *
 *  · 네 단계 = 아이콘 점 + 진행 막대. 지난 단계는 채우고, 지금 단계는 은은하게 퍼지는 테두리로 짚는다.
 *  · 한 줄 설명은 lib/commerce/box-progress(정본) — 주말 조리 · 월 포장 · 화 발송 리듬과 같은 말.
 *  · 송장이 있으면 실시간 배송 조회로, 없으면 주문 상세로.
 * 판정·문구는 서버(dashboard)가 정해서 넘긴다 — 이 컴포넌트는 그리기만 한다.
 * AppChrome(data-ft-chrome="app") 안에서만 쓴다.
 */

import Link from 'next/link'
import { Package, Truck, Navigation, Home, ChevronRight } from 'lucide-react'
import { V3, V3FontSize, V3FontWeight, V3Radius } from '@/lib/design/tokens'
import { BOX_STAGES, type BoxStage } from '@/lib/commerce/box-progress'

const STAGE_ICON: Record<BoxStage, typeof Package> = {
  preparing: Package,
  shipped: Truck,
  in_transit: Navigation,
  delivered: Home,
}

interface BoxProgressCardProps {
  /** "푸린이" — petName 을 거친 이름. */
  dogLabel: string
  stage: BoxStage
  /** 단계 한 줄(stageDetail). */
  detail: string
  /** 담긴 레시피 — "흑돼지 화식" 등. 없으면 생략. */
  itemLabel?: string | null
  /** 이동할 곳 — 송장이 있으면 배송 조회, 없으면 주문 상세. */
  href: string
  /** 링크 문구. */
  linkLabel: string
}

export default function BoxProgressCard({ dogLabel, stage, detail, itemLabel, href, linkLabel }: BoxProgressCardProps) {
  const idx = BOX_STAGES.findIndex((s) => s.key === stage)
  const done = stage === 'delivered'
  const pct = (idx / (BOX_STAGES.length - 1)) * 100
  return (
    <section style={{ padding: '0 20px 14px' }} aria-label="박스 배송 진행">
      <Link
        href={href}
        className="block active:opacity-80"
        style={{
          background: V3.paperHi,
          border: `1px solid ${V3.rule}`,
          borderRadius: V3Radius.md,
          padding: '16px 16px 14px',
          color: V3.ink,
          textDecoration: 'none',
        }}
      >
        <div className="flex items-center justify-between" style={{ gap: 8 }}>
          <span
            style={{
              fontSize: V3FontSize.md,
              fontWeight: V3FontWeight.black,
              letterSpacing: '-0.02em',
              wordBreak: 'keep-all',
            }}
          >
            {done ? `${dogLabel} 박스가 도착했어요` : `${dogLabel} 박스가 가고 있어요`}
          </span>
          <span
            className="shrink-0"
            style={{
              // 작은 글자 — accent(3.4:1)는 장식 전용, 글자는 accentDeep(10차 점검 D 대비).
              fontSize: V3FontSize.sm,
              fontWeight: 700,
              color: V3.accentDeep,
              background: `color-mix(in srgb, ${V3.accent} 12%, transparent)`,
              borderRadius: V3Radius.pill,
              padding: '3px 10px',
            }}
          >
            {BOX_STAGES[idx]?.label}
          </span>
        </div>
        {itemLabel && (
          <p style={{ margin: '4px 0 0', fontSize: V3FontSize.sm, color: V3.inkMute, wordBreak: 'keep-all' }}>
            {itemLabel}
          </p>
        )}

        {/* 진행 — 점 네 개와 그 사이 막대(채워진 만큼이 지나온 길). */}
        <div className="relative" style={{ marginTop: 18 }}>
          <div
            aria-hidden
            className="absolute"
            style={{ top: 17, left: '12.5%', right: '12.5%', height: 4, borderRadius: 4, background: V3.paperDeep }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                borderRadius: 4,
                background: V3.accent,
                transition: 'width 600ms ease',
              }}
            />
          </div>
          <ol className="relative grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', listStyle: 'none', margin: 0, padding: 0 }}>
            {BOX_STAGES.map((s, i) => {
              const Icon = STAGE_ICON[s.key]
              const passed = i < idx || (done && i === idx)
              const now = i === idx && !done
              return (
                <li key={s.key} className="flex flex-col items-center" style={{ gap: 6 }}>
                  <span className="relative flex items-center justify-center" style={{ width: 38, height: 38 }}>
                    {now && (
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-full animate-ping"
                        style={{ background: V3.accent, opacity: 0.22 }}
                      />
                    )}
                    <span
                      className="relative flex items-center justify-center rounded-full"
                      style={{
                        width: 38,
                        height: 38,
                        background: passed || now ? V3.accent : V3.paperHi,
                        border: `2px solid ${passed || now ? V3.accent : V3.paperDeep}`,
                        color: passed || now ? '#fff' : V3.inkFaint,
                      }}
                    >
                      <Icon size={18} strokeWidth={2.2} />
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: now ? 800 : 600,
                      color: passed || now ? V3.ink : V3.inkMute,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.label}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>

        <p
          style={{
            margin: '14px 0 0',
            fontSize: V3FontSize.base,
            fontWeight: 600,
            color: V3.inkSoft,
            lineHeight: 1.5,
            wordBreak: 'keep-all',
          }}
        >
          {detail}
        </p>
        <span
          className="flex items-center"
          style={{ marginTop: 8, gap: 2, fontSize: V3FontSize.sm, fontWeight: 700, color: V3.accentDeep }}
        >
          {linkLabel}
          <ChevronRight size={16} strokeWidth={2.4} aria-hidden />
        </span>
      </Link>
    </section>
  )
}
