/**
 * SubscriptionsSummaryView — 앱 하단 탭 '정기배송'(/mypage/subscriptions) 화면의 배치(그리기만).
 *
 * 금액·할인·결제일·서포터즈 회차 판정은 페이지(app/(main)/mypage/subscriptions/page.tsx)가 그대로 하고
 * — 청구 크론과 같은 함수(resolveAutoDiscount·chargeDateFor·getTrialState)에서 나온 값이다 —
 * 이 컴포넌트는 정해진 값을 시안대로 놓는다(앱 새 디자인 'A 포스터', 2026-10-09, 캔버스 AppSubList·S11~S15·C03).
 * 배치를 따로 둔 이유: 이 화면은 로그인해야 열려서, 점검 화면(/design-check, 미리보기 전용)이 같은 배치에
 * 예시 값을 넣어 모든 상태를 시안과 나란히 본다.
 *
 * 배치: (방금 시작) 안내 → 조치가 필요한 구독(빨강) → 다음 결제(머스타드 + 도장 그림자, 서포터즈 혜택 같은 카드)
 *   또는 결제 예정 없음(회색) → 정기배송 시작하기(구독이 하나도 없으면 머스타드 핵심 카드, 아니면 회색 + 머스타드 띠)
 *   → 정기배송 N건 목록(사진·이름·상태·레시피 색·금액) → 결제·주문 내역.
 */

import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { V3, V3Shadow } from '@/lib/design/tokens'
import { RECIPE_COLOR } from '@/components/analysis/display'
import type { PouchLine } from '@/lib/design/pouch'
import type { SubState } from '@/lib/subscription-state'
import DogPawMark from '@/components/DogPawMark'

export type TrialInfo = { cheap: number; half: number; price: number; intervalDays: number }

export interface SubsSummaryModel {
  /** 카드 등록 직후(?new=1). */
  justStarted: boolean
  alerts: Array<{ key: string; kind: 'needs_card' | 'card_failed'; dogLabel: string; href: string }>
  /** 다음 결제 — 결제 예정이 없으면 null. */
  hero: {
    /** 날짜 칸 문구 — "10월 10일 (토)" / "… 발송분" / "… · 확인 중" (페이지가 정한다). */
    dateText: string
    /** 실제로 빠져나갈 금액(할인 반영). */
    amount: number
    /** 할인 전 합계. */
    subtotal: number
    discount: number
    /** 할인 한 줄 — "서포터즈 혜택으로 77,700원 할인" / "나무 등급 할인 −15,300원". */
    discountText: string | null
    /** 같은 날 함께 결제되는 구독이 둘 이상이면 이름별 금액. */
    breakdown: Array<{ name: string; amount: number }>
    /** 결제수단 한 줄 — "신한카드 ····1234" / "구독별로 결제수단이 달라요". */
    methodLine: string
    trial: TrialInfo | null
  } | null
  /** 결제 예정이 없을 때 한 줄. */
  empty: { title: string; sub: string } | null
  /** 결제 예정은 없는데 서포터즈 혜택이 기다릴 때(카드 등록 전). */
  trialCard: TrialInfo | null
  startable: Array<{ id: string; label: string; ready: boolean; href: string; photoUrl: string | null }>
  rows: Array<{
    id: string
    dogName: string
    photoUrl: string | null
    state: SubState
    stateLabel: string
    /** "77,800원 · 곁들임 · 10월 10일 (토) 결제" */
    line: string
    href: string
    /** 푸시·메일이 ?focus=<id> 로 보낸 구독. */
    focused: boolean
    /** 레시피 파우치(색 네모). */
    lines: PouchLine[]
  }>
}

function krw(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

function Avatar({ size, photoUrl, bg = V3.soft }: { size: number; photoUrl: string | null; bg?: string }) {
  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {photoUrl ? (
        <Image src={photoUrl} alt="" fill sizes={`${size}px`} className="object-cover" unoptimized />
      ) : (
        <DogPawMark size={Math.round(size * 0.42)} color={V3.inkMute} />
      )}
    </span>
  )
}

