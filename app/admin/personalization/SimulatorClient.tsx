'use client'

import { useMemo, useState } from 'react'
import { decideFirstBox } from '@/lib/personalization/firstBox'
import { decideNextBox } from '@/lib/personalization/nextBox'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import type {
  AlgorithmInput,
  Checkin,
  Formula,
} from '@/lib/personalization/types'

/**
 * 알고리즘 시뮬레이터 — 운영자가 임의 입력으로 결과를 즉시 확인.
 *
 * 알고리즘 자체가 pure function 이라 client-side 에서 그대로 호출. DB 호출
 * 없음, 데이터 저장 없음 — "what-if" 분석 도구.
 *
 * # 두 모드
 *  - First box: decideFirstBox 단독 호출 (설문만으로 결정)
 *  - Next box: decideFirstBox 호출 후 그 결과 + checkin 으로 decideNextBox
 *              (cycle 진행 시뮬레이션)
 */

type Mode = 'first' | 'next'

const ALLERGY_OPTIONS = [
  '닭·칠면조',
  '소고기',
  '양고기',
  '연어·생선',
  '돼지고기',
  '유제품',
  '계란',
  '곡물 (밀/옥수수)',
  '대두',
]

const CHRONIC_OPTIONS = [
  'kidney',
  'arthritis',
  'allergy_skin',
  'ibd',
  'pancreatitis',
  'diabetes',
  'cardiac',
  'liver',
  'dental',
  'epilepsy',
  'stones',
]

const PROTEIN_OPTIONS = ['chicken', 'duck', 'salmon', 'beef', 'pork', 'lamb']

function defaultInput(): AlgorithmInput {
  return {
    dogId: 'sim-dog',
    dogName: '시뮬',
    ageMonths: 36,
    weightKg: 5,
    neutered: true,
    activityLevel: 'medium',
    bcs: 5,
    allergies: [],
    chronicConditions: [],
    pregnancy: 'none',
    careGoal: 'general_upgrade',
    homeCookingExperience: 'occasional',
    currentDietSatisfaction: 4,
    weightTrend6mo: 'stable',
    giSensitivity: 'rare',
    preferredProteins: [],
    indoorActivity: 'moderate',
    dailyKcal: 280,
    dailyGrams: 200,
  }
}

function defaultCheckin(): Checkin {
  return {
    cycleNumber: 1,
    checkpoint: 'week_4',
    stoolScore: 4,
    coatScore: 4,
    appetiteScore: 4,
    overallSatisfaction: 4,
    respondedAt: new Date().toISOString(),
  }
}

