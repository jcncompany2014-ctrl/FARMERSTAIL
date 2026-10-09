/**
 * 하루 필요 에너지 카드 — 큰 kcal + 범위 막대 + 계산식·계수 사다리.
 * (Magazine DailyEnergyCard 에서 출발 — 2026-05-21 핸드오프.)
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 D08): 이 화면의 핵심 숫자 상자 — 머스타드 바탕 + 먹선 2px +
 *   도장 그림자(한 화면 한 곳). 큰 숫자는 Anton(.ft-num). 세는 움직임(CountUp)은 걷었다(정적 포스터).
 *   계산식 표기: "RER 429 × 1.40 · NRC" → "기초 에너지 429 × 1.4"(사장님 결정 목록 — 전문용어·기준 약어 빼기).
 *   숫자 자체(429·1.4·600)는 그대로다 — 말만 바꿨다.
 */

import { petName } from '@/lib/korean'
import { V3, V3Shadow } from '@/lib/design/tokens'
import { factorText, numTopic } from '../display'

export interface DailyEnergyData {
  /** 하루 필요 kcal */
  mer: number
  /** 기초 에너지 kcal/일 */
  rer: number
  /** 활동·중성화 등 합산 계수 */
  factor: number
  /** 신뢰구간 하한 kcal */
  merMin: number
  /** 신뢰구간 상한 kcal */
  merMax: number
  /**
   * 칼로리 v2 6단계 — 계수 사다리 (analyses.factor_breakdown).
   * [0] = 기본값(또는 성장기·감량 등 단일 요약), 이후 = 부호 있는 가산/감산.
   * 과거 분석(v2 이전)은 없음 → 사다리 생략.
   */
  breakdown?: { label: string; delta: number }[] | null
}

export function DailyEnergyCard({ data, dogName }: { data: DailyEnergyData; dogName: string }) {
  const range = Math.max(1, data.merMax - data.merMin)
  const pct = Math.max(0, Math.min(100, ((data.mer - data.merMin) / range) * 100))
  const factor = factorText(data.factor)
  const ladder = data.breakdown && data.breakdown.length > 0 ? data.breakdown : null

  return (
    <section
      aria-label="하루 필요 에너지"
      style={{
        margin: '22px 20px 0',
        padding: '18px 18px 16px',
        border: `2px solid ${V3.ink}`,
        boxShadow: V3Shadow.stamp,
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        background: V3.mustard,
        color: V3.ink,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 800 }}>하루 필요 에너지</span>
      <span style={{ marginTop: 2, fontSize: 15 }}>
        {petName(dogName)}가 하루 체중을 유지하는 데 필요한 에너지
      </span>
      <span style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
        <span className="ft-num" style={{ fontSize: 84, lineHeight: 0.95 }}>
          {Math.round(data.mer)}
        </span>
        <span className="ft-poster" style={{ fontSize: 24 }}>
          kcal
        </span>
      </span>

      {/* 범위 막대 — 지금 값이 신뢰구간 어디쯤인지(숫자는 아래 줄). */}
      <div
        aria-hidden
        style={{ marginTop: 14, position: 'relative', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.5)' }}
      >
        <span
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 4, background: V3.ink }}
        />
        <span
          style={{
            position: 'absolute',
            left: `${pct}%`,
            top: -5,
            width: 18,
            height: 18,
            boxSizing: 'border-box',
            marginLeft: -9,
            borderRadius: 9,
            background: '#FFFFFF',
            border: `2px solid ${V3.ink}`,
          }}
        />
      </div>
      <span style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span>최소 {data.merMin}</span>
        <span style={{ fontWeight: 800 }}>지금 {Math.round(data.mer)}kcal</span>
        <span>최대 {data.merMax}</span>
      </span>

      <div
        style={{
          marginTop: 16,
          padding: '12px 14px',
          borderRadius: 4,
          background: 'rgba(255,255,255,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute }}>계산식</span>
          <span style={{ fontSize: 17, fontWeight: 800, whiteSpace: 'nowrap' }}>
            기초 에너지 {Math.round(data.rer)} × {factor}
          </span>
        </span>
        {/* 계수 사다리 — 스펙 v2 §5 "계수 근거 노출 = 투명성이 곧 마케팅 자산". */}
        {ladder && (
          <>
            <span
              style={{ paddingTop: 10, borderTop: '1px solid #E0DDDE', fontSize: 14, fontWeight: 700, color: V3.inkMute }}
            >
              {numTopic(factor)} 이렇게 나왔어요
            </span>
            {ladder.map((line, i) => (
              <span
                key={`${line.label}-${i}`}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15 }}
              >
                <span style={{ color: V3.inkSoft, lineHeight: 1.45 }}>{line.label}</span>
                <strong style={{ fontWeight: 800, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {i === 0 ? factorText(line.delta) : `${line.delta < 0 ? '−' : '+'}${factorText(line.delta)}`}
                </strong>
              </span>
            ))}
          </>
        )}
      </div>

      {/* 개체차 안내 — 스펙 v2 §7: 시작 추정치임을 수치 옆에서 정직하게. */}
      <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.6 }}>
        같은 조건이라도 아이마다 필요한 열량은 꽤 달라요. 이 숫자는 시작점이에요 — 2~4주 체중 변화를 보고 조금씩
        맞춰가요.
      </p>
    </section>
  )
}
