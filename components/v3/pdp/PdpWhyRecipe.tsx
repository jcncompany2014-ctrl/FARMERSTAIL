/**
 * PdpWhyRecipe — "왜 이 레시피?" editorial 블록.
 *
 * 핸드오프 패턴 (item 64):
 *   - heading "왜 이 레시피?" — 22px sans 800
 *   - numbered editorial sections:
 *       1/ 큰 sans 800 번호 + 항목명 → 본문
 *       2/ ...
 *       3/ ...
 *   - 사용자 요청대로 italic serif 폐기 — 번호도 sans bold.
 *   - 각 항목은 paperHi card + 1px rule 또는 stacked + ink rule 사이.
 */

import { V3, V3FontWeight } from '@/lib/design/tokens'

export interface WhyReason {
  /** "단백질 28%" / "Bexley 알러지" / "칼슘:인 1.2:1" 등. */
  title: string
  /** 본문 — 2-3줄 권장. */
  body: string
}

interface PdpWhyRecipeProps {
  /** Section heading. 기본 "왜 이 레시피?". */
  heading?: string
  reasons: WhyReason[]
}

export default function PdpWhyRecipe({
  heading = '왜 이 레시피?',
  reasons,
}: PdpWhyRecipeProps) {
  if (reasons.length === 0) return null

  return (
    <section style={{ padding: '0 20px 28px' }}>
      <h2
        style={{
          margin: '0 0 14px',
          fontFamily: 'var(--font-sans)',
          fontWeight: V3FontWeight.black,
          fontSize: 22,
          color: V3.ink,
          letterSpacing: '-0.025em',
          wordBreak: 'keep-all',
        }}
      >
        {heading}
      </h2>

      <div className="flex flex-col" style={{ gap: 0 }}>
        {reasons.map((r, i) => (
          <div
            key={i}
            style={{
              padding: '16px 0',
              borderTop: i === 0 ? 'none' : `1px solid ${V3.rule}`,
            }}
          >
            <div className="flex items-baseline" style={{ gap: 14 }}>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: V3FontWeight.display, // 900
                  fontSize: 28,
                  color: V3.accent,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  minWidth: 36,
                }}
                aria-hidden
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: V3FontWeight.bold,
                  fontSize: 16,
                  color: V3.ink,
                  letterSpacing: '-0.015em',
                  wordBreak: 'keep-all',
                }}
              >
                {r.title}
              </span>
            </div>
            <p
              style={{
                margin: '8px 0 0',
                paddingLeft: 50, // align under title
                fontFamily: 'var(--font-sans)',
                fontSize: 13.5,
                color: V3.inkSoft,
                lineHeight: 1.55,
                wordBreak: 'keep-all',
              }}
            >
              {r.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
