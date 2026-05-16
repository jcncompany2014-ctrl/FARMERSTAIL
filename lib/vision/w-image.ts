/**
 * W_image 산출 — 발명 모듈 B 핵심 청구항.
 *
 * 촬영 이미지의 자세·각도·조명·자세·털길이 등을 분석해 신뢰도 점수
 * W_image ∈ [0, 1] 출력. 이 점수가 임계치 (기본 0.5) 미만이면 BCS 추정값
 * 을 사용하지 않고 자가 입력값에만 의존.
 *
 * # 1차 구현 — 룰 기반
 * CNN 모델 없이도 가능한 신호:
 *  · coverageRatio   — 견이 frame 안 얼마나 차지하나 (canvas 픽셀 분석)
 *  · brightness      — 평균 luminance (너무 어둡거나 밝으면 ↓)
 *  · sharpness       — variance of Laplacian 근사 (흐림 검출)
 *  · referenceFound  — 신용카드 등 참조 객체 감지 여부
 *  · viewType        — 'side' (가장 신뢰) > 'front' > 'top' > 'unknown'
 *
 * # 발명 핵심 — PCT flag 가드
 * computeWImage() 호출 시 INVENTION_W_IMAGE flag OFF 면 0 반환 → 호출처가
 * "사진 신뢰도 평가 미사용" 으로 분기.
 */

export type WImageInput = {
  /** 견이 차지하는 frame 비율 0~1. 0.4 이상 권장. */
  coverageRatio: number
  /** 평균 luminance 0~255. 80~200 권장. */
  brightness: number
  /** Laplacian variance 근사 0~∞. 100+ 권장 (낮으면 흐림). */
  sharpness: number
  /** 참조 객체 (신용카드 등) 감지 여부. */
  referenceFound: boolean
  /** 측면 / 정면 / 위 / 불명. */
  viewType: 'side' | 'front' | 'top' | 'unknown'
}

export type WImageResult = {
  score: number
  /** 0.5 미만이면 사용 안 함 (호출처 분기). */
  usable: boolean
  /** 문제점 인간-읽기-쉬운 list. UI 에서 안내용. */
  issues: string[]
}

const THRESHOLD = 0.5

const VIEW_SCORE: Record<WImageInput['viewType'], number> = {
  side: 1.0,
  front: 0.7,
  top: 0.6,
  unknown: 0.3,
}

function wImageFlagOn(): boolean {
  if (process.env.NEXT_PUBLIC_INVENTION_CORE !== 'on') return false
  return process.env.NEXT_PUBLIC_INVENTION_W_IMAGE !== 'off'
}

/**
 * 입력 신호 → W_image 점수.
 *
 * w_image = w1·coverage + w2·brightness + w3·sharpness + w4·reference + w5·view
 *
 * [B11 fix] 가중치 재배분 — BCS 추정 정확도 영향력 기준:
 *  · view        0.30  (측면 vs 정면이 가장 큰 영향)
 *  · sharpness   0.25
 *  · brightness  0.15
 *  · coverage    0.15  (reference 와 결합 시 의미)
 *  · reference   0.15
 * 이전: coverage 0.25 / view 0.20 — 학술 근거에 맞춰 view 우선.
 */
export function computeWImage(input: WImageInput): WImageResult {
  if (!wImageFlagOn()) {
    return { score: 0, usable: false, issues: ['평가 비활성'] }
  }
  const issues: string[] = []

  // coverage 0~1 → 0~1 (0.4 이하면 부족)
  const cov = Math.max(0, Math.min(1, input.coverageRatio))
  const covScore = cov < 0.4 ? cov / 0.4 : 1
  if (cov < 0.4) issues.push('강아지가 너무 작게 찍혔어요')

  // brightness 80~200 sweet spot. 그 외는 선형 감점.
  // audit #34: issue threshold 와 score weight 임계 일치 — 점수 영향 적은 (마지막
  // 30 단계) 임계에서는 issue 도 push 안 함. 사용자에게 score 와 chip 일관성.
  const b = input.brightness
  let brightnessScore = 1
  const BRIGHTNESS_ISSUE_THRESHOLD = 0.7 // 점수 70% 이하 일 때만 issue
  if (b < 50) {
    brightnessScore = 0
  } else if (b < 80) {
    brightnessScore = (b - 50) / 30
  } else if (b > 230) {
    brightnessScore = 0
  } else if (b > 200) {
    brightnessScore = (230 - b) / 30
  }
  // issue push — score 가 threshold 이하일 때만 (chip 진실성)
  if (brightnessScore < BRIGHTNESS_ISSUE_THRESHOLD) {
    if (b < 80) issues.push(b < 50 ? '너무 어두워요' : '조명이 부족해요')
    else if (b > 200) issues.push(b > 230 ? '너무 밝아요' : '역광/과노출')
  }

  // sharpness — Laplacian variance 100+ 권장
  let sharpScore = 1
  if (input.sharpness < 30) {
    sharpScore = 0
    issues.push('초점이 많이 흐려요')
  } else if (input.sharpness < 100) {
    sharpScore = (input.sharpness - 30) / 70
    issues.push('약간 흐려요')
  }

  // reference object
  const refScore = input.referenceFound ? 1 : 0.3
  if (!input.referenceFound) {
    issues.push('참조 객체 (카드 등) 없음 — 절대 크기 보정 약함')
  }

  // view type
  const viewScore = VIEW_SCORE[input.viewType]
  if (input.viewType === 'unknown') {
    issues.push('어떤 각도인지 모름 — 측면 사진이 가장 정확해요')
  }

  // [B11] 가중치 재배분 — view 0.30 / sharpness 0.25 / brightness 0.15 /
  // coverage 0.15 / reference 0.15. 합 1.00.
  const score =
    0.15 * covScore +
    0.15 * brightnessScore +
    0.25 * sharpScore +
    0.15 * refScore +
    0.3 * viewScore

  const rounded = Math.round(score * 100) / 100
  return {
    score: rounded,
    usable: rounded >= THRESHOLD,
    issues,
  }
}

export const W_IMAGE_THRESHOLD = THRESHOLD
