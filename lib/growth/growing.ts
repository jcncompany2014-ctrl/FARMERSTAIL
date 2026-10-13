/**
 * 성장기 강아지인가 — 체중 경보·리마인더 크론이 같은 조건으로 뺀다(2026-10-13 점검 E3).
 *
 * weight-change-detect(지금 12개월 미만 **또는** 마지막 분석이 성장기)와 weight-reminder(마지막 분석이 성장기)가
 * 각자 조건을 들고 있었고, intervention-alerts(6개월 추세로 '30일 안에 과체중 도달' 경보)는 아예 빼지 않았다.
 * 자라는 아이는 체중이 느는 게 정상이라 그 추세로 '과체중 경보'를 보냈다.
 *
 * 나이는 dogs.age_value/age_unit(dog-age-update 크론이 매일 갱신), 단계는 최신 analyses.stage(한글).
 * 나이를 모르고 단계도 성장기가 아니면 false.
 */
import { stageFromKR } from '../nutrition.ts'

export function isGrowingDog(input: {
  ageValue: number | null | undefined
  ageUnit: string | null | undefined
  latestStage?: string | null
}): boolean {
  const months =
    input.ageValue == null || !Number.isFinite(input.ageValue)
      ? null
      : input.ageUnit === 'years'
        ? input.ageValue * 12
        : input.ageValue
  if (months != null && months < 12) return true
  return stageFromKR(input.latestStage ?? null) === 'puppy'
}
