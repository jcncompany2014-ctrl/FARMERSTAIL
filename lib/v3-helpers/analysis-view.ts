/**
 * AnalysisView 에서 사용하는 pure helper 함수들.
 *
 * 분할 (2026-05-27): `app/(main)/dogs/[id]/analysis/AnalysisView.tsx` 의 bundle
 * 크기를 줄이기 위해 컴포넌트 외부 헬퍼들을 추출. 동작 / 시그니처 변경 없음.
 */

/** RER = 70 · w^0.75  →  w = (RER / 70)^(4/3) */
export function weightFromRER(rer: number): number {
  return Math.pow(rer / 70, 4 / 3)
}

/**
 * Magazine HeroSection 용 나이 라벨. birth_date 우선, 없으면 age_value/unit.
 * 출력 예: "3세 4개월" / "8개월" / "성견 (나이 미상)".
 */
export function formatAgeLabel(dog: {
  birth_date: string | null
  age_value: number | null
  age_unit: string | null
}): string {
  if (dog.birth_date) {
    const b = new Date(dog.birth_date)
    const now = new Date()
    let years = now.getFullYear() - b.getFullYear()
    let months = now.getMonth() - b.getMonth()
    if (now.getDate() < b.getDate()) months -= 1
    if (months < 0) {
      years -= 1
      months += 12
    }
    if (years <= 0 && months <= 0) return '신생견'
    if (years <= 0) return `${months}개월`
    if (months <= 0) return `${years}세`
    return `${years}세 ${months}개월`
  }
  if (dog.age_value != null && dog.age_unit) {
    const unit = dog.age_unit === 'years' || dog.age_unit === '년' ? '세' : '개월'
    return `${dog.age_value}${unit}`
  }
  return '성견'
}

/**
 * analysis.supplements (string[]) → magazine SupplementsCard 행.
 * 알려진 키워드 매칭으로 icon · tag · reason 결정.
 */
export function mapSupplements(
  raw: string[],
): Array<{ name: string; tag: string; reason: string; icon: 'pill' | 'drop' | 'leaf' }> {
  return raw.slice(0, 3).map((label) => {
    const lower = label.toLowerCase()
    if (/오메가|epa|dha|피쉬|fish/.test(lower)) {
      return { name: label, tag: '피부·모질', reason: 'BCS·피모 윤기 보강', icon: 'drop' as const }
    }
    if (/프로바이오|장|gi|소화|probiotic/.test(lower)) {
      return { name: label, tag: '장 건강', reason: '단백 소화 보조', icon: 'leaf' as const }
    }
    return { name: label, tag: '기본', reason: 'AAFCO 미량성분 보강', icon: 'pill' as const }
  })
}

/**
 * 추이 카드의 ISO date → "M.D" 짧은 라벨. 잘못된 입력은 "-".
 */
export function formatDate(iso: string | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return `${d.getMonth() + 1}.${d.getDate()}`
}
