'use client'

/**
 * FdRecipeSheet — FD 클론 "제품 정보 퀵뷰" 바텀시트 (2026-06-19).
 *
 * 사장님 지시: "제품 보러가기" 버튼 = 페이지 점프 대신, 탭하면 제품 정보가
 * 바텀시트로 슬라이드업 (The Farmer's Dog PDP 느낌 — 누끼 사진 → 원재료 →
 * 성분 분석 표 → AAFCO 표준 → 칼로리). 페이지 이동/데드엔드 없이 그 자리에서.
 *
 * # 단일 정직 소스
 *   - 레시피(이름·컨셉·주재료·칼로리): lib/web-recipes (공개 수준 — 배합%·
 *     프리믹스·원가 미포함, 사장님 2026-06-16 확정).
 *   - 성분 분석(건물 기준 DM): lib/sku-nutrition-matrix (R&D 시제품 + FEDIAF/NRC
 *     교차검증값). 단백/지방/Ca:P/EPA+DHA.
 *   ★절대 미노출: 배합 %·프리믹스 사양·원가. 상세 성적서는 "가입 후 앱"으로 안내.
 *
 * # 재사용처
 *   - app/compare/CompareClient (5종 카드 "화식 보러가기")
 *   - app/start/StartSurvey (Your Plan 레시피 "자세히 보기")
 *   - 추후 FD 홈 레시피 섹션 등 모든 "보러가기" 트리거.
 *
 * 모든 CTA 는 설문 퍼널(/start)로 — FD 클론 규칙(가입 전 커머스 데드엔드 방지).
 */

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { X, Check, ArrowRight } from 'lucide-react'
import { PhotoSlot } from './ui'
import { SKU_NUTRITION } from '@/lib/sku-nutrition-matrix'
import type { SkuKey } from '@/lib/allergy-sku-matrix'
import type { WebRecipe } from '@/lib/web-recipes'

/** WebRecipe.protein → SKU 키 (성분 분석 매트릭스 조회용). 연어(S03)는 web-recipes
 *  에 없으므로(미출시) 매핑 불필요. */
const PROTEIN_TO_SKU: Record<WebRecipe['protein'], SkuKey> = {
  chicken: 'C01',
  duck: 'D02',
  pork: 'P04',
  beef: 'B05',
}

