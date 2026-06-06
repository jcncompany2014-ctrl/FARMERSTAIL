/**
 * 추천 v3 — 2주 피드백 해석 훅 (재분석 시드).
 *
 * 첫 박스 ~2주 후 보호자 체크인(변/식욕/모질/만족)을 받아, 다음 추천을 어떻게
 * 틀지 결정하는 **순수 함수**. 라이브 dog_checkins(week_2) + nextBox 흐름과
 * 정렬되, v3 레이어 구조(베이스 SKU + 기능성 소스)에 맞춰 신호를 라우팅한다.
 *
 * 출력은 "재추천 시드":
 *  - profileNudges → 다음 NeedProfile 에 머지해 runLayerA 재실행
 *  - addConcerns   → runLayerB 로 추가 라우팅(소스 대기열)
 *  - shouldReanalyze → 재분석 권장 여부(전반 불만족/안 먹음/무른 변)
 *
 * 효능·치료 단정 없음(사료법) — 전부 "조정·관찰·권장" 수준.
 */
import type {
  ConcernKey,
  FeedbackInterpretation,
  NeedProfile,
  TwoWeekFeedback,
} from './types.ts'

export function interpretTwoWeekFeedback(
  fb: TwoWeekFeedback,
): FeedbackInterpretation {
  const profileNudges: Partial<NeedProfile> = {}
  const addConcerns: ConcernKey[] = []
  const notes: string[] = []
  let shouldReanalyze = false

  // ── 변 (Bristol 1~7, 4 이상) ──
  if (fb.stoolScore !== null) {
    if (fb.stoolScore >= 6) {
      addConcerns.push('digestion')
      notes.push(
        '변이 무른 편이에요 — 소화가 부드러운 단백 위주 + 소화 보완 소스를 대기열에 등록할게요. 2주 더 지켜봐 주세요.',
      )
      shouldReanalyze = true
    } else if (fb.stoolScore <= 2) {
      notes.push(
        '변이 단단한 편이에요 — 수분·식이섬유를 조금 늘리면 도움이 돼요. 급여량은 유지해 주세요.',
      )
    }
  }

  // ── 식욕 (1~5, 5 최고) ──
  if (fb.appetiteScore !== null && fb.appetiteScore <= 2) {
    // 잘 안 먹음 → 기호성 높은 단백(돼지)로 기우는 재추천 + 회복기 신호.
    profileNudges.appetite = 'picky'
    notes.push(
      '잘 안 먹는 편이에요 — 기호성이 높은 단백 위주로 다시 추천해 드릴게요.',
    )
    shouldReanalyze = true
  }

  // ── 모질 (1~5) ──
  if (fb.coatScore !== null && fb.coatScore <= 2) {
    addConcerns.push('skin')
    notes.push(
      '모질이 아직 아쉬워요 — 피부·모질 보완 소스를 대기열에 등록할게요(출시 시 알림). 피모 변화는 6~8주는 봐야 해요.',
    )
  }

  // ── 전반 만족 (1~5) ──
  if (fb.satisfaction !== null) {
    if (fb.satisfaction <= 2) {
      shouldReanalyze = true
      notes.push('전반 만족이 낮아요 — 처방을 다시 점검해 재추천해 드릴게요.')
    } else if (
      fb.satisfaction >= 4 &&
      (fb.stoolScore === null || (fb.stoolScore >= 3 && fb.stoolScore <= 5)) &&
      (fb.appetiteScore === null || fb.appetiteScore >= 3)
    ) {
      notes.push('순조로워요 — 지금 처방을 유지할게요. 잘하고 있어요!')
    }
  }

  if (notes.length === 0) {
    notes.push('특이 신호가 없어요 — 현재 처방을 유지할게요.')
  }

  // addConcerns 중복 제거.
  return {
    profileNudges,
    addConcerns: [...new Set(addConcerns)],
    notes,
    shouldReanalyze,
  }
}
