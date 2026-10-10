/**
 * 추천 레시피 카드 — "땅콩이의 추천 레시피"(레시피 비율 띠 + 레시피 줄 + 이렇게 추천했어요).
 *
 * 2026-07-13 갈아엎기(사장님 지시): 기간(1/2/4주분) 토글 제거 — 배송은 무조건 2주마다 고정이라 기간은 선택
 * 개념이 아님. 화식 비율 선택(곁들임/반반/완전)은 아래 RecommendationBox 로 이동. 행도 시끄러운 스텐실 라벨·
 * 카운터·큰 % 를 빼고 하루 g·kcal 만 차분하게 — % 수치는 노출 안 함(비율 띠가 비율을 보여 준다).
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 D08): 흰 카드 → 먹선 2px 로 여는 섹션. 제목 글꼴 26 ·
 *   레시피 색 띠(12px) · 줄마다 레시피 팩 스튜디오 사진 52 + 이름(레시피 색 네모) + 하루 g·kcal.
 *   레시피 이름은 박스·주문과 같은 말("닭고기 레시피") — 엔진 부제("프레시 치킨 레시피")가 아니다.
 */

import Image from 'next/image'
import { petName } from '@/lib/korean'
import { V3 } from '@/lib/design/tokens'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Reasoning, FoodLine } from '@/lib/personalization/types'
import { plainTrigger, isPlainCustomerText } from '@/lib/personalization/plain-reason'
import { bowlImageForLine, studioPouchImageForLine } from '@/lib/personalization/packageImage'
import { recipeColorOfLine, recipeTitleOfLine } from '../display'

export interface BoxMixItem {
  key: FoodLine
  /** 영문 라벨 (레거시 — 현재 행에는 미표시, boxItems 빌더 호환 위해 유지). */
  name: string
  /** 화면 이름. ex: '닭고기 레시피' */
  ko: string
  /** 부제. ex: '고단백 · 브로콜리 · 체중 관리에' */
  sub: string
  /** 비율 % — 비율 띠 폭 산정용(수치 자체는 미표시). */
  pct: number
  /** 하루 평균 kcal */
  kcal: number
  /** 하루 평균 g */
  g: number
  /** 사진 URL — 없으면 레시피 팩 스튜디오 사진. */
  photoUrl?: string | null
}

