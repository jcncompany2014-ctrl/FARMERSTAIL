/**
 * 마일스톤 축하 헬퍼 — voice-guidelines §10 정책.
 *
 * "초롱이의 정밀 케어 100일", "1년 함께한 가족" 같은 시점에 축하 카드.
 * 시스템의 성공이 아닌 견의 성취를 축하 (견 주어).
 *
 * 사용
 * ────
 *   const m = currentMilestone(profile.created_at, dog.created_at)
 *   if (m) return <MilestoneCard milestone={m} />
 */

export type Milestone = {
  /** 기준일로부터 N일 — 30, 100, 365, 730 등 */
  daysSince: number
  /** 사용자에게 보일 라벨 */
  label: string
  /** kicker (영문 부제) */
  kicker: string
  /** 축하 메시지 ({name} placeholder 치환됨) */
  message: string
  /** 색 tone */
  tone: 'gold' | 'terracotta' | 'moss'
}

const MILESTONES: Milestone[] = [
  {
    daysSince: 30,
    label: '한 달 함께',
    kicker: 'Month One',
    message: '{name}와 함께한 첫 한 달. 새 식단에 잘 적응했어요',
    tone: 'moss',
  },
  {
    daysSince: 100,
    label: '정밀 케어 100일',
    kicker: 'Day 100',
    message: '{name}의 100일 — 정성껏 챙겨주셔서 고마워요',
    tone: 'terracotta',
  },
  {
    daysSince: 365,
    label: '함께한 1년',
    kicker: 'One Year',
    message: '{name}와의 1년. 단짝이라는 표현이 이래서 있나봐요',
    tone: 'gold',
  },
  {
    daysSince: 730,
    label: '함께한 2년',
    kicker: 'Two Years',
    message: '{name}와의 2년. 시간이 빠르네요',
    tone: 'gold',
  },
  {
    daysSince: 1095,
    label: '함께한 3년',
    kicker: 'Three Years',
    message: '{name}와의 3년. 평생 가족이에요',
    tone: 'gold',
  },
]

/**
 * 가장 최근 도달한 마일스톤 (지난 7일 이내 도달). 없으면 null.
 *
 * audit #15: 365일 이상 anniversary milestone 은 윤년 보정 — 가입일 (월/일)
 * 과 일치하는 anniversary 를 ±3일 윈도우로 확인. 1년 = 365.25일 평균이라
 * 단순 days 365 비교는 4년에 1일씩 어긋남. 사용자 직관 "2주년 = 같은 월일"
 * 과 일치하도록 calendar-aware 비교.
 */
export function currentMilestone(
  joinedAt: string | Date | null | undefined,
  nowMs: number = Date.now(),
): Milestone | null {
  if (!joinedAt) return null
  const joined = typeof joinedAt === 'string' ? new Date(joinedAt) : joinedAt
  const days = Math.floor((nowMs - joined.getTime()) / 86_400_000)
  const now = new Date(nowMs)

  // 내림차순으로 가장 큰 milestone 부터 확인.
  for (let i = MILESTONES.length - 1; i >= 0; i -= 1) {
    const m = MILESTONES[i]

    // 365+ 일 anniversary 는 calendar-aware (월/일 매칭 ±3일).
    if (m.daysSince >= 365) {
      const years = Math.round(m.daysSince / 365)
      const anniversary = new Date(joined.getTime())
      anniversary.setFullYear(joined.getFullYear() + years)
      const diff = (now.getTime() - anniversary.getTime()) / 86_400_000
      if (diff >= -3 && diff <= 7) return m
      continue
    }

    // 1년 미만 milestone (30/100/200일 등) — 단순 days.
    if (days >= m.daysSince && days < m.daysSince + 7) return m
  }
  return null
}

/**
 * {name} placeholder 치환. 견 이름 없으면 "우리 아이" fallback.
 */
export function renderMilestoneMessage(m: Milestone, dogName: string | null): string {
  return m.message.replace(/\{name\}/g, dogName ?? '우리 아이')
}

/**
 * 정밀 케어 자기 평가 인증 — 사용자 자존감 부여 (voice-guidelines §10).
 * 부정 정보의 정반대. 측정 정확도가 상위 30% 이상이면 "정밀 케어 가족"
 * 라벨 부여. 등급 시스템과 별개 축.
 *
 * 입력 신뢰도 점수가 아직 없으므로 placeholder. 실제 데이터 모이면 분포
 * 기반 percentile 산출.
 */
export type CareLabel = 'precise_care_family' | null

export function computeCareLabel(accuracyScore: number | null): CareLabel {
  if (accuracyScore == null) return null
  // 0.85+ = 상위 30% 가정 (추후 분포 기반으로 보정)
  return accuracyScore >= 0.85 ? 'precise_care_family' : null
}

export const CARE_LABELS: Record<NonNullable<CareLabel>, { label: string; kicker: string; description: string }> = {
  precise_care_family: {
    label: '정밀 케어 가족',
    kicker: 'Precise Care Family',
    description: '상위 30% 정확한 측정으로 케어 중이에요',
  },
}
