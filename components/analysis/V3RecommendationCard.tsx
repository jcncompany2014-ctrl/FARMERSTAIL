'use client'

import type { CSSProperties } from 'react'
import { Sparkles, AlertCircle, Clock, Beaker } from 'lucide-react'
import type {
  RecommendationResult,
  SkuPick,
  EvidenceClaim,
  ConcernKey,
} from '@/lib/personalization/v3/types'

/**
 * V3RecommendationCard — 추천 엔진 v3 결과 표시(app-only).
 *
 * 2-레이어 추천을 보호자에게 보여준다:
 *  - 레이어 A(밥): 베이스 SKU 1~2종 + 믹스 비율 + 검증된 효능 문구 + 급여 그램.
 *  - 레이어 B(소스): 기능성 우려 → 준비중 소스 대기열(출시 알림).
 *  - 다중 알레르기 등으로 후보 0 → 맞춤 상담 안내.
 *
 * recommendation=null/undefined(레거시 formula·v3 미생성)면 아무것도 안 그림.
 * 효능 문구는 catalog SSOT(마스터레시피 충족률 검증) — 여기선 그대로 노출만.
 */

const CONCERN_KR: Record<ConcernKey, string> = {
  skin: '피부·모질',
  joint: '관절',
  digestion: '장·소화',
  immune: '면역',
}

/** 근거 등급별 점 색 — T1(함량 사실)=강조, T3(완곡)=옅게. */
function claimDot(grade: EvidenceClaim['grade']): string {
  switch (grade) {
    case 'T1':
      return 'var(--moss, #4f6a48)'
    case 'T2':
      return 'var(--ink, #16140f)'
    case 'T3':
      return 'var(--muted, #706854)'
    case 'positioning':
      return 'var(--terracotta, #c4623f)'
  }
}

export default function V3RecommendationCard({
  recommendation,
}: {
  recommendation: RecommendationResult | null | undefined
}) {
  if (!recommendation) return null
  const { layerA, layerB } = recommendation

  // ── 상담 라우팅 (후보 0) ──
  if (layerA.needsConsultation) {
    return (
      <section style={shell}>
        <div style={headerRow}>
          <span style={kicker}>
            <Sparkles size={11} strokeWidth={2.4} />
            맞춤 추천
          </span>
        </div>
        <div style={consultBox}>
          <AlertCircle
            size={16}
            strokeWidth={2}
            color="var(--terracotta, #c4623f)"
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink)' }}>
            {layerA.consultationReason ??
              '맞춤 추천을 위해 상담이 필요해요.'}
          </p>
        </div>
      </section>
    )
  }

  const isMix = layerA.picks.length > 1

  return (
    <section style={shell}>
      <div style={headerRow}>
        <span style={kicker}>
          <Sparkles size={11} strokeWidth={2.4} />
          맞춤 베이스 레시피
        </span>
        <span style={mixTag}>{isMix ? '2종 믹스' : '단일 레시피'}</span>
      </div>

      {/* 베이스 SKU picks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {layerA.picks.map((p) => (
          <PickRow key={p.id} pick={p} showRatio={isMix} />
        ))}
      </div>

      {/* 교차반응 주의 */}
      {layerA.crossReactWarnings.length > 0 && (
        <div style={warnRow}>
          <AlertCircle size={12} strokeWidth={2} color="var(--terracotta, #c4623f)" />
          <span>
            {layerA.crossReactWarnings
              .map((w) => `${w.allergyLabel} 알레르기 — 교차반응 가능(관찰 권장)`)
              .join(' · ')}
          </span>
        </div>
      )}

      {/* 급여 그램 요약 */}
      <div style={gramsRow}>
        <div>
          <div style={statLabel}>하루 권장량</div>
          <div style={statValue}>
            {layerA.dailyGrams.toLocaleString()}
            <small style={{ fontSize: 11, fontWeight: 600 }}> g/일</small>
          </div>
        </div>
        <div>
          <div style={statLabel}>혼합 열량</div>
          <div style={statValue}>
            {layerA.blendedKcalPer100g}
            <small style={{ fontSize: 11, fontWeight: 600 }}> kcal/100g</small>
          </div>
        </div>
        <div>
          <div style={statLabel}>하루 칼로리</div>
          <div style={statValue}>
            {layerA.dailyKcal}
            <small style={{ fontSize: 11, fontWeight: 600 }}> kcal</small>
          </div>
        </div>
      </div>

      {/* 레이어 B — 기능성 소스 대기열 */}
      {layerB.waitlistConcerns.length > 0 && (
        <div style={sourceBox}>
          <div style={sourceHead}>
            <Beaker size={12} strokeWidth={2} color="var(--moss, #4f6a48)" />
            맞춤 기능성 토퍼 — 준비 중
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {layerB.waitlistConcerns.map((c) => (
              <span key={c} style={sourceChip}>
                <Clock size={10} strokeWidth={2.2} />
                {CONCERN_KR[c]} 보완
              </span>
            ))}
          </div>
          <p style={sourceFoot}>
            {CONCERN_KR[layerB.waitlistConcerns[0]!]} 등 우려에 맞춘 기능성 토퍼를
            준비하고 있어요. 출시되면 알려드릴게요.
          </p>
        </div>
      )}
    </section>
  )
}