export default function SimulatorClient() {
  const [mode, setMode] = useState<Mode>('first')
  const [input, setInput] = useState<AlgorithmInput>(defaultInput())
  const [checkin, setCheckin] = useState<Checkin>(defaultCheckin())

  const result = useMemo<Formula>(() => {
    const firstFormula = decideFirstBox(input)
    if (mode === 'first') return firstFormula
    return decideNextBox({
      previousFormula: firstFormula,
      checkins: [checkin],
      surveyInput: input,
      cycleNumber: 2,
    })
  }, [mode, input, checkin])

  function update<K extends keyof AlgorithmInput>(
    key: K,
    value: AlgorithmInput[K],
  ) {
    setInput((prev) => ({ ...prev, [key]: value }))
  }

  function toggleAllergy(v: string) {
    const next = input.allergies.includes(v)
      ? input.allergies.filter((x) => x !== v)
      : [...input.allergies, v]
    update('allergies', next)
  }

  function toggleChronic(v: string) {
    const next = input.chronicConditions.includes(v)
      ? input.chronicConditions.filter((x) => x !== v)
      : [...input.chronicConditions, v]
    update('chronicConditions', next)
  }

  function toggleProtein(v: string) {
    const next = input.preferredProteins.includes(v)
      ? input.preferredProteins.filter((x) => x !== v)
      : [...input.preferredProteins, v]
    update('preferredProteins', next)
  }

  return (
    <section className="bg-white border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-text">
          시뮬레이션
        </h3>
        <div className="ml-auto flex gap-1.5">
          <button
            onClick={() => setMode('first')}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${
              mode === 'first'
                ? 'bg-text text-white'
                : 'bg-bg text-muted hover:text-text'
            }`}
          >
            First box
          </button>
          <button
            onClick={() => setMode('next')}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${
              mode === 'next'
                ? 'bg-text text-white'
                : 'bg-bg text-muted hover:text-text'
            }`}
          >
            Next box (cycle 2)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* INPUT */}
        <div className="space-y-3">
          <Field label="나이 (개월)">
            <input
              type="number"
              value={input.ageMonths}
              onChange={(e) =>
                update('ageMonths', Math.max(0, Number(e.target.value)))
              }
              className="ft-inp"
            />
          </Field>
          <Field label="체중 (kg)">
            <input
              type="number"
              step={0.1}
              value={input.weightKg}
              onChange={(e) => update('weightKg', Number(e.target.value))}
              className="ft-inp"
            />
          </Field>
          <Field label="BCS (1-9)">
            <input
              type="number"
              min={1}
              max={9}
              value={input.bcs ?? 5}
              onChange={(e) =>
                update('bcs', Number(e.target.value) as AlgorithmInput['bcs'])
              }
              className="ft-inp"
            />
          </Field>
          <Field label="활동량">
            <select
              value={input.activityLevel}
              onChange={(e) =>
                update(
                  'activityLevel',
                  e.target.value as AlgorithmInput['activityLevel'],
                )
              }
              className="ft-inp"
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </Field>
          <Field label="케어 목표">
            <select
              value={input.careGoal ?? 'general_upgrade'}
              onChange={(e) =>
                update('careGoal', e.target.value as AlgorithmInput['careGoal'])
              }
              className="ft-inp"
            >
              <option value="general_upgrade">general_upgrade</option>
              <option value="weight_management">weight_management</option>
              <option value="skin_coat">skin_coat</option>
              <option value="joint_senior">joint_senior</option>
              <option value="allergy_avoid">allergy_avoid</option>
            </select>
          </Field>
          <Field label="화식 경험">
            <select
              value={input.homeCookingExperience ?? 'occasional'}
              onChange={(e) =>
                update(
                  'homeCookingExperience',
                  e.target.value as AlgorithmInput['homeCookingExperience'],
                )
              }
              className="ft-inp"
            >
              <option value="first">first</option>
              <option value="occasional">occasional</option>
              <option value="frequent">frequent</option>
            </select>
          </Field>
          <Field label="GI 민감도">
            <select
              value={input.giSensitivity ?? 'rare'}
              onChange={(e) =>
                update(
                  'giSensitivity',
                  e.target.value as AlgorithmInput['giSensitivity'],
                )
              }
              className="ft-inp"
            >
              <option value="rare">rare</option>
              <option value="sometimes">sometimes</option>
              <option value="frequent">frequent</option>
              <option value="always">always</option>
            </select>
          </Field>
          <Field label="임신/수유">
            <select
              value={input.pregnancy ?? 'none'}
              onChange={(e) =>
                update(
                  'pregnancy',
                  e.target.value as AlgorithmInput['pregnancy'],
                )
              }
              className="ft-inp"
            >
              <option value="none">none</option>
              <option value="pregnant">pregnant</option>
              <option value="lactating">lactating</option>
            </select>
          </Field>

          <Field label="알레르기">
            <div className="flex flex-wrap gap-1.5">
              {ALLERGY_OPTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleAllergy(a)}
                  className={`px-2 py-1 rounded-full text-[10.5px] font-bold ${
                    input.allergies.includes(a)
                      ? 'bg-text text-white'
                      : 'bg-bg-2 text-text border border-rule'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </Field>

          <Field label="만성질환">
            <div className="flex flex-wrap gap-1.5">
              {CHRONIC_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleChronic(c)}
                  className={`px-2 py-1 rounded-full text-[10.5px] font-mono ${
                    input.chronicConditions.includes(c)
                      ? 'bg-terracotta text-white'
                      : 'bg-bg-2 text-text border border-rule'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <Field label="선호 단백질">
            <div className="flex flex-wrap gap-1.5">
              {PROTEIN_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => toggleProtein(p)}
                  className={`px-2 py-1 rounded-full text-[10.5px] font-mono ${
                    input.preferredProteins.includes(p)
                      ? 'bg-text text-white'
                      : 'bg-bg-2 text-text border border-rule'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>

          <Field label="일일 권장 kcal">
            <input
              type="number"
              value={input.dailyKcal}
              onChange={(e) => update('dailyKcal', Number(e.target.value))}
              className="ft-inp"
            />
          </Field>

          {mode === 'next' && (
            <div className="pt-3 border-t border-rule">
              <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted mb-2">
                Next box · 체크인 응답
              </div>
              <Field label="체크포인트">
                <select
                  value={checkin.checkpoint}
                  onChange={(e) =>
                    setCheckin((p) => ({
                      ...p,
                      checkpoint: e.target.value as Checkin['checkpoint'],
                    }))
                  }
                  className="ft-inp"
                >
                  <option value="week_2">week_2</option>
                  <option value="week_4">week_4</option>
                </select>
              </Field>
              <Field label="변 (1-7, 4=이상)">
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={checkin.stoolScore ?? 4}
                  onChange={(e) =>
                    setCheckin((p) => ({
                      ...p,
                      stoolScore: Number(
                        e.target.value,
                      ) as Checkin['stoolScore'],
                    }))
                  }
                  className="ft-inp"
                />
              </Field>
              <Field label="털 (1-5)">
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={checkin.coatScore ?? 4}
                  onChange={(e) =>
                    setCheckin((p) => ({
                      ...p,
                      coatScore: Number(e.target.value) as Checkin['coatScore'],
                    }))
                  }
                  className="ft-inp"
                />
              </Field>
              <Field label="식욕 (1-5)">
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={checkin.appetiteScore ?? 4}
                  onChange={(e) =>
                    setCheckin((p) => ({
                      ...p,
                      appetiteScore: Number(
                        e.target.value,
                      ) as Checkin['appetiteScore'],
                    }))
                  }
                  className="ft-inp"
                />
              </Field>
              <Field label="만족도 (1-5)">
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={checkin.overallSatisfaction ?? 4}
                  onChange={(e) =>
                    setCheckin((p) => ({
                      ...p,
                      overallSatisfaction: Number(
                        e.target.value,
                      ) as Checkin['overallSatisfaction'],
                    }))
                  }
                  className="ft-inp"
                />
              </Field>
            </div>
          )}
        </div>

        {/* OUTPUT */}
        <div>
          <div className="bg-bg-2 rounded-xl p-4 mb-3">
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted mb-2">
              결과 — Line ratios
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-rule mb-3">
              {ALL_LINES.filter((l) => result.lineRatios[l] > 0).map((line) => (
                <div
                  key={line}
                  style={{
                    width: `${result.lineRatios[line] * 100}%`,
                    background: FOOD_LINE_META[line].color,
                  }}
                  title={`${FOOD_LINE_META[line].name} ${(result.lineRatios[line] * 100).toFixed(0)}%`}
                />
              ))}
            </div>
            <ul className="space-y-1">
              {ALL_LINES.map((line) => {
                const pct = Math.round(result.lineRatios[line] * 100)
                return (
                  <li
                    key={line}
                    className={`flex items-center gap-2 text-[11.5px] ${
                      pct === 0 ? 'text-muted' : 'text-text'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: FOOD_LINE_META[line].color }}
                    />
                    <span className="flex-1 font-mono">
                      {FOOD_LINE_META[line].name}
                    </span>
                    <span className="font-black">{pct}%</span>
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 pt-3 border-t border-rule text-[11px] text-muted">
              토퍼: 야채 {Math.round(result.toppers.vegetable * 100)}% · 단백질{' '}
              {Math.round(result.toppers.protein * 100)}%
            </div>
            <div className="text-[10px] text-muted mt-1">
              전환: {result.transitionStrategy} · {result.algorithmVersion}
            </div>
          </div>

          {/* Reasoning */}
          <div className="bg-bg-2 rounded-xl p-4">
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted mb-2">
              Reasoning ({result.reasoning.length})
            </div>
            <ul className="space-y-2">
              {result.reasoning.map((r, i) => (
                <li
                  key={i}
                  className="text-[11.5px] text-text leading-relaxed"
                >
                  <span
                    className="font-mono text-[9.5px] mr-1.5 px-1 rounded"
                    style={{
                      background: 'var(--bg)',
                      color: 'var(--terracotta)',
                    }}
                  >
                    P{r.priority}
                  </span>
                  <strong>{r.chipLabel}</strong>
                  <span className="text-muted block mt-0.5 ml-7">
                    {r.trigger} → {r.action}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <details className="mt-3">
            <summary className="text-[10px] text-muted cursor-pointer font-bold uppercase tracking-[0.2em]">
              Raw JSON
            </summary>
            <pre
              className="mt-2 text-[10px] bg-bg-2 p-3 rounded-xl overflow-auto"
              style={{ maxHeight: 320 }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      </div>

      <style jsx>{`
        .ft-inp {
          width: 100%;
          background: white;
          box-shadow: inset 0 0 0 1px var(--rule);
          border: 0;
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 12px;
          font-family: inherit;
          color: var(--ink);
          outline: 0;
        }
        .ft-inp:focus {
          box-shadow: inset 0 0 0 1.5px var(--ink);
        }
      `}</style>
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
      <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted mb-1">
        {label}
      </div>
      {children}
    </div>
  )
}
