import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyTreatDeduction,
  breedToFlags,
  calculateAdultFactor,
  calculateRER,
  classifyPath,
  computeFeedingPlanV2,
  deriveBCS,
  estimateIdealBodyWeight,
  feedbackAdjustment,
  modifiedAtwaterKcalPer100g,
  resolveKibbleKcal,
} from './engine.ts'
import type { KibbleDb, SurveyInputV2 } from './types.ts'

/**
 * 0단계 회귀 하네스 — 스펙 §10 T1~T5 + 가드레일(§8).
 * 스펙 본문 수치와 정확 계산이 어긋나는 곳은 주석으로 명시(중간 반올림 차).
 */

const stubDb: KibbleDb = {
  getProduct: async () => null,
  logMissing: async () => {},
}

function input(over: Partial<SurveyInputV2> = {}): SurveyInputV2 {
  return {
    currentWeightKg: 6,
    ageYears: 4,
    sex: 'male',
    isNeutered: true,
    breed: 'mixed',
    lifeStage: 'adult',
    bodyAssessment: { ribs: 'easy', waist: 'slight', abdomen: 'level' },
    activityIntensity: 'low',
    activityEvidence: 'self_report',
    isVeryInactive: false,
    housing: 'indoor',
    coldExposure: false,
    isEasyKeeper: false,
    healthFlags: ['none'],
    givesTreats: false,
    hwasikShare: 0.3,
    hwasikSku: 'chicken',
    hwasikKcalPer100g: 115,
    kibbleKcalPer100g: 350,
    ...over,
  }
}

describe('deriveBCS — 3분해 역산 (M2a)', () => {
  it('갈비뼈 hard + 허리 none + 배 sagging → 9 (비만)', () => {
    assert.equal(deriveBCS({ ribs: 'hard', waist: 'none', abdomen: 'sagging' }), 9)
  })
  it('갈비뼈 visible + 마른 신호 2 → 2 (저체중)', () => {
    assert.equal(deriveBCS({ ribs: 'visible', waist: 'clear', abdomen: 'tucked' }), 2)
  })
  it('갈비뼈 easy + 마른 신호 2 → 4 (⚠️ 스펙 본문 T1 은 5라 적었으나 코드 기준 4 — 이상 범위라 factor 영향 0)', () => {
    assert.equal(deriveBCS({ ribs: 'easy', waist: 'clear', abdomen: 'tucked' }), 4)
  })
  it('갈비뼈 easy 단독 → 5 (이상)', () => {
    assert.equal(deriveBCS({ ribs: 'easy', waist: 'slight', abdomen: 'level' }), 5)
  })

  // 🔧 2026-07-12 버그 수정 회귀 (사장님 리포트): 예전 base 방향 게이트 때문에
  // '갈비뼈 이상 + 허리·배 과체중' 이 5 로 고정됐던 케이스들. 허리·배가 실제로
  // 갈비뼈 판정을 보정해야 한다.
  it('갈비뼈 easy + 허리 none + 배 sagging → 6 (초기 과체중, 게이트 버그 케이스)', () => {
    assert.equal(deriveBCS({ ribs: 'easy', waist: 'none', abdomen: 'sagging' }), 6)
  })
  it('갈비뼈 visible + 허리 none + 배 sagging → 4 (마른 갈비뼈지만 과체중 신호)', () => {
    assert.equal(deriveBCS({ ribs: 'visible', waist: 'none', abdomen: 'sagging' }), 4)
  })
  it('갈비뼈 slight_pressure(6) + 마른 신호 2 → 5 (7빈칸 반대방향)', () => {
    assert.equal(
      deriveBCS({ ribs: 'slight_pressure', waist: 'clear', abdomen: 'tucked' }),
      5,
    )
  })
  it('갈비뼈 hard(8) + 마른 신호 2 → 7 (모순 신호, 7로 절충)', () => {
    assert.equal(deriveBCS({ ribs: 'hard', waist: 'clear', abdomen: 'tucked' }), 7)
  })
  it('단일 신호(허리만 none)는 갈비뼈 이상 판정을 흔들지 않음 → 5', () => {
    assert.equal(deriveBCS({ ribs: 'easy', waist: 'none', abdomen: 'level' }), 5)
  })
})

describe('RER (M3) — 지수식 + 토이 보정 유지(사장님 확정)', () => {
  it('6kg → 268.4', () => assert.equal(calculateRER(6), 268.4))
  it('30kg → 897.3', () => assert.equal(calculateRER(30), 897.3))
  it('1kg 토이 → 76.8 (순수 지수식 70 대비 상향 — 저급 방지 보정)', () => {
    assert.equal(calculateRER(1), 76.8)
  })
})

