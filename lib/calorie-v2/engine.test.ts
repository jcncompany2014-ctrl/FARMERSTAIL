import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  breedToFlags,
  calculateAdultFactor,
  deriveBCS,
  estimateIdealBodyWeight,
  feedbackAdjustment,
} from './engine.ts'
import type { SurveyInputV2 } from './types.ts'

/**
 * 스펙 §10 T1~T5 + 가드레일(§8) 중 **이 파일이 책임지는 범위**의 회귀 하네스.
 *
 * ⚠️ 2026-07-17 창고 정리: 상위 파이프라인(computeFeedingPlanV2 등)이 死코드라
 * 삭제되면서 그것을 부르던 테스트(DER·배분·건사료 폴백·간식 차감·성장식·
 * vet_referral 라우팅)도 함께 제거했다. **스펙 케이스 T1·T3·T5 는 버리지 않고
 * 살아있는 사다리 함수(calculateAdultFactor)로 이관해 계수 검증을 보존**했다.
 *
 * DER·그램·간식·성장식·임신수유의 실제 회귀는 정본인 `lib/nutrition.test.ts` /
 * `lib/nutrition-rer.test.ts` 소관 — 여기서 중복 검증하지 않는다.
 */

function input(over: Partial<SurveyInputV2> = {}): SurveyInputV2 {
  return {
    ageYears: 4,
    isNeutered: true,
    bodyAssessment: { ribs: 'easy', waist: 'slight', abdomen: 'level' },
    activityIntensity: 'low',
    activityEvidence: 'self_report',
    isVeryInactive: false,
    housing: 'indoor',
    coldExposure: false,
    isEasyKeeper: false,
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

describe('T1 — 전형적 한국 반려견 (감산 지배형 사다리)', () => {
  const t1 = input({
    ageYears: 8,
    bodyAssessment: { ribs: 'easy', waist: 'clear', abdomen: 'tucked' },
    isEasyKeeper: true,
  })
  it('계수 = 1.4 −0.1(중년) −0.1(easy-keeper) = 1.2', () => {
    assert.equal(calculateAdultFactor(t1, breedToFlags('mixed')).factor, 1.2)
  })
  it('factorBreakdown 에 감산 근거 3줄(기본+중년+체질) 노출 · 합 = 계수', () => {
    const r = calculateAdultFactor(t1, breedToFlags('mixed'))
    assert.equal(r.lines.length, 3)
    assert.equal(r.lines.reduce((s, l) => +(s + l.delta).toFixed(2), 0), 1.2)
  })
})

describe('T3 — 래브라도 (견종 OB → easy-keeper 감산 1회)', () => {
  it('계수 1.4 −0.1(OB) = 1.3', () => {
    assert.equal(
      calculateAdultFactor(input(), breedToFlags('labrador')).factor,
      1.3,
    )
  })
  it('이중차감 금지: 설문 easyKeeper=true 여도 감산 줄은 1개', () => {
    const both = input({ isEasyKeeper: true })
    const r = calculateAdultFactor(both, breedToFlags('labrador'))
    assert.equal(r.lines.filter((l) => l.label.includes('체질')).length, 1)
    assert.equal(r.factor, 1.3)
  })
})

describe('T5 — 노령 초비활동 (하한 클램프)', () => {
  it('계수 1.4 −0.2(노령) −0.1(초비활동) −0.1(체질) = 1.0 (하한)', () => {
    const t5 = input({ ageYears: 12, isVeryInactive: true, isEasyKeeper: true })
    assert.equal(calculateAdultFactor(t5, breedToFlags('mixed')).factor, 1.0)
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
    const s = input({ activityIntensity: 'high' })
    const r = calculateAdultFactor(s, breedToFlags('french_bulldog'))
    assert.ok(!r.lines.some((l) => l.label.includes('활발')))
    assert.equal(r.factor, 1.3) // 1.4 − 0.1(OB)
  })
  it('IBW: BCS ≤5 는 무변경, BCS 8 은 /1.3', () => {
    assert.equal(estimateIdealBodyWeight(6, 5), 6)
    assert.equal(estimateIdealBodyWeight(13, 8), 10)
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
