/**
 * DeliveryStripCard — 박스 사이(결제된 박스가 없을 때) 다음 정기배송 카드.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 T01): 왼쪽 = "발송까지 N일"(큰 숫자), 세로 선, 오른쪽 =
 *   "다음 정기배송 / 10월 13일 (화) 발송 / 닭고기 · 흑돼지 화식", 끝에 ›. 카드 색 = 박스 레시피 파우치 색
 *   (lib/design/pouch — 한 가지 = 그 색 + 먹색 도장 그림자, 두 가지 = 첫째 바탕 + 둘째 테두리·그림자).
 *
 * ★ 이 날짜는 **발송일**이다 — `next_delivery_date` 는 발송일(화)이고 도착은 지역에 따라 그 다음 날부터다
 *   (lib/shipping-schedule). 예전 이름 `arrivalLabel`·"내일 새벽 도착" 이 발송일을 도착일로 말하게 만들었다(2026-07-30 정정).
 *   날짜가 지났거나 결제를 확인 중이면 발송을 약속하지 않는다 — 숫자 대신 "확인 중"(shipTimingLabel 원칙).
 */

import Link from 'next/link'
import { boxCardColors, boxCardFrame, type PouchLine } from '@/lib/design/pouch'

interface DeliveryStripCardProps {
  /** 발송까지 남은 날(0 = 오늘). 확인 중이면 null. */
  daysUntil: number | null
  /** "10월 13일 (화)" — 발송일. 확인 중이면 null. */
  shipDateLabel: string | null
  /** 확인 중일 때 한 줄(shipTimingLabel·결제 확인 문구). */
  checkDetail?: string | null
  /** 담긴 레시피 — "닭고기 · 흑돼지 화식". */
  itemLabel: string | null
  /** 레시피 파우치(표시 순서) — 카드 색. */
  lines?: readonly PouchLine[]
  /** 앱 정기배송 정본 = /mypage/subscriptions (웹 /account/subscriptions 로 보내면 앱에 웹 화면이 뜬다). */
  href?: string
}

export default function DeliveryStripCard({
  daysUntil,
  shipDateLabel,
  checkDetail,
  itemLabel,
  lines = [],
  href = '/mypage/subscriptions',
}: DeliveryStripCardProps) {
  const colors = boxCardColors(lines)
  const checking = daysUntil == null || daysUntil < 0 || !shipDateLabel
  return (
    <Link
      href={href}
      aria-label="다음 정기배송 보기"
      className="transition active:scale-[0.99]"
      style={{
        margin: '22px 20px 0',
        padding: 18,
        borderRadius: 4,
        textDecoration: 'none',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        columnGap: 16,
        alignItems: 'center',
        ...boxCardFrame(colors),
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{checking ? '발송' : daysUntil === 0 ? '오늘' : '발송까지'}</span>
        {checking ? (
          <span style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.3, whiteSpace: 'nowrap' }}>확인 중</span>
        ) : daysUntil === 0 ? (
          <span style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.3, whiteSpace: 'nowrap' }}>발송</span>
        ) : (
          <span style={{ whiteSpace: 'nowrap' }}>
            <span className="ft-num" style={{ fontSize: 44, lineHeight: 1 }}>
              {daysUntil}
            </span>
            <span style={{ fontSize: 16, fontWeight: 800 }}> 일</span>
          </span>
        )}
      </span>
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          paddingLeft: 16,
          borderLeft: `1px solid ${colors.divider}`,
          minWidth: 0,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700 }}>다음 정기배송</span>
        {checking ? (
          <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.45, wordBreak: 'keep-all' }}>
            {checkDetail ?? '발송 일정을 확인하고 있어요.'}
          </span>
        ) : (
          <span style={{ fontSize: 18, fontWeight: 800 }}>{shipDateLabel} 발송</span>
        )}
        {itemLabel && <span style={{ fontSize: 15, wordBreak: 'keep-all' }}>{itemLabel}</span>}
      </span>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  )
}
