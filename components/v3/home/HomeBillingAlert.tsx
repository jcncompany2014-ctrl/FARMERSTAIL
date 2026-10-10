/**
 * HomeBillingAlert — 홈 맨 위 "손을 써야 하는 정기배송" 한 줄 (2026-08-07 신설, 2026-10-09 앱 새 디자인).
 *
 * 예전엔 홈에 결제 상태를 알려주는 자리가 한 곳도 없어서, 카드가 깨진 고객이 "활성 · 정기배송" 만 보고
 * 박스가 오는 줄 알았다. 문구·판정은 홈(dashboard, subscriptionState 정본)이 정하고 여기선 그리기만 한다.
 *
 * 캔버스 T02(카드 등록 전)·T03(결제 멈춤) = 옅은 빨강 바탕 + 빨강 테두리 + 빨강 바로가기 글자,
 * T04(일시정지) = 회색 바탕 + 왼쪽 머스타드 띠 + 먹색 바로가기. 오른쪽 끝에 느낌표 동그라미.
 */

import Link from 'next/link'
import { V3 } from '@/lib/design/tokens'

interface HomeBillingAlertProps {
  text: string
  cta: string
  /** danger = 결제가 필요/멈춤(빨강), notice = 일시정지(회색 + 머스타드 띠). */
  tone: 'danger' | 'notice'
  href?: string
}

export default function HomeBillingAlert({ text, cta, tone, href = '/mypage/subscriptions' }: HomeBillingAlertProps) {
  const danger = tone === 'danger'
  return (
    <Link
      href={href}
      className="transition active:opacity-80"
      style={{
        margin: '18px 20px 0',
        padding: '14px 16px',
        borderRadius: 4,
        border: danger ? `1.5px solid ${V3.sale}` : 0,
        borderLeft: danger ? `1.5px solid ${V3.sale}` : `6px solid ${V3.mustard}`,
        background: danger ? '#FDF3F1' : V3.soft,
        color: V3.ink,
        textDecoration: 'none',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        columnGap: 12,
        alignItems: 'center',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.4, wordBreak: 'keep-all' }}>{text}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: danger ? V3.sale : V3.ink }}>{cta} →</span>
      </span>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke={danger ? V3.sale : V3.ink}
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 7.5v5.5M12 16.5v.01" />
      </svg>
    </Link>
  )
}
