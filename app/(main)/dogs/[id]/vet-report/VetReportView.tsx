/**
 * 진료 보고서 그리기 — 조회·판정은 page.tsx 가 하고, 여기는 받은 값을 A4 한 장 모양으로 놓는다.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 D22):
 *   화면 머리(제목 글꼴 28 + 먹색 저장 버튼) → 1.5px 먹선 용지(위 2px 먹선 머리) → 1~8 묶음(묶음 사이 회색 선) → 풋터.
 *   사장님 결정 목록에서 고친 것:
 *    · 복약 주기 영어 원문("daily") → 한국어(매일 · 매주 · 필요할 때) — 약 화면(MedicationsClient)과 같은 이름.
 *    · 날짜는 한 가지 꼴로(시안 "2026. 9. 30.") — 서버 지역 설정에 기대지 않고 한국 시간으로 직접 만든다.
 *    · '견주' → '보호자', 'BCS·MCS·MER' 같은 약어 머리 → "체형 점수·근육 점수·하루 권장 열량"(시안 문구).
 *    · 정확한 영양소 %(단백질·지방·탄수화물·섬유 DM%) 칸은 시안에서 뺐다 — 하루 열량·급여량만 남긴다.
 *   점검 화면(/design-check/analysis)이 같은 컴포넌트에 예시 값을 넣어 로그인 없이 본다.
 */

import VetReportPrintButton from './VetReportPrintButton'
import { V3 } from '@/lib/design/tokens'

export interface VetSurveyAnswers {
  bcsExact?: number
  mcsScore?: number
  bristolScore?: number
  allergies?: string[]
  chronicDiseases?: string[]
}

export interface VetAnalysisRow {
  id: string
  created_at: string
  mer: number | null
  rer: number | null
  stage: string | null
  bcs_label: string | null
  bcs_score: number | null
  feed_g: number | null
  protein_pct: number | null
  fat_pct: number | null
  carb_pct: number | null
  fiber_pct: number | null
  vet_consult_recommended: boolean | null
  next_review_date: string | null
  commentary: string | null
}

export interface VetWeightLog {
  measured_at: string
  weight: number
}

export interface VetMedicationRow {
  id: string
  name: string
  dose: string | null
  schedule: string | null
  time: string | null
  note: string | null
  enabled: boolean | null
}

export interface VetReportData {
  dog: {
    name: string
    breed: string | null
    weight: number | null
    age_value: number | null
    age_unit: string | null
    gender: string | null
    neutered: boolean | null
  }
  owner: { name: string | null; phone: string | null } | null
  answers: VetSurveyAnswers
  surveyCreatedAt: string | null
  analysis: VetAnalysisRow | null
  weights: VetWeightLog[]
  meds: VetMedicationRow[]
  /** 발행일(오늘) ISO. */
  issuedAt: string
}

/** 날짜 한 가지 꼴 — "2026. 9. 30."(한국 시간). 서버 지역 설정(ICU)에 따라 '2026-09-30'·'9/30/2026'로 갈리지 않게 직접 만든다. */
export function dotDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const k = new Date(d.getTime() + 9 * 3_600_000)
  return `${k.getUTCFullYear()}. ${k.getUTCMonth() + 1}. ${k.getUTCDate()}.`
}

/** 복약 주기 — 저장 값(daily·weekly·asneeded) → 약 화면과 같은 한국어. 모르는 값은 그대로. */
const SCHEDULE_LABEL: Record<string, string> = {
  daily: '매일',
  weekly: '매주',
  asneeded: '필요할 때',
}

