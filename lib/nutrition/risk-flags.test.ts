import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  RISK_FLAG_INFO,
  riskFlagLabel,
  riskFlagSeverity,
  riskFlagDesc,
} from './risk-flags.ts'

/**
 * lib/nutrition/risk-flags.ts — 영양 분석 risk flag 한국어 라벨.
 *
 * 회귀 가드:
 *  - audit #11: REFEEDING_RISK 가 critical severity + 단계적 증량 안내 포함
 *  - SEVERE_OBESITY critical / OVERWEIGHT info — 차등화
 *  - 모든 known flag 한국어 label (raw enum 노출 X)
 *  - unknown flag → raw 그대로 fallback (시스템 안 깨짐)
 */

describe('RISK_FLAG_INFO — 핵심 매핑', () => {
  it('REFEEDING_RISK — critical severity + 단계적 증량 안내 (audit #11)', () => {
    const info = RISK_FLAG_INFO.REFEEDING_RISK
    assert.ok(info)
    assert.equal(info?.severity, 'critical')
    assert.match(info?.label ?? '', /응급|저체중/)
    assert.match(info?.desc ?? '', /단계적|수의사|전해질/)
  })

  it('SEVERE_OBESITY — critical (월 -1kg 이상 감량 위험)', () => {
    const info = RISK_FLAG_INFO.SEVERE_OBESITY
    assert.equal(info?.severity, 'critical')
  })

  it('OVERWEIGHT — info (가벼운 안내)', () => {
    const info = RISK_FLAG_INFO.OVERWEIGHT
    assert.equal(info?.severity, 'info')
  })

  it('SEVERE_UNDERWEIGHT — critical (REFEEDING_RISK 보다 약하지만 critical)', () => {
    const info = RISK_FLAG_INFO.SEVERE_UNDERWEIGHT
    assert.equal(info?.severity, 'critical')
  })

  it('GIANT_BREED — info (수의사 상담 권장 정도)', () => {
    const info = RISK_FLAG_INFO.GIANT_BREED
    assert.equal(info?.severity, 'info')
  })

  it('만성질환 flag (kidney/cardiac/pancreatitis) 모두 high', () => {
    for (const flag of [
      'CKD_DIET_REQUIRED',
      'CARDIAC_LOW_SODIUM',
      'LOW_FAT_REQUIRED',
      'DIABETIC_DIET_REQUIRED',
    ]) {
      assert.equal(
        RISK_FLAG_INFO[flag]?.severity,
        'high',
        `${flag} severity 가 high 아님`,
      )
    }
  })
})

describe('riskFlagLabel', () => {
  it('알려진 flag → 한국어 라벨', () => {
    assert.equal(riskFlagLabel('REFEEDING_RISK'), '응급 — 심한 저체중')
    assert.equal(riskFlagLabel('OVERWEIGHT'), '과체중')
    assert.equal(riskFlagLabel('GIANT_BREED'), '거대견 (50kg+)')
  })

  it('알 수 없는 flag → raw 그대로 fallback (시스템 안 깨짐)', () => {
    assert.equal(riskFlagLabel('NEW_FLAG_2026'), 'NEW_FLAG_2026')
  })

  it('영문 enum 그대로 노출되지 않음 (한국어 사용자 경험)', () => {
    const knownFlags = Object.keys(RISK_FLAG_INFO)
    for (const flag of knownFlags) {
      const label = riskFlagLabel(flag)
      // 한국어 문자 포함 (가-힣)
      assert.match(label, /[가-힣]/, `${flag} 라벨에 한국어 없음: "${label}"`)
    }
  })
})

describe('riskFlagSeverity', () => {
  it('알려진 flag → 정확한 severity', () => {
    assert.equal(riskFlagSeverity('REFEEDING_RISK'), 'critical')
    assert.equal(riskFlagSeverity('CKD_DIET_REQUIRED'), 'high')
    assert.equal(riskFlagSeverity('OVERWEIGHT'), 'info')
  })

  it('알 수 없는 flag → info fallback (안전 default)', () => {
    assert.equal(riskFlagSeverity('NEW_FLAG_2026'), 'info')
  })

  it('critical / high / info 셋 중 하나만 반환', () => {
    const allowedValues = new Set(['critical', 'high', 'info'])
    for (const flag of Object.keys(RISK_FLAG_INFO)) {
      assert.ok(allowedValues.has(riskFlagSeverity(flag)))
    }
  })
})

describe('riskFlagDesc', () => {
  it('알려진 flag → 짧은 설명 문자열', () => {
    const desc = riskFlagDesc('REFEEDING_RISK')
    assert.ok(desc.length > 0)
    assert.match(desc, /[가-힣]/)
  })

  it('알 수 없는 flag → 빈 문자열', () => {
    assert.equal(riskFlagDesc('NEW_FLAG_2026'), '')
  })
})

describe('회귀 가드 — flag 정합성', () => {
  it('nutrition.ts 에서 push 하는 모든 flag 가 매핑됨 (운영 누락 차단)', () => {
    // calculateNutrition 에서 emit 되는 핵심 flag 목록 — 신규 추가 시 동시 등록.
    const emittedFlags = [
      'REFEEDING_RISK',
      'SEVERE_UNDERWEIGHT',
      'UNDERWEIGHT',
      'OVERWEIGHT',
      'SEVERE_OBESITY',
      'GIANT_BREED',
    ]
    for (const flag of emittedFlags) {
      assert.ok(
        RISK_FLAG_INFO[flag],
        `${flag} 가 emit 되지만 매핑 없음 — 사용자 raw enum 노출`,
      )
    }
  })

  it('만성질환별 flag (guidelines.ts CONDITION_ADJUSTMENTS) 매핑 누락 차단', () => {
    const chronicFlags = [
      'CKD_DIET_REQUIRED',
      'DIABETIC_DIET_REQUIRED',
      'CARDIAC_LOW_SODIUM',
      'LOW_FAT_REQUIRED',
      'HYPOALLERGENIC_DIET',
      'JOINT_SUPPORT',
      'HEPATIC_SUPPORT',
      'KETOGENIC_DIET',
      'LOW_OXALATE_DIET', // urinary_stone (매핑 누락 점검용)
      'COGNITIVE_SUPPORT',
      'STEROID_SIDE_EFFECTS',
      'EPI_ENZYME_REQUIRED',
      'HYPOTHYROID_WEIGHT',
      'CUSHINGS_DIET',
      'IVDD_WEIGHT',
      'TRACHEAL_WEIGHT',
      'SINGLE_PROTEIN_REQUIRED',
      'WEIGHT_LOSS_DIET',
    ]
    const missing = chronicFlags.filter((f) => !RISK_FLAG_INFO[f])
    // 누락된 게 있으면 fail 메시지로 어떤 flag 인지 알림
    assert.deepEqual(missing, [], `매핑 누락: ${missing.join(', ')}`)
  })
})
