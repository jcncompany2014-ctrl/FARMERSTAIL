/**
 * 4-페르소나 추론 라이브러리.
 *
 * 발명 명세서 "보호자 유형 분기 UI" 와 D7.4 phase 의 핵심.
 *
 * 사용자 행동 카운트들을 0~1 점수로 정규화 후 4 페르소나에 매핑.
 *
 * # 페르소나 정의
 * - data_lover    : 데이터 신뢰형 — 분석 자주 봄, 체크인 응답률 높음
 * - emotional     : 감성형 — 일지 작성 많음, 사진 업로드
 * - convenience   : 편의형 — 정기배송, 자동화 의존
 * - vet_dependent : 수의사 의존형 — 챗봇 질문 많음, vet_diagnosed
 *
 * # 디자인 결정
 * - 점수는 모두 [0, 1]. 서로 배타적 X — 한 사용자가 emotional 0.7 +
 *   data_lover 0.4 일 수도 있음.
 * - dominant 는 단순 argmax. secondary 는 그 다음.
 * - 모든 점수가 < THRESHOLD (0.25) 이면 dominant=null — 신호 부족.
 *   대시보드는 페르소나 카드 안 보여줌.
 *
 * # voice-guidelines
 * - 페르소나는 "분류" 라기보다 "UI 가이드". 사용자에게 명시적으로
 *   "당신은 △△ 타입이에요" 라고 말하지 않는다. 카드 카피·우선순위 조정에만 사용.
 */

export type Persona = 'data_lover' | 'emotional' | 'convenience' | 'vet_dependent'

export type PersonaInput = {
  /** 챗봇 메시지 누적 (사용자 발화만) */
  chatCount: number
  /** 분석 수 (analyses) */
  analysisCount: number
  /** 체크인 응답 수 (dog_checkins) */
  checkinCount: number
  /** 일지 entry 수 (dog_diary) */
  diaryCount: number
  /** 강아지 사진 업로드 여부 */
  hasPhoto: boolean
  /** 정기배송 활성 */
  hasSubscription: boolean
  /** 알레르기 출처 — vet_diagnosed 면 수의사 의존 신호 */
  allergiesSource: 'self_suspected' | 'vet_diagnosed' | 'unknown' | null
  /** 가입 후 일수 — 신호가 적은 신규 사용자 분류 안정성 */
  daysSinceSignup: number
}

export type PersonaScores = Record<Persona, number>

export type PersonaResult = {
  scores: PersonaScores
  dominant: Persona | null
  secondary: Persona | null
}

const THRESHOLD = 0.25

/** 0~max 사이 값을 0~1 로 saturating. */
function sat(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0
  return Math.min(1, value / max)
}

/**
 * 사용자 행동 → 4 페르소나 점수.
 *
 * 가중치는 휴리스틱. 실데이터로 calibration 후 조정 예정 (메타학습 D8).
 */
export function computePersona(input: PersonaInput): PersonaResult {
  // 가입 1주 미만 / 데이터 거의 없으면 모두 0
  if (input.daysSinceSignup < 7) {
    const zero: PersonaScores = {
      data_lover: 0,
      emotional: 0,
      convenience: 0,
      vet_dependent: 0,
    }
    return { scores: zero, dominant: null, secondary: null }
  }

  // data_lover — 분석 + 체크인 + (분석/체크인 비율)
  const data_lover =
    0.5 * sat(input.analysisCount, 4) +
    0.4 * sat(input.checkinCount, 6) +
    0.1 * (input.checkinCount >= 2 ? 1 : 0)

  // emotional — 일지 + 사진
  const emotional =
    0.7 * sat(input.diaryCount, 8) + (input.hasPhoto ? 0.3 : 0)

  // convenience — 정기배송 필수. 활성 사용 기간 bonus.
  // 정기배송 없으면 점수 0 — daysSinceSignup 만으로 convenience 분류 X.
  const convenience = input.hasSubscription
    ? 0.7 + 0.3 * sat(input.daysSinceSignup, 60)
    : 0

  // vet_dependent — 챗봇 + vet_diagnosed
  const vetDiag =
    input.allergiesSource === 'vet_diagnosed' ? 0.4 : 0
  const vet_dependent =
    0.6 * sat(input.chatCount, 10) + vetDiag

  const scores: PersonaScores = {
    data_lover: round(data_lover),
    emotional: round(emotional),
    convenience: round(convenience),
    vet_dependent: round(vet_dependent),
  }

  // dominant / secondary 결정
  const sorted = (Object.entries(scores) as Array<[Persona, number]>).sort(
    (a, b) => b[1] - a[1],
  )
  const [topName, topScore] = sorted[0]
  const [secondName, secondScore] = sorted[1]
  const dominant = topScore >= THRESHOLD ? topName : null
  const secondary =
    dominant && secondScore >= THRESHOLD ? secondName : null

  return { scores, dominant, secondary }
}

function round(n: number): number {
  return Math.round(Math.min(1, Math.max(0, n)) * 100) / 100
}

/**
 * ISO timestamp → 현재까지의 day 수. Date.now() 캡슐화 — server component
 * 에서 직접 호출하면 react-hooks/purity 룰에 걸리므로 lib 경유.
 */
export function daysSinceIso(
  iso: string | null,
  nowMs: number = Date.now(),
): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return 0
  return Math.floor((nowMs - t) / 86_400_000)
}

/**
 * 현재 시각 - N 일 의 ISO. lib 캡슐화 (react-hooks/purity 회피).
 */
export function isoDaysAgo(days: number, nowMs: number = Date.now()): string {
  return new Date(nowMs - days * 86_400_000).toISOString()
}

/**
 * 페르소나별 dashboard 권유 카드 카피.
 * dashboard 에서 PersonaCard 로 표시.
 */
export type PersonaCardSpec = {
  kicker: string
  title: string
  subtitle: string
  cta: string
  href: string
  tone: 'terracotta' | 'gold' | 'moss'
}

export function personaCardSpec(
  persona: Persona,
  dogId: string | null,
): PersonaCardSpec {
  const dogHref = (suffix: string) =>
    dogId ? `/dogs/${dogId}${suffix}` : '/dogs'

  switch (persona) {
    case 'data_lover':
      return {
        kicker: '데이터 한눈에',
        title: '분석 추이 살펴보기',
        subtitle: '주기별 BCS·체중 변화를 그래프로 확인해보세요',
        cta: '추이 보기',
        href: dogHref('/analyses'),
        tone: 'terracotta',
      }
    case 'emotional':
      return {
        kicker: '오늘의 기록',
        title: '일지에 짧게 한 줄',
        subtitle: '소소한 순간이 모이면 1년 후 큰 흐름이 보여요',
        cta: '일지 쓰기',
        href: dogHref('/diary'),
        tone: 'moss',
      }
    case 'convenience':
      return {
        kicker: '편하게 챙기기',
        title: '다음 배송 준비됐어요',
        subtitle: '주기 변경·일시 정지는 한 번에 설정할 수 있어요',
        cta: '구독 관리',
        href: '/mypage/subscriptions',
        tone: 'gold',
      }
    case 'vet_dependent':
      return {
        kicker: '전문가와 함께',
        title: '진료 기록 사진 한 장으로',
        subtitle: '영수증·처방전을 올리면 자동으로 정리돼요',
        cta: '진료 기록 올리기',
        href: dogHref('/health'),
        tone: 'terracotta',
      }
  }
}
