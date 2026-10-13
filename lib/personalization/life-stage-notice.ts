/**
 * 아기 강아지·임신·수유 안내 — 추천 레시피를 보여 주기 **전에** 띄운다(2026-10-13 점검 E11 사장님 결정).
 *
 * 판매 4종은 성견 유지용 화식이다. 예전엔 아기 강아지에게 '아기 강아지 · 성장기 맞춤'·'대형견 아기 · 골격 보호' 칩을
 * 붙여 성장기에 맞춘 것처럼 말했다. 결제는 막지 않되(사장님 결정), 추천 앞에서 사실을 말하고 수의사 상담을 권한다.
 * 그 칩들은 고객 화면에서 뺐다(plain-reason HIDDEN_CUSTOMER_RULES).
 *
 * 판정은 분석 결과에 이미 있는 값으로 — 생애 단계(analyses.stage, 한글)와 위험 표시(PREGNANT·LACTATING).
 */
import { stageFromKR } from '../nutrition.ts'

export const LIFE_STAGE_VET_NOTICE =
  '성견 유지용 화식이에요. 아기·임신·수유 중이면 수의사와 먼저 상의해 주세요.'

export function needsLifeStageVetNotice(
  stage: string | null | undefined,
  riskFlags: readonly string[] | null | undefined,
): boolean {
  if (stageFromKR(stage ?? null) === 'puppy') return true
  const flags = riskFlags ?? []
  return flags.includes('PREGNANT') || flags.includes('LACTATING')
}
