/**
 * 챗봇 능동 개입 (proactive nudges).
 *
 * 사용자가 챗봇에 진입했을 때 history 가 비어있거나 마지막 대화가
 * 오래된 경우, 영양 도우미가 먼저 "함께 점검해볼까요?" 라고
 * 부드럽게 제안하는 1건 메시지.
 *
 * # 정책 (voice-guidelines)
 * - §1: "신뢰도" 단어 X — "맞춤도" 또는 우회 표현.
 * - §4: 부정 정보는 견 주어 + 부드럽게 (예: BCS 7 → "살을 살짝 빼볼까요")
 * - §5: 능동 개입 빈도 — push 와 채널 별개라 빈도 상한 없지만, 한 세션
 *      안에 한 번만. 24h dismiss 는 클라이언트가 처리.
 * - §6: 첫 4주 보호 — 임상 표현 자제, 검사 권유 자제.
 *
 * # 우선순위
 * BCS 극단(7+/3-) > 14일+ 체중 미기록 > 알레르기 자가진단 > 첫 진입.
 * 가장 시급한 1건만 반환 — 모달이 4건 쌓이지 않게.
 */

// 상대경로 + 명시 .ts — proactive-nudges.test.ts 가 node --test(별칭 미해석·
// ESM 확장자 필수)로 직접 로드하므로 `@/` 별칭이면 테스트가 로드 실패한다
// (milestones.ts 와 동일 이슈·engine.ts 패턴).
import { petName } from '../korean.ts'

export type ChatNudgeReason =
  | 'bcs_high'
  | 'bcs_low'
  | 'stale_weight'
  | 'allergy_unverified'
  | 'first_chat'

export type ChatNudge = {
  reason: ChatNudgeReason
  message: string
  /** 옵션 — 사용자가 클릭하면 input 에 자동 주입되는 시작 질문. */
  promptSuggestion?: string
}

export type NudgeContext = {
  dogName: string | null
  /** 1~9. null = 분석 0건. */
  latestBcs: number | null
  /** null = 측정 0건. */
  daysSinceLastWeight: number | null
  /** dogs.allergies_source — D4 phase 컬럼. */
  allergiesSource:
    | 'self_suspected'
    | 'vet_diagnosed'
    | 'unknown'
    | null
  /** 가입일로부터 며칠 — 첫 4주 보호 phase 판단용. null=알 수 없음. */
  daysSinceSignup: number | null
  /** R32 #20 — dogs.user_method_lock. 변수별 권유 차단. voice-guidelines §9. */
  methodLock?: {
    weight?: boolean
    activity?: boolean
    feed?: boolean
  }
}

const GRACE_PERIOD_DAYS = 28

export function computeChatNudge(ctx: NudgeContext): ChatNudge | null {
  const name = ctx.dogName?.trim() || '강아지'
  const inGrace =
    ctx.daysSinceSignup != null && ctx.daysSinceSignup < GRACE_PERIOD_DAYS

  // BCS 7 이상 (과체중) — 임상 표현 X. 첫 4주에는 검사/식단 권유 자제.
  if (ctx.latestBcs != null && ctx.latestBcs >= 7 && !inGrace) {
    return {
      reason: 'bcs_high',
      message: `${name}의 BCS 가 ${ctx.latestBcs}/9 로 약간 높게 나왔어요. 살을 부드럽게 빼는 식단을 같이 정리해볼까요?`,
      promptSuggestion: `${petName(name)}가 BCS ${ctx.latestBcs}인데 어떤 식단이 좋을까요?`,
    }
  }
  // BCS 3 이하 (저체중)
  if (ctx.latestBcs != null && ctx.latestBcs <= 3 && !inGrace) {
    return {
      reason: 'bcs_low',
      message: `${name}의 BCS 가 ${ctx.latestBcs}/9 — 살을 살짝 더 붙일 수 있는 식단 어떨까요?`,
      promptSuggestion: `${name}의 체중을 늘리는 식단 추천해주세요`,
    }
  }
  // 14일+ 체중 미기록 — R32 #20: weight 측정도구 lock 이면 권유 skip
  // (voice-guidelines §9 견주 자율성). 잠긴 사용자는 stale_weight 무시.
  if (
    ctx.daysSinceLastWeight != null &&
    ctx.daysSinceLastWeight >= 14 &&
    !inGrace &&
    !ctx.methodLock?.weight
  ) {
    return {
      reason: 'stale_weight',
      message: `${name}의 체중을 ${ctx.daysSinceLastWeight}일 동안 안 재셨네요. 측정이 어려우면 사진으로 추정하는 방법도 같이 알려드릴 수 있어요.`,
      promptSuggestion: '강아지 체중을 정확히 재는 방법 알려주세요',
    }
  }
  // 알레르기 자가진단만 (수의사 미확진)
  if (ctx.allergiesSource === 'self_suspected' && !inGrace) {
    return {
      reason: 'allergy_unverified',
      message: `${name}의 알레르기가 자가 관찰로 입력돼있네요. 식단 안전을 위해 알레르기 검사를 알아보면 어떨까요? 무리해서 권하는 건 아니에요.`,
      promptSuggestion: '강아지 알레르기 검사는 어떻게 진행하나요?',
    }
  }
  // 첫 진입 (또는 보호 phase 안) — 가벼운 인사
  return {
    reason: 'first_chat',
    message: inGrace
      ? `안녕하세요. 영양 도우미예요. 처음 함께하는 시기라 천천히 익숙해지면 돼요. 궁금한 거 편하게 물어봐주세요.`
      : `안녕하세요. 영양 도우미예요. ${name}에 대해 어떤 게 가장 궁금하세요?`,
  }
}
