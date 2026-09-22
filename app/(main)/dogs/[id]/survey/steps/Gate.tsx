// 설문 v4 — 선택 묶음 관문 (2026-09-22, 시니어 사용성 3단계).
//
// 사장님(9/21): "계산 정확도가 안 떨어졌으면 좋겠긴 한데, 건너뛰는 걸 더 편하게 할 수
// 없나?" → 필수가 끝나는 지점에 관문을 하나 두고 두 갈래를 **둘 다 큰 버튼**으로 보인다.
// '4개 더 답하기'가 첫 번째(정확도), '건너뛰고 결과 보기'가 두 번째. 어느 쪽을 눌러도
// 잘못이 아니라는 문구.
import { ArrowRight, Sparkles } from 'lucide-react'

export function GateScreen({
  onAnswer,
  onSkip,
  saving,
}: {
  onAnswer: () => void
  onSkip: () => void
  saving: boolean
}) {
  return (
    <div className="s-page">
      <div className="s-kickrow">
        <span className="s-kicker">거의 다 됐어요</span>
      </div>
      <h1 className="s-title">
        여기까지로도
        <br />
        결과를 볼 수 있어요
      </h1>
      <p className="s-sub">
        4개만 더 답하면 하루 급여량 계산이 더 정확해져요. 1분이면 충분해요.
      </p>

      <div className="s-gate-topics" aria-label="추가 질문 주제">
        <span>지금 먹는 사료</span>
        <span>산책</span>
        <span>운동·사는 곳</span>
        <span>먹는 약</span>
      </div>

      <div className="s-gate-btns">
        <button type="button" className="s-gate-primary" onClick={onAnswer} disabled={saving}>
          <Sparkles size={20} strokeWidth={2.2} aria-hidden />
          4개 더 답하기
          <ArrowRight size={18} strokeWidth={2.6} aria-hidden />
        </button>
        <button type="button" className="s-gate-secondary" onClick={onSkip} disabled={saving}>
          건너뛰고 결과 보기
        </button>
      </div>
      <p className="s-qhint" style={{ textAlign: 'center', marginTop: 14 }}>
        건너뛰어도 결과 화면에서 언제든 추가로 답할 수 있어요.
      </p>
    </div>
  )
}
