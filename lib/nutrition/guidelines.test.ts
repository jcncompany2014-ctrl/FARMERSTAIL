import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  bcsMerFactor,
  pregnancyTrimester,
  PREGNANCY_RER_MULTIPLIER,
  lactationRerMultiplier,
  pregnancyChipLabel,
  CONDITION_ADJUSTMENTS,
  BCS_DESCRIPTIONS,
  CHRONIC_CONDITION_LABELS,
  GUIDELINE_VERSION,
} from './guidelines.ts'
import type { BcsKey, ChronicConditionKey } from './guidelines.ts'

/**
 * lib/nutrition/guidelines.ts — 수의영양학 SSOT 테이블 회귀 가드.
 *
 *  - audit v1.6: bcsMerFactor BCS 1-2 = 1.20 (이전 1.40 → over-aggressive 수정)
 *  - audit #12: PREGNANCY chip 라벨과 multiplier 일관
 *  - audit B2: diabetes cite 정정 (iris_ckd → aafco2024 + nrc2006)
 *  - audit B3: obesity 별도 키 + WEIGHT_LOSS_DIET
 *  - audit #11: BCS 1 별도 분기 (refeeding risk) — bcsMerFactor 만으론 적용 X,
 *    호출처가 BCS=1 추가 케어. 그래도 factor 자체는 같이 검증.
 */

describe('bcsMerFactor (audit v1.6 회귀)', () => {
  it('BCS 1 = 1.20 (이전 1.40 → over-aggressive 수정)', () => {
    assert.equal(bcsMerFactor(1), 1.20)
  })

  it('BCS 2 = 1.20', () => {
    assert.equal(bcsMerFactor(2), 1.20)
  })

  it('BCS 3-4 = 1.10', () => {
    assert.equal(bcsMerFactor(3), 1.10)
    assert.equal(bcsMerFactor(4), 1.10)
  })

  it('BCS 5 = 1.0 (ideal)', () => {
    assert.equal(bcsMerFactor(5), 1.0)
  })

  it('BCS 6 = 0.95 / BCS 7 = 0.85 (감량 단계 1)', () => {
    assert.equal(bcsMerFactor(6), 0.95)
    assert.equal(bcsMerFactor(7), 0.85)
  })

  it('BCS 8 = 0.80 / BCS 9 = 0.75 (비만 — 감량 protocol)', () => {
    assert.equal(bcsMerFactor(8), 0.80)
    assert.equal(bcsMerFactor(9), 0.75)
  })

  it('단조 증가 X — BCS 1-5 까지는 1.20 → 1.0 으로 감소', () => {
    // 1-2 (1.20) > 3-4 (1.10) > 5 (1.0)
    assert.ok(bcsMerFactor(1) > bcsMerFactor(3))
    assert.ok(bcsMerFactor(3) > bcsMerFactor(5))
  })

  it('단조 감소 — BCS 5-9 까지 1.0 → 0.75', () => {
    // 5 (1.0) > 6 (0.95) > 7 (0.85) > 8 (0.80) > 9 (0.75)
    assert.ok(bcsMerFactor(5) > bcsMerFactor(6))
    assert.ok(bcsMerFactor(6) > bcsMerFactor(7))
    assert.ok(bcsMerFactor(7) > bcsMerFactor(8))
    assert.ok(bcsMerFactor(8) > bcsMerFactor(9))
  })

  it('NRC weight-gain ≤+20% 가드 — BCS 1-2 final 보호', () => {
    // adult-active stage base 1.8 × bcsMerFactor 1.20 = 2.16 (안전 상한)
    // 이전 1.40 였을 시 1.8 × 1.40 = 2.52 → 위장 부담 / 급증 위험.
    const stageBase = 1.8
    const final = stageBase * bcsMerFactor(2)
    assert.ok(final <= 2.2, `BCS 2 + active final ${final} 가 안전 상한 초과`)
  })
})

describe('pregnancyTrimester', () => {
  it('week 1-3 → early', () => {
    assert.equal(pregnancyTrimester(1), 'early')
    assert.equal(pregnancyTrimester(2), 'early')
    assert.equal(pregnancyTrimester(3), 'early')
  })

  it('week 4-5 → mid', () => {
    assert.equal(pregnancyTrimester(4), 'mid')
    assert.equal(pregnancyTrimester(5), 'mid')
  })

  it('week 6+ → late', () => {
    assert.equal(pregnancyTrimester(6), 'late')
    assert.equal(pregnancyTrimester(9), 'late')
    assert.equal(pregnancyTrimester(12), 'late')
  })

  it('null / 0 / 음수 → early (방어)', () => {
    assert.equal(pregnancyTrimester(null), 'early')
    assert.equal(pregnancyTrimester(0), 'early')
    assert.equal(pregnancyTrimester(-1), 'early')
  })
})

