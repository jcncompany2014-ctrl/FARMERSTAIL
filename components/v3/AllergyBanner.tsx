/**
 * AllergyBanner — B1. 강아지 알레르기 vs 제품 알레르겐 매칭 안내.
 *
 * 앱 컨텍스트 전용. PDP 의 web-shared 영역에는 못 박지만, /dogs/[id]/* 같은
 * app 페이지에서 제품 추천 카드 옆에 노출 가능.
 *
 * # API
 *
 *   <AllergyBanner
 *     dogName="초롱"
 *     dogAllergies={['chicken', 'beef']}
 *     productAllergens={['chicken']}
 *   />
 *
 * # 디자인
 *
 *  - 매칭 시: sale red border + AlertTriangle + 어느 알레르겐 겹치는지 명시
 *  - 미매칭 시 (안전): sage border + Check + "안심" 메시지
 *  - dogAllergies 가 비어있으면 null 반환 (노출 X)
 */

import { AlertTriangle, Check } from 'lucide-react'
import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'

interface AllergyBannerProps {
  dogName: string
  /** 견의 알레르기 목록 (slug 또는 한글 라벨). */
  dogAllergies: string[]
  /** 제품의 알레르겐 목록. */
  productAllergens: string[]
  /** 안전 시 표시 — false 면 매칭 시에만 노출. 기본 true. */
  showSafe?: boolean
}

/**
 * 양쪽 배열을 normalize 후 교집합 계산. 대소문자 / 공백 무시.
 */
function intersect(a: string[], b: string[]): string[] {
  const aSet = new Set(a.map((x) => x.trim().toLowerCase()))
  const out: string[] = []
  for (const x of b) {
    if (aSet.has(x.trim().toLowerCase())) out.push(x)
  }
  return out
}

export default function AllergyBanner({
  dogName,
  dogAllergies,
  productAllergens,
  showSafe = true,
}: AllergyBannerProps) {
  if (dogAllergies.length === 0) return null

  const overlap = intersect(dogAllergies, productAllergens)
  const danger = overlap.length > 0

  if (!danger && !showSafe) return null

  const accent = danger ? V3.sale : V3.sage

  return (
    <div
      role="status"
      style={{
        background: `color-mix(in srgb, ${accent} 8%, ${V3.paperHi})`,
        border: `1px solid color-mix(in srgb, ${accent} 32%, transparent)`,
        borderRadius: V3Radius.sm,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          background: accent,
          color: V3.paperHi,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {danger ? (
          <AlertTriangle size={14} strokeWidth={2.5} />
        ) : (
          <Check size={14} strokeWidth={2.5} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            fontWeight: V3FontWeight.bold,
            color: V3.ink,
            letterSpacing: '-0.01em',
            margin: 0,
            lineHeight: 1.35,
          }}
        >
          {danger
            ? `${dogName}의 알레르겐이 포함됐어요`
            : `${dogName}에게 안심`}
        </p>
        <p
          style={{
            marginTop: 4,
            fontSize: 11.5,
            color: V3.inkMute,
            lineHeight: 1.45,
          }}
        >
          {danger
            ? `포함된 알레르겐: ${overlap.join(', ')}. 다른 식단을 검토하시거나 수의사 상담을 권해요.`
            : `${dogName}의 등록된 알레르겐 ${dogAllergies.length}개와 겹치는 성분이 없어요.`}
        </p>
      </div>
    </div>
  )
}
