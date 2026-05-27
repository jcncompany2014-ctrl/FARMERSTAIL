/**
 * SubscriptionsClient 에서 사용하는 pure helper / 상수.
 *
 * 분할 (2026-05-27): `app/(main)/mypage/subscriptions/SubscriptionsClient.tsx`
 * 의 bundle 크기를 줄이기 위해 컴포넌트 외부 헬퍼들을 추출. 동작 / 시그니처 변경 없음.
 */

export type StatusToken = 'sage' | 'yellow' | 'inkMute'

/**
 * billing-auth fallback customerKey 생성기.
 */
export function generateFallbackCustomerKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * 결제 재시도 시각 KST 포맷.
 */
export function formatRetryAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const fmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('month')}월 ${get('day')}일 ${get('hour')}:${get('minute')}`
}

export const STATUS_MAP: Record<
  'active' | 'paused' | 'cancelled',
  { label: string; tone: StatusToken }
> = {
  active: { label: '구독 중', tone: 'sage' },
  paused: { label: '일시정지', tone: 'yellow' },
  cancelled: { label: '해지됨', tone: 'inkMute' },
}

export const INTERVAL_LABELS: Record<number, string> = {
  1: '매주',
  2: '2주마다',
  4: '4주마다',
}