function PickRow({ pick, showRatio }: { pick: SkuPick; showRatio: boolean }) {
  return (
    <article style={pickCard} data-primary={pick.isPrimary}>
      <div style={pickHead}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={pickName}>{pick.nameKr}</span>
          {pick.isPrimary && showRatio && <span style={primaryTag}>주재료</span>}
        </div>
        {showRatio ? (
          <span style={pickRatio}>{Math.round(pick.ratio * 100)}%</span>
        ) : (
          <span style={pickKcal}>{pick.kcalPer100g} kcal/100g</span>
        )}
      </div>
      <ul style={claimList}>
        {pick.claims.map((c, i) => (
          <li key={i} style={claimItem}>
            <span
              style={{
                ...claimDotStyle,
                background: claimDot(c.grade),
              }}
            />
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

// ── 스타일 (app v3 톤: radius 4/12, paper/ink 토큰) ──
const shell: CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 12,
  background: 'var(--paper-hi, #faf6ec)',
  border: '1px solid var(--rule, rgba(22,20,15,0.1))',
}
const headerRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
}
const kicker: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 11.5,
  fontWeight: 800,
  letterSpacing: '0.01em',
  color: 'var(--ink, #16140f)',
}
const mixTag: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--muted, #706854)',
  background: 'var(--paper, #f4ede0)',
  border: '1px solid var(--rule, rgba(22,20,15,0.1))',
  borderRadius: 999,
  padding: '2px 8px',
}
const pickCard: CSSProperties = {
  padding: 12,
  borderRadius: 4,
  background: 'var(--paper, #f4ede0)',
  border: '1px solid var(--rule, rgba(22,20,15,0.08))',
}
const pickHead: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
}
const pickName: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: 'var(--ink, #16140f)',
}
const primaryTag: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  color: 'var(--moss, #4f6a48)',
  background: 'rgba(79,106,72,0.1)',
  borderRadius: 999,
  padding: '1px 7px',
}
const pickRatio: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: 'var(--ink, #16140f)',
  fontFamily: 'var(--font-mono), monospace',
}
const pickKcal: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--muted, #706854)',
}
const claimList: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
}
const claimItem: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 7,
  fontSize: 12,
  lineHeight: 1.45,
  color: 'var(--ink-soft, #3a342a)',
}
const claimDotStyle: CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: 999,
  marginTop: 6,
  flexShrink: 0,
}
const warnRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginTop: 10,
  fontSize: 11,
  color: 'var(--terracotta, #c4623f)',
  fontWeight: 600,
}
const gramsRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
  marginTop: 12,
  padding: '12px 0 0',
  borderTop: '1px solid var(--rule, rgba(22,20,15,0.08))',
}
const statLabel: CSSProperties = {
  fontSize: 10,
  color: 'var(--muted, #706854)',
  marginBottom: 2,
}
const statValue: CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  color: 'var(--ink, #16140f)',
}
const sourceBox: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 4,
  background: 'rgba(79,106,72,0.06)',
  border: '1px solid rgba(79,106,72,0.16)',
}
const sourceHead: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11.5,
  fontWeight: 700,
  color: 'var(--ink, #16140f)',
  marginBottom: 8,
}
const sourceChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 10.5,
  fontWeight: 700,
  color: 'var(--moss, #4f6a48)',
  background: 'var(--paper-hi, #faf6ec)',
  border: '1px solid rgba(79,106,72,0.2)',
  borderRadius: 999,
  padding: '3px 9px',
}
const sourceFoot: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 10.5,
  lineHeight: 1.5,
  color: 'var(--muted, #706854)',
}
const consultBox: CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: 12,
  borderRadius: 4,
  background: 'rgba(196,98,63,0.06)',
  border: '1px solid rgba(196,98,63,0.18)',
}
