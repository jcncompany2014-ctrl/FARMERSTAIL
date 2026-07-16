/**
 * "보호자님께 한마디" 를 뻔하지 않게 만드는 **이야깃거리(wow angle)** 계산.
 *
 * # 왜 있나 (사장님 2026-07-16)
 * AI 코멘트가 "잘 크고 있어요" 수준이면 AI 를 붙인 값이 약하다. 이 아이만의
 * 사정을 짚어야 "우와" 가 나온다. 사장님이 원한 4개 앵글:
 *   ① 시계열 — "지난번보다"  ② 예측 — "이대로 가면"
 *   ③ 견종 맞춤            ④ 생일 (가입일 X, 생일만)
 *
 * # 숫자=규칙, 말=AI
 * 이 파일은 **숫자만** 낸다 — BCS 가 몇 단계 좋아졌는지, 급여량이 몇 % 조정됐는지,
 * 생일까지 며칠인지. 이 사실들을 프롬프트에 넘기면 AI 가 **그중 가장 인상적인
 * 하나만 골라** 따뜻한 한 문장으로 녹인다(다 나열하면 길어서 사장님이 싫어함).
 * 견종 특성·예측 표현은 AI 의 몫(=말)이라 여기서 딱딱하게 만들지 않는다 —
 * 대신 "이 견종/이 추세를 언급해도 좋다" 는 재료만 프롬프트가 열어준다.
 *
 * 앵글이 하나도 성립 안 하면 빈 배열 — 그럼 AI 는 평소대로 기본 톤으로 쓴다.
 */

export type WowAngleInput = {
  /** 현재 BCS (1~9, 4~5 이상적) */
  bcsScore: number
  /** 직전 분석 BCS. null = 첫 분석 */
  prevBcsScore: number | null
  /** 현재 일일 급여량(g) */
  feedG: number
  /** 직전 분석 급여량(g). null = 첫 분석 */
  prevFeedG: number | null
  /** 현재 생애주기 라벨 (예: "성견", "노령견") */
  stage: string
  /** 직전 분석 생애주기 라벨. null = 첫 분석 */
  prevStage: string | null
  /** 직전 분석 이후 경과일. null = 첫 분석 */
  daysSinceLast: number | null
  /** 다음 생일까지 남은 일수. 0 = 오늘. null = 생년월일 모름 */
  daysUntilBirthday: number | null
  /** 다음 생일에 되는 나이(살). null = 모름 */
  turningAge: number | null
}

export type WowAngle = {
  /** 앵글 종류 — 테스트·디버그용 */
  kind: 'timeseries' | 'birthday' | 'stage'
  /** AI 에게 넘길 사실 한 줄 (한국어) */
  fact: string
}

/** BCS 4~5 를 이상 체형으로 본다(WSAVA 9단계). 5 를 중심으로 거리 계산. */
const BCS_IDEAL = 5

/** 며칠 → 사람이 쓰는 표현 ("6일 전 / 약 3주 전 / 약 2개월 전"). */
function agoText(days: number): string {
  if (days <= 10) return `${days}일 전`
  if (days < 56) return `약 ${Math.round(days / 7)}주 전`
  return `약 ${Math.round(days / 30)}개월 전`
}

/**
 * 이야깃거리 후보들을 계산. 성립하는 것만 담아 반환(0~3개).
 * AI 는 이 중 **하나만** 고른다 — 우선순위는 프롬프트가 정하지 않고 AI 판단에 맡긴다
 * (그 아이한테 뭐가 제일 반가운 소식인지는 맥락이라서).
 */
