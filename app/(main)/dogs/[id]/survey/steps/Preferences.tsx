// 설문 v4 — 케어 목표 화면 (마지막 필수 질문). careGoal 은 personalization 1순위.
// 모질·피부(coat)는 2026-09-22 삭제 — 계산 소비처가 AI 프롬프트 문구뿐이고
// 케어 목표 '피부·털 개선'이 대신한다(사장님 결정).
//
// 2026-10-09 앱 새 디자인('A 포스터', 시안 E12): 아이콘 칸 → 줄 목록(이름 + 회색 설명), 설명은 시안의 짧은 말.
// 머리말 "마지막 질문" → "마지막 필수 질문" — 뒤에 관문·추가 질문이 이어진다(앱시안 결정 '문구가 서로 다른 곳').
// 다섯 줄이 카드에 들어가게 제목 아래 설명 줄("이 답이 첫 박스의 식단 구성을 정해요…")은 시안처럼 뺐다. 답 값은 그대로.
import { ScreenShell, LineList } from './ScreenShell'

export type CareGoal =
  | 'weight_management'
  | 'skin_coat'
  | 'joint_senior'
  | 'allergy_avoid'
  | 'general_upgrade'

const CARE_GOAL_OPTIONS: ReadonlyArray<{ v: CareGoal; label: string; sub: string }> = [
  { v: 'weight_management', label: '체중 관리', sub: '체형에 맞춰 급여량을 조정해요' },
  { v: 'skin_coat', label: '피부·털 개선', sub: '윤기 부족, 가려움, 푸석함이 걱정될 때' },
  { v: 'joint_senior', label: '관절·시니어 케어', sub: '7살 이상이거나 관절이 걱정될 때' },
  { v: 'allergy_avoid', label: '알레르기·민감 피하기', sub: '특정 고기를 빼고 덜 먹어 본 고기를 우선해요' },
  { v: 'general_upgrade', label: '골고루 건강하게', sub: '특별한 걱정은 없어요' },
]

export function GoalScreen({
  careGoal,
  setCareGoal,
}: {
  careGoal: CareGoal | ''
  setCareGoal: (v: CareGoal | '') => void
}) {
  return (
    <ScreenShell
      kicker="마지막 필수 질문"
      title={
        <>
          가장 신경 쓰고 싶은 건
          <br />
          무엇인가요?
        </>
      }
    >
      <LineList
        style={{ marginTop: 16 }}
        options={CARE_GOAL_OPTIONS}
        value={careGoal}
        onChange={(v) => setCareGoal(v)}
        ariaLabel="케어 목표"
      />
    </ScreenShell>
  )
}