const Chevron = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 6l6 6-6 6" />
  </svg>
)

/** 서포터즈 혜택 — 회차가 아니라 기간·총액(사장님 2026-10-01 "56일치 밥이 총 400원"). 숫자 판정은 페이지(청구와 같은 판정). */
function TrialBlock({ t, onMustard }: { t: TrialInfo; onMustard: boolean }) {
  const segs = [
    ...Array.from({ length: t.cheap }, () => 'cheap' as const),
    ...Array.from({ length: t.half }, () => 'half' as const),
  ]
  const restBg = onMustard ? 'rgba(255,255,255,0.5)' : '#E5E3E4'
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 14, fontWeight: 700 }}>서포터즈 혜택</span>
      <span style={{ marginTop: 4, fontSize: 18, lineHeight: 1.4, fontWeight: 800, wordBreak: 'keep-all' }}>
        {t.cheap > 0
          ? `남은 ${t.cheap * t.intervalDays}일치 밥이 총 ${(t.cheap * t.price).toLocaleString('ko-KR')}원이에요`
          : `남은 ${t.half * t.intervalDays}일치 밥은 반값이에요`}
      </span>
      {/* 남은 박스(2주치) 하나 = 막대 한 칸. 첫 칸 = 다음 결제. */}
      <span aria-hidden style={{ marginTop: 12, display: 'flex', gap: 3 }}>
        {segs.map((ph, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 2,
              marginLeft: i === t.cheap && t.cheap > 0 ? 6 : 0,
              background: i === 0 ? V3.ink : ph === 'cheap' || t.cheap === 0 ? 'rgba(232,149,47,0.35)' : restBg,
            }}
          />
        ))}
      </span>
      <span style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, wordBreak: 'keep-all' }}>
        {t.cheap > 0 && (
          <span>
            {t.price.toLocaleString('ko-KR')}원 · {t.cheap * t.intervalDays}일
          </span>
        )}
        {t.half > 0 && <span>반값 · {t.half * t.intervalDays}일</span>}
        <span>그다음 정상가</span>
      </span>
      <span style={{ marginTop: 10, fontSize: 15 }}>가격이 바뀌기 전에 미리 알려드릴게요</span>
    </div>
  )
}

function StateChip({ state, label }: { state: SubState; label: string }) {
  const base = {
    height: 24,
    boxSizing: 'border-box' as const,
    padding: '0 7px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
  }
  if (state === 'active') return <span style={{ ...base, background: V3.ink, color: '#FFFFFF' }}>{label}</span>
  if (state === 'card_failed') return <span style={{ ...base, background: V3.sale, color: '#FFFFFF' }}>{label}</span>
  if (state === 'needs_card') return <span style={{ ...base, border: `1.5px dashed ${V3.ink}`, color: V3.ink }}>{label}</span>
  return <span style={{ ...base, background: V3.soft, color: V3.inkMute }}>{label}</span>
}

function CardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
    </svg>
  )
}

function ReceiptIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  )
}

/** 조회 실패 — "구독 없음"으로 그리지 않는다(2026-07-30: 결제가 걸린 고객에게 '시작하세요'가 떴다). 캔버스 S14. */
export function SubsLoadFailed() {
  return (
    <section
      role="alert"
      style={{
        margin: '24px 20px 0',
        padding: '22px 20px 20px',
        border: `1.5px solid ${V3.sale}`,
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        color: V3.ink,
      }}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={V3.sale} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3.5l9.5 16.5h-19z" />
        <path d="M12 10v4.5M12 17.5v.01" />
      </svg>
      <h2 style={{ margin: '14px 0 0', fontSize: 26, lineHeight: 1.25 }}>
        정기배송 정보를
        <br />
        불러오지 못했어요
      </h2>
      <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.6, color: V3.inkSoft }}>
        잠시 뒤에 다시 열어봐 주세요. 계속 이러면 알려주세요.
      </p>
      <p
        style={{
          margin: '12px 0 0',
          padding: '12px 14px',
          borderRadius: 4,
          background: V3.soft,
          fontSize: 16,
          fontWeight: 800,
          lineHeight: 1.5,
        }}
      >
        진행 중인 정기배송은 그대로 있어요.
      </p>
      <Link
        href="/mypage/orders"
        style={{
          marginTop: 18,
          height: 58,
          borderRadius: 4,
          background: V3.ink,
          color: '#FFFFFF',
          fontSize: 17,
          fontWeight: 800,
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        결제·주문 내역 보기
      </Link>
    </section>
  )
}

