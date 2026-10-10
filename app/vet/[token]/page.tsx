import type { Metadata } from 'next'
import StoreShell from '@/components/store/StoreShell'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import VetSharePrintButton from './VetSharePrintButton'
import { sensitivityAnalysis, type DogState } from '@/lib/counterfactual'
import { petName, withHonorific } from '@/lib/korean'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '진료 참고용 공유',
  robots: { index: false, follow: false },
}

type Params = Promise<{ token: string }>

/**
 * /vet/[token] — 보호자가 수의사에게 공유한 read-only 페이지.
 *
 * 로그인 없이 익명 진입. supabase anon role 로 fetch_vet_share() RPC 호출.
 * RPC 가 RLS 우회 + 토큰 검증 + 정보 통합 반환.
 *
 * # 표시
 *  - 보호자 이름 + 강아지 메타 (이름, 종, 성별, 중성화, 나이, 체중)
 *  - 알레르기 / 만성 질환
 *  - 최신 분석 결과 (RER, MER, BCS, 단백·지방·탄수, risk flags)
 *    ※ '권장 보조제'는 2026-07-31 에 숨겼다 — 폐지한 영양제 라인의 데이터라
 *      우리가 팔지도 보증하지도 않는 것을 권하는 모양이 된다(아래 주석 참조).
 *  - 최근 체중 측정
 *
 * # 데이터 신뢰성 표시
 *  - allergies_source, weight_method, weight_measured_at 으로 "어떻게 측정한
 *    값인지" 명시 — 수의사가 보호자 보고와 객관 측정을 구분.
 */
