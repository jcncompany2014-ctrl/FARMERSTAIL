/**
 * 분석 히스토리 그리기 — 데이터 조회·판정은 page.tsx 가 하고, 여기는 받은 행을 시안 순서대로 놓는다.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 A06): 머리말(머스타드 네모) + 제목 글꼴 32 → 최신 분석 = 머스타드 바탕
 *   도장 그림자 카드(이 화면의 핵심) → 지난 분석 = 세로 줄 + 네모 점 + 회색 면 카드(왼쪽 6px 띠) → 다시 분석 버튼.
 *   'MER'·'체형 5/9' 같은 표기는 "하루 열량"·"알맞음"으로(규칙44 · 사장님 결정 목록). 이모지(🔄·⚠️)는 뺐다.
 *   점검 화면(/design-check/analysis)이 같은 컴포넌트에 예시 행을 넣어 로그인 없이 본다 — 그래서 페이지에서 뺐다.
 */

import Link from 'next/link'
import { petName, kgNumber } from '@/lib/korean'
import { V3, V3Shadow } from '@/lib/design/tokens'
import { bodyShape } from '@/components/analysis/display'

/** RER = 70 · w^0.75 → w = (RER / 70)^(4/3) */
function weightFromRER(rer: number): number {
  return Math.pow(rer / 70, 4 / 3)
}

export type AnalysisHistoryRow = {
  id: string
  created_at: string
  mer: number
  rer: number
  stage: string
  bcs_label: string
  bcs_score: number
  feed_g: number
  protein_pct: number
  fat_pct: number
  guideline_version: string | null
  carb_pct: number | null
  fiber_pct: number | null
  vet_consult_recommended: boolean | null
  next_review_date: string | null
  commentary: string | null
  supplements: string[] | null
  /** survey | growth_auto(자견 월간 성장 자동 갱신, 2026-10-01) */
  source: string | null
  /** 자견 월간 자동 갱신 기록인가 — 판정은 page.tsx(a.source === 'growth_auto', 규칙150). */
  isGrowthAuto: boolean
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  })
}

/** 변화 한 줄 — ▲/▼ 값(단위). 거의 같으면 "변화 없음". 체중·체형 방향은 좋고 나쁨이 아니라 회색. */
function Delta({ value, unit, neutral = false, digits = 1 }: { value: number; unit: string; neutral?: boolean; digits?: number }) {
  if (Math.abs(value) < 0.05) {
    return <span style={{ fontSize: 13, fontWeight: 700, color: V3.inkMute }}>변화 없음</span>
  }
  const up = value > 0
  const n = digits === 0 ? Math.round(Math.abs(value)).toString() : Math.abs(value).toFixed(digits)
  return (
    <span style={{ fontSize: 13, fontWeight: neutral ? 700 : 800, color: neutral ? V3.inkMute : V3.ink }}>
      {up ? '▲' : '▼'} {n}
      {unit}
    </span>
  )
}