export default function SubscriptionsSummaryView({ model, after }: { model: SubsSummaryModel; after?: ReactNode }) {
  const { hero, rows } = model
  // 정기배송 시작하기 카드는 구독이 하나도 없고 결제 예정도 없을 때만 이 화면의 핵심 카드(도장 그림자) — S11.
  const startIsCore = rows.length === 0 && !hero
  return (
    <div style={{ paddingBottom: 32, color: V3.ink }}>
      {model.justStarted && (
        <div
          role="status"
          style={{
            margin: '20px 20px 0',
            padding: '14px 16px',
            borderRadius: 4,
            background: V3.cream,
            display: 'grid',
            gridTemplateColumns: '28px 1fr',
            columnGap: 10,
            alignItems: 'center',
          }}
        >
          <span style={{ width: 28, height: 28, borderRadius: 14, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={V3.ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <strong style={{ fontSize: 17, fontWeight: 800 }}>정기배송이 시작됐어요</strong>
            <span style={{ fontSize: 15, opacity: 0.88 }}>다음 결제일에 자동으로 결제돼요</span>
          </span>
        </div>
      )}

      {/* 조치가 필요한 것 — 어느 강아지인지 이름을 붙여 바로 보낸다 */}
      {model.alerts.map((a) => (
        <Link
          key={a.key}
          href={a.href}
          role="alert"
          className="active:opacity-80"
          style={{
            margin: '20px 20px 0',
            padding: '14px 14px 14px 16px',
            border: `1.5px solid ${V3.sale}`,
            borderRadius: 4,
            background: '#FBF1EF',
            color: V3.ink,
            textDecoration: 'none',
            display: 'grid',
            gridTemplateColumns: '24px 1fr 20px',
            columnGap: 10,
            alignItems: 'start',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={V3.sale} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ marginTop: 1 }}>
            <path d="M12 3.5l9.5 16.5h-19z" />
            <path d="M12 10v4.5M12 17.5v.01" />
          </svg>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <strong style={{ fontSize: 17, fontWeight: 800, wordBreak: 'keep-all' }}>
              {a.kind === 'needs_card' ? `${a.dogLabel} 정기배송은 아직 시작 전이에요` : `${a.dogLabel} 결제가 되지 않았어요`}
            </strong>
            <span style={{ fontSize: 15, lineHeight: 1.5, color: V3.inkSoft, wordBreak: 'keep-all' }}>
              {a.kind === 'needs_card' ? '결제수단을 등록하면 첫 배송일이 잡혀요.' : '결제수단을 다시 등록하면 정기배송이 이어져요.'}
            </span>
          </span>
          <span aria-hidden style={{ alignSelf: 'center', fontSize: 22, fontWeight: 700 }}>
            ›
          </span>
        </Link>
      ))}

      {/* 주인공: 다음 결제 (+ 서포터즈 혜택을 같은 카드 안에) */}
      {hero ? (
        <section
          aria-label="다음 결제"
          style={{
            margin: model.alerts.length > 0 || model.justStarted ? '16px 20px 0' : '20px 20px 0',
            padding: hero.trial ? '18px 18px 18px' : '18px 18px 16px',
            border: `2px solid ${V3.ink}`,
            boxShadow: V3Shadow.stamp,
            borderRadius: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background: V3.mustard,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>다음 결제</span>
            <span
              style={{
                minHeight: 28,
                padding: '2px 9px',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.5)',
                fontSize: 14,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                textAlign: 'right',
              }}
            >
              {hero.dateText}
            </span>
          </div>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 2, whiteSpace: 'nowrap' }}>
            <span className="ft-num" style={{ fontSize: 52, lineHeight: 1 }}>
              {hero.amount.toLocaleString('ko-KR')}
            </span>
            <span className="ft-poster" style={{ fontSize: 26 }}>
              원
            </span>
          </span>
          {/* 할인이 있으면 무엇이 빠졌는지 한 줄. 원래 금액은 취소선 — 비율(%)은 쓰지 않는다(브랜드 보이스). */}
          {hero.discount > 0 && hero.discountText && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, textDecoration: 'line-through' }}>{krw(hero.subtotal)}</span>
              <span
                style={{
                  minHeight: 26,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: '#EDF2EE',
                  fontSize: 14,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {hero.discountText}
              </span>
            </span>
          )}
          {hero.breakdown.length >= 2 && (
            <span style={{ fontSize: 15, wordBreak: 'keep-all' }}>
              {hero.breakdown.map((b) => `${b.name} ${krw(b.amount)}`).join(' + ')}, 같은 날 결제돼요
            </span>
          )}
          <span
            style={{
              paddingTop: 10,
              borderTop: '1px solid rgba(20,20,20,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 15,
            }}
          >
            <CardIcon />
            {hero.methodLine}
          </span>
          {hero.trial && (
            <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1.5px dashed #D5D3D4' }}>
              <TrialBlock t={hero.trial} onMustard />
            </div>
          )}
        </section>
      ) : (
        <>
          {model.empty && (
            <section
              style={{
                margin: model.alerts.length > 0 || model.justStarted ? '16px 20px 0' : '20px 20px 0',
                padding: '20px 18px',
                borderRadius: 4,
                background: V3.soft,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span className="ft-poster" style={{ fontSize: 24, lineHeight: 1.2 }}>
                {model.empty.title}
              </span>
              <span style={{ fontSize: 16, lineHeight: 1.5, color: V3.inkSoft }}>{model.empty.sub}</span>
            </section>
          )}
          {/* 서포터즈인데 아직 카드 등록 전 — 혜택이 기다리고 있다는 걸 먼저 보여 준다. */}
          {model.trialCard && (
            <section style={{ margin: '16px 20px 0', padding: '18px', borderRadius: 4, background: V3.cream }}>
              <TrialBlock t={model.trialCard} onMustard={false} />
            </section>
          )}
        </>
      )}

      {/* 구독 없는 강아지 — 큰 시작 버튼(하단 탭 "정기배송" 의 핵심). 분석이 없으면 설문부터. */}
      {model.startable.length > 0 && (
        <section
          aria-labelledby="start-title"
          style={
            startIsCore
              ? {
                  margin: '22px 20px 0',
                  padding: '20px 18px 18px',
                  border: `2px solid ${V3.ink}`,
                  boxShadow: V3Shadow.stamp,
                  borderRadius: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  background: V3.mustard,
                }
              : {
                  margin: '22px 20px 0',
                  padding: 18,
                  border: 0,
                  borderLeft: `6px solid ${V3.mustard}`,
                  borderRadius: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  background: V3.soft,
                }
          }
        >
          <h2 id="start-title" style={{ margin: 0, fontSize: startIsCore ? 28 : 24 }}>
            정기배송 시작하기
          </h2>
          <p
            style={{
              margin: startIsCore ? '10px 0 0' : '8px 0 0',
              fontSize: startIsCore ? 17 : 16,
              lineHeight: 1.6,
              color: startIsCore ? V3.ink : V3.inkSoft,
              wordBreak: 'keep-all',
            }}
          >
            분석 결과에 맞춘 레시피로 2주마다 보내드려요. 다음 결제 전까지 미루거나 그만둘 수 있어요.
          </p>
          <div style={{ marginTop: startIsCore ? 16 : 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {model.startable.map((d) => {
              // 분석이 끝난 아이 = 먹색 주 버튼(핵심 카드일 때만), 나머지는 흰 먹선 버튼.
              const primary = d.ready && startIsCore
              return (
                <Link
                  key={d.id}
                  href={d.href}
                  className="active:opacity-80"
                  style={{
                    minHeight: 64,
                    padding: '0 16px 0 10px',
                    borderRadius: 4,
                    border: primary ? 0 : `1.5px solid ${V3.ink}`,
                    background: primary ? V3.ink : '#FFFFFF',
                    color: primary ? '#FFFFFF' : V3.ink,
                    textDecoration: 'none',
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr 22px',
                    columnGap: 12,
                    alignItems: 'center',
                  }}
                >
                  <Avatar size={40} photoUrl={d.photoUrl} bg={primary ? 'rgba(255,255,255,0.5)' : V3.soft} />
                  <span style={{ fontSize: 17, fontWeight: 800, wordBreak: 'keep-all' }}>{d.label}</span>
                  <Chevron />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* 구독별 한 줄 — 관리는 강아지 화면에서 */}
      {rows.length > 0 && (
        <section aria-labelledby="list-title" style={{ padding: '30px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <h2 id="list-title" style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 24 }}>정기배송</span>
            <span className="ft-num" style={{ fontSize: 22 }}>
              {rows.length}
            </span>
            <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-sans)' }}>건</span>
          </h2>
          <div style={{ marginTop: 12, borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}>
            {rows.map((r) => (
              <Link
                key={r.id}
                href={r.href}
                className="active:opacity-80"
                style={{
                  minHeight: 88,
                  borderBottom: `1px solid ${V3.rule}`,
                  display: 'grid',
                  gridTemplateColumns: '52px 1fr 16px',
                  columnGap: 14,
                  alignItems: 'center',
                  color: V3.ink,
                  textDecoration: 'none',
                  // 푸시·메일이 ?focus=<id> 로 보낸 그 구독을 눈에 띄게.
                  background: r.focused ? V3.creamSoft : undefined,
                  outline: r.focused ? `2px solid ${V3.mustard}` : undefined,
                  outlineOffset: r.focused ? -2 : undefined,
                }}
              >
                <Avatar size={52} photoUrl={r.photoUrl} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span className="ft-poster truncate" style={{ fontSize: 21 }}>
                      {r.dogName}
                    </span>
                    <StateChip state={r.state} label={r.stateLabel} />
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: V3.inkSoft, wordBreak: 'keep-all' }}>
                    {r.lines.length > 0 && (
                      <span style={{ display: 'flex', gap: 2, flexShrink: 0 }} aria-hidden>
                        {r.lines.map((l) => (
                          <span key={l} style={{ width: 9, height: 9, background: RECIPE_COLOR[l] }} />
                        ))}
                      </span>
                    )}
                    <span>{r.line}</span>
                  </span>
                </span>
                <span aria-hidden style={{ fontSize: 20 }}>
                  ›
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Link
        href="/mypage/orders"
        className="active:opacity-80"
        style={{
          margin: rows.length > 0 ? '4px 20px 0' : '26px 20px 0',
          minHeight: rows.length > 0 ? 60 : 64,
          borderTop: rows.length > 0 ? 0 : `2px solid ${V3.ink}`,
          borderBottom: `1px solid ${V3.rule}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 17,
          fontWeight: 800,
          color: V3.ink,
          textDecoration: 'none',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {rows.length === 0 && <ReceiptIcon />}
          결제·주문 내역
        </span>
        <span aria-hidden>›</span>
      </Link>
      {after}
    </div>
  )
}