describe('T1 — 전형적 한국 반려견 (감산 지배형)', () => {
  const t1 = input({
    ageYears: 8,
    bodyAssessment: { ribs: 'easy', waist: 'clear', abdomen: 'tucked' },
    isEasyKeeper: true,
  })
  it('계수 = 1.4 −0.1(중년) −0.1(easy-keeper) = 1.2 → DER 322', async () => {
    const plan = await computeFeedingPlanV2(t1, stubDb)
    assert.equal(plan.path, 'adult')
    assert.equal(plan.rer, 268.4)
    assert.equal(plan.factor, 1.2)
    assert.equal(plan.der, 322)
  })
  it('배분: 화식 84g(115 실측) · 건사료 64g(350)', async () => {
    const plan = await computeFeedingPlanV2(t1, stubDb)
    assert.equal(plan.hwasik.grams, 84)
    assert.equal(plan.kibble.grams, 64)
    assert.equal(plan.kibble.source, 'label')
  })
  it('factorBreakdown 에 감산 근거 3줄(기본+중년+체질) 노출', async () => {
    const plan = await computeFeedingPlanV2(t1, stubDb)
    assert.equal(plan.factorBreakdown.length, 3)
    assert.equal(
      plan.factorBreakdown.reduce((s, l) => +(s + l.delta).toFixed(2), 0),
      1.2,
    )
  })
})

describe('T2 — 과체중 (IBW 감량 분기)', () => {
  const t2 = input({
    currentWeightKg: 8,
    ageYears: 5,
    bodyAssessment: { ribs: 'hard', waist: 'none', abdomen: 'sagging' },
  })
  it('BCS9 → IBW 5.71 → RER 258.6 → 계수 1.0 → DER 259', async () => {
    const plan = await computeFeedingPlanV2(t2, stubDb)
    assert.equal(plan.path, 'weight_loss')
    assert.equal(plan.derivedBcs, 9)
    assert.equal(plan.idealWeightKg, 5.71)
    assert.equal(plan.rer, 258.6) // 스펙 본문 259.3 은 손반올림 — 정확 계산은 258.6, DER 은 동일 259
    assert.equal(plan.der, 259)
  })
  it('감량 노트(속도·BCS 종료·재측정) 포함', async () => {
    const plan = await computeFeedingPlanV2(t2, stubDb)
    assert.ok(plan.notes.some((n) => n.includes('0.5~2%')))
  })
})

describe('T3 — 래브라도 (견종 OB → easy-keeper 감산 1회)', () => {
  const t3 = input({ currentWeightKg: 30, ageYears: 4, breed: 'labrador', activityIntensity: 'mid' })
  it('계수 1.4 −0.1(OB) = 1.3 → DER 1166', async () => {
    const plan = await computeFeedingPlanV2(t3, stubDb)
    assert.equal(plan.factor, 1.3)
    assert.equal(plan.rer, 897.3)
    assert.equal(plan.der, 1166) // 스펙 본문 1167 은 RER 897.4 손반올림 차
  })
  it('이중차감 금지: 설문 easyKeeper=true 여도 감산 줄은 1개', () => {
    const both = input({ breed: 'labrador', isEasyKeeper: true })
    const r = calculateAdultFactor(both, breedToFlags('labrador'))
    assert.equal(r.lines.filter((l) => l.label.includes('체질')).length, 1)
  })
})

describe('T4 — 자견 성장식 (앞 상수 130 + 토이 하향)', () => {
  it('3kg/성견8kg 푸들 → 정확식 589 × 0.85 = 501kcal', async () => {
    const plan = await computeFeedingPlanV2(
      input({
        currentWeightKg: 3,
        lifeStage: 'puppy',
        expectedAdultWeightKg: 8,
        breed: 'poodle_toy',
        ageYears: 0.4,
      }),
      stubDb,
    )
    assert.equal(plan.path, 'growth')
    assert.equal(plan.der, 501) // 70 이면 317 — 46% 과소. 130 필수(가드레일 8).
    assert.ok(plan.notes.some((n) => n.includes('토이')))
    assert.equal(plan.factor, 3.0) // p=0.375 < 0.5 → 간이 근사 병기
  })
})

describe('T5 — 노령 초비활동 (하한 클램프)', () => {
  it('계수 1.4−0.2−0.1−0.1 = 1.0(하한) → DER 198', async () => {
    const plan = await computeFeedingPlanV2(
      input({
        currentWeightKg: 4,
        ageYears: 12,
        isVeryInactive: true,
        isEasyKeeper: true,
      }),
      stubDb,
    )
    assert.equal(plan.factor, 1.0)
    assert.equal(plan.der, 198)
  })
})