export default function AnalysesHistoryView({
  dogId,
  dogName,
  analyses,
  latestIsStale,
}: {
  dogId: string
  dogName: string
  /** 최신순. */
  analyses: AnalysisHistoryRow[]
  latestIsStale: boolean
}) {
  return (
    // 줄 높이는 시안과 같은 기본값(normal).
    <div style={{ paddingBottom: 28, color: V3.ink, lineHeight: 'normal' }}>
      {/* 헤더 */}
      <section style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: V3.inkMute }}>
          <span aria-hidden style={{ width: 8, height: 8, background: V3.mustard }} />
          분석 기록
        </span>
        <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>분석 히스토리</h1>
        <span style={{ fontSize: 15, color: V3.inkSoft }}>
          {/* 자견은 매달 성장에 맞춰 자동으로 다시 계산된 기록도 쌓인다(source growth_auto). */}
          맞춤 분석 기록 · 총 {analyses.length}회
        </span>
      </section>

      {/* v1.6.1 audit (2026-05-05) 이전 분석은 급여량 계산이 부정확할 수 있다 — 재분석 권장 */}
      {latestIsStale && (
        <section
          style={{
            margin: '18px 20px 0',
            padding: '14px 16px',
            borderRadius: 4,
            background: V3.soft,
            borderLeft: `6px solid ${V3.mustard}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            wordBreak: 'keep-all',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 800 }}>알고리즘이 업데이트됐어요</span>
          <span style={{ fontSize: 15, lineHeight: 1.55, color: V3.inkSoft }}>
            체형 / 임신·수유 / 급여량 계산 정확도 향상 (수의영양 최신 기준 반영). 더 정확한 결과를 위해 다시 분석을 받아주세요.
          </span>
          <Link
            href={`/dogs/${dogId}/survey`}
            style={{
              alignSelf: 'flex-start',
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              fontSize: 15,
              fontWeight: 800,
              color: V3.ink,
              textDecoration: 'underline',
              textUnderlineOffset: 4,
            }}
          >
            새 설문으로 다시 분석 →
          </Link>
        </section>
      )}

      {analyses.length === 0 ? (
        <section
          style={{
            margin: '28px 20px 0',
            padding: '44px 22px 32px',
            border: `1.5px dashed ${V3.inkFaint}`,
            borderRadius: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              background: V3.soft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: V3.inkSoft,
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="4" width="14" height="17" rx="1.5" />
              <path d="M9 4V3h6v1" />
              <path d="M9 10h6M9 14h6M9 18h3" />
            </svg>
          </span>
          <h2 style={{ margin: '20px 0 0', fontSize: 26, lineHeight: 1.15 }}>아직 분석 기록이 없어요</h2>
          <p style={{ margin: '12px 0 0', fontSize: 17, lineHeight: 1.6, color: V3.inkSoft }}>
            설문을 마치면 분석 결과가 여기에 쌓여요.
          </p>
          <Link
            href={`/dogs/${dogId}/survey`}
            style={{
              marginTop: 26,
              alignSelf: 'stretch',
              height: 58,
              borderRadius: 4,
              background: V3.ink,
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            설문 시작하기
          </Link>
        </section>
      ) : (
        <>
          {/* LATEST 분석 hero — 사용자가 페이지 들어왔을 때 한눈에 처방 핵심 */}
          <LatestAnalysisHero dogId={dogId} dogName={dogName} analysis={analyses[0]!} isStale={latestIsStale} />

          {/* 이전 분석 timeline — 최신은 hero 가 표시하므로 2번째부터만 */}
          {analyses.length > 1 && (
            <section aria-labelledby="past-title" style={{ margin: '34px 20px 0', display: 'flex', flexDirection: 'column' }}>
              {/* h2 는 앱 틀에서 제목 글꼴이 된다 — 이 머리말은 본문 굵은 글자(시안)라 h3. */}
              <h3 id="past-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800 }}>
                <span aria-hidden style={{ width: 16, height: 2, background: V3.mustard }} />
                지난 분석
              </h3>
              <ol
                style={{
                  position: 'relative',
                  margin: '12px 0 0',
                  padding: 0,
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* 세로 타임라인 축 */}
                <span aria-hidden style={{ position: 'absolute', left: 7, top: 22, bottom: 22, width: 1.5, background: '#D5D3D4' }} />
                {analyses.slice(1).map((a, idx0) => {
                  const idx = idx0 + 1 // 원본 array index (hero 가 0 차지)
                  // 이전(더 오래된) 분석과 비교 — 리스트는 최신순이므로 idx+1이 이전
                  const prev = analyses[idx + 1]
                  const weight = weightFromRER(Number(a.rer))
                  const prevWeight = prev ? weightFromRER(Number(prev.rer)) : null
                  const dWeight = prevWeight !== null ? weight - prevWeight : 0
                  const dMer = prev ? a.mer - prev.mer : 0
                  const dBcs = prev ? a.bcs_score - prev.bcs_score : 0
                  return (
                    <li key={a.id} style={{ position: 'relative', paddingLeft: 28 }}>
                      {/* 타임라인 점 — 가장 가까운 지난 분석은 먹색, 그 앞은 회색 */}
                      <span
                        aria-hidden
                        style={{
                          position: 'absolute',
                          left: 2,
                          top: 20,
                          width: 12,
                          height: 12,
                          boxSizing: 'border-box',
                          background: idx0 === 0 ? V3.ink : '#8A8A8A',
                          border: '2px solid #FFFFFF',
                        }}
                      />
                      <Link
                        href={`/dogs/${dogId}/analyses/${a.id}`}
                        className="transition active:scale-[0.99]"
                        style={{
                          padding: 14,
                          borderRadius: 4,
                          color: V3.ink,
                          textDecoration: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                          background: V3.soft,
                          borderLeft: `6px solid ${V3.mustard}`,
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <span style={{ fontSize: 17, fontWeight: 800 }}>{formatDate(a.created_at)}</span>
                            {a.isGrowthAuto && (
                              <span
                                style={{
                                  height: 24,
                                  padding: '0 7px',
                                  boxSizing: 'border-box',
                                  borderRadius: 4,
                                  border: `1.5px solid ${V3.ink}`,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                매달 자동 갱신
                              </span>
                            )}
                          </span>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
                            <path d="M9 6l6 6-6 6" />
                          </svg>
                        </span>

                        <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                          <Cell label="하루 열량">
                            <span style={{ whiteSpace: 'nowrap' }}>
                              <span className="ft-num" style={{ fontSize: 20 }}>
                                {a.mer.toLocaleString()}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 700 }}> kcal</span>
                            </span>
                            {prev && <Delta value={dMer} unit="" digits={0} />}
                          </Cell>
                          <Cell label="체중">
                            <span style={{ whiteSpace: 'nowrap' }}>
                              <span className="ft-num" style={{ fontSize: 20 }}>
                                {kgNumber(weight)}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 700 }}> kg</span>
                            </span>
                            {prev && <Delta value={dWeight} unit="kg" neutral />}
                          </Cell>
                          <Cell label="체형">
                            <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.45 }}>
                              {bodyShape(a.bcs_score, a.bcs_label).word}
                            </span>
                            {prev && <Delta value={dBcs} unit="단계" neutral digits={0} />}
                          </Cell>
                        </span>

                        <span style={{ fontSize: 14, color: V3.inkMute }}>
                          {a.stage} · 급여량 {a.feed_g}g
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </section>
          )}

          <Link
            href={`/dogs/${dogId}/survey`}
            style={{
              margin: '22px 20px 0',
              height: 52,
              boxSizing: 'border-box',
              borderRadius: 4,
              border: `1.5px solid ${V3.ink}`,
              color: V3.ink,
              fontSize: 16,
              fontWeight: 800,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            새 설문으로 다시 분석하기
          </Link>
        </>
      )}
    </div>
  )
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: 10,
        borderRadius: 4,
        background: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 13, color: V3.inkMute }}>{label}</span>
      {children}
    </span>
  )
}

/**
 * Latest 분석 hero 카드.
 *
 * 사용자가 분석 페이지 들어왔을 때 가장 먼저 보이는 영역. 핵심 stat (하루 열량 /
 * 급여량 / 체중) + 영양소 분포 막대 + 영양 도우미 첫 줄 + CTA (전체 분석 결과).
 * 2026-10-09 앱 새 디자인: 머스타드 바탕 + 먹선 2px + 도장 그림자(이 화면의 핵심 카드).
 */
function LatestAnalysisHero({
  dogId,
  dogName,
  analysis,
  isStale,
}: {
  dogId: string
  dogName: string
  analysis: AnalysisHistoryRow
  isStale: boolean
}) {
  const weight = weightFromRER(Number(analysis.rer))
  const protein = analysis.protein_pct ?? 0
  const fat = analysis.fat_pct ?? 0
  const carb = analysis.carb_pct ?? Math.max(0, 100 - protein - fat - (analysis.fiber_pct ?? 0))
  // 단축 코멘터리 (첫 문장 또는 80자)
  const commentSnippet = analysis.commentary
    ? (analysis.commentary.split(/[.!?。]\s*/)[0] ?? '').slice(0, 90)
    : null
  const stat = (label: string, value: string, unit: string, i: number) => (
    <span
      style={{
        padding: i === 0 ? '12px 6px 12px 0' : i === 1 ? '12px 6px 12px 12px' : '12px 0 12px 12px',
        borderLeft: i > 0 ? '1px solid rgba(20,20,20,0.2)' : 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 13 }}>{label}</span>
      <span style={{ whiteSpace: 'nowrap' }}>
        <span className="ft-num" style={{ fontSize: 26 }}>
          {value}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700 }}> {unit}</span>
      </span>
    </span>
  )

  return (
    <section
      aria-label="최신 분석"
      style={{
        margin: '22px 20px 0',
        padding: 18,
        border: `2px solid ${V3.ink}`,
        boxShadow: V3Shadow.stamp,
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        background: V3.mustard,
        color: V3.ink,
        wordBreak: 'keep-all',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 800 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill={V3.ink} aria-hidden>
            <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
          </svg>
          최신 분석
        </span>
        <span style={{ fontSize: 13 }}>{formatDate(analysis.created_at)}</span>
      </span>

      {/* 이 아이 이름을 앵커로 — 감정 훅. 제목 글꼴은 앱 틀의 h2 규칙. */}
      <h2 style={{ margin: '12px 0 0', fontSize: 26, lineHeight: 1.15 }}>{petName(dogName)}의 맞춤 영양 설계</h2>
      <span style={{ marginTop: 6, fontSize: 15 }}>
        {analysis.stage} · 체형 {bodyShape(analysis.bcs_score, analysis.bcs_label).word}
      </span>

      {/* 핵심 지표 — 줄로 나눈 3칸. 숫자는 Anton. */}
      <div
        style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          borderTop: `1.5px solid ${V3.ink}`,
          borderBottom: '1px solid rgba(20,20,20,0.2)',
        }}
      >
        {stat('하루 열량', `${Math.round(analysis.mer)}`, 'kcal', 0)}
        {stat('권장 급여량', `${analysis.feed_g}`, 'g/일', 1)}
        {stat('체중', kgNumber(weight), 'kg', 2)}
      </div>

      {/* 영양소 분포 — 정확한 성분% 노출 금지(2026-07-18) — 막대·범례로 비율만 시각화,
          숫자 readout 없음. [[feedback_no_exact_nutrient_percent]] */}
      <span style={{ marginTop: 16, fontSize: 14, fontWeight: 700 }}>영양소 분포</span>
      <div aria-hidden style={{ marginTop: 8, height: 12, display: 'flex', gap: 2, background: 'rgba(255,255,255,0.5)' }}>
        <span style={{ width: `${protein}%`, background: V3.ink }} />
        <span style={{ width: `${fat}%`, background: '#8A8A8A' }} />
        <span style={{ width: `${carb}%`, background: '#CFCDCE' }} />
      </div>
      <span style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 14 }}>
        {[
          [V3.ink, '단백질'],
          ['#8A8A8A', '지방'],
          ['#CFCDCE', '탄수화물'],
        ].map(([c, l]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden style={{ width: 10, height: 10, background: c }} />
            {l}
          </span>
        ))}
      </span>

      {/* 영양 도우미 한마디 snippet (있으면). */}
      {commentSnippet && (
        <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.55 }}>
          <strong style={{ fontWeight: 800 }}>영양 도우미</strong> {commentSnippet}
          {commentSnippet.length >= 90 ? '…' : ''}
        </p>
      )}

      {/* CTA — 전체 분석 결과(영양 분석 + 추천 박스 + 정기배송)로 직행(단일 CTA). */}
      <Link
        href={`/dogs/${dogId}/analysis`}
        className="transition active:scale-[0.98]"
        style={{
          marginTop: 18,
          height: 56,
          borderRadius: 4,
          background: V3.ink,
          color: '#FFFFFF',
          fontSize: 17,
          fontWeight: 800,
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        전체 분석 결과 보기
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>

      {/* 메타 — 다음 분석 권장일 / 수의사 상담 추천 */}
      {(analysis.next_review_date || analysis.vet_consult_recommended) && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid rgba(20,20,20,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: 14,
          }}
        >
          {analysis.next_review_date && <span>다음 분석 권장: {formatDate(analysis.next_review_date)}</span>}
          {analysis.vet_consult_recommended && <span style={{ fontWeight: 800 }}>수의사 상담을 권장해요</span>}
        </div>
      )}

      {/* stale 안내 inline (헤더 banner 와 별개) */}
      {isStale && (
        <p style={{ margin: '12px 0 0', padding: '8px 10px', borderRadius: 4, background: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.5 }}>
          알고리즘 업데이트 전 분석이에요 — 정확도를 위해 다시 분석해 주세요
        </p>
      )}
    </section>
  )
}