export default async function VetSharePage({
  params,
}: {
  params: Params
}) {
  const { token } = await params

  // ★로그인 쿠키를 싣지 않는 **익명** 클라이언트 (2026-09-25 출시 전 점검 3차).
  //   이 페이지는 원래 익명 진입용인데 쿠키 클라이언트를 써서, 로그인한 사람(보호자가
  //   자기 링크를 확인해 볼 때)이 열면 auth.uid() 가 채워져 열람 횟수 갱신이
  //   prevent_vet_share_token_tampering 트리거에 막혀 RPC 전체가 실패했다.
  //   수의사는 로그인하지 않으므로 익명이 정본이다.
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data, error } = await supabase.rpc('fetch_vet_share', { p_token: token })
  // 오류를 '링크 문제'로만 보여 주면 사장님은 모른다 — 실제로 모든 링크가 컬럼 오류로
  // 죽어 있었는데 흔적이 없었다(규칙1).
  if (error) {
    captureBusinessEvent('error', 'vet_share.fetch_failed', { dbError: error.message })
  }

  type RpcResult =
    | {
        ok: true
        token: { expiresAt: string; accessedCount: number }
        owner: { name: string | null }
        dog: DogRow
        analysis: AnalysisRow | null
        latestWeight: { weight: number; measured_at: string } | null
      }
    | { ok: false; error: string; message: string }

  // '응답 없음' 은 개발자용 내부 문자열이었다 — 수의사 화면에 그대로 찍혔다.
  const result = (data ?? {
    ok: false,
    error: 'unknown',
    message: '링크를 확인하지 못했어요. 잠시 후 다시 열어봐 주세요.',
  }) as RpcResult

  // 모양 = 웹 시안 WEB-A35(열 수 없음, 2026-10-10 웹 리뉴얼). 링크 기한 14일 = app/api/dogs/[id]/vet-share(만든 날부터 14일).
  if (!result.ok) {
    return (
      <StoreShell>
        <section role="alert" style={{ padding: '48px 20px 72px', display: 'flex', flexDirection: 'column' }}>
          <span aria-hidden style={{ width: 72, height: 72, boxSizing: 'border-box', border: '2.5px solid #B3261E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#B3261E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
              <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
              <path d="M4 4l16 16" />
            </svg>
          </span>
          <span style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#595959' }}>
            <span aria-hidden style={{ width: 8, height: 8, background: '#141414' }} />
            진료 참고용
          </span>
          <h1 className="d" style={{ margin: '10px 0 0', fontSize: 38, lineHeight: 1.15 }}>
            진료 공유 링크를
            <br />
            열 수 없어요
          </h1>
          <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>{result.message}</p>
          <div style={{ marginTop: 22, padding: 16, borderRadius: 4, background: '#F6F4F5', fontSize: 17, lineHeight: 1.6 }}>
            보호자에게 새 링크를 보내 달라고 해 주세요. 링크는 만든 날부터 <strong style={{ fontWeight: 800 }}>14일</strong> 동안 열려요.
          </div>
        </section>
      </StoreShell>
    )
  }

  const dog = result.dog
  const analysis = result.analysis
  const latestWeight = result.latestWeight
  // 영양 구성은 정확한 %가 아니라 막대·범례로(성분 % 노출 금지 원칙) — 비율만 쓴다.
  const macro = analysis ? [analysis.protein_pct, analysis.fat_pct, analysis.carb_pct].map((v) => Math.max(0, Number(v) || 0)) : null

  // 모양 = 웹 시안 WEB-A32(2026-10-10 웹 리뉴얼) — 영어 약어(RER·MER·BCS) 대신 한국어 이름, 위 2px 먹선 표.
  return (
    <StoreShell>
      <div className="vet-share-print">
        <style>{`
          @media print {
            .fts { background: #fff !important; }
            .fts header, .fts footer, .no-print { display: none !important; }
            .vet-share-print section { page-break-inside: avoid; }
            .vet-share-print a { color: #141414 !important; text-decoration: none !important; }
          }
        `}</style>
        <section style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ height: 32, padding: '0 10px', boxSizing: 'border-box', borderRadius: 4, border: '1.5px solid #141414', display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 800 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 3v6a4 4 0 0 0 8 0V3" />
                <path d="M10 13v3a5 5 0 0 0 10 0v-2" />
                <circle cx="20" cy="12" r="2" />
              </svg>
              진료 참고용
            </span>
            {/* PDF / 인쇄 — window.print() — 브라우저가 PDF 저장 또는 실 인쇄 */}
            <VetSharePrintButton />
          </div>
          <h1 className="d" style={{ margin: '20px 0 0', fontSize: 40, lineHeight: 1.1, overflowWrap: 'anywhere' }}>
            {petName(dog.name)}의 정보
          </h1>
          {result.owner.name && <p style={{ margin: '10px 0 0', fontSize: 17, color: '#595959' }}>보호자: {withHonorific(result.owner.name)}</p>}
        </section>

        <section aria-labelledby="dog-title" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <h2 id="dog-title" className="d" style={{ margin: 0, fontSize: 24 }}>
            강아지 정보
          </h2>
          <dl style={{ margin: '12px 0 0', borderTop: '2px solid #141414', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <Field label="이름" value={dog.name} />
            <Field label="견종" value={dog.breed ?? '—'} right />
            <Field label="성별" value={dog.gender === 'female' ? '여' : dog.gender === 'male' ? '남' : '—'} />
            <Field label="중성화" value={dog.neutered ? '예' : '아니오'} right />
            <Field label="지금 체중" value={dog.weight != null ? `${dog.weight} kg` : '—'} />
            <Field label="생년월일" value={dog.birth_date ?? '—'} right />
            <Field label="활동량" value={activityLabel(dog.activity_level)} />
            <Field
              label="체중 잰 방법"
              right
              value={dog.weight_method ? weightMethodLabel(dog.weight_method) : '—'}
              sub={dog.weight_method && dog.weight_measured_at ? dog.weight_measured_at.slice(0, 10) : undefined}
            />
          </dl>
        </section>

        {/* 알레르기 / 만성 질환 — 어떻게 안 값인지(보호자 관찰·수의사 확진)를 함께 */}
        {((dog.allergies?.length ?? 0) > 0 || (dog.chronic_conditions?.length ?? 0) > 0) && (
          <section aria-labelledby="care-title" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
            <h2 id="care-title" className="d" style={{ margin: 0, fontSize: 24 }}>
              알레르기 · 만성 질환
            </h2>
            <dl style={{ margin: '12px 0 0', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
              {dog.allergies && dog.allergies.length > 0 && (
                <div style={{ padding: '12px 0', borderBottom: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <dt style={{ fontSize: 14, color: '#595959' }}>알레르기</dt>
                  <dd style={{ margin: 0, fontSize: 17, fontWeight: 800, lineHeight: 1.45 }}>
                    {dog.allergies.join(', ')}
                    {dog.allergies_source && <span style={{ marginLeft: 6, fontSize: 15, fontWeight: 600, color: '#595959' }}>({allergiesSourceLabel(dog.allergies_source)})</span>}
                  </dd>
                </div>
              )}
              {dog.chronic_conditions && dog.chronic_conditions.length > 0 && (
                <div style={{ padding: '12px 0', borderBottom: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <dt style={{ fontSize: 14, color: '#595959' }}>만성 질환</dt>
                  <dd style={{ margin: 0, fontSize: 17, fontWeight: 800, lineHeight: 1.45 }}>{dog.chronic_conditions.join(', ')}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* 최신 분석 */}
        {analysis ? (
          <section aria-labelledby="ana-title" style={{ padding: '36px 20px 0', display: 'flex', flexDirection: 'column' }}>
            <h2 id="ana-title" className="d" style={{ margin: 0, fontSize: 24 }}>
              최신 분석{' '}
              <span style={{ fontFamily: 'var(--font-sans), sans-serif', fontSize: 16, fontWeight: 700, color: '#595959', letterSpacing: '-0.02em' }}>
                {analysis.created_at.slice(0, 10)}
              </span>
            </h2>
            <div style={{ marginTop: 12, border: '2px solid #141414', boxShadow: '4px 4px 0 #141414', borderRadius: 4, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <span style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#595959' }}>하루 권장 열량</span>
                <span style={{ whiteSpace: 'nowrap' }}>
                  <span className="n" style={{ fontSize: 34, lineHeight: 1 }}>
                    {analysis.mer}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 800 }}> kcal</span>
                </span>
              </span>
              <span style={{ padding: 16, borderLeft: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#595959' }}>하루 권장 급여량</span>
                <span style={{ whiteSpace: 'nowrap' }}>
                  <span className="n" style={{ fontSize: 34, lineHeight: 1 }}>
                    {analysis.feed_g}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 800 }}> g</span>
                </span>
              </span>
            </div>
            <dl style={{ margin: '16px 0 0', borderTop: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <Field label="쉴 때 필요한 열량" value={`${analysis.rer} kcal`} />
              <Field label="활동 계수" value={`${analysis.factor}`} right />
              <Field label="생애 단계" value={analysis.stage} />
              <Field label="체형 점수" value={analysis.bcs_label} right />
            </dl>
            {macro && macro.some((v) => v > 0) && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>영양 구성</span>
                <div aria-hidden style={{ height: 14, display: 'grid', gridTemplateColumns: macro.map((v) => `${v}fr`).join(' '), gap: 3 }}>
                  <span style={{ background: '#141414' }} />
                  <span style={{ background: '#8A8A8A' }} />
                  <span style={{ background: '#D9D9D9' }} />
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 15, color: '#3D3D3D' }}>
                  {[
                    ['#141414', '단백질'],
                    ['#8A8A8A', '지방'],
                    ['#D9D9D9', '탄수화물'],
                  ].map(([c, l]) => (
                    <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 12, background: c }} />
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/*
              ⛔ '권장 보조제' 숨김 (2026-07-31 사장님 "출시 안 한 영양제가 보인다").
              이 값(analyses.supplements)은 폐지한 맞춤 영양제 박스를 위해 만든 데이터다 — 분석 화면(2026-07-13)·AI
              프롬프트(2026-07-16)에서 뺐는데 이 수의사 리포트만 남아 있었다. 데이터·계산(getSupplements)은 살려 두고 이 자리만 비운다.
            */}
            {analysis.risk_flags && analysis.risk_flags.length > 0 && (
              <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 4, border: '1.5px solid #B3261E', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <strong style={{ fontSize: 15, fontWeight: 800, color: '#B3261E' }}>주의할 점</strong>
                <span style={{ fontSize: 16, lineHeight: 1.55 }}>{analysis.risk_flags.join(' · ')}</span>
              </div>
            )}
            {analysis.vet_consult_recommended && (
              <p style={{ margin: '12px 0 0', fontSize: 16, fontWeight: 800, color: '#B3261E' }}>수의사 상담을 권해요</p>
            )}
          </section>
        ) : (
          <section style={{ padding: '36px 20px 0' }}>
            <p style={{ margin: 0, padding: '18px 16px', borderRadius: 4, background: '#F6F4F5', fontSize: 16, color: '#595959', textAlign: 'center' }}>아직 분석 데이터가 없어요</p>
          </section>
        )}

        {/* 최근 체중 */}
        {latestWeight && (
          <section aria-labelledby="w-title" style={{ padding: '36px 20px 0', display: 'flex', flexDirection: 'column' }}>
            <h2 id="w-title" className="d" style={{ margin: 0, fontSize: 24 }}>
              최근 체중
            </h2>
            <div style={{ marginTop: 12, padding: '14px 0', borderTop: '2px solid #141414', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ whiteSpace: 'nowrap' }}>
                <span className="n" style={{ fontSize: 30 }}>
                  {latestWeight.weight}
                </span>
                <span style={{ fontSize: 16, fontWeight: 800 }}> kg</span>
              </span>
              <span style={{ fontSize: 16, color: '#595959' }}>{latestWeight.measured_at.slice(0, 10)} 측정</span>
            </div>
          </section>
        )}

        {/* [C1] 반사실 민감도 — 발명 모듈 G. flag OFF 면 빈 배열 → 숨김. 어떤 변수 변화가 급여량을 가장 많이 바꾸는지. */}
        {(() => {
          if (!analysis || !dog.weight) return null
          const lifeStage: DogState['lifeStage'] = analysis.stage.includes('성장') ? 'puppy' : analysis.stage.includes('노령') ? 'senior' : 'adult'
          const baseline: DogState = {
            weightKg: dog.weight,
            bcs: analysis.bcs_score ?? 5,
            activityFactor: analysis.factor ?? 1.2,
            lifeStage,
            neutered: !!dog.neutered,
          }
          const results = sensitivityAnalysis(baseline)
          if (results.length === 0) return null
          return (
            <section aria-labelledby="sens-title" style={{ padding: '36px 20px 0', display: 'flex', flexDirection: 'column' }}>
              <h2 id="sens-title" className="d" style={{ margin: 0, fontSize: 24 }}>
                급여량에 영향이 큰 것
              </h2>
              <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.6, color: '#595959' }}>각 항목이 한 단계 바뀔 때 하루 권장 그램이 얼마나 바뀌는지예요.</p>
              <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
                {results.slice(0, 4).map((r) => (
                  <li key={`${r.variable}-${r.delta}`} style={{ minHeight: 48, borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 16 }}>
                    <span>{r.description}</span>
                    <span style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                      {r.delta > 0 ? '+' : ''}
                      {r.delta} g/일
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })()}

        <p style={{ margin: '28px 20px 64px', padding: '14px 16px', borderRadius: 4, background: '#F6F4F5', fontSize: 15, lineHeight: 1.6, color: '#3D3D3D' }}>
          보호자가 보낸 링크로 읽기만 할 수 있게 공유된 페이지예요. 링크는 <strong style={{ color: '#141414' }}>{result.token.expiresAt.slice(0, 10)}</strong>까지 열려요.
        </p>
      </div>
    </StoreShell>
  )
}

type DogRow = {
  id: string
  name: string
  breed: string | null
  gender: 'male' | 'female' | null
  neutered: boolean | null
  weight: number | null
  birth_date: string | null
  activity_level: string | null
  allergies_source: string | null
  weight_method: string | null
  weight_measured_at: string | null
  chronic_conditions: string[] | null
  allergies: string[] | null
}

type AnalysisRow = {
  created_at: string
  rer: number
  mer: number
  factor: number
  stage: string
  bcs_label: string
  bcs_score: number
  protein_pct: number
  fat_pct: number
  carb_pct: number
  feed_g: number
  ca_p_ratio: number | null
  supplements: string[] | null
  risk_flags: string[] | null
  vet_consult_recommended: boolean | null
  next_review_date: string | null
}

function Field({ label, value, sub, right }: { label: string; value: string; sub?: string; right?: boolean }) {
  return (
    <div
      style={{
        padding: right ? '12px 0 12px 14px' : '12px 0',
        borderBottom: '1px solid #E5E5E5',
        borderLeft: right ? '1px solid #E5E5E5' : 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
      }}
    >
      <dt style={{ fontSize: 14, color: '#595959' }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 17, fontWeight: 800, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
        {value}
        {sub && <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#595959' }}>{sub}</span>}
      </dd>
    </div>
  )
}

function activityLabel(level: string | null): string {
  if (!level) return '—'
  const map: Record<string, string> = {
    very_low: '매우 낮음',
    low: '낮음',
    normal: '보통',
    moderate: '보통',
    high: '높음',
    very_high: '매우 높음',
  }
  return map[level] ?? level
}

function weightMethodLabel(method: string): string {
  const map: Record<string, string> = {
    vet_scale: '동물병원 체중계',
    home_digital: '가정용 디지털',
    home_analog: '가정용 아날로그',
    hold: '안고 재기',
    eyeball: '눈으로 추정',
    unknown: '미상',
  }
  return map[method] ?? method
}

function allergiesSourceLabel(source: string): string {
  const map: Record<string, string> = {
    self_suspected: '보호자 자가관찰',
    vet_diagnosed: '수의사 확진',
    unknown: '미상',
  }
  return map[source] ?? source
}
