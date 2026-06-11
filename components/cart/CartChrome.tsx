'use client'

/**
 * CartChrome — 모바일 장바구니 상단 (Phase P r3 리뉴얼, 2026-06-12).
 *
 * 이전(2026-05-21): 자체 헤더(←/장바구니 N/편집) + ink 눈금자 + 배송지 +
 * 가짜 전체선택 row. 문제:
 *   - 자체 헤더가 AppChrome 깊은화면 헤더(← 장바구니)와 중복 + '편집'이
 *     존재하지 않는 /account 로 링크.
 *   - 전체선택/선택삭제가 시각 전용(동작 X) — 기만 UI.
 *   - 눈금자+노란 삼각형 포인터가 과하게 복잡 (사장님: 난잡).
 *
 * 리뉴얼 구성 (컬리 그래머):
 *   1. 배송지 카드 (sage pin + 도착 예정) — 어디로 가는지부터.
 *   2. 무료배송 슬림 progress — 한 줄 문구 + 4px pill bar.
 *
 * 데스크톱은 기존 헤더 유지 — 본 컴포넌트는 md:hidden (app 핸드오프 전용).
 */

import Link from 'next/link'
import { MapPin, Truck, ChevronRight } from 'lucide-react'

interface Props {
  /** 현재 소계 (원) */
  subtotal: number
  /** 무료배송 임계치 (원) */
  freeThreshold: number
  /** 무료배송까지 남은 금액 */
  remainingToFree: number
  /** 기본 배송지 텍스트 (없으면 안내 문구) */
  addressLine?: string | null
  /** 도착 예정 텍스트 (서버에서 계산해서 전달) */
  arrivalLabel: string
}

export default function CartChrome({
  subtotal,
  freeThreshold,
  remainingToFree,
  addressLine,
  arrivalLabel,
}: Props) {
  const pct = Math.min(100, (subtotal / freeThreshold) * 100)
  const hasFree = remainingToFree <= 0

  return (
    <div className="md:hidden">
      {/* 1. 배송지 카드 */}
      <section className="px-4 pt-3 pb-3">
        <Link
          href="/mypage/addresses"
          className="flex items-center gap-3 transition active:scale-[0.99]"
          style={{
            background: 'var(--paper-hi, #fbf6ec)',
            border: '1px solid var(--rule, rgba(22,20,15,0.12))',
            borderRadius: 4,
            padding: '14px 16px',
          }}
        >
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 38,
              height: 38,
              borderRadius: 4,
              background: 'var(--sage, #4f6a48)',
              color: 'var(--paper-hi, #fbf6ec)',
            }}
          >
            <MapPin size={18} color="var(--paper-hi, #fbf6ec)" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="font-bold"
                style={{ fontSize: 10, color: '#7a6d5b', letterSpacing: 1 }}
              >
                배송지
              </span>
              <span
                className="inline-flex items-center font-bold"
                style={{
                  padding: '2px 7px',
                  background: 'rgba(220, 83, 42, 0.12)',
                  color: '#dc532a',
                  borderRadius: 2,
                  fontSize: 9.5,
                  letterSpacing: 0.3,
                  lineHeight: 1,
                }}
              >
                기본
              </span>
            </div>
            <div
              className="truncate"
              style={{
                marginTop: 5,
                fontSize: 13.5,
                fontFamily: "var(--font-sans), 'Pretendard', sans-serif",
                fontWeight: 700,
                color: '#1a140c',
                letterSpacing: '-0.01em',
                lineHeight: 1.35,
              }}
            >
              {addressLine ?? '배송지를 등록해 주세요'}
            </div>
            <div
              className="flex items-center gap-1.5"
              style={{ marginTop: 4, fontSize: 10, color: '#dc532a', fontWeight: 700 }}
            >
              <span
                style={{ width: 5, height: 5, borderRadius: 3, background: '#dc532a' }}
              />
              {arrivalLabel}
            </div>
          </div>
          <ChevronRight size={18} color="#7a6d5b" strokeWidth={1.8} />
        </Link>
      </section>

      {/* 2. 무료배송 슬림 progress — 한 줄 문구 + 4px pill bar */}
      <section className="px-4 pb-1">
        <div
          style={{
            background: 'var(--paper-hi, #fbf6ec)',
            border: '1px solid var(--rule, rgba(22,20,15,0.12))',
            borderRadius: 4,
            padding: '12px 14px',
          }}
        >
          <div className="flex items-center gap-2">
            <Truck
              size={16}
              color={hasFree ? 'var(--sage, #4f6a48)' : 'var(--accent, #c44a26)'}
              strokeWidth={1.8}
            />
            <span
              className="flex-1 font-bold"
              style={{ fontSize: 12, color: 'var(--ink, #16140f)' }}
            >
              {hasFree ? (
                <>
                  무료배송 적용!{' '}
                  <span style={{ color: 'var(--sage, #4f6a48)' }}>배송비 무료</span>
                </>
              ) : (
                <>
                  <span style={{ color: 'var(--accent, #c44a26)' }}>
                    {remainingToFree.toLocaleString()}원
                  </span>{' '}
                  더 담으면 무료배송
                </>
              )}
            </span>
          </div>
          <div
            aria-hidden
            style={{
              marginTop: 9,
              height: 4,
              borderRadius: 999,
              background: 'rgba(22,20,15,0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                borderRadius: 999,
                background: hasFree
                  ? 'var(--sage, #4f6a48)'
                  : 'var(--accent, #c44a26)',
                transition: 'width 240ms cubic-bezier(0.16,1,0.3,1)',
              }}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
