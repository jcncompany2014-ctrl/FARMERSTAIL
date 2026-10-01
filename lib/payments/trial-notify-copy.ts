import { petName } from '../korean.ts'

/**
 * 체험단 도장 알림 문구·관리자 결과 한 줄 — 순수 함수(테스트용으로 lib/payments/trial-notify.ts 에서 분리).
 * ★문구는 사장님이 아직 정하지 않았다(2026-10-01) — 바꿀 땐 여기만. 비율%·"언제든"·전문용어 금지.
 */
export const TRIAL_STAMP_COPY = {
  title: '파머스테일 서포터즈로 선정됐어요',
  body(p: { dogName: string | null; cheap: number; half: number }): string {
    const who = p.dogName ? `${petName(p.dogName)} ` : ''
    const perk =
      p.cheap > 0
        ? `${who}첫 박스 ${p.cheap}번은 100원이에요.`
        : p.half > 0
          ? `${who}첫 박스 ${p.half}번은 반값이에요.`
          : `${who}서포터즈 혜택이 준비됐어요.`
    return p.dogName
      ? `${perk} 지금 플랜을 고르고 카드를 등록해 주세요.`
      : `${perk} 우리 아이를 등록하고 카드를 등록해 주세요.`
  },
} as const

export type TrialPushResult = { sent: number; reason: string | null; url: string }

/** 관리자 화면용 한 줄 — 알림이 실제로 갔는지. */
export function trialPushLabel(r: TrialPushResult): string {
  if (r.sent > 0) return '앱 알림을 보냈어요.'
  switch (r.reason) {
    case 'QUIET_HOURS':
      return '고객이 정한 조용한 시간이라 앱 알림은 보내지 않았어요.'
    case 'CATEGORY_DISABLED':
      return '고객이 이 종류의 알림을 꺼 둬서 앱 알림은 보내지 않았어요.'
    case 'TARGET_LOOKUP_FAILED':
    case 'PUSH_THREW':
    case 'SUBS_QUERY_FAILED':
    case 'ADMIN_CLIENT_UNAVAILABLE':
      return '앱 알림을 보내지 못했어요(일시 오류) — 고객에게 직접 알려 주세요.'
    default:
      return '앱 알림을 받을 기기가 없어요(앱 미설치·알림 미허용) — 고객에게 직접 알려 주세요.'
  }
}
