/**
 * OrderDetailAppView — 주문 상세 '앱' 화면(앱 새 디자인 'A 포스터', 2026-10-09, 캔버스 M08·I01).
 *
 * /mypage/orders/[id] 는 웹·앱이 같이 쓰는 서버 화면이다. 조회·판정(취소 가능 여부·결제된 정기배송 박스·
 * 영수증 노출 조건)은 page.tsx 가 그대로 하고, 앱일 때만 이 컴포넌트가 그린다 — 웹 화면은 예전 그대로.
 * 점검 화면(/design-check)이 같은 컴포넌트에 예시 값을 넣어 로그인 없이 시안과 나란히 본다.
 *
 * 앱 문구는 앱 이름으로: '정기배송 관리'·'1:1 문의' → '정기배송 화면'·'고객센터'(앱시안 결정 3번 '문구').
 * 사진은 레시피 팩 스튜디오 컷(주문에 저장된 상품 사진은 옛 겉봉투일 수 있다 — 겉봉투 사진 금지).
 */

import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { V3, V3Shadow } from '@/lib/design/tokens'
import { pouchLineFromName, POUCH_NAME } from '@/lib/design/pouch'
import { RECIPE_COLOR } from '@/components/analysis/display'
import { studioPouchImage } from '@/lib/personalization/packageImage'

export type OrderDetailAppItem = {
  id: string
  product_name: string
  product_image_url: string | null
  unit_price: number
  quantity: number
  line_total: number
}

export type OrderDetailAppModel = {
  id: string
  orderNumber: string
  /** 결제된 주문만 영수증 링크(page.tsx 와 같은 조건). */
  showReceipt: boolean
  isCancelled: boolean
  cancelledAtText: string | null
  cancelReason: string | null
  /** 취소됐는데 결제됐던 주문 — 환불 안내 한 줄. */
  refundNote: boolean
  /** 배송 단계(결제됐고 취소 안 됐을 때만). -1 = 단계 전. */
  stepIndex: number | null
  /** 배송 단계 아래 줄들 — 발송 뒤엔 택배사·송장·일시, 발송 전(결제된 정기배송 박스)엔 결제·발송 예정. */
  shipRows: Array<{ label: string; value: string; strong?: boolean; spaced?: boolean }>
  trackHref: string | null
  trackingSoon: boolean
  items: OrderDetailAppItem[]
  /** 입금 대기 가상계좌(카드 전용이라 거의 안 나온다). */
  virtualAccount: null | { bank: string; number: string; holder: string | null; due: string | null; amount: number }
  /** address — 주소와 상세 주소 사이는 줄바꿈 문자(화면은 pre-line 으로 두 줄). */
  recipient: { name: string; phone: string; address: string; memo: string | null }
  payRows: Array<{ label: string; value: ReactNode; strong?: boolean }>
  subtotal: number
  shippingFeeText: string
  discount: null | { label: string; amount: number }
  total: number
  refunded: number
  /** 취소 버튼 자리(page.tsx 가 판정해 CancelOrderButton 을 넘긴다). */
  cancelSlot: ReactNode
  /** 결제된 정기배송 박스 — 직접 취소 불가 안내. */
  paidSubscriptionBox: boolean
}

const STEPS = ['상품 준비', '배송 중', '배송 완료'] as const

function SectionTitle({ id, children, count }: { id: string; children: ReactNode; count?: number }) {
  return (
    <h2 id={id} style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 22 }}>
      {children}
      {count != null && (
        <span className="ft-num" style={{ fontSize: 20 }}>
          {count}
        </span>
      )}
    </h2>
  )
}