export function buildWowAngles(input: WowAngleInput): WowAngle[] {
  const angles: WowAngle[] = []

  // ① 시계열 — 직전 분석 대비 BCS/급여량 변화. "지난번보다" + "이대로 가면"의 근거.
  if (
    input.prevBcsScore !== null &&
    input.daysSinceLast !== null &&
    input.daysSinceLast > 0
  ) {
    const when = agoText(input.daysSinceLast)
    const dBcs = input.bcsScore - input.prevBcsScore
    const prevDist = Math.abs(input.prevBcsScore - BCS_IDEAL)
    const curDist = Math.abs(input.bcsScore - BCS_IDEAL)

    if (dBcs !== 0) {
      // 이상 체형(5)에 가까워졌나 멀어졌나로 방향을 판단 — 단순 증감보다 정확.
      const toward = curDist < prevDist
      const dir = toward
        ? '이상적인 체형(BCS 4~5)에 더 가까워졌어요'
        : '이상 체형에서 조금 멀어졌어요 — 급여량·산책을 다시 살필 때예요'
      angles.push({
        kind: 'timeseries',
        fact: `${when} 분석에선 BCS ${input.prevBcsScore}였는데 이번엔 ${input.bcsScore} — ${dir}. (이 추세가 이어지면 어떻게 될지 "이대로 가면…"으로 살짝 짚어줘도 좋아요.)`,
      })
    } else if (input.prevFeedG !== null && input.prevFeedG > 0) {
      const pct = Math.round(
        ((input.feedG - input.prevFeedG) / input.prevFeedG) * 100,
      )
      if (Math.abs(pct) >= 5) {
        angles.push({
          kind: 'timeseries',
          fact: `${when} 대비 하루 급여량이 ${pct > 0 ? '+' : ''}${pct}% 조정됐어요(체형·성장 반영). 왜 바뀌었는지 안심되게 한마디 해주면 좋아요.`,
        })
      }
    }
  }

  // ③ 생애주기 전환 — "이제 성견/노령견 단계" 는 그 자체로 반가운/챙길 소식.
  if (
    input.prevStage !== null &&
    input.prevStage !== input.stage &&
    input.stage.trim().length > 0
  ) {
    angles.push({
      kind: 'stage',
      fact: `생애주기가 '${input.prevStage}'에서 '${input.stage}'(으)로 바뀌었어요. 이 시기에 보호자가 챙기면 좋은 걸 딱 하나 짚어줘도 좋아요.`,
    })
  }

  // ④ 생일 — 30일 이내일 때만. 가입일은 절대 언급 안 함(사장님 명시).
  if (
    input.daysUntilBirthday !== null &&
    input.daysUntilBirthday >= 0 &&
    input.daysUntilBirthday <= 30
  ) {
    const d = input.daysUntilBirthday
    const ageText =
      input.turningAge !== null ? ` ${input.turningAge}살이 돼요.` : ''
    const whenText =
      d === 0 ? '오늘이 생일이에요!' : d <= 7 ? `${d}일 뒤가 생일이에요.` : `${d}일 뒤 생일이 다가와요.`
    angles.push({
      kind: 'birthday',
      fact: `${whenText}${ageText} 생일을 살짝 축하해주면 보호자가 좋아해요(선물·할인 얘기는 하지 말고 마음만).`,
    })
  }

  return angles
}

/**
 * 다음 생일까지 남은 일수 + 그때 되는 나이. 생년월일(YYYY-MM-DD) 기준.
 * nowMs 를 주입받아 순수 함수로 유지(테스트·SSR 안전).
 * 반환 daysUntil 은 0(오늘)~365. 잘못된 입력이면 null.
 */
export function birthdayInfo(
  birthISO: string | null,
  nowMs: number,
): { daysUntil: number; turningAge: number } | null {
  if (!birthISO) return null
  const birth = new Date(birthISO + 'T00:00:00Z')
  if (Number.isNaN(birth.getTime())) return null

  const now = new Date(nowMs)
  const y = now.getUTCFullYear()
  const bMonth = birth.getUTCMonth()
  const bDay = birth.getUTCDate()

  // 올해 생일 (2/29 는 평년엔 3/1 로 밀려도 무방 — Date 가 알아서 정규화).
  let next = Date.UTC(y, bMonth, bDay)
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  if (next < todayUTC) next = Date.UTC(y + 1, bMonth, bDay)

  const daysUntil = Math.round((next - todayUTC) / 86_400_000)
  const nextYear = new Date(next).getUTCFullYear()
  const turningAge = nextYear - birth.getUTCFullYear()
  return { daysUntil, turningAge }
}