describe('PREGNANCY_RER_MULTIPLIER (audit #12 SSOT)', () => {
  it('early = 1.3, mid = 1.5, late = 1.8', () => {
    assert.equal(PREGNANCY_RER_MULTIPLIER.early, 1.3)
    assert.equal(PREGNANCY_RER_MULTIPLIER.mid, 1.5)
    assert.equal(PREGNANCY_RER_MULTIPLIER.late, 1.8)
  })

  it('audit #12 — 단조 증가 (trimester 진행 시 ↑)', () => {
    assert.ok(
      PREGNANCY_RER_MULTIPLIER.early <
        PREGNANCY_RER_MULTIPLIER.mid,
    )
    assert.ok(
      PREGNANCY_RER_MULTIPLIER.mid <
        PREGNANCY_RER_MULTIPLIER.late,
    )
  })

  it('NRC §15.6 권장 범위 — 1.3 ~ 1.8 사이', () => {
    for (const t of ['early', 'mid', 'late'] as const) {
      const v = PREGNANCY_RER_MULTIPLIER[t]
      assert.ok(v >= 1.3 && v <= 2.0, `${t}: ${v}`)
    }
  })
})

describe('pregnancyChipLabel (audit #12 chip ↔ multiplier 일관)', () => {
  it('late chip 의 범위 (1.6-2.0×) 가 실제 multiplier 1.8 을 포함', () => {
    const label = pregnancyChipLabel(7)
    assert.match(label, /1\.6-2\.0/)
    // 1.8 ∈ [1.6, 2.0]
    assert.ok(
      PREGNANCY_RER_MULTIPLIER.late >= 1.6 &&
        PREGNANCY_RER_MULTIPLIER.late <= 2.0,
    )
  })

  it('mid chip (1.4-1.6×) 가 multiplier 1.5 포함', () => {
    const label = pregnancyChipLabel(5)
    assert.match(label, /1\.4-1\.6/)
    assert.ok(
      PREGNANCY_RER_MULTIPLIER.mid >= 1.4 &&
        PREGNANCY_RER_MULTIPLIER.mid <= 1.6,
    )
  })

  it('early chip (1.2-1.4×) 가 multiplier 1.3 포함', () => {
    const label = pregnancyChipLabel(2)
    assert.match(label, /1\.2-1\.4/)
    assert.ok(
      PREGNANCY_RER_MULTIPLIER.early >= 1.2 &&
        PREGNANCY_RER_MULTIPLIER.early <= 1.4,
    )
  })

  it('null 입력 → early 기본', () => {
    const label = pregnancyChipLabel(null)
    assert.match(label, /1\.2-1\.4/)
  })
})

describe('lactationRerMultiplier', () => {
  it('null → 2.5 default (≈ 1.4 pups)', () => {
    assert.equal(lactationRerMultiplier(null), 2.5)
  })

  it('1 마리 → 2.2 (=1.5 + 0.7×1)', () => {
    assert.equal(lactationRerMultiplier(1), 2.2)
  })

  it('5 마리 → 5.0 (cap)', () => {
    assert.equal(lactationRerMultiplier(5), 5.0)
  })

  it('8 마리 이상 → 5.0 cap (식욕 한계)', () => {
    assert.equal(lactationRerMultiplier(8), 5.0)
    assert.equal(lactationRerMultiplier(12), 5.0) // 더 많아도 cap
  })

  it('0 / 음수 → 2.5 default', () => {
    assert.equal(lactationRerMultiplier(0), 2.5)
    assert.equal(lactationRerMultiplier(-1), 2.5)
  })

  it('단조 증가 (litter ↑ → multiplier ↑) 최대 cap 까지', () => {
    assert.ok(lactationRerMultiplier(2) < lactationRerMultiplier(3))
    assert.ok(lactationRerMultiplier(3) < lactationRerMultiplier(4))
  })
})

