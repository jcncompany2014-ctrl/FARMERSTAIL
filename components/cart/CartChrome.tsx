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
      {/* 헤더 — v3: paperHi + 1px rule (그림자 폐기) */}
      <section className="px-4 pt-2 pb-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center transition active:scale-95"
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--r-sm, 18px)',
            background: 'var(--paper-hi, #fff)',
            border: '1px solid var(--rule, rgba(22,20,15,0.12))',
            cursor: 'pointer',
          }}
          aria-label="뒤로"
        >
          <ChevronLeft size={18} color="var(--ink, #16140f)" strokeWidth={1.8} />
        </button>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 900,
            fontSize: 15,
            color: 'var(--ink, #16140f)',
            letterSpacing: '-0.02em',
          }}
        >
          장바구니{' '}
          <span style={{ color: 'var(--accent, #c44a26)' }}>{count}</span>
        </div>
        <Link
          href="/account"
          className="flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--r-sm, 18px)',
            background: 'var(--paper-hi, #fff)',
            border: '1px solid var(--rule, rgba(22,20,15,0.12))',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--ink, #16140f)',
            letterSpacing: '-0.005em',
          }}
        >
          편집
        </Link>
      </section>

      {/* 무료배송 progress — v3: ink ruler + yellow triangle pointer (그라데이션 폐기) */}
      <section className="px-4 pb-3">
        <div
          style={{
            background: 'var(--paper-hi, #fbf6ec)',
            border: '1px solid var(--rule, rgba(22,20,15,0.12))',
            borderRadius: 'var(--r-sm, 4px)',
            padding: '14px 16px',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Truck size={18} color="var(--accent, #c44a26)" strokeWidth={1.8} />
            <div
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
                  더 담으면 무료배송!
                </>
              )}
            </div>
          </div>

          {/* ink ruler */}
          <div className="relative" style={{ height: 18, marginBottom: 4 }}>
            {/* hairline base */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 8,
                height: 2,
                background: 'var(--ink, #16140f)',
              }}
            />
            {/* tick marks (0 / 50% / 100%) */}
            {[0, 50, 100].map((p) => (
              <div
                key={p}
                aria-hidden
                style={{
                  position: 'absolute',
                  left: `${p}%`,
                  top: 4,
                  width: 2,
                  height: 10,
                  background: 'var(--ink, #16140f)',
                  transform: 'translateX(-50%)',
                }}
              />
            ))}
            {/* progress fill — sage block from 0 to pct */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                top: 8,
                height: 2,
                width: `${pct}%`,
                background: hasFree
                  ? 'var(--sage, #4f6a48)'
                  : 'var(--accent, #c44a26)',
                transition: 'width 240ms cubic-bezier(0.16,1,0.3,1)',
              }}
            />
            {/* yellow triangle pointer at current pct — ▽ ruler 위쪽 위치,
                뾰족한 끝은 아래쪽 ruler 라인 가리킴. */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: `${Math.min(100, Math.max(0, pct))}%`,
                top: 1,
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '6px solid var(--yellow, #e6b942)',
                transform: 'translateX(-50%)',
                transition: 'left 240ms cubic-bezier(0.16,1,0.3,1)',
              }}
            />
          </div>

          {/* tick labels — R22: absolute 로 tick (0% / 50% / 100%) 가운데
              translateX(-50%) 정렬. flex justify-between 으로는 텍스트 폭
              차이 때문에 tick line 가운데에 안 옴. */}
          <div
            className="relative tabular-nums"
            style={{
              height: 12,
              fontFamily:
                "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
              fontSize: 9,
              color: 'var(--ink-mute, #706854)',
              letterSpacing: '0.06em',
            }}
          >
            {/* R24: 양 끝 label 박스 밖 노출 방지 — 좌끝 좌측 정렬,
                우끝 우측 정렬, 가운데만 translateX(-50%) (commerce 표준). */}
            <span
              style={{
                position: 'absolute',
                left: '0%',
                whiteSpace: 'nowrap',
              }}
            >
              0
            </span>
            <span
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
              }}
            >
              {Math.round(freeThreshold / 2).toLocaleString()}
            </span>
            <span
              style={{
                position: 'absolute',
                left: '100%',
                transform: 'translateX(-100%)',
                whiteSpace: 'nowrap',
                color: 'var(--accent, #c44a26)',
                fontWeight: 700,
              }}
            >
              {freeThreshold.toLocaleString()}원
            </span>
          </div>
        </div>
      </section>

      {/* 배송지 카드 — v3: paperHi + 1px rule + sage 4px square pin */}
      <section className="px-4 pb-3">
        <Link
          href="/account/addresses"
          className="flex items-center gap-3"
          style={{
            background: 'var(--paper-hi, #fbf6ec)',
            border: '1px solid var(--rule, rgba(22,20,15,0.12))',
            borderRadius: 'var(--r-sm, 4px)',
            padding: '14px 16px',
          }}
        >
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--r-sm, 4px)',
              background: 'var(--sage, #4f6a48)',
              color: 'var(--paper-hi, #fbf6ec)',
            }}
          >
            <MapPin size={18} color="var(--paper-hi, #fbf6ec)" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5" style={{ paddingBottom: 2 }}>
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
                  lineHeight: 1,
                }}
              >
                기본
              </span>
            </div>
            <div
              className="font-['Archivo_Black'] truncate"
              style={{
                marginTop: 6,
                fontSize: 13,
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
