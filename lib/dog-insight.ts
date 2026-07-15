/**
 * 개요 페이지 인사이트 멘트 — "체형이 살짝 변했어요, 활동량도 같이 살펴봐요".
 *
 * 사장님 2026-07-14 확정(A안):
 *  · 근거는 **체중 기록**. 설문은 구독 시작 후 거의 다시 하지 않지만 체중은
 *    꾸준히 기록되므로, 개요의 살아있는 신호는 체중이다.
 *  · **멘트가 늘 똑같으면 안 된다.** 상황(늘었다/줄었다/유지/들쭉날쭉/오래됨/
 *    기록 없음)마다 다른 말이 나가고, 같은 상황 안에서도 문구를 돌린다.
 *  · 설문을 다시 하면 그때 그 정보를 개요에 **덧붙인다**(surveyNote).
 *
 * # 왜 순수 함수인가
 * 렌더 중 Math.random()/Date.now() 를 쓰면 SSR↔CSR 하이드레이션이 어긋난다.
 * 문구 회전은 데이터에서 파생한 결정적 seed 로 고른다(같은 입력 → 같은 문구,
 * 기록이 쌓이면 자연히 다음 문구로 넘어감).
 *
 * # 분석 페이지 '추이 카드' 와의 관계
 * 추이 카드는 설문 기록 기반이라 갱신이 없어 제거됨(2026-07-14). 그 역할을
 * 여기(개요 = 체중 기록 기반)가 대신한다.
 *
 * # InterventionWindowCard 와의 관계
 * 개입 윈도우(lib/intervention-window)는 "이대로면 N일 후 위험" 경보 —
 * urgent/watch 일 때만 뜨는 별개 카드. 이 인사이트는 항상 뜨는 순한 관찰 멘트로,
 * 경보를 대신하지 않는다. 위험 판정은 그쪽이 담당.
 */
import { petName, iGa } from './korean.ts'

export type InsightTone =
  /** 잘 되고 있음 — moss */
  | 'good'
  /** 눈여겨볼 변화 — terracotta (경보 아님) */
  | 'watch'
  /** 그냥 관찰 — muted */
  | 'neutral'
  /** 기록을 남겨달라는 요청 — muted */
  | 'prompt'

export type InsightSituation =
  | 'no_log'
  | 'first_log'
  | 'stale'
  | 'gain_slight'
  | 'gain_notable'
  | 'loss_slight'
  | 'loss_notable'
  | 'swing'
  | 'stable'

export interface InsightWeightLog {
  weight: number
  /** ISO */
  measured_at: string
}

export interface DogInsightInput {
  dogName: string
  /** 정렬 무관 — 내부에서 최신순으로 정렬한다. */
  weightLogs: InsightWeightLog[]
  /** 기준 시각. 테스트 주입용(미지정 시 now). */
  now?: Date
  /** 최신 설문 시각 — 최근 재설문이면 멘트에 정보를 덧붙인다. */
  lastSurveyAt?: string | null
  /** 최신 설문의 BCS(1-9). 재설문 노트에서 체형 언급에 사용. */
  bcs?: number | null
}

export interface DogInsight {
  situation: InsightSituation
  tone: InsightTone
  /** 한 줄 요약 — 굵게. */
  headline: string
  /** 부연 — 다음에 뭘 보면 좋은지. */
  body: string
  /** 재설문 정보 덧붙임. 없으면 undefined. */
  surveyNote?: string
}

const DAY = 86_400_000

/** 이 기간 넘게 기록이 없으면 '오래된 기록'으로 본다. */
const STALE_DAYS = 21
/** 비교 기준점을 찾을 때 목표로 하는 과거 시점. */
const BASELINE_TARGET_DAYS = 28
/** 기준점이 이보다 최근이면 비교 의미 없음 → 사실상 같은 날. */
const BASELINE_MIN_GAP_DAYS = 5
/** |변화율| 이 미만이면 '유지'. */
const STABLE_PCT = 2
/** |변화율| 이 이상이면 '뚜렷한 변화'. */
const NOTABLE_PCT = 5
/** 창 안 최대-최소 폭이 이 이상인데 순변화가 작으면 '들쭉날쭉'. */
const SWING_RANGE_PCT = 6

/** 문구 후보 중 하나를 결정적으로 고른다(하이드레이션 안전). */
function pick<T>(variants: readonly T[], seed: number): T {
  const i = Math.abs(Math.trunc(seed)) % variants.length
  return variants[i]!
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / DAY
}

/**
 * 체중 기록으로 개요 인사이트 멘트를 만든다.
 * 항상 무언가를 돌려준다(기록이 없으면 기록을 권하는 멘트).
 */
