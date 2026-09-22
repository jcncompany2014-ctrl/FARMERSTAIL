// 설문 v4 — 케어 목표 화면 (마지막 본 질문). careGoal 은 personalization 1순위.
// 모질·피부(coat)는 2026-09-22 삭제 — 계산 소비처가 AI 프롬프트 문구뿐이고
// 케어 목표 '피부·털 개선'이 대신한다(사장님 결정).
import { Check } from 'lucide-react'
import { ScreenShell } from './ScreenShell'

export type CareGoal =
  | 'weight_management'
  | 'skin_coat'
  | 'joint_senior'
  | 'allergy_avoid'
  | 'general_upgrade'

// 아이콘: 굵은 아웃라인 세트. public/survey/icons/care-*.png (pine 실루엣 알파) 를
// CSS mask 로 칠해 선택 시 흰색.
const CARE_GOAL_OPTIONS: Array<{
  v: CareGoal
  label: string
  desc: string
  img: string
}> = [
  {
    v: 'weight_management',
    label: '체중 관리',
    desc: '살을 빼거나, 유지하거나, 찌우기 — 체형에 맞춰 급여량을 조정해요',
    img: '/survey/icons/care-weight.png',
  },
  {
    v: 'skin_coat',
    label: '피부·털 개선',
    desc: '윤기 부족, 가려움, 푸석함 — 오메가-3 를 늘려요',
    img: '/survey/icons/care-coat.png',
  },
  {
    v: 'joint_senior',
    label: '관절·시니어 케어',
    desc: '7세 이상이거나 관절이 걱정될 때 — 관절에 좋은 영양 중심',
    img: '/survey/icons/care-joint.png',
  },
  {
    v: 'allergy_avoid',
    label: '알레르기·민감 피하기',
    desc: '특정 고기를 빼고, 덜 먹어 본 고기를 우선해요',
    img: '/survey/icons/care-allergy.png',
  },
  {
    v: 'general_upgrade',
    label: '골고루 건강하게',
    desc: '특별한 걱정은 없어요 — 균형 잡힌, 잘 먹는 밥 중심',
    img: '/survey/icons/care-general.png',
  },
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
      kicker="마지막 질문"
      title={
        <>
          가장 신경 쓰고 싶은 건
          <br />
          무엇인가요?
        </>
      }
      sub="이 답이 첫 박스의 식단 구성을 정해요. 이후 정기 체크인으로 조정돼요."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {CARE_GOAL_OPTIONS.map(({ v, label, desc, img }) => {
          const active = careGoal === v
          return (
            <button
              key={v}
              type="button"
              className="s-listbtn"
              aria-pressed={active}
              onClick={() => setCareGoal(v)}
            >
              <span className="s-lb-icon s-lb-icon-bare">
                <span
                  className="s-careicon"
                  aria-hidden
                  style={{
                    WebkitMaskImage: `url(${img})`,
                    maskImage: `url(${img})`,
                    backgroundColor: active ? '#fff' : 'var(--fd-coral)',
                  }}
                />
              </span>
              <span className="s-lb-body">
                <span className="s-lb-title">{label}</span>
                <span className="s-lb-sub">{desc}</span>
              </span>
              {active && (
                <Check size={18} strokeWidth={2.5} color="#fff" style={{ flex: '0 0 auto' }} />
              )}
            </button>
          )
        })}
      </div>
    </ScreenShell>
  )
}
