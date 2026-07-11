/**
 * 칼로리 v2 4단계 — 견종 플래그 브리지 (스펙 §6 M4b·§7).
 *
 * dogs.breed(한글 자유 라벨: "토이푸들", "골든 리트리버"…)를 기존
 * lib/breeds/registry 로 정규화 매칭 → 스펙 BreedKey → BreedFlags.
 *
 * 원칙(스펙): 견종은 kcal 숫자가 아니라 **플래그** — OB(비만경향)는
 * easy-keeper 와 OR 로 감산 1회, TOY 는 자견 정확식 −15%, BRA 는 활동 가산
 * 억제. 개체차(±30%)가 견종 평균차를 압도하므로 견종별 kcal 표는 만들지 않는다.
 */
import { BREEDS } from '../breeds/registry.ts'
import { breedToFlags } from './engine.ts'
import type { BreedFlags, BreedKey } from './types.ts'

/** registry code → 스펙 BreedKey. 미등재 code 는 unknown(플래그 없음). */
const CODE_TO_KEY: Record<string, BreedKey> = {
  maltese: 'maltese',
  toy_poodle: 'poodle_toy',
  // 미니 푸들·말티푸도 초소형 성장 과대추정 계열 — TOY 플래그 목적으로 동일 키.
  mini_poodle: 'poodle_toy',
  maltipoo: 'poodle_toy',
  pomeranian: 'pomeranian',
  shih_tzu: 'shih_tzu',
  bichon: 'bichon',
  chihuahua: 'chihuahua',
  corgi: 'welsh_corgi',
  dachshund: 'dachshund',
  cocker: 'cocker_spaniel',
  golden_retriever: 'golden_retriever',
  labrador: 'labrador',
  jindo: 'jindo',
  schnauzer_mini: 'schnauzer_mini',
  yorkie: 'yorkshire',
  french_bulldog: 'french_bulldog',
  mix: 'mixed',
}

/**
 * 스펙 16종 밖이지만 근거(VetCompass·Pegram 2021) 있는 추가 플래그.
 * BreedKey 를 늘리는 대신 플래그를 직접 부여.
 */
const EXTRA_FLAGS: Record<string, Partial<BreedFlags>> = {
  pug: { obeseProne: true, brachycephalic: true },
  bulldog: { obeseProne: true, brachycephalic: true },
  beagle: { obeseProne: true },
}

const NONE: BreedFlags = breedToFlags('unknown')

/** 공백·대소문자 무시 정규화 — DB 실값 "토이푸들" ↔ registry "토이 푸들" 정합. */
function norm(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase()
}

/** 한글 라벨/영문 alias/code 무엇이 와도 registry code 로. 미매칭 = null. */
export function registryCodeFromLabel(
  raw: string | null | undefined,
): string | null {
  const q = norm(raw ?? '')
  if (!q) return null
  const hit = BREEDS.find(
    (b) =>
      norm(b.label) === q || norm(b.alias ?? '') === q || norm(b.code) === q,
  )
  return hit?.code ?? null
}

/** dogs.breed 라벨 → 스펙 견종 플래그. 미매칭/믹스/미입력 = 플래그 없음. */
export function breedFlagsFromLabel(
  raw: string | null | undefined,
): BreedFlags {
  const code = registryCodeFromLabel(raw)
  if (!code) return NONE
  const key = CODE_TO_KEY[code]
  if (key) return breedToFlags(key)
  const extra = EXTRA_FLAGS[code]
  if (extra) return { ...NONE, ...extra }
  return NONE
}
