/**
 * Capacitor LocalNotifications wrapper (R17-E50).
 *
 * native (iOS/Android) 에서 로컬 알림 발송. 약물 / 정기배송 / 사용자 정의
 * 리마인더 사용. Web (PWA) 에선 web-push 가 따로 처리.
 *
 * 도입 필요 패키지 (사용 전 npm install):
 *   @capacitor/local-notifications
 *
 * 권한 흐름:
 *   1. checkPermissions() — 'granted' / 'denied' / 'prompt'
 *   2. prompt 이면 requestPermissions()
 *   3. granted 이면 schedule()
 *
 * # 사용
 *
 *   await ensureNotificationsPermission()
 *   await scheduleMedicationReminder({
 *     id: 1001, name: '심장사상충 예방약', at: new Date(...),
 *   })
 */

import { isNativeApp } from './capacitor'

const isCapacitorNative = isNativeApp

interface ScheduleOptions {
  id: number
  title: string
  body: string
  at: Date
  /** 매일 / 매주 등 반복. cron 형식. */
  repeats?: 'daily' | 'weekly' | null
}

// 패키지 도입 전이라 typed import 가 안 됨. 런타임에 dynamic require — 미설치 시
// null. 사용자가 `npm i @capacitor/local-notifications` 후 자동 활성.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modulePromise: Promise<any> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadModule(): Promise<any> {
  if (!isCapacitorNative()) return null
  if (!modulePromise) {
    modulePromise = (
      import(/* webpackIgnore: true */ '@capacitor/local-notifications' as string).catch(
        () => null,
      )
    )
  }
  return modulePromise
}

export async function ensureNotificationsPermission(): Promise<boolean> {
  const mod = await loadModule()
  if (!mod) return false
  try {
    const status = await mod.LocalNotifications.checkPermissions()
    if (status.display === 'granted') return true
    if (status.display === 'denied') return false
    const req = await mod.LocalNotifications.requestPermissions()
    return req.display === 'granted'
  } catch (e) {
    console.error('local-notifications permission', e)
    return false
  }
}

export async function scheduleNotification(
  opts: ScheduleOptions,
): Promise<boolean> {
  const mod = await loadModule()
  if (!mod) return false
  try {
    await mod.LocalNotifications.schedule({
      notifications: [
        {
          id: opts.id,
          title: opts.title,
          body: opts.body,
          schedule: {
            at: opts.at,
            ...(opts.repeats === 'daily'
              ? { every: 'day', repeats: true }
              : opts.repeats === 'weekly'
                ? { every: 'week', repeats: true }
                : {}),
          },
        },
      ],
    })
    return true
  } catch (e) {
    console.error('local-notifications schedule', e)
    return false
  }
}

export async function cancelNotification(id: number): Promise<void> {
  const mod = await loadModule()
  if (!mod) return
  try {
    await mod.LocalNotifications.cancel({ notifications: [{ id }] })
  } catch (e) {
    console.error('local-notifications cancel', e)
  }
}

/**
 * medication.id (UUID) → 안정된 integer ID 변환.
 * native LocalNotifications 는 integer ID 만 받음.
 */
export function uuidToNotificationId(uuid: string): number {
  // 첫 8자 hex → int32 (음수도 OK).
  return parseInt(uuid.replace(/-/g, '').slice(0, 8), 16) | 0
}
