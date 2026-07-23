// audit #96: SurveyClient.tsx 분할 — status step 의 후반부 (모질·피부 + 케어 목표).
// 명세의 'preferences' 에 해당. careGoal 은 personalization 알고리즘 1순위.
import { Check, Sparkles } from 'lucide-react'

type Coat = 'healthy' | 'dull' | 'shedding' | 'itchy' | 'lesions' | ''

// 모질·피부 칩 아이콘(굵은 아웃라인). public/survey/icons/coat-*.png
const COAT_OPTIONS: Array<{ v: Coat; label: string; img: string }> = [
  { v: 'healthy', label: '건강', img: '/survey/icons/coat-healthy.png' },
  { v: 'dull', label: '푸석', img: '/survey/icons/coat-dull.png' },
  { v: 'shedding', label: '심한 탈모', img: '/survey/icons/coat-shedding.png' },
]

export type CareGoal =
  | 'weight_management'
  | 'skin_coat'
  | 'joint_senior'
  | 'allergy_avoid'
  | 'general_upgrade'

// 아이콘: 굵은 아웃라인 세트(사장님 2026-07-23). public/survey/icons/care-*.png
// (pine 실루엣 알파) 를 CSS mask 로 칠해 선택 시 흰색 로직 그대로.
const CARE_GOAL_OPTIONS: Array<{
  v: CareGoal
  label: string
  desc: string
  img: string
}> = [
  {
    v: 'weight_management',
    label: '체중 관리',
    desc: '감량 / 유지 / 증량 — BCS 가 5점에서 멀수록 적극 조정',
    img: '/survey/icons/care-weight.png',
  },
  {
    v: 'skin_coat',
    label: '피부·털 개선',
    desc: '윤기 부족, 가려움, 푸석함 — 오메가-3 비중 강화',
    img: '/survey/icons/care-coat.png',
  },
  {
    v: 'joint_senior',
    label: '관절·시니어 케어',
    desc: '7세 이상 또는 관절 신호 — B1·콜린·콜라겐 중심',
    img: '/survey/icons/care-joint.png',
  },
  {
    v: 'allergy_avoid',
    label: '알레르기·민감 회피',
    desc: '특정 단백질 차단 + 노블 프로틴 우선',
    img: '/survey/icons/care-allergy.png',
  },
  {
    v: 'general_upgrade',
    label: '일반 영양 업그레이드',
    desc: '특별 이슈 없음 — 균형식 + 기호성 중심',
    img: '/survey/icons/care-general.png',
  },
]

export type PreferencesProps = {
  coat: Coat
  setCoat: (v: Coat) => void
  careGoal: CareGoal | ''
  setCareGoal: (v: CareGoal | '') => void
}

export default function Preferences({
  coat,
  setCoat,
  careGoal,
  setCareGoal,
}: PreferencesProps) {
  return (
    <>
      <div className="s-sect">
        <div className="s-sect-lbl">
          <span className="s-label-text">모질·피부 상태</span>
          <span className="s-opt">선택</span>
        </div>
        <div className="s-chiprow">
          {COAT_OPTIONS.map(({ v, label, img }) => {
            const active = coat === v
            return (
              <button
                key={v}
                type="button"
                className={'s-chip' + (active ? ' s-on' : '')}
                aria-pressed={active}
                onClick={() => setCoat(active ? '' : v)}
              >
                <span
                  className="s-chip-ic"
                  aria-hidden
                  style={{
                    WebkitMaskImage: `url(${img})`,
                    maskImage: `url(${img})`,
                    backgroundColor: active ? '#fff' : 'var(--fd-pine)',
                  }}
                />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="s-sect">
        <div className="s-sect-lbl">
          <span className="s-label-text">가장 신경 쓰고 싶은 케어 목표</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
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
                <span
                  className="s-lb-icon"
                  style={{
                    background: active
                      ? 'rgba(255,255,255,.12)'
                      : 'var(--bg-2)',
                  }}
                >
                  <span
                    className="s-careicon"
                    aria-hidden
                    style={{
                      WebkitMaskImage: `url(${img})`,
                      maskImage: `url(${img})`,
                      // active 는 코랄 채움 위 흰색, 아니면 코랄 실루엣.
                      backgroundColor: active ? '#fff' : 'var(--fd-coral)',
                    }}
                  />
                </span>
                <span className="s-lb-body">
                  <span className="s-lb-title">{label}</span>
                  <span className="s-lb-sub">{desc}</span>
                </span>
                {active && (
                  <Check
                    size={16}
                    strokeWidth={2.5}
                    color="#fff"
                    style={{ flex: '0 0 auto' }}
                  />
                )}
              </button>
            )
          })}
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
          이 답이 첫 박스의 화식 라인 메인을 결정해요. 이후 정기 체크인으로 비율이 조정됩니다.
        </p>
      </div>

      <div className="s-hint" style={{ marginTop: 24 }}>
        <div className="s-iconwrap">
          <Sparkles size={14} strokeWidth={2} />
        </div>
        <div>
          <strong>준비 끝!</strong> 결과 보기를 누르면 NRC·AAFCO·FEDIAF·WSAVA
          가이드라인에 맞춰 맞춤 영양 분석이 시작돼요.
        </div>
      </div>
    </>
  )
}