describe('CONDITION_ADJUSTMENTS — 회귀 가드', () => {
  it('audit B2 — diabetes cite 가 iris_ckd 아님 (CKD 가이드라인 오인용 X)', () => {
    const d = CONDITION_ADJUSTMENTS.diabetes
    assert.ok(!d.cite.includes('iris_ckd'))
    assert.ok(d.cite.includes('aafco2024') || d.cite.includes('nrc2006'))
  })

  it('audit B3 — obesity 별도 키 + WEIGHT_LOSS_DIET flag', () => {
    const o = CONDITION_ADJUSTMENTS.obesity
    assert.ok(o.riskFlags.includes('WEIGHT_LOSS_DIET'))
    // 근육 보존 위해 protein +, fat ↓
    assert.ok(o.proteinDelta > 0)
    assert.ok(o.fatDelta < 0)
  })

  it('kidney (CKD) — 인 제한 micro factor 0.6 (IRIS 권장)', () => {
    const k = CONDITION_ADJUSTMENTS.kidney
    assert.equal(k.micro?.phosphorusFactor, 0.6)
    assert.ok(k.vetConsult)
  })

  it('cardiac / mmvd — sodium 제한 (ACVIM Keene 2019)', () => {
    assert.ok((CONDITION_ADJUSTMENTS.cardiac.micro?.sodiumFactor ?? 1) < 1)
    assert.ok((CONDITION_ADJUSTMENTS.mmvd.micro?.sodiumFactor ?? 1) < 1)
  })

  it('pancreatitis — 저지방 필수 (fat negative + LOW_FAT_REQUIRED)', () => {
    const p = CONDITION_ADJUSTMENTS.pancreatitis
    assert.ok(p.fatDelta < 0)
    assert.ok(p.riskFlags.includes('LOW_FAT_REQUIRED'))
  })

  it('epi (외분비 췌장 부전) — pancreatitis 와 다른 별개 패턴', () => {
    const epi = CONDITION_ADJUSTMENTS.epi
    const panc = CONDITION_ADJUSTMENTS.pancreatitis
    // EPI 는 정상 fat OK, pancreatitis 는 저지방 필수 — 서로 다름
    assert.notEqual(epi.fatDelta, panc.fatDelta)
    assert.ok(epi.riskFlags.includes('EPI_ENZYME_REQUIRED'))
  })

  it('critical 만성질환에 cite 또는 vetConsult 둘 중 하나 (책임 추적)', () => {
    // dental 같은 minor 조건 (텍스처 권장만, 의료 처치 X) 은 면제.
    const MINOR_EXEMPT: ChronicConditionKey[] = ['dental']
    const keys = (Object.keys(CONDITION_ADJUSTMENTS) as ChronicConditionKey[])
      .filter((k) => !MINOR_EXEMPT.includes(k))
    for (const k of keys) {
      const adj = CONDITION_ADJUSTMENTS[k]
      const hasResponsibility = adj.cite.length > 0 || adj.vetConsult
      assert.ok(
        hasResponsibility,
        `${k} 가 cite 와 vetConsult 둘 다 없음 — 책임 추적 X`,
      )
    }
  })

  it('CHRONIC_CONDITION_LABELS 가 CONDITION_ADJUSTMENTS 와 1:1 매핑', () => {
    const adjKeys = Object.keys(CONDITION_ADJUSTMENTS).sort()
    const labelKeys = Object.keys(CHRONIC_CONDITION_LABELS).sort()
    assert.deepEqual(adjKeys, labelKeys)
  })
})

describe('BCS_DESCRIPTIONS — risk classification', () => {
  it('BCS 1-2 → severe_under', () => {
    assert.equal(BCS_DESCRIPTIONS[1].risk, 'severe_under')
    assert.equal(BCS_DESCRIPTIONS[2].risk, 'severe_under')
  })

  it('BCS 5 → ideal', () => {
    assert.equal(BCS_DESCRIPTIONS[5].risk, 'ideal')
  })

  it('BCS 8-9 → severe_over', () => {
    assert.equal(BCS_DESCRIPTIONS[8].risk, 'severe_over')
    assert.equal(BCS_DESCRIPTIONS[9].risk, 'severe_over')
  })

  it('모든 BCS 1-9 정의 (key 누락 X)', () => {
    for (let i = 1 as BcsKey; i <= 9; i = ((i + 1) as BcsKey)) {
      assert.ok(BCS_DESCRIPTIONS[i], `BCS ${i} 누락`)
      if (i === 9) break
    }
  })
})

describe('GUIDELINE_VERSION', () => {
  it('주요 인용 출처 명시 — NRC + AAFCO + FEDIAF + WSAVA + IRIS + KFA', () => {
    assert.match(GUIDELINE_VERSION, /NRC/)
    assert.match(GUIDELINE_VERSION, /AAFCO/)
    assert.match(GUIDELINE_VERSION, /FEDIAF/)
    assert.match(GUIDELINE_VERSION, /WSAVA/)
    assert.match(GUIDELINE_VERSION, /IRIS/)
    assert.match(GUIDELINE_VERSION, /KFA/)
  })
})
