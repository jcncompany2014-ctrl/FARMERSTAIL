'use client'

import { useMemo, useState } from 'react'
import { recommend } from '@/lib/personalization/v3/engine'
import type {
  NeedProfile,
  ConcernKey,
  EvidenceClaim,
} from '@/lib/personalization/v3/types'

/**
 * V3SimulatorClient — 추천 엔진 v3 시뮬레이터 + 결정 trace 뷰어 (admin).
 *
 * v3 는 순수 함수라 서버 왕복 없이 클라이언트에서 즉시 실행. 운영자가 임의
 * NeedProfile + 일일 칼로리를 넣어 "이 강아지엔 v3 가 뭘, 왜 추천?"을 확인:
 *  - 베이스 SKU picks + 믹스 비율 + 검증 효능 문구(등급)
 *  - 후보별 적합도 점수(왜 이 단백질이 1등인지)
 *  - 단계별 결정 trace(필터→need→점수→믹스→그램)
 *  - 레이어 B 소스 라우팅(대기열)
 * = 추천 근거의 완전 투명화(클레임 대응·룰 검증).
 */

const ALLERGY_OPTS = ['닭·칠면조', '오리', '돼지고기', '소고기'] as const
const CONCERN_OPTS: { key: ConcernKey; kr: string }[] = [
  { key: 'skin', kr: '피부·모질' },
  { key: 'joint', kr: '관절' },
  { key: 'digestion', kr: '장·소화' },
  { key: 'immune', kr: '면역' },
]

function gradeColor(grade: EvidenceClaim['grade']): string {
  switch (grade) {
    case 'T1':
      return 'var(--moss)'
    case 'T2':
      return 'var(--ink)'
    case 'T3':
      return 'var(--muted)'
    case 'positioning':
      return 'var(--terracotta)'
  }
}