export function BoxMixCard({
  dogName,
  items,
  loading = false,
  reasoning,
}: {
  dogName: string
  items: BoxMixItem[]
  /** dog 별 lineRatios(formula) 아직 로딩 중 — 가짜 placeholder 대신 스켈레톤.
   *  (formula null 시 상위가 임시 박스를 넘기던 것이 '옛 박스 플래시'의 원인) */
  loading?: boolean
  /** 추천 근거 — 이 카드 안에 바로 노출(사장님 2026-07-14: 왜 추천했는지
   *  추천 레시피 밑에서 딱 보여야 함). 접이식 X. */
  reasoning?: Reasoning[]
}) {
  // 'v3 맞춤 베이스' 같은 내부 용어 행은 제외 — 고객에게 의미 없음(사장님 지시).
  // 10/6 10차 E: 저장된 근거는 임상 표기(puppy·BCS·DCM …)라 쉬운 말로 바꿔 그리고, 바꿔도 영문·인용이 남는 줄은 뺀다.
  const reasons = (reasoning ?? [])
    .filter((r) => !/v3/i.test(r.chipLabel) && !/v3/i.test(r.trigger))
    .map((r) => ({ ...r, trigger: plainTrigger(r.trigger) }))
    .filter((r) => isPlainCustomerText(r.trigger) && isPlainCustomerText(r.chipLabel))
    .slice(0, 4)

  return (
    <section
      aria-label="추천 레시피"
      style={{
        margin: '28px 20px 0',
        borderTop: `2px solid ${V3.ink}`,
        paddingTop: 14,
        display: 'flex',
        flexDirection: 'column',
        color: V3.ink,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute }}>맞춤 식단</span>
        <span style={{ fontSize: 14, fontWeight: 800 }}>
          {loading ? '레시피 구성 중' : `화식 ${items.length}종 레시피`}
        </span>
      </span>
      {/* 제목 글꼴은 앱 틀의 h2 규칙이 준다. */}
      <h2 style={{ margin: '8px 0 0', fontSize: 26, lineHeight: 1.15, wordBreak: 'keep-all' }}>
        {petName(dogName)}의 추천 레시피
      </h2>

      {loading ? (
        <BoxSkeleton />
      ) : (
        <>
          {/* 2종 이상일 때만 비율 띠 — 1종이면 한 색이라 불필요. */}
          {items.length >= 2 && (
            <div
              aria-hidden
              style={{
                marginTop: 14,
                height: 12,
                display: 'grid',
                gridTemplateColumns: items.map((it) => `${Math.max(1, it.pct)}fr`).join(' '),
                gap: 2,
              }}
            >
              {items.map((it) => (
                <span key={it.key} style={{ background: recipeColorOfLine(it.key) }} />
              ))}
            </div>
          )}

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' }}>
            {items.map((it) => (
              <BoxRow key={it.key} item={it} />
            ))}
          </div>

          {/* 왜 이렇게 추천했는지 — 레시피 바로 밑에서 접지 않고 노출. */}
          {reasons.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: V3.inkMute }}>이렇게 추천했어요</span>
              {reasons.map((r, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, lineHeight: 1.45 }}>
                  <span style={{ flex: 1, minWidth: 0, color: V3.inkSoft }}>{r.trigger}</span>
                  <span aria-hidden style={{ color: V3.inkMute }}>
                    →
                  </span>
                  <strong style={{ fontWeight: 800, flexShrink: 0 }}>{r.chipLabel}</strong>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

/** 로딩 스켈레톤 — 실제 띠+줄 치수와 같게(CLS 없이). */
function BoxSkeleton() {
  return (
    <>
      <div style={{ marginTop: 14 }}>
        <Skeleton className="h-3 w-full" rounded="none" />
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              minHeight: 76,
              borderBottom: `1px solid ${V3.rule}`,
              display: 'grid',
              gridTemplateColumns: '52px 1fr auto',
              columnGap: 12,
              alignItems: 'center',
            }}
          >
            <Skeleton className="w-[52px] h-[52px]" rounded="full" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </>
  )
}

function BoxRow({ item }: { item: BoxMixItem }) {
  // 레시피 팩 스튜디오 컷(시안 D08) — 판매하지 않는 라인(연어)은 그릇 사진, 그것도 없으면 레시피 색 원.
  const photo = item.photoUrl ?? studioPouchImageForLine(item.key) ?? bowlImageForLine(item.key)
  const color = recipeColorOfLine(item.key)
  // 큰 이름 = 팩에 찍힌 영어, 아래 회색 = 한글 상품 이름(사장님 2026-10-10). 팩이 없는 라인은 예전 한글 이름 그대로.
  const t = recipeTitleOfLine(item.key)
  const pouch = t.en !== null
  const title = t.en ?? item.ko
  const subLine = pouch ? `${t.ko} · ${item.sub}` : item.sub
  return (
    <div
      style={{
        minHeight: 76,
        borderBottom: `1px solid ${V3.rule}`,
        display: 'grid',
        gridTemplateColumns: '52px 1fr auto',
        columnGap: 12,
        alignItems: 'center',
      }}
    >
      <span
        style={{
          position: 'relative',
          width: 52,
          height: 52,
          borderRadius: 26,
          overflow: 'hidden',
          background: photo ? V3.soft : color,
        }}
      >
        {photo && <Image src={photo} alt={`${item.ko} 팩`} fill sizes="52px" style={{ objectFit: 'cover' }} />}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden style={{ width: 10, height: 10, background: color, flexShrink: 0 }} />
          <span className={pouch ? 'ft-num' : undefined} style={pouch ? { fontSize: 19, letterSpacing: '0.02em' } : { fontSize: 17, fontWeight: 800 }}>
            {title}
          </span>
        </span>
        <span style={{ fontSize: 14, color: V3.inkMute, wordBreak: 'keep-all' }}>{subLine}</span>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 13, color: V3.inkMute }}>하루</span>
        <span style={{ fontSize: 15, fontWeight: 800 }}>
          {Math.round(item.g)}g · {Math.round(item.kcal)}kcal
        </span>
      </span>
    </div>
  )
}
