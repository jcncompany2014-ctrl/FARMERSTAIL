/**
 * BoxProgressCard — 결제된 정기배송 박스가 지금 어디쯤인지 (홈, 2026-10-01 사장님).
 *
 * "홈 화면에 결제한 사람들 중에 발송 시작한 사람한테는 그 가는 과정이 이쁘게 시각적으로 잘 담기게 하나
 *  떴으면 좋겠어. 발송 준비, 발송, 배송 중, 배송 완료"
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 AppHome·BoxColor-*): 박스에 든 레시피 **파우치 색**이 카드 바탕이다
 *   (한 가지 = 그 색 + 먹색 도장 그림자, 두 가지 = 첫째 색 바탕 + 둘째 색 테두리·그림자 — lib/design/pouch).
 *   네 단계는 굵은 막대 네 칸 + 이름. 지난·지금 단계는 채운다. 아래 줄 = 단계 한 줄 + "자세히 ›".
 *   이 카드가 화면의 핵심 카드라 도장 그림자를 가진다(한 화면에 한 곳).
 *  · 한 줄 설명은 lib/commerce/box-progress(정본) — 주말 조리 · 월 포장 · 화 발송 리듬과 같은 말.
 *  · 송장이 있으면 실시간 배송 조회로, 없으면 주문 상세로.
 * 판정·문구는 서버(dashboard)가 정해서 넘긴다 — 이 컴포넌트는 그리기만 한다.
 * AppChrome(data-ft-chrome="app") 안에서만 쓴다.
 */

import Link from 'next/link'
import { V3 } from '@/lib/design/tokens'
import { BOX_STAGES, type BoxStage } from '@/lib/commerce/box-progress'
import { boxCardColors, boxCardFrame, type PouchLine } from '@/lib/design/pouch'

interface BoxProgressCardProps {
  /** "땅콩이" — petName 을 거친 이름. */
  dogLabel: string
  stage: BoxStage
  /** 단계 한 줄(stageDetail). */
  detail: string
  /** 담긴 레시피 — "닭고기 · 흑돼지 화식". 없으면 생략. */
  itemLabel?: string | null
  /** 레시피 파우치(표시 순서) — 카드 색. 비면 머스타드. */
  lines?: readonly PouchLine[]
  /** 이동할 곳 — 송장이 있으면 배송 조회, 없으면 주문 상세. */
  href: string
  /** 아래 줄 바로가기 — "자세히" / "배송 조회". */
  linkLabel: string
}

/** 단계별 제목(두 줄) — 준비 단계엔 아직 안 나갔다: "가고 있어요"는 발송 뒤부터(11차 점검 E). */
export function boxTitleLines(dogLabel: string, stage: BoxStage): [string, string] {
  if (stage === 'delivered') return [`${dogLabel} 박스가`, '도착했어요']
  if (stage === 'preparing') return [`${dogLabel} 박스를`, '준비하고 있어요']
  return [`${dogLabel} 박스가`, '가고 있어요']
}

export default function BoxProgressCard({
  dogLabel,
  stage,
  detail,
  itemLabel,
  lines = [],
  href,
  linkLabel,
}: BoxProgressCardProps) {
  const idx = BOX_STAGES.findIndex((s) => s.key === stage)
  const colors = boxCardColors(lines)
  const [t1, t2] = boxTitleLines(dogLabel, stage)
  return (
    // 카드 전체가 눌린다(예전처럼) — 아래 '자세히 ›'는 눈에 보이는 표시. 어르신 손가락에 큰 과녁.
    <Link
      href={href}
      aria-label={`이번 박스 — ${t1} ${t2}. ${linkLabel}`}
      className="block transition active:scale-[0.99]"
      style={{
        margin: '22px 20px 0',
        textDecoration: 'none',
        padding: '18px 18px 16px',
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        ...boxCardFrame(colors),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>이번 박스</span>
          <span className="ft-poster" style={{ fontSize: 23, lineHeight: 1.2, wordBreak: 'keep-all' }}>
            {t1}
            <br />
            {t2}
          </span>
        </span>
        <span
          style={{
            flexShrink: 0,
            height: 30,
            padding: '0 10px',
            borderRadius: 4,
            background: V3.ink,
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {BOX_STAGES[idx]?.label}
        </span>
      </div>
      {itemLabel && (
        <span style={{ fontSize: 16, fontWeight: 700, wordBreak: 'keep-all' }}>{itemLabel}</span>
      )}
      <ol
        aria-label="박스 진행"
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 4,
        }}
      >
        {BOX_STAGES.map((s, i) => {
          const reached = i <= idx
          const now = i === idx
          return (
            <li key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }} aria-current={now ? 'step' : undefined}>
              <span aria-hidden style={{ height: 8, background: reached ? colors.barOn : colors.barOff }} />
              <span style={{ fontSize: 14, fontWeight: now ? 800 : 500, whiteSpace: 'nowrap' }}>{s.label}</span>
            </li>
          )
        })}
      </ol>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          paddingTop: 12,
          borderTop: `1px solid ${colors.divider}`,
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1.45, wordBreak: 'keep-all' }}>{detail}</span>
        <span
          aria-hidden
          style={{ flexShrink: 0, fontSize: 15, fontWeight: 800, textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          {linkLabel} ›
        </span>
      </div>
    </Link>
  )
}