function Row({ label, children, strong = false, wrap = false }: { label: string; children: ReactNode; strong?: boolean; wrap?: boolean }) {
  return wrap ? (
    <div style={{ padding: '12px 0', borderBottom: `1px solid ${V3.rule}`, display: 'grid', gridTemplateColumns: '76px 1fr', columnGap: 8 }}>
      <dt style={{ fontSize: 15, color: V3.inkMute }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 16, lineHeight: 1.55, fontWeight: strong ? 800 : 400, wordBreak: 'keep-all' }}>{children}</dd>
    </div>
  ) : (
    <div style={{ minHeight: 48, borderBottom: `1px solid ${V3.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <dt style={{ fontSize: 15, color: V3.inkMute, flexShrink: 0 }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 16, fontWeight: strong ? 800 : 400, textAlign: 'right' }}>{children}</dd>
    </div>
  )
}

function itemLook(it: OrderDetailAppItem) {
  const line = pouchLineFromName(it.product_name)
  return line
    ? { line, name: `${POUCH_NAME[line]} 레시피`, sub: `한 끼 팩 · ${it.unit_price.toLocaleString('ko-KR')}원 × ${it.quantity}`, image: studioPouchImage(line) }
    : {
        line: null,
        name: it.product_name.replace(/\s*\([^)]*\)\s*$/, ''),
        sub: `${it.unit_price.toLocaleString('ko-KR')}원 × ${it.quantity}`,
        image: it.product_image_url,
      }
}

export default function OrderDetailAppView({ m }: { m: OrderDetailAppModel }) {
  return (
    // 줄 높이 normal — 시안 원본은 기본 줄 높이(여러 줄 칸 — 주소·안내문 — 은 따로 지정).
    <div style={{ paddingBottom: 36, color: V3.ink, lineHeight: 'normal' }}>
      {/* 주문번호 + 영수증 */}
      <section style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute }}>주문번호</span>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.01em', wordBreak: 'break-all' }}>{m.orderNumber}</span>
        </span>
        {m.showReceipt && (
          <Link
            href={`/mypage/orders/${m.id}/receipt`}
            className="active:opacity-80"
            style={{
              height: 44,
              padding: '0 12px',
              borderRadius: 4,
              border: `1.5px solid ${V3.ink}`,
              display: 'flex',
              alignItems: 'center',
              fontSize: 15,
              fontWeight: 800,
              color: V3.ink,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {/* 시안은 '영수증 / PDF' 였지만 앱 영수증은 PDF 가 아니라 이미지로 저장한다(ReceiptSaveButton) — 하는 일대로. */}
            영수증
          </Link>
        )}
      </section>

      {/* 취소된 주문 */}
      {m.isCancelled && (
        <section
          role="status"
          style={{ margin: '20px 20px 0', padding: 16, border: `1.5px solid ${V3.sale}`, borderRadius: 4, background: '#FBF1EF', display: 'flex', flexDirection: 'column', gap: 4 }}
        >
          <strong style={{ fontSize: 18, fontWeight: 800 }}>취소된 주문</strong>
          {m.cancelledAtText && <span style={{ fontSize: 15, color: V3.inkSoft }}>취소 일시 · {m.cancelledAtText}</span>}
          {m.cancelReason && <span style={{ fontSize: 15, color: V3.inkSoft, lineHeight: 1.55 }}>사유 · {m.cancelReason}</span>}
          {m.refundNote && (
            <span style={{ marginTop: 4, fontSize: 15, color: V3.inkSoft, lineHeight: 1.55 }}>결제 금액은 3~7 영업일 안에 원래 결제 수단으로 환불돼요.</span>
          )}
        </section>
      )}

      {/* 배송 상태 */}
      {m.stepIndex !== null && (
        <section aria-labelledby="ship-title" style={{ padding: '28px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <SectionTitle id="ship-title">배송 상태</SectionTitle>
          <div style={{ marginTop: 12, padding: '18px 8px 0', borderTop: `2px solid ${V3.ink}`, position: 'relative' }}>
            {/* 단계 사이 선 — 지나온 구간은 머스타드. */}
            <span aria-hidden style={{ position: 'absolute', left: 44, right: 44, top: 31, height: 3, background: '#EFEDEE' }} />
            {m.stepIndex > 0 && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 44,
                  top: 31,
                  height: 3,
                  width: `calc((100% - 88px) * ${Math.min(m.stepIndex, STEPS.length - 1) / (STEPS.length - 1)})`,
                  background: V3.mustard,
                }}
              />
            )}
            <ol style={{ position: 'relative', margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {STEPS.map((label, i) => {
                const done = i < m.stepIndex! || (i === m.stepIndex && i === STEPS.length - 1)
                const now = i === m.stepIndex && !done
                return (
                  <li key={label} aria-current={i === m.stepIndex ? 'step' : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        boxSizing: 'border-box',
                        borderRadius: 14,
                        background: done || now ? V3.ink : '#FFFFFF',
                        border: done || now ? 0 : '2px solid #D5D3D4',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {done ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      ) : now ? (
                        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: '#FFFFFF' }} />
                      ) : null}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: i === m.stepIndex ? 800 : 700, color: done || now ? V3.ink : '#8A8A8A' }}>{label}</span>
                  </li>
                )
              })}
            </ol>
          </div>
          {m.shipRows.length > 0 && (
            <dl style={{ margin: '20px 0 0', display: 'flex', flexDirection: 'column', borderTop: `1px solid ${V3.rule}` }}>
              {m.shipRows.map((r) => (
                <Row key={r.label} label={r.label} strong={r.strong}>
                  <span style={r.spaced ? { letterSpacing: '0.02em', fontWeight: 700 } : undefined}>{r.value}</span>
                </Row>
              ))}
            </dl>
          )}
          {m.trackingSoon && <p style={{ margin: '10px 0 0', fontSize: 15, color: V3.inkMute }}>송장번호가 곧 올라와요.</p>}
          {m.trackHref && (
            <Link
              href={m.trackHref}
              className="active:opacity-80"
              style={{
                marginTop: 14,
                height: 56,
                padding: '0 16px',
                borderRadius: 4,
                borderLeft: `6px solid ${V3.mustard}`,
                background: V3.soft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 16,
                fontWeight: 800,
                color: V3.ink,
                textDecoration: 'none',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 6.5h11v9H3z" />
                  <path d="M14 9.5h4l3 3v3h-7" />
                  <circle cx="7" cy="17.5" r="1.8" />
                  <circle cx="17" cy="17.5" r="1.8" />
                </svg>
                실시간 배송 조회
              </span>
              <span aria-hidden>›</span>
            </Link>
          )}
        </section>
      )}

      {/* 주문 상품 */}
      <section aria-labelledby="items-title" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <SectionTitle id="items-title" count={m.items.length}>
          주문 상품
        </SectionTitle>
        <div style={{ marginTop: 12, borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}>
          {m.items.map((it) => {
            const look = itemLook(it)
            return (
              <div
                key={it.id}
                style={{ padding: '14px 0', borderBottom: `1px solid ${V3.rule}`, display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr) auto', columnGap: 12, alignItems: 'center' }}
              >
                <span style={{ position: 'relative', width: 56, height: 56, borderRadius: 4, overflow: 'hidden', background: V3.soft }}>
                  {look.image && <Image src={look.image} alt="" fill sizes="56px" className="object-cover" />}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 800 }}>
                    {look.line && <span aria-hidden style={{ width: 9, height: 9, background: RECIPE_COLOR[look.line], flexShrink: 0 }} />}
                    {look.name}
                  </span>
                  <span style={{ fontSize: 14, color: V3.inkMute }}>{look.sub}</span>
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap' }}>{it.line_total.toLocaleString('ko-KR')}원</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* 입금 대기 가상계좌 */}
      {m.virtualAccount && (
        <section style={{ margin: '28px 20px 0', padding: 16, borderRadius: 4, background: V3.cream, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <strong style={{ fontSize: 16, fontWeight: 800 }}>입금을 기다리고 있어요</strong>
          <span style={{ fontSize: 15 }}>
            {m.virtualAccount.bank} {m.virtualAccount.number}
            {m.virtualAccount.holder ? ` · ${m.virtualAccount.holder}` : ''}
          </span>
          {m.virtualAccount.due && <span style={{ fontSize: 15, color: V3.sale, fontWeight: 800 }}>입금 기한 {m.virtualAccount.due}</span>}
          <span style={{ fontSize: 15 }}>입금 금액 {m.virtualAccount.amount.toLocaleString('ko-KR')}원 · 기한까지 입금되지 않으면 주문이 자동 취소돼요.</span>
        </section>
      )}

      {/* 배송지 */}
      <section aria-labelledby="addr-title" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <SectionTitle id="addr-title">배송지</SectionTitle>
        <dl style={{ margin: '12px 0 0', borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}>
          <Row label="받는 분" strong wrap>
            {m.recipient.name}
          </Row>
          <Row label="연락처" wrap>
            {m.recipient.phone}
          </Row>
          {/* 주소와 상세 주소는 두 줄로(시안 M08) — 한 줄로 이으면 상세 주소 낱말 중간에서 접힌다. */}
          <Row label="주소" wrap>
            <span style={{ whiteSpace: 'pre-line' }}>{m.recipient.address}</span>
          </Row>
          {m.recipient.memo && (
            <Row label="메모" wrap>
              {m.recipient.memo}
            </Row>
          )}
        </dl>
      </section>

      {/* 결제 정보 */}
      <section aria-labelledby="pay-title" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <SectionTitle id="pay-title">결제 정보</SectionTitle>
        <dl style={{ margin: '12px 0 0', borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}>
          {m.payRows.map((r) => (
            <Row key={r.label} label={r.label} strong={r.strong}>
              {r.value}
            </Row>
          ))}
          <Row label="상품 금액">
            <span style={{ fontWeight: 700 }}>{m.subtotal.toLocaleString('ko-KR')}원</span>
          </Row>
          <Row label="배송비">
            <span style={{ fontWeight: 700 }}>{m.shippingFeeText}</span>
          </Row>
          {/* ★할인 줄이 없어서 상품금액과 총결제 차이가 설명 없이 남았다(2026-08-08 금액 감사) — 웹과 같은 줄. */}
          {m.discount && (
            <Row label={m.discount.label}>
              <span style={{ fontWeight: 800 }}>−{m.discount.amount.toLocaleString('ko-KR')}원</span>
            </Row>
          )}
        </dl>
        <div
          style={{
            marginTop: 16,
            padding: '16px 18px',
            border: `2px solid ${V3.ink}`,
            boxShadow: V3Shadow.stamp,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            background: V3.mustard,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 800 }}>총 결제 금액</span>
          <span style={{ whiteSpace: 'nowrap' }}>
            <span className="ft-num" style={{ fontSize: 34, lineHeight: 1 }}>
              {m.total.toLocaleString('ko-KR')}
            </span>
            <span className="ft-poster" style={{ fontSize: 18 }}>
              원
            </span>
          </span>
        </div>
        {m.refunded > 0 && (
          <p style={{ margin: '12px 0 0', display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
            <span style={{ color: V3.inkMute }}>환불 금액</span>
            <strong style={{ fontWeight: 800, color: V3.sale }}>−{m.refunded.toLocaleString('ko-KR')}원</strong>
          </p>
        )}
      </section>

      {/* 주문 취소: 배송 시작 전에만(page.tsx 판정) */}
      {m.cancelSlot && <section style={{ padding: '24px 20px 0' }}>{m.cancelSlot}</section>}
      {m.paidSubscriptionBox && (
        <section
          aria-label="취소 안내"
          style={{ margin: '28px 20px 0', padding: 16, borderRadius: 4, background: V3.soft, display: 'flex', gap: 10, alignItems: 'flex-start' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 7.6v.4" />
          </svg>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: V3.inkSoft, wordBreak: 'keep-all' }}>
            결제된 정기배송 박스는 맞춤으로 만들어 그대로 보내드려서 <strong style={{ fontWeight: 800, color: V3.ink }}>직접 취소할 수 없어요.</strong> 다음
            박스는 정기배송 화면에서 결제 전에 미루거나 해지할 수 있어요. 사정이 있으시면 고객센터로 알려 주세요.
          </p>
        </section>
      )}
    </div>
  )
}
