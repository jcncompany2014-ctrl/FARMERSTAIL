/**
 * 결과 화면 둘러보기 — 단계 상태(앱시안 결정 4번, 사장님 구조 · 2026-10-09 캔버스 TR0~TR4).
 *
 * 첫 가입 → 첫 설문 → **첫 결과 화면**에서 한 번만 자동으로 뜬다(건너뛰기 없음). 결과 화면(플랜 고르는 곳) →
 * 홈(기록 버튼 · 기록이 쌓이는 곳) → '결과로 돌아가기'로 원래 결과 화면에 돌아와 끝난다. 화면을 건너 단계를 들고
 * 다녀야 해서 이 폰의 localStorage 에 둔다(서버·계정과 무관 — 다른 폰에선 다시 안 뜨게 하려면 완료 표식이 필요하지만,
 * 시작 조건이 '그 강아지의 첫 분석'이라 다른 폰에서 다시 뜰 일이 없다).
 *
 * 저장소를 못 쓰면(사생활 모드 등) 시작하지 않는다 — 단계를 못 들고 다니면 홈에서 길을 잃는다.
 * 중간에 앱을 닫고 오래 지나 돌아오면(30분) 조용히 끝낸다 — 며칠 뒤 홈에 갑자기 안내가 뜨지 않게.
 */

export type TourStep = 'intro' | 'plan' | 'record' | 'stats' | 'finish'

export type TourState = {
  step: TourStep
  dogName: string
  /** 마지막에 돌아갈 결과 화면 주소(경로 + 쿼리). */
  backHref: string
  startedAt: number
}

const KEY = 'ft_result_tour'
const DONE_KEY = 'ft_result_tour_done'
const STALE_MS = 30 * 60 * 1000
const STEPS: readonly TourStep[] = ['intro', 'plan', 'record', 'stats', 'finish']

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    const s = window.localStorage
    const probe = '__ft_tour_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

/** 진행 중인 둘러보기. 없거나 깨졌거나 오래됐으면 null(오래된 건 끝낸 것으로 친다). */
export function readTour(now: number = Date.now()): TourState | null {
  const s = storage()
  if (!s) return null
  try {
    const raw = s.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<TourState>
    const ok =
      typeof v.step === 'string' &&
      (STEPS as readonly string[]).includes(v.step) &&
      typeof v.dogName === 'string' &&
      // 돌아갈 주소는 이 사이트 안 경로만 — '//다른곳' 과 '/\다른곳'(브라우저가 '//' 로 읽는다)은 버린다.
      typeof v.backHref === 'string' &&
      v.backHref.startsWith('/') &&
      !v.backHref.startsWith('//') &&
      !v.backHref.includes('\\') &&
      typeof v.startedAt === 'number'
    if (!ok) {
      s.removeItem(KEY)
      return null
    }
    if (now - (v.startedAt as number) > STALE_MS) {
      finishTour()
      return null
    }
    return v as TourState
  } catch {
    return null
  }
}

export function writeTour(state: TourState): void {
  const s = storage()
  if (!s) return
  try {
    s.setItem(KEY, JSON.stringify(state))
  } catch {
    /* 꽉 찼으면 둘러보기만 못 한다 */
  }
}

/** 끝 — 진행 상태를 지우고 '봤음'을 남긴다. */
export function finishTour(): void {
  const s = storage()
  if (!s) return
  try {
    s.removeItem(KEY)
    s.setItem(DONE_KEY, String(Date.now()))
  } catch {
    /* noop */
  }
}

/** 이 폰에서 이미 봤나. 저장소를 못 쓰면 '봤음'(= 시작 안 함). */
export function tourSeen(): boolean {
  const s = storage()
  if (!s) return true
  try {
    return Boolean(s.getItem(DONE_KEY))
  } catch {
    return true
  }
}

/**
 * 결과 화면에서 새로 시작할지 — 설문 직후(fromSurvey)이고 그 강아지의 첫 분석이며 이 폰에서 아직 안 봤고
 * 진행 중인 둘러보기도 없을 때만.
 */
export function shouldStartTour(input: { fromSurvey: boolean; analysisCount: number; seen: boolean; inProgress: boolean }): boolean {
  return input.fromSurvey && input.analysisCount === 1 && !input.seen && !input.inProgress
}