export default function VetReportView({ data }: { data: VetReportData }) {
  const { dog, owner, answers, analysis, weights, meds } = data
  const issued = dotDate(data.issuedAt)
  const activeMeds = meds.filter((m) => m.enabled !== false)

  return (
    <div className="print:bg-white" style={{ paddingBottom: 32, color: V3.ink, lineHeight: 'normal' }}>
      <style>
        {`@media print {
          @page { size: A4 portrait; margin: 14mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .vet-report-page { box-shadow: none !important; border: none !important; margin: 0 !important; }
        }`}
      </style>

      {/* 헤더 (인쇄 제외)
          ★2026-09-08 사장님: "검은 버튼은 너무 크고 제목도 애매하다".
          - 제목이 **두 번** 나왔다 — 이 화면 제목과 바로 아래 보고서 용지의
            제목이 같은 문장이라, 큰 글씨 둘이 붙어 어느 게 화면 이름인지
            흐렸다. 화면 제목은 짧게('진료 보고서'), 큰 제목은 **용지 안 것 하나만**.
          - 저장 버튼은 기능 그대로(액션이라 채움 유지). */}
      <section
        className="no-print"
        style={{
          padding: '22px 20px 0',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          columnGap: 12,
          alignItems: 'start',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          {/* 제목 글꼴은 앱 틀의 h1 규칙이 준다. */}
          <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.1 }}>진료 보고서</h1>
          <span style={{ fontSize: 15, lineHeight: 1.55, color: V3.inkSoft, wordBreak: 'keep-all' }}>
            병원에 가져가 보여주세요 — 최근 12개월 식이·체중·분석 요약이에요.
          </span>
        </span>
        <VetReportPrintButton />
      </section>

      {/* 보고서 본문 */}
      <article
        aria-label="수의사 진료 보고서"
        className="vet-report-page"
        style={{
          margin: '18px 20px 0',
          padding: '18px 16px 16px',
          border: `1.5px solid ${V3.ink}`,
          borderRadius: 4,
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          wordBreak: 'keep-all',
        }}
      >
        {/* 제목 + 발행 정보 */}
        <div
          style={{
            paddingBottom: 12,
            borderBottom: `2px solid ${V3.ink}`,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: V3.inkMute }}>동물병원 상담용 리포트</span>
            <span className="ft-poster" style={{ fontSize: 22 }}>
              수의사 진료 보고서
            </span>
          </span>
          <span style={{ textAlign: 'right', fontSize: 13, lineHeight: 1.5, color: V3.inkMute, whiteSpace: 'nowrap' }}>
            발행 {issued}
            <br />
            파머스테일
          </span>
        </div>

        {/* 1. 반려견 정보 */}
        <Section title="1. 반려견 정보">
          <Grid cols={3} rowGap>
            <Field label="이름" value={dog.name} />
            <Field label="견종" value={dog.breed ?? '—'} span={2} />
            <Field
              label="나이"
              value={
                dog.age_value
                  ? `${dog.age_value}${dog.age_unit === 'years' || dog.age_unit === 'year' ? '세' : '개월'}`
                  : '—'
              }
            />
            <Field label="성별" value={dog.gender === 'male' ? '수컷' : dog.gender === 'female' ? '암컷' : '—'} />
            <Field label="중성화" value={dog.neutered ? '예' : '아니오'} />
            <Field label="현재 체중" value={dog.weight ? `${dog.weight} kg` : '—'} />
          </Grid>
        </Section>

        {/* 2. 보호자 연락처 */}
        <Section title="2. 보호자 연락처">
          <Grid cols={3}>
            <Field label="이름" value={owner?.name ?? '—'} />
            <Field label="전화" value={owner?.phone ?? '—'} span={2} />
          </Grid>
        </Section>

        {/* 3. 몸 상태 */}
        <Section title="3. 몸 상태 (보호자 자가 측정)">
          <Grid cols={2} rowGap>
            <Field
              label="체형 점수"
              value={
                answers.bcsExact != null
                  ? `${answers.bcsExact} / 9`
                  : analysis?.bcs_score != null
                    ? `${analysis.bcs_score} / 9`
                    : '—'
              }
              hint="1 매우 마름 · 5 알맞음 · 9 비만"
            />
            <Field
              label="근육 점수"
              value={answers.mcsScore != null ? `${answers.mcsScore} / 4` : '—'}
              hint="1 정상 · 4 심한 손실"
            />
            <Field
              label="변 상태 점수"
              value={answers.bristolScore != null ? `${answers.bristolScore} / 7` : '—'}
              hint="1 단단 · 4 알맞음 · 7 물변"
            />
            <Field label="평가일" value={dotDate(data.surveyCreatedAt)} />
          </Grid>
        </Section>

        {/* 4. 체중 추이 (12개월) */}
        <Section title="4. 체중 추이 (최근 12개월)">
          {weights.length === 0 ? (
            <p style={{ margin: 0, fontSize: 15, color: V3.inkSoft }}>기록이 없어요.</p>
          ) : (
            <>
              <WeightChart logs={weights} />
              <Grid cols={3}>
                <Field label="기간 시작" value={`${weights[0]!.weight} kg`} hint={dotDate(weights[0]!.measured_at)} />
                <Field
                  label="기간 끝"
                  value={`${weights[weights.length - 1]!.weight} kg`}
                  hint={dotDate(weights[weights.length - 1]!.measured_at)}
                />
                <Field
                  label="변화"
                  value={`${(weights[weights.length - 1]!.weight - weights[0]!.weight).toFixed(2)} kg`}
                  hint={`${weights.length}회 측정`}
                />
              </Grid>
            </>
          )}
        </Section>

        {/* 5. 알레르기 + 만성 질환 */}
        <Section title="5. 알레르기 · 만성 질환 (보호자 보고)">
          <Grid cols={2}>
            <ListField label="알레르기" items={answers.allergies} />
            <ListField label="만성 질환" items={answers.chronicDiseases} />
          </Grid>
        </Section>

        {/* 6. 지금 먹는 식단 */}
        <Section title="6. 지금 먹는 식단 (파머스테일 분석)">
          {!analysis ? (
            <p style={{ margin: 0, fontSize: 15, color: V3.inkSoft }}>분석 기록이 없어요.</p>
          ) : (
            <>
              <Grid cols={2}>
                <Field label="하루 권장 열량" value={analysis.mer != null ? `${analysis.mer.toFixed(0)} kcal` : '—'} />
                <Field label="하루 권장 급여량" value={analysis.feed_g != null ? `${analysis.feed_g.toFixed(0)} g` : '—'} />
              </Grid>
              {analysis.commentary && (
                <p style={{ margin: 0, padding: '10px 12px', borderRadius: 4, background: V3.soft, fontSize: 15, lineHeight: 1.6 }}>
                  {analysis.commentary}
                </p>
              )}
            </>
          )}
        </Section>

        {/* 7. 지금 먹는 약 */}
        <Section title="7. 지금 먹는 약">
          {activeMeds.length === 0 ? (
            <p style={{ margin: 0, fontSize: 15, color: V3.inkSoft }}>기록이 없어요.</p>
          ) : (
            <div style={{ borderTop: `1px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  padding: '8px 0',
                  borderBottom: `1px solid ${V3.rule}`,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  columnGap: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  color: V3.inkMute,
                }}
              >
                <span>약 이름</span>
                <span>용량</span>
                <span>언제</span>
              </div>
              {activeMeds.map((m, i) => (
                <div
                  key={m.id}
                  style={{
                    padding: '10px 0',
                    borderBottom: i < activeMeds.length - 1 ? `1px solid ${V3.rule}` : 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <span style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', columnGap: 6, fontSize: 15 }}>
                    <span style={{ fontWeight: 700 }}>{m.name}</span>
                    <span>{m.dose ?? '—'}</span>
                    <span>
                      {m.schedule ? (SCHEDULE_LABEL[m.schedule] ?? m.schedule) : '—'}
                      {m.time ? ` · ${m.time}` : ''}
                    </span>
                  </span>
                  {m.note && <span style={{ fontSize: 14, color: V3.inkMute }}>비고 · {m.note}</span>}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 8. 다음 점검 */}
        <Section title="8. 다음 점검" last>
          <Grid cols={2}>
            <Field label="수의사 진료 권고" value={analysis?.vet_consult_recommended ? '권고됨' : '권고 없음'} />
            <Field label="다음 분석 권장일" value={dotDate(analysis?.next_review_date)} />
          </Grid>
        </Section>

        {/* footer */}
        <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.6, color: V3.inkMute }}>
          이 보고서는 보호자의 자가 측정과 파머스테일 분석 결과를 요약한 자료예요. 의료 진단을 대신하지 않으며, 수의사
          진료의 보조 자료로 활용해 주세요.
          <br />
          발행처: 파머스테일 · farmerstail.kr · {issued}
        </p>
      </article>
    </div>
  )
}

// ─── Sub components ───

function Section({ title, children, last = false }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section
      className="print:break-inside-avoid"
      style={{
        padding: last ? '14px 0 12px' : '14px 0',
        borderBottom: last ? `2px solid ${V3.ink}` : `1px solid ${V3.rule}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* h2·h1 은 앱 틀에서 제목 글꼴이 된다 — 묶음 이름은 본문 굵은 글자(시안)라 h3. */}
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{title}</h3>
      {children}
    </section>
  )
}

function Grid({ cols, rowGap = false, children }: { cols: 2 | 3; rowGap?: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        rowGap: rowGap ? 10 : 0,
        columnGap: 8,
      }}
    >
      {children}
    </div>
  )
}

function Field({ label, value, hint, span }: { label: string; value: string; hint?: string; span?: 2 }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 1, gridColumn: span ? `span ${span}` : undefined, minWidth: 0 }}>
      <span style={{ fontSize: 13, color: V3.inkMute }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700 }}>{value}</span>
      {hint && <span style={{ fontSize: 13, color: V3.inkMute }}>{hint}</span>}
    </span>
  )
}