export default function FdRecipeSheet({
  recipe,
  onClose,
  ctaHref = '/start',
}: {
  /** null 이면 닫힘(렌더 안 함). */
  recipe: WebRecipe | null
  onClose: () => void
  /** CTA 목적지 — 기본 설문 퍼널. null 이면 CTA 숨김(이미 퍼널 안일 때). */
  ctaHref?: string | null
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  // onClose 가 매 렌더 새 함수여도 effect 가 재실행되지 않게 ref 로 고정
  // (재실행되면 trigger 캡처가 패널 내부 요소를 가리켜 포커스 복귀가 깨짐).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  const open = recipe !== null

  // 접근성 — ESC 닫기 · 바디 스크롤 락 · 포커스 트랩 · 트리거 포커스 복귀.
  // (StartSurvey 기존 레시피 모달과 동일 패턴.)
  useEffect(() => {
    if (!open) return
    const trigger = document.activeElement as HTMLElement | null
    const focusables = () => {
      const panel = panelRef.current
      return panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'button, [href], input, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => !el.hasAttribute('disabled'))
        : []
    }
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key === 'Tab') {
        const items = focusables()
        if (items.length === 0) return
        const firstEl = items[0]!
        const lastEl = items[items.length - 1]!
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      trigger?.focus()
    }
  }, [open])

  if (!recipe) return null

  const n = SKU_NUTRITION[PROTEIN_TO_SKU[recipe.protein]]
  // 원재료 콜아웃 — 공개 주재료를 '·' 로 분리해 칩으로(FD 사진 콜아웃 느낌).
  const callouts = recipe.mainIngredients
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean)
  // 성분 분석 행 — 건물(DM) 기준. 점추정값(R&D)이라 min/max 대신 단일값.
  const analysis: Array<{ k: string; v: string }> = [
    { k: '조단백질', v: `${n.protein_pct}%` },
    { k: '조지방', v: `${n.fat_pct}%` },
    { k: '칼슘 : 인', v: `${n.ca_p_ratio.toFixed(2)} : 1` },
    { k: '오메가-3 (EPA+DHA)', v: `${n.epa_dha_pct}%` },
  ]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fd-recipe-sheet-title"
      onClick={onClose}
      className="animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(23,59,51,0.55)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-in-up"
        style={{
          background: '#FFFFFF',
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          maxWidth: 480,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '18px 20px 26px',
        }}
      >
        {/* 헤더 — 컨셉 eyebrow + 닫기 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: 'var(--fd-green)',
              textTransform: 'uppercase',
            }}
          >
            {recipe.concept}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              appearance: 'none',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--fd-muted)',
              padding: 4,
              fontFamily: 'inherit',
            }}
          >
            <X className="w-5 h-5" strokeWidth={2.2} />
          </button>
        </div>

        <h2
          id="fd-recipe-sheet-title"
          style={{
            marginTop: 4,
            fontSize: 22,
            fontWeight: 900,
            color: 'var(--fd-pine)',
            letterSpacing: '-0.025em',
          }}
        >
          {recipe.name}
        </h2>
        <p style={{ marginTop: 3, fontSize: 12.5, color: 'var(--fd-muted)', fontWeight: 600 }}>
          추천 · {recipe.recommendedFor}
        </p>

        {/* 누끼 사진 (밀팩) */}
        <div style={{ marginTop: 12 }}>
          <PhotoSlot
            label={`${recipe.name} 누끼 사진`}
            ratio="16 / 10"
            tone="cream"
            rounded={12}
            className="w-full"
          />
        </div>

        {/* 원재료 — 공개 주재료 칩 (FD Ingredients 콜아웃) */}
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: 'var(--fd-muted)',
              textTransform: 'uppercase',
            }}
          >
            원재료
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {callouts.map((ing) => (
              <span
                key={ing}
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: 'var(--fd-pine)',
                  background: 'var(--fd-cream)',
                  boxShadow: 'inset 0 0 0 1px var(--fd-line)',
                  padding: '5px 11px',
                  borderRadius: 999,
                }}
              >
                {ing}
              </span>
            ))}
          </div>
        </div>

        {/* 성분 분석 — 건물(DM) 기준 표 (FD Guaranteed Analysis) */}
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: 'var(--fd-muted)',
                textTransform: 'uppercase',
              }}
            >
              성분 분석
            </div>
            <span style={{ fontSize: 10.5, color: 'var(--fd-muted)', fontWeight: 600 }}>
              건물(DM) 기준
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            {analysis.map((row) => (
              <div
                key={row.k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--fd-line)',
                }}
              >
                <span style={{ fontSize: 12.5, color: 'var(--fd-muted)', fontWeight: 600 }}>
                  {row.k}
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    color: 'var(--fd-pine)',
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {row.v}
                </span>
              </div>
            ))}
            {/* 칼로리 — 완성품 기준(웹 레시피 단일 소스) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 0',
              }}
            >
              <span style={{ fontSize: 12.5, color: 'var(--fd-muted)', fontWeight: 600 }}>
                칼로리
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  color: 'var(--fd-pine)',
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {recipe.kcalPer100g} kcal/100g
              </span>
            </div>
          </div>
        </div>

        {/* 영양 표준 — AAFCO statement */}
        <div
          className="rounded-[12px]"
          style={{
            marginTop: 16,
            padding: '13px 15px',
            background: 'var(--fd-cream)',
            boxShadow: 'inset 0 0 0 1px var(--fd-line)',
            display: 'flex',
            gap: 10,
          }}
        >
          <Check
            className="w-4 h-4 shrink-0"
            strokeWidth={2.6}
            style={{ color: 'var(--fd-green)', marginTop: 1 }}
          />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--fd-pine)' }}>
              AAFCO · FEDIAF · NIAS 3중 표준 동시충족
            </div>
            <p style={{ marginTop: 3, fontSize: 11.5, color: 'var(--fd-muted)', lineHeight: 1.55 }}>
              권장 영양 기준에 +15% 안전마진. 자연 원물 우선 설계로 심장에서 자연
              타우린을, 연어유에서 오메가-3를 공급해요.
            </p>
          </div>
        </div>

        <p style={{ marginTop: 11, fontSize: 11, color: 'var(--fd-muted)', lineHeight: 1.55 }}>
          공개 가능한 정보만 담았어요. 상세 배합비와 영양 성적서는 가입 후 앱에서
          확인할 수 있어요.
        </p>

        {/* CTA — 설문 퍼널 (커머스 데드엔드 방지). 이미 퍼널 안이면 ctaHref=null → 숨김. */}
        {ctaHref !== null && (
          <Link
            href={ctaHref}
            className="no-underline"
            style={{
              marginTop: 16,
              display: 'inline-flex',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: 'var(--fd-coral)',
              color: '#fff',
              padding: '14px',
              borderRadius: 999,
              fontSize: 13.5,
              fontWeight: 800,
              letterSpacing: '-0.01em',
            }}
          >
            내 아이 맞춤으로 시작하기
            <ArrowRight className="w-4 h-4" strokeWidth={2.6} />
          </Link>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: ctaHref !== null ? 9 : 4,
            appearance: 'none',
            border: '1px solid var(--fd-line)',
            background: 'transparent',
            color: 'var(--fd-pine)',
            width: '100%',
            padding: '12px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          닫기
        </button>
      </div>
    </div>
  )
}