export function buildDogInsight(input: DogInsightInput): DogInsight {
  const { dogName, bcs, lastSurveyAt } = input
  const now = input.now ?? new Date()
  const name = petName(dogName)

  const logs = [...input.weightLogs]
    .filter((l) => Number.isFinite(l.weight) && l.weight > 0)
    .sort(
      (a, b) =>
        new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime(),
    )

  const surveyNote = buildSurveyNote(lastSurveyAt, bcs, now)

  if (logs.length === 0) {
    return {
      situation: 'no_log',
      tone: 'prompt',
      headline: `${name}의 체중을 한 번 재볼까요?`,
      body: '기록이 두 번만 쌓여도 체형이 어느 쪽으로 가는지 알려드릴 수 있어요.',
      surveyNote,
    }
  }

  const latest = logs[0]!
  const latestDate = new Date(latest.measured_at)
  const sinceLatest = daysBetween(now, latestDate)

  // seed — 기록이 쌓이거나 시간이 지나면 자연히 다른 문구로 넘어간다.
  const seed = logs.length * 7 + Math.trunc(sinceLatest)

  if (sinceLatest > STALE_DAYS) {
    const weeks = Math.round(sinceLatest / 7)
    return {
      situation: 'stale',
      tone: 'prompt',
      headline: `마지막 기록이 ${weeks}주 전이에요.`,
      body: pick(
        [
          `${name}${iGa(name)} 그동안 어떻게 지냈는지, 체중 한 번 재서 남겨 주세요.`,
          '오랜만에 한 번 재두면 다음 급여량을 더 정확하게 맞출 수 있어요.',
          '몸무게가 바뀌면 하루 급여량도 함께 바뀌어요. 지금 한 번 어떠세요?',
        ],
        seed,
      ),
      surveyNote,
    }
  }

  if (logs.length === 1) {
    return {
      situation: 'first_log',
      tone: 'neutral',
      headline: `첫 기록은 ${latest.weight}kg.`,
      body: '2~4주 뒤에 한 번 더 재면, 그때부터 체형 변화를 짚어 드릴게요.',
      surveyNote,
    }
  }

  // 비교 기준점 — 최신 기록에서 약 4주 전에 가장 가까운 기록.
  const baseline = pickBaseline(logs, latestDate)
  if (!baseline) {
    return {
      situation: 'first_log',
      tone: 'neutral',
      headline: `지금은 ${latest.weight}kg.`,
      body: '간격을 조금 두고 한 번 더 재면 변화를 읽을 수 있어요.',
      surveyNote,
    }
  }

  const deltaKg = latest.weight - baseline.weight
  const deltaPct = (deltaKg / baseline.weight) * 100
  const gapWeeks = Math.max(
    1,
    Math.round(daysBetween(latestDate, new Date(baseline.measured_at)) / 7),
  )
  const absKg = Math.abs(deltaKg).toFixed(1)

  // 창 안 변동 폭 — 순변화는 작은데 오르내림이 크면 '들쭉날쭉'.
  const window = logs.filter(
    (l) =>
      new Date(l.measured_at).getTime() >=
      new Date(baseline.measured_at).getTime(),
  )
  const weights = window.map((l) => l.weight)
  const rangePct =
    ((Math.max(...weights) - Math.min(...weights)) / baseline.weight) * 100

  if (Math.abs(deltaPct) < STABLE_PCT) {
    if (rangePct >= SWING_RANGE_PCT) {
      return {
        situation: 'swing',
        tone: 'neutral',
        headline: '오르내림이 조금 있었어요.',
        body: pick(
          [
            '재는 시간대(밥 전/후)만 맞춰도 기록이 훨씬 안정돼요.',
            `${gapWeeks}주 사이 오르락내리락했지만 결국 제자리예요. 같은 조건에서 재보면 더 정확해요.`,
            '간식이나 활동량이 들쑥날쑥했는지 함께 떠올려 보면 좋아요.',
          ],
          seed,
        ),
        surveyNote,
      }
    }
    return {
      situation: 'stable',
      tone: 'good',
      headline: `${gapWeeks}주째 잘 유지되고 있어요.`,
      body: pick(
        [
          `${name}${iGa(name)} 지금 식단에 잘 맞고 있다는 뜻이에요. 이대로 가요.`,
          '급여량을 바꿀 이유가 없어요. 기록만 계속 남겨 주세요.',
          '변화가 없다는 건 좋은 소식이에요. 다음 달에도 이 흐름으로.',
        ],
        seed,
      ),
      surveyNote,
    }
  }

  if (deltaPct > 0) {
    const notable = deltaPct >= NOTABLE_PCT
    return {
      situation: notable ? 'gain_notable' : 'gain_slight',
      tone: notable ? 'watch' : 'neutral',
      headline: notable
        ? `${gapWeeks}주 사이 ${absKg}kg 늘었어요.`
        : `체형이 살짝 통통해졌어요. (+${absKg}kg)`,
      body: notable
        ? pick(
            [
              '간식 양과 활동량을 같이 살펴봐 주세요. 계속 이어지면 급여량을 조정해 드릴게요.',
              `${name}${iGa(name)} 요즘 산책이 줄었는지 떠올려 보면 좋아요. 필요하면 화식 비율부터 손봐요.`,
              '체중이 꾸준히 오르면 관절에 부담이 돼요. 다음 기록까지 활동량을 조금 늘려 볼까요?',
            ],
            seed,
          )
        : pick(
            [
              '걱정할 정도는 아니에요. 활동량을 같이 살펴봐도 좋아요.',
              '자연스러운 범위예요. 산책 시간이 줄지 않았는지만 한 번 보세요.',
              '아직은 흐름을 지켜볼 단계예요. 다음 기록에서 다시 짚어 드릴게요.',
            ],
            seed,
          ),
      surveyNote,
    }
  }

  const notable = Math.abs(deltaPct) >= NOTABLE_PCT
  return {
    situation: notable ? 'loss_notable' : 'loss_slight',
    tone: notable ? 'watch' : 'neutral',
    headline: notable
      ? `${gapWeeks}주 사이 ${absKg}kg 줄었어요.`
      : `체중이 살짝 줄었어요. (-${absKg}kg)`,
    body: notable
      ? pick(
          [
            '의도한 다이어트가 아니라면, 식욕과 변 상태를 함께 살펴봐 주세요.',
            `짧은 기간에 줄어든 편이에요. ${name}${iGa(name)} 밥을 남기지는 않는지 확인해 주세요.`,
            '체중이 빠르게 빠질 땐 수의사와 한 번 상의해 보시는 걸 권해요.',
          ],
          seed,
        )
      : pick(
          [
            '다이어트 중이라면 좋은 흐름이에요. 아니라면 식욕을 함께 살펴봐 주세요.',
            '완만한 변화예요. 밥을 잘 먹고 있다면 그대로 두셔도 괜찮아요.',
            '가벼운 감소예요. 다음 기록에서 흐름이 이어지는지 볼게요.',
          ],
          seed,
        ),
    surveyNote,
  }
}