function ListField({ label, items }: { label: string; items?: string[] }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <span style={{ fontSize: 13, color: V3.inkMute }}>{label}</span>
      {items && items.length > 0 ? (
        <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>{items.join(', ')}</span>
      ) : (
        <span style={{ fontSize: 15, color: V3.inkSoft }}>없음 (또는 미입력)</span>
      )}
    </span>
  )
}

function WeightChart({ logs }: { logs: VetWeightLog[] }) {
  if (logs.length < 2) {
    return <p style={{ margin: 0, fontSize: 14, color: V3.inkMute }}>측정이 2회 이상 있어야 그려져요 (지금 {logs.length}회).</p>
  }
  const weights = logs.map((l) => l.weight)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = max - min || 1
  // 시안 D22 — 가로 326 · 세로 64 · 아래 회색 기준선 · 먹색 선 2.5 · 마지막 점만 머스타드.
  const W = 326
  const H = 64
  const pts = logs.map((l, i) => ({
    x: 6 + (i / (logs.length - 1)) * (W - 12),
    y: 52 - ((l.weight - min) / range) * 40,
  }))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden style={{ display: 'block', width: '100%', height: 'auto' }}>
      <line x1={0} y1={62} x2={W} y2={62} stroke={V3.rule} strokeWidth={1} />
      <polyline
        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={V3.ink}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {pts.map((p, i) =>
        i === pts.length - 1 ? (
          <circle key={i} cx={p.x} cy={p.y} r={5} fill={V3.mustard} stroke={V3.ink} strokeWidth={2} />
        ) : (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill={V3.ink} />
        ),
      )}
    </svg>
  )
}
