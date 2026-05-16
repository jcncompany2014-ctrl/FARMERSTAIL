/**
 * 활동량 표시 메타 — SSOT.
 *
 * audit 3-12: DogDetailClient / EditDogClient / SurveyClient 등 여러 곳에서
 * activity_level → 한글/아이콘 매핑을 따로 정의해 텍스트가 미묘하게 달랐다
 * ('활동적' vs '활발한', '보통' vs '중간'). 한 곳에서 정의해 import.
 */

export type ActivityLevel = 'low' | 'medium' | 'high'

export const ACTIVITY_LABEL_KR: Record<ActivityLevel, string> = {
  low: '낮음',
  medium: '보통',
  high: '활동적',
}

export const ACTIVITY_LUCIDE_ICON: Record<ActivityLevel, string> = {
  low: 'Moon',
  medium: 'Footprints',
  high: 'Zap',
}

export function activityLabel(level: string | null | undefined): string {
  if (level && level in ACTIVITY_LABEL_KR) {
    return ACTIVITY_LABEL_KR[level as ActivityLevel]
  }
  return '-'
}
