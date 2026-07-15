'use client'

/**
 * Magazine BoxMixCard — 첫 박스 "레시피 구성" 카드 (스택 바 + 라인 행).
 *
 * 2026-07-13 갈아엎기(사장님 지시): 기간(1/2/4주분) 토글 제거 — 배송은 무조건
 * 2주마다 고정이라 기간은 선택 개념이 아님. 화식 비율 선택(곁들임/반반/완전)은
 * 아래 RecommendationBox 로 이동. 행도 시끄러운 스텐실 라벨·카운터·큰 % 를 빼고
 * 하루 g·kcal 만 차분하게 — % 수치는 노출 안 함(스택 바가 비율을 시각화).
 */

import Image from 'next/image'
import { Bone, Droplet, Sparkles, Leaf } from 'lucide-react'
import { petName } from '@/lib/korean'
import { Skeleton } from '@/components/ui/Skeleton'
import type { MagazinePalette, BoxLineKey } from './palette'
import { lineColors } from './palette'
import { Reveal, useReveal } from './primitives'
import { ReportCard, SectionHeader } from './ReportCard'

export interface BoxMixItem {
  key: BoxLineKey
  /** 영문 라벨 (레거시 — 현재 행에는 미표시, boxItems 빌더 호환 위해 유지). */
  name: string
  /** 한국어 이름 + 단백. ex: '닭 · 균형식' */
  ko: string
  /** 부제. ex: '단일 단백원 · 소화 부담 낮음' */
  sub: string
  /** 비율 % — 스택 바 폭 산정용(수치 자체는 미표시). */
  pct: number
  /** 하루 평균 kcal */
  kcal: number
  /** 하루 평균 g */
  g: number
  /** 누끼 제품 사진 URL — 있으면 원형 슬롯에 표시, 없으면 아이콘 placeholder. */
  photoUrl?: string | null
}

export function BoxMixCard({
  p,
  dogName,
  items,
  loading = false,
}: {
  p: MagazinePalette
  dogName: string
  items: BoxMixItem[]
  /** dog 별 lineRatios(formula) 아직 로딩 중 — 가짜 placeholder 대신 스켈레톤.
   *  (formula null 시 상위가 임시 박스를 넘기던 것이 '옛 박스 플래시'의 원인) */
  loading?: boolean
}) {
  const colors = lineColors(p)

  return (
    <Reveal delay={80}>
      <ReportCard p={p}>
        <SectionHeader
          p={p}
          eyebrow="RECOMMENDED"
          title={`${petName(dogName)}의 추천 레시피`}
          tail={loading ? '레시피 구성 중' : `화식 ${items.length}종 레시피`}
        />

        {loading ? (
          <BoxSkeleton p={p} />
        ) : (
          <>
            {/* 2종 이상일 때만 비율 바 — 1종이면 100% 단색이라 불필요. */}
            {items.length >= 2 && (
              <div style={{ marginTop: 16 }}>
                <StackedBar items={items} colors={colors} />
              </div>
            )}

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it) => (
                <BoxRow key={it.key} p={p} item={it} color={colors[it.key]} />
              ))}
            </div>
          </>
        )}
      </ReportCard>
    </Reveal>
  )
}

/** 로딩 스켈레톤 — 실제 바+행 레이아웃과 동일 치수로 CLS 없이 shimmer. */
function BoxSkeleton({ p }: { p: MagazinePalette }) {
  return (
    <>
      <div style={{ marginTop: 16 }}>
        <Skeleton className="h-4 w-full" rounded="full" />
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              background: p.cardSoft,
              borderRadius: 8,
            }}
          >
            <Skeleton className="w-12 h-12 shrink-0" rounded="full" />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-2.5 w-3/4" />
            </div>
            <Skeleton className="h-3 w-10 shrink-0" />
          </div>
        ))}
      </div>
    </>
  )
}

function StackedBar({
  items,
  colors,
}: {
  items: BoxMixItem[]
  colors: ReturnType<typeof lineColors>
}) {
  const [ref, shown] = useReveal({ threshold: 0.3 })
  return (
    <div
      ref={ref}
      style={{
        height: 16,
        borderRadius: 999,
        overflow: 'hidden',
        display: 'flex',
        background: 'rgba(0,0,0,0.04)',
      }}
    >
      {items.map((it, i) => (
        <div
          key={it.key}
          style={{
            width: shown ? `${it.pct}%` : '0%',
            background: colors[it.key],
            transition: `width 900ms cubic-bezier(.2,.7,.2,1) ${100 + i * 90}ms`,
            borderRight: i < items.length - 1 ? '1px solid rgba(255,255,255,0.35)' : 'none',
          }}
        />
      ))}
    </div>
  )
}

function BoxRow({
  p,
  item,
  color,
}: {
  p: MagazinePalette
  item: BoxMixItem
  color: string
}) {
  const IconComp =
    item.key === 'skin'
      ? Droplet
      : item.key === 'joint'
        ? Sparkles
        : item.key === 'weight'
          ? Leaf
          : Bone
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: p.cardSoft,
        borderRadius: 8,
      }}
    >
      {/* 원형 제품사진 슬롯 — 누끼 제품 사진 자리. photoUrl 있으면 원형 안에 표시,
          없으면 라인색 틴트 원 + 아이콘 placeholder. */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {item.photoUrl ? (
          <Image
            src={item.photoUrl}
            alt={item.ko}
            fill
            sizes="48px"
            style={{ objectFit: 'contain' }}
          />
        ) : (
          <IconComp size={22} color={color} strokeWidth={1.9} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: p.ink }}>{item.ko}</div>
        <div style={{ fontSize: 11, color: p.muted, marginTop: 2 }}>{item.sub}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div
          style={{
            fontSize: 9,
            color: p.muted,
            fontWeight: 600,
            letterSpacing: '0.1em',
          }}
        >
          하루
        </div>
        <div style={{ fontSize: 12, color: p.ink, fontWeight: 700, marginTop: 1 }}>
          {Math.round(item.g)}g · {Math.round(item.kcal)}kcal
        </div>
      </div>
    </div>
  )
}