export default function V3SimulatorClient() {
  const [weightGoal, setWeightGoal] =
    useState<NeedProfile['weightGoal']>('maintain')
  const [activityLevel, setActivityLevel] =
    useState<NeedProfile['activityLevel']>('medium')
  const [appetite, setAppetite] = useState<NeedProfile['appetite']>('normal')
  const [senior, setSenior] = useState(false)
  const [allergies, setAllergies] = useState<string[]>([])
  const [concerns, setConcerns] = useState<ConcernKey[]>([])
  const [dailyKcal, setDailyKcal] = useState(400)
  const [treatPct, setTreatPct] = useState(0)

  const result = useMemo(() => {
    const profile: NeedProfile = {
      weightGoal,
      activityLevel,
      appetite,
      senior,
      allergies,
      functionalConcerns: concerns,
    }
    return recommend(profile, dailyKcal, { treatReductionPct: treatPct })
  }, [
    weightGoal,
    activityLevel,
    appetite,
    senior,
    allergies,
    concerns,
    dailyKcal,
    treatPct,
  ])

  const { layerA, layerB, engineVersion } = result

  const toggle = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]

  return (
    <section className="mt-8 bg-white border border-rule rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-text">
          추천 엔진 v3 시뮬레이터
        </h3>
        <span className="font-mono text-[10px] text-muted">{engineVersion}</span>
      </div>

      {/* 입력 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="체중 목표">
          <Seg
            value={weightGoal}
            opts={[
              ['loss', '감량'],
              ['maintain', '유지'],
              ['gain', '증량'],
            ]}
            onChange={(v) => setWeightGoal(v as NeedProfile['weightGoal'])}
          />
        </Field>
        <Field label="활동량">
          <Seg
            value={activityLevel}
            opts={[
              ['low', '낮음'],
              ['medium', '보통'],
              ['high', '높음'],
            ]}
            onChange={(v) =>
              setActivityLevel(v as NeedProfile['activityLevel'])
            }
          />
        </Field>
        <Field label="식욕">
          <Seg
            value={appetite}
            opts={[
              ['normal', '보통'],
              ['picky', '까다로움'],
              ['low', '저하'],
            ]}
            onChange={(v) => setAppetite(v as NeedProfile['appetite'])}
          />
        </Field>
        <Field label="일일 칼로리(MER)">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={dailyKcal}
              min={50}
              max={4000}
              onChange={(e) => setDailyKcal(Number(e.target.value) || 0)}
              className="w-24 border border-rule rounded-lg px-2 py-1 text-[12px] font-mono"
            />
            <label className="flex items-center gap-1 text-[11px] text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={senior}
                onChange={(e) => setSenior(e.target.checked)}
              />
              시니어
            </label>
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="알레르기 (제외)">
          <div className="flex flex-wrap gap-1.5">
            {ALLERGY_OPTS.map((a) => (
              <Chip
                key={a}
                on={allergies.includes(a)}
                onClick={() => setAllergies((s) => toggle(s, a))}
              >
                {a}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="기능성 우려 (레이어 B)">
          <div className="flex flex-wrap gap-1.5">
            {CONCERN_OPTS.map((c) => (
              <Chip
                key={c.key}
                on={concerns.includes(c.key)}
                onClick={() => setConcerns((s) => toggle(s, c.key))}
              >
                {c.kr}
              </Chip>
            ))}
          </div>
        </Field>
      </div>

      <Field label="간식 차감">
        <Seg
          value={String(treatPct)}
          opts={[
            ['0', '없음'],
            ['0.05', '가끔 5%'],
            ['0.1', '매일 10%'],
          ]}
          onChange={(v) => setTreatPct(Number(v))}
        />
      </Field>

      {/* 결과 */}
      <div className="mt-5 border-t border-rule pt-4">
        {layerA.needsConsultation ? (
          <div className="bg-terracotta/8 border border-terracotta/30 rounded-xl p-4 text-[12.5px] text-text">
            ⚠ 상담 라우팅 — {layerA.consultationReason}
          </div>
        ) : (
          <>
            {/* picks */}
            <div className="space-y-2 mb-4">
              {layerA.picks.map((p) => (
                <div
                  key={p.id}
                  className="bg-paper/40 border border-rule rounded-xl p-3"
                  style={{ background: 'var(--paper, #f4ede0)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[14px] text-ink">
                      {p.nameKr}
                      {p.isPrimary && layerA.picks.length > 1 && (
                        <span className="ml-2 text-[9.5px] font-bold text-moss">
                          주재료
                        </span>
                      )}
                    </span>
                    <span className="font-mono font-bold text-[15px] text-ink">
                      {Math.round(p.ratio * 100)}%
                      <span className="ml-1.5 text-[10px] text-muted font-normal">
                        {p.kcalPer100g}kcal/100g
                      </span>
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {p.claims.map((c, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-1.5 text-[11.5px] text-text"
                      >
                        <span
                          className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: gradeColor(c.grade) }}
                          title={`${c.grade} · ${c.basis}`}
                        />
                        <span>
                          {c.text}{' '}
                          <span className="font-mono text-[9px] text-muted">
                            [{c.grade}]
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* 그램 + 교차반응 */}
            <div className="flex items-center gap-4 text-[12px] mb-4 font-mono">
              <span className="text-ink font-bold">
                {layerA.dailyGrams}g/일
              </span>
              <span className="text-muted">
                혼합 {layerA.blendedKcalPer100g}kcal/100g
              </span>
              {layerA.crossReactWarnings.length > 0 && (
                <span className="text-terracotta">
                  ⚠ 교차반응{' '}
                  {layerA.crossReactWarnings
                    .map((w) => w.allergyLabel)
                    .join(',')}
                </span>
              )}
            </div>
          </>
        )}

        {/* 점수 */}
        {layerA.scores.length > 0 && (
          <TraceBlock title="후보 적합도 점수">
            <div className="flex flex-wrap gap-2">
              {layerA.scores.map((s) => (
                <span
                  key={s.protein}
                  className="font-mono text-[11px] px-2 py-0.5 rounded bg-paper border border-rule"
                  style={{ background: 'var(--paper, #f4ede0)' }}
                >
                  {s.protein} <b>{s.score}</b>
                </span>
              ))}
            </div>
          </TraceBlock>
        )}

        {/* trace */}
        <TraceBlock title="결정 trace">
          <ol className="space-y-1">
            {layerA.trace.map((t, i) => (
              <li key={i} className="flex gap-2 text-[11px]">
                <span className="font-bold text-moss shrink-0 w-20">
                  {t.step}
                </span>
                <span className="text-muted">{t.detail}</span>
              </li>
            ))}
          </ol>
        </TraceBlock>

        {/* 레이어 B */}
        <TraceBlock title="레이어 B 소스 라우팅">
          {layerB.routes.length === 0 ? (
            <p className="text-[11px] text-muted">기능성 우려 없음</p>
          ) : (
            <ul className="space-y-1">
              {layerB.routes.map((r) => (
                <li key={r.concern} className="text-[11px] text-text">
                  <span className="font-mono text-muted">{r.concern}</span> →{' '}
                  {r.sourceNameKr ?? '소스 없음'}{' '}
                  <span
                    className={
                      r.available ? 'text-moss' : 'text-terracotta'
                    }
                  >
                    ({r.available ? '출시' : '준비중'})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TraceBlock>
      </div>
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-wide uppercase text-muted mb-1.5">
        {label}
      </div>
      {children}
    </div>
  )
}

function Seg({
  value,
  opts,
  onChange,
}: {
  value: string
  opts: [string, string][]
  onChange: (v: string) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-rule overflow-hidden">
      {opts.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={
            'px-2.5 py-1 text-[11px] font-bold ' +
            (value === v
              ? 'bg-terracotta text-white'
              : 'bg-white text-muted hover:text-text')
          }
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'px-2.5 py-1 rounded-full text-[11px] font-bold border ' +
        (on
          ? 'bg-terracotta text-white border-terracotta'
          : 'bg-white text-muted border-rule hover:text-text')
      }
    >
      {children}
    </button>
  )
}

function TraceBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-3 bg-paper/30 rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.02)' }}>
      <div className="text-[9.5px] font-bold tracking-[0.15em] uppercase text-muted mb-2">
        {title}
      </div>
      {children}
    </div>
  )
}
