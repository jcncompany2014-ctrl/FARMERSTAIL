'use client'

/**
 * CartChrome — 모바일 장바구니 상단 (2026-05-21).
 *
 * app-product 핸드오프 cp-cart.jsx 패턴.
 *   1. 헤더 (← / 장바구니 N / 편집)
 *   2. 무료배송 progress card (그라데이션 + 0/15K/30K 눈금)
 *   3. 배송지 카드 (sage tinted pin + 도착 예정)
 *   4. 전체선택 N/N + 선택삭제 (시각 전용 — 멀티셀렉트 v2)
 *
 * 데스크톱은 기존 헤더 유지 — 본 컴포넌트는 md:hidden.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, MapPin, Truck, ChevronRight, Check } from 'lucide-react'

interface Props {
  /** 현재 장바구니 상품 수 */
  count: number
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
  count,
  subtotal,
  freeThreshold,
  remainingToFree,
  addressLine,
  arrivalLabel,
}: Props) {
  const router = useRouter()
  const pct = Math.min(100, (subtotal / freeThreshold) * 100)
  const hasFree = remainingToFree <= 0

  return (
    <div className="md:hidden">
      {/* 헤더 */}
      <section className="px-4 pt-2 pb-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center"
          style={{ boxShadow: '0 2px 8px rgba(26,20,12,0.06)' }}
          aria-label="뒤로"
        >
          <ChevronLeft size={18} color="#1a140c" strokeWidth={1.8} />
        </button>
        <div
          className="font-['Archivo_Black']"
          style={{ fontSize: 15, color: '#1a140c', letterSpacing: '-0.01em' }}
        >
          장바구니 <span style={{ color: '#dc532a' }}>{count}</span>
        </div>
        <Link
          href="/account"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[11px] font-bold"
          style={{ color: '#1a140c', boxShadow: '0 2px 8px rgba(26,20,12,0.06)' }}
        >
          편집
        </Link>
      </section>

      {/* 무료배송 progress */}
      <section className="px-4 pb-3">
        <div
          className="bg-white"
          style={{
            borderRadius: 18,
            padding: '14px 16px',
            boxShadow: '0 2px 8px rgba(26,20,12,0.06)',
          }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <Truck size={18} color="#dc532a" strokeWidth={1.8} />
            <div
              className="flex-1 font-bold"
              style={{ fontSize: 12, color: '#1a140c' }}
            >
              {hasFree ? (
                <>
                  무료배송 적용!{' '}
                  <span style={{ color: '#5d6f3f' }}>배송비 무료</span>
                </>
              ) : (
                <>
                  <span style={{ color: '#dc532a' }}>
                    {remainingToFree.toLocaleString()}원
                  </span>{' '}
                  더 담으면 무료배송!
                </>
              )}
            </div>
          </div>
          <div
            className="relative overflow-hidden"
            style={{
              height: 8,
              borderRadius: 4,
              background: '#fbf3df',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                left: 0,
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #dc532a, #e8a82e)',
                borderRadius: 4,
                transition: 'width 0.3s',
              }}
            />
          </div>
          <div
            className="flex justify-between mt-1.5 tabular-nums"
            style={{ fontSize: 9, color: '#7a6d5b' }}
          >
            <span>0</span>
            <span>{Math.round(freeThreshold / 2).toLocaleString()}</span>
            <span style={{ color: '#dc532a', fontWeight: 700 }}>
              {freeThreshold.toLocaleString()}원
            </span>
          </div>
        </div>
      </section>

      {/* 배송지 카드 */}
      <section className="px-4 pb-3">
        <Link
          href="/account/addresses"
          className="flex items-center gap-3 bg-white"
          style={{
            borderRadius: 18,
            padding: '14px 16px',
            boxShadow: '0 2px 8px rgba(26,20,12,0.06)',
          }}
        >
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'rgba(93, 111, 63, 0.13)',
              color: '#5d6f3f',
            }}
          >
            <MapPin size={20} color="#5d6f3f" strokeWidth={1.8} />
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
                  borderRadius: 8,
                  fontSize: 9.5,
                  letterSpacing: 0.3,
                }}
              >
                기본
              </span>
            </div>
            <div
              className="font-['Archivo_Black'] mt-0.5 truncate"
              style={{
                fontSize: 13,
                color: '#1a140c',
                letterSpacing: '-0.01em',
                lineHeight: 1.25,
              }}
            >
              {addressLine ?? '배송지를 등록해 주세요'}
            </div>
            <div
              className="flex items-center gap-1.5 mt-1"
              style={{ fontSize: 10, color: '#dc532a', fontWeight: 700 }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  background: '#dc532a',
                }}
              />
              {arrivalLabel}
            </div>
          </div>
          <ChevronRight size={18} color="#7a6d5b" strokeWidth={1.8} />
        </Link>
      </section>

      {/* 전체선택 row (시각 전용) */}
      <section className="px-5 pt-1 pb-2 flex items-center justify-between">
        <div
          className="flex items-center gap-2"
          style={{ fontSize: 12, fontWeight: 600, color: '#1a140c' }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              background: '#dc532a',
            }}
          >
            <Check size={12} color="#fff" strokeWidth={3} />
          </div>
          전체선택{' '}
          <span
            className="tabular-nums"
            style={{ color: '#7a6d5b', fontSize: 11 }}
          >
            {count} / {count}
          </span>
        </div>
        <span
          className="font-medium"
          style={{ fontSize: 11, color: '#7a6d5b' }}
        >
          선택삭제
        </span>
      </section>
    </div>
  )
}