/** 최신 기록에서 약 4주 전에 가장 가까운 기록. 너무 붙어 있으면 null. */
function pickBaseline(
  logs: InsightWeightLog[],
  latestDate: Date,
): InsightWeightLog | null {
  let best: InsightWeightLog | null = null
  let bestScore = Infinity
  for (const log of logs.slice(1)) {
    const gap = daysBetween(latestDate, new Date(log.measured_at))
    if (gap < BASELINE_MIN_GAP_DAYS) continue
    const score = Math.abs(gap - BASELINE_TARGET_DAYS)
    if (score < bestScore) {
      bestScore = score
      best = log
    }
  }
  // 4주 후보가 없으면(기록이 촘촘하거나 짧으면) 가장 오래된 것으로 비교.
  if (!best) {
    const oldest = logs[logs.length - 1]!
    const gap = daysBetween(latestDate, new Date(oldest.measured_at))
    if (gap >= BASELINE_MIN_GAP_DAYS) return oldest
  }
  return best
}

/** 최근 설문(재설문) 정보 덧붙임 — 사장님 "설문 다시 하면 그때 정보 추가". */
const RESURVEY_FRESH_DAYS = 30

function buildSurveyNote(
  lastSurveyAt: string | null | undefined,
  bcs: number | null | undefined,
  now: Date,
): string | undefined {
  if (!lastSurveyAt) return undefined
  const days = daysBetween(now, new Date(lastSurveyAt))
  if (!Number.isFinite(days) || days > RESURVEY_FRESH_DAYS) return undefined

  const when = days < 1 ? '오늘' : `${Math.round(days)}일 전`
  if (bcs == null) return `${when} 다시 설문한 내용이 식단에 반영돼 있어요.`

  const shape =
    bcs <= 3
      ? '마른 편'
      : bcs <= 5
        ? '이상적인 체형'
        : bcs <= 6
          ? '살짝 통통한 편'
          : '통통한 편'
  return `${when} 설문에서 체형은 ${shape}(BCS ${bcs}/9)으로 확인됐고, 그 기준으로 급여량을 잡았어요.`
}
