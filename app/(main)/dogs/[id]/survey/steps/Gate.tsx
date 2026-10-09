// 설문 v4 — 선택 묶음 관문 (2026-09-22, 시니어 사용성 3단계).
//
// 사장님(9/21): "계산 정확도가 안 떨어졌으면 좋겠긴 한데, 건너뛰는 걸 더 편하게 할 수
// 없나?" → 필수가 끝나는 지점에 관문을 하나 두고 두 갈래를 **둘 다 큰 버튼**으로 보인다.
// '4개 더 답하기'가 첫 번째(정확도), '건너뛰고 결과 보기'가 두 번째. 어느 쪽을 눌러도
// 잘못이 아니라는 문구.
//
// 2026-10-09 앱 새 디자인('A 포스터', 시안 E13): 주제 4개 = 번호 줄 목록, 두 갈래 버튼은 카드 아래 버튼 자리
// (GateButtons — SurveyClient 가 틀의 버튼 자리에 넣는다). "결과 화면에서 언제든 추가로 답할 수 있어요" 줄은
// 뺐다 — '언제든' 금지어이고, 결과 화면의 추가 답변도 재분석 월 3회 한도 안이라 사실과 다르다(앱시안 결정 3번).
import { ScreenShell } from './ScreenShell'

const TOPICS = ['지금 먹는 사료', '산책', '운동·사는 곳', '먹는 약'] as const

export function GateScreen() {
  return (
    <ScreenShell
      kicker="거의 다 됐어요"
      title={
        <>
          여기까지만 답해도
          <br />
          결과를 볼 수 있어요
        </>
      }
      sub="4개만 더 답하면 하루 급여량이 더 정확해져요"
    >
      <ol className="s-gate-list" aria-label="추가 질문 주제">
        {TOPICS.map((t, i) => (
          <li key={t} className="s-gate-row">
            <span className="s-gate-num ft-num" aria-hidden="true">
              {i + 1}
            </span>
            {t}
          </li>
        ))}
      </ol>
    </ScreenShell>
  )
}

/** 관문 두 갈래 — 위 = 먹색 '4개 더 답하기 · 1분', 아래 = 테두리 '건너뛰고 결과 보기'. */
export function GateButtons({
  onAnswer,
  onSkip,
  saving,
}: {
  onAnswer: () => void
  onSkip: () => void
  saving: boolean
}) {
  return (
    <>
      <button type="button" className="s-btn-primary s-gate-primary" onClick={onAnswer} disabled={saving}>
        4개 더 답하기 · 1분
      </button>
      <button type="button" className="s-btn-secondary s-gate-secondary" onClick={onSkip} disabled={saving}>
        건너뛰고 결과 보기
      </button>
    </>
  )
}