describe('가드레일 (§8)', () => {
  it('상한 클램프: 미중성화+저체중+객관고활동+실외한랭 = 2.15 → 2.0', () => {
    const s = input({
      isNeutered: false,
      bodyAssessment: { ribs: 'visible', waist: 'clear', abdomen: 'tucked' },
      activityIntensity: 'high',
      activityEvidence: 'objective',
      housing: 'outdoor',
      coldExposure: true,
    })
    assert.equal(calculateAdultFactor(s, breedToFlags('mixed')).factor, 2.0)
  })
  it('단두종 활동 가산 억제: 프렌치불독 high 자가보고 → 가산 0', () => {
    const s = input({ breed: 'french_bulldog', activityIntensity: 'high' })
    const r = calculateAdultFactor(s, breedToFlags('french_bulldog'))
    assert.ok(!r.lines.some((l) => l.label.includes('활발')))
    assert.equal(r.factor, 1.3) // 1.4 − 0.1(OB)
  })
  it('질병 → vet_referral (계산 중단, DER 0)', async () => {
    const plan = await computeFeedingPlanV2(input({ healthFlags: ['diabetes'] }), stubDb)
    assert.equal(plan.path, 'vet_referral')
    assert.equal(plan.der, 0)
  })
  it('임신 → reproduction 라우팅 (계산 중단 — 사장님 확정)', () => {
    assert.equal(classifyPath(input({ isPregnant: true, isNeutered: false, sex: 'female' }), 5), 'reproduction')
  })
  it('IBW: BCS ≤5 는 무변경, BCS 8 은 /1.3', () => {
    assert.equal(estimateIdealBodyWeight(6, 5), 6)
    assert.equal(estimateIdealBodyWeight(13, 8), 10)
  })
})

describe('간식 10% 룰 (M8) — 헤비유저 처리', () => {
  it('간식 100kcal 신고, DER 322 → 캡 32kcal 만 차감 + 초과 경고', () => {
    const r = applyTreatDeduction(322, input({ givesTreats: true, treatKcalPerDay: 100 }))
    assert.equal(r.treatKcal, 32)
    assert.equal(Math.round(r.mainPool), 290)
    assert.ok(r.note?.includes('초과'))
  })
  it('캡 이내(20kcal)는 그대로 차감, 경고 없음', () => {
    const r = applyTreatDeduction(322, input({ givesTreats: true, treatKcalPerDay: 20 }))
    assert.equal(r.treatKcal, 20)
    assert.equal(r.note, undefined)
  })
})

describe('건사료 3단 폴백 (M9b) + 앳워터', () => {
  it('DB 히트 → source db', async () => {
    const db: KibbleDb = {
      getProduct: async () => ({ kcalPer100g: 372 }),
      logMissing: async () => {},
    }
    const r = await resolveKibbleKcal(input({ kibbleProductId: 'x', kibbleKcalPer100g: undefined }), db)
    assert.deepEqual(r, { kcalPer100g: 372, source: 'db' })
  })
  it('라벨 → label, 성분표 → atwater(380.0), 없음 → none + 로그', async () => {
    const logged: string[] = []
    const db: KibbleDb = {
      getProduct: async () => null,
      logMissing: async (raw) => {
        logged.push(raw)
      },
    }
    const ga = { crudeProtein: 30, crudeFat: 20, crudeFiber: 3, moisture: 10, ash: 7 }
    assert.equal(modifiedAtwaterKcalPer100g(ga), 380)
    const atw = await resolveKibbleKcal(input({ kibbleKcalPer100g: undefined, kibbleGA: ga }), db)
    assert.equal(atw.source, 'atwater')
    const none = await resolveKibbleKcal(
      input({ kibbleKcalPer100g: undefined, kibbleRawInput: '동네사료X' }),
      db,
    )
    assert.equal(none.source, 'none')
    assert.deepEqual(logged, ['동네사료X'])
  })
})

describe('M10 재측정 피드백 (수렴 엔진)', () => {
  it('유지 목표: ±2% 이내 유지, +3% 증가 → −10%', () => {
    assert.equal(feedbackAdjustment(300, 1.5, 14, 'maintain').newDer, 300)
    assert.equal(feedbackAdjustment(300, 3, 14, 'maintain').newDer, 270)
  })
  it('감량 목표: 정체(−0.2%/주) → −10%, 과속(−3%/주) → +10%, 적정(−1%/주) → 유지', () => {
    // 감량 중 체중 변화율은 음수 — 스펙 원문의 부호 버그를 교정한 의미론.
    assert.equal(feedbackAdjustment(300, -0.4, 14, 'lose').newDer, 270) // 거의 안 빠짐
    assert.equal(feedbackAdjustment(300, -6, 14, 'lose').newDer, 330) // 주 3% 과속
    assert.equal(feedbackAdjustment(300, -2, 14, 'lose').newDer, 300) // 주 1% 적정
    assert.equal(feedbackAdjustment(300, 2, 14, 'lose').newDer, 270) // 오히려 증가 → 인하
  })
  it('증량 목표: 정체 → +10%', () => {
    assert.equal(feedbackAdjustment(300, -0.5, 14, 'gain').newDer, 330)
  })
})
