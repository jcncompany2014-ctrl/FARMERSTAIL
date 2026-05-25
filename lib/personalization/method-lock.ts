/**
 * 사용자 측정도구 잠금 (User Method Lock) — 42 deferred #20, voice-guidelines §9.
 *
 * 견주가 "이 변수는 현재 측정도구로 충분해요" 라고 명시한 변수에 대해
 * 시스템이 더 이상 도구 개선 push / nudge / hint 를 보내지 않게 하는 가드.
 *
 * # 데이터
 * `dogs.user_method_lock` JSONB 컬럼 — `{"weight": true, "feed": false}`.
 * 키 누락 / false / null = lock 해제 (default 행동). true = 권유 차단.
 *
 * # 사용처
 * - components/dashboard/AccuracyBreakdown.tsx — 변수별 lock 토글 UI
 * - lib/chat/proactive-nudges.ts — nudge 발송 전 isLocked() 확인
 * - lib/push.ts — push 발송 전 isLocked() 확인
 *
 * # 정책 (voice-guidelines §9 User Sovereignty)
 * - 잠금되어도 신뢰도 점수 산출은 그대로 (낮은 채로) — 사용자 자율 결정
 * - accuracy_user_boost 와 독립적으로 작동 (boost 는 score, lock 은 행동)
 */

import type { Json } from '@/lib/supabase/types'

/** 측정도구 잠금 가능한 변수 키. reliability.ts 의 AccuracyVar.key 와 동기화. */
export type LockableMethodKey = 'weight' | 'activity' | 'feed'

/** dogs.user_method_lock JSONB 의 구조 — 옵셔널 boolean 키. */
export type UserMethodLock = Partial<Record<LockableMethodKey, boolean>>

/** 빈 default. INSERT 시 사용. */
export const EMPTY_LOCK: UserMethodLock = {}

/**
 * JSONB Json 값을 type-safe UserMethodLock 으로 변환. 잘못된 값 (null, 배열,
 * primitive 등) 은 빈 객체로 안전 fallback.
 */
export function parseLock(value: Json | null | undefined): UserMethodLock {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  const obj = value as Record<string, unknown>
  const result: UserMethodLock = {}
  for (const key of ['weight', 'activity', 'feed'] as LockableMethodKey[]) {
    const v = obj[key]
    if (typeof v === 'boolean') result[key] = v
  }
  return result
}

/**
 * 특정 변수의 lock 여부. true = push/nudge skip.
 */
export function isLocked(
  lock: UserMethodLock | Json | null | undefined,
  key: LockableMethodKey,
): boolean {
  const parsed = parseLock(lock as Json)
  return parsed[key] === true
}

/**
 * 잠금 토글 — UPDATE 용 새 lock 객체 반환.
 * 기존 lock 의 다른 키는 보존. 지정한 key 만 새 boolean 으로 set.
 */
export function withLockToggled(
  lock: UserMethodLock | Json | null | undefined,
  key: LockableMethodKey,
  next: boolean,
): UserMethodLock {
  const parsed = parseLock(lock as Json)
  return { ...parsed, [key]: next }
}

/**
 * 사용자 노출 라벨 — voice-guidelines §9 톤. "이대로 쓸래" 같은 견주 주체 표현.
 */
export const METHOD_LOCK_LABELS: Record<LockableMethodKey, string> = {
  weight: '체중 측정 이대로 쓸래',
  activity: '활동량 추정 이대로 쓸래',
  feed: '급여 측정 이대로 쓸래',
}

export const METHOD_LOCK_HINT: Record<LockableMethodKey, string> = {
  weight: '시스템이 더 이상 체중 측정 도구 권유를 보내지 않아요',
  activity: '시스템이 더 이상 만보계/GPS 연동 권유를 보내지 않아요',
  feed: '시스템이 더 이상 급여 측정 도구 권유를 보내지 않아요',
}
