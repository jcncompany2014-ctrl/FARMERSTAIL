/**
 * ForTodaySection — 추천 상품 + delivery + bonus 3-슬롯 grid.
 *
 * 핸드오프 패턴 (1.5fr 1fr grid):
 *   - 좌측: 대 추천 카드 — 사진 150h + "For·pur·토이푸들" + 이름 + 메타 + 가격 + + 버튼
 *   - 우측 위: ink D-1 카드 — "내일 새벽 도착" + sparkline + "주문 보기 →"
 *   - 우측 아래: yellow bonus — "다음 결제 시 10% 할인"
 */

import Link from 'next/link'
import Image from 'next/image'
import { Plus, ArrowRight, ShoppingBag } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono, Sparkline } from '@/components/v3'

export interface ForTodayProduct {
  id: string
  /** 제품명. */
  name: string
  /** 부제목 — "단백질 28% · 4kg 토이푸들 맞춤" */
  meta: string
  /** 가격 (할인가 적용). */
  price: number
  /** 1.5kg / 1팩 등 단위. */
  unit?: string
  imageUrl?: string | null
  /** "For · pur · 토이푸들" kicker */
  kicker: string
  /** photo placeholder bg tint. */
  toneBg?: string
  href?: string
  /** + 버튼 클릭. */
  onAdd?: () => void
}

export interface ForTodayDelivery {
  /** D-1, D-Day 등 라벨. */
  dLabel: string
  /** 도착 라벨 — "내일\n새벽 도착". */
  arrivalLabel: React.ReactNode
  /** 도착 상품 — "닭가슴살 1.5kg". */
  itemLabel: string
  /** 14일 mini 추세 (옵션). */
  sparkData?: number[]
  href: string
}

export interface ForTodayBonus {
  /** 본문 — "다음 결제 시\n10% 할인". */
  body: React.ReactNode
  /** kicker — 기본 "Bonus". */
  kicker?: string
}

interface ForTodaySectionProps {
  /** 활성 강아지 이름 — heading 표시용. */
  dogName: string
  /** 현재 추천 번호 / 전체 — "02 / 12". */
  cursor?: string
  product: ForTodayProduct
  delivery?: ForTodayDelivery
  bonus?: ForTodayBonus
}

export default function ForTodaySection({
  dogName,
  cursor,
  product,
  delivery,
  bonus,
}: ForTodaySectionProps) {
  return (
    <section style={{ padding: '0 20px 30px' }}>
      <div
        className="flex items-baseline justify-between"
        style={{ marginBottom: 14 }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 22,
            color: V3.ink,
            letterSpacing: '-0.025em',
            wordBreak: 'keep-all',
          }}
        >
          {dogName}를 위한 추천
        </h2>
        {cursor && (
          <Mono color="inkMute" size="xs" weight={500}>
            {cursor}
          </Mono>
        )}
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: '1.5fr 1fr',
          gap: 8,
        }}
      >
        {/* 좌측 — 대 추천 제품 */}
        <ProductPanel product={product} />

        {/* 우측 — delivery 위 + bonus 아래 stack */}
        <div className="flex flex-col" style={{ gap: 8 }}>
          {delivery && <DeliveryPanel delivery={delivery} />}
          {bonus && <BonusPanel bonus={bonus} />}
        </div>
      </div>
    </section>
  )
}

function ProductPanel({ product }: { product: ForTodayProduct }) {
  const card = (
    <div
      className="ft-card-v3 flex flex-col"
      style={{ padding: 12 }}
    >
      <div
        className="relative overflow-hidden"
        style={{
          width: '100%',
          height: 150,
          borderRadius: 2,
          background: product.toneBg ?? '#d4b88c',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.16)',
        }}
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="200px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag size={32} color={V3.inkMute} strokeWidth={1.4} />
          </div>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <Mono color="accent" size="xs" weight={600}>
          {product.kicker}
        </Mono>
      </div>
      <div
        className="ft-clamp-2"
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: V3FontWeight.bold,
          fontSize: 16,
          color: V3.ink,
          marginTop: 6,
          letterSpacing: '-0.015em',
          lineHeight: 1.25,
          wordBreak: 'keep-all',
        }}
      >
        {product.name}
      </div>
      <div
        className="ft-clamp-1"
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          color: V3.inkSoft,
          marginTop: 3,
        }}
      >
        {product.meta}
      </div>
      <div
        className="flex justify-between items-baseline"
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${V3.rule}`,
        }}
      >
        <div>
          <Mono color="inkMute" size="xxs" weight={500}>
            가격{product.unit ? ` / ${product.unit}` : ''}
          </Mono>
          <div
            className="tabular-nums"
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.black,
              fontSize: 16,
              color: V3.ink,
              marginTop: 2,
              letterSpacing: '-0.015em',
            }}
          >
            ₩ {product.price.toLocaleString()}
          </div>
        </div>
        <button
          onClick={(e) => {
            if (product.onAdd) {
              e.preventDefault()
              product.onAdd()
            }
          }}
          className="flex items-center justify-center transition active:scale-95"
          style={{
            width: 30,
            height: 30,
            borderRadius: 4,
            background: V3.ink,
            border: 'none',
            cursor: 'pointer',
          }}
          aria-label="장바구니에 담기"
        >
          <Plus size={16} color={V3.paperHi} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  )
  return product.href ? <Link href={product.href}>{card}</Link> : card
}

function DeliveryPanel({ delivery }: { delivery: ForTodayDelivery }) {
  return (
    <Link
      href={delivery.href}
      className="ft-card-ink flex flex-col"
      style={{ padding: 12, flex: 1, textDecoration: 'none' }}
    >
      <Mono color="yellow" size="xs" weight={600}>
        {delivery.dLabel}
      </Mono>
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: V3FontWeight.bold,
          fontSize: 18,
          marginTop: 8,
          lineHeight: 1.15,
          letterSpacing: '-0.025em',
          color: V3.paper,
          whiteSpace: 'pre-line',
          wordBreak: 'keep-all',
        }}
      >
        {delivery.arrivalLabel}
      </div>
      <div
        className="ft-clamp-1"
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 11.5,
          color: 'rgba(244,237,224,0.6)',
          marginTop: 6,
        }}
      >
        {delivery.itemLabel}
      </div>
      <div style={{ flex: 1 }} />
      {delivery.sparkData && delivery.sparkData.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <Sparkline
            data={delivery.sparkData}
            width={130}
            height={28}
            color={V3.yellow}
            lastDot
          />
        </div>
      )}
      <div
        className="flex justify-between items-center"
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: `1px solid var(--ink-rule)`,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            color: V3.paper,
            fontWeight: 500,
          }}
        >
          주문 보기
        </span>
        <ArrowRight size={13} color={V3.paper} strokeWidth={2} />
      </div>
    </Link>
  )
}

function BonusPanel({ bonus }: { bonus: ForTodayBonus }) {
  return (
    <div
      style={{
        background: V3.yellow,
        borderRadius: 4,
        padding: 12,
        color: V3.ink,
      }}
    >
      <Mono color="ink" size="xs" weight={600}>
        {bonus.kicker ?? 'Bonus'}
      </Mono>
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: V3FontWeight.bold,
          fontSize: 13,
          marginTop: 6,
          lineHeight: 1.2,
          letterSpacing: '-0.005em',
          whiteSpace: 'pre-line',
          wordBreak: 'keep-all',
        }}
      >
        {bonus.body}
      </div>
    </div>
  )
}
