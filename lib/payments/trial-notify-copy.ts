import { petName } from '../korean.ts'
import { DELIVERY_INTERVAL_DAYS } from '../personalization/cycle.ts'

/**
 * 체험단 도장 알림 문구·관리자 결과 한 줄 — 순수 함수(테스트용으로 lib/payments/trial-notify.ts 에서 분리).
 * 비율%·"언제든"·전문용어 금지.
 *
 * ★회차("첫 박스 4번")가 아니라 **기간과 총액**으로 말한다(사장님 2026-10-01 "첫 박스 4번이라
 *   말하지 말고 기간으로 말해 — 56일치 밥이 총 400원이에요"). 박스 하나 = 2주(DELIVERY_INTERVAL_DAYS)
 *   치라 100원 박스 4개 = 56일치 · 총 400원. 회차·단가는 도장 행 값(관리자가 바꿀 수 있음)에서 계산한다.
 */
export const TRIAL_STAMP_COPY = {
  title: '파머스테일 서포터즈로 선정됐어요',
  body(p: { dogName: string | null; cheap: number; half: number; cheapPrice?: number }): string {
    const who = p.dogName ? `${petName(p.dogName)} ` : ''
    // 청구와 같은 단가 규칙(lib/payments/trial.ts trialPricing: 최소 100원).
    const price = Math.max(100, Math.trunc(p.cheapPrice ?? 100))
    const perk =
      p.cheap > 0
        ? `${who}${p.cheap * DELIVERY_INTERVAL_DAYS}일치 밥이 총 ${(p.cheap * price).toLocaleString('ko-KR')}원이에요.`
        : p.half > 0
          ? `${who}${p.half * DELIVERY_INTERVAL_DAYS}일치 밥이 반값이에요.`
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
