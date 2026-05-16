// audit #96: SurveyClient.tsx 분할 — stool step. Bristol 1~7 + GI 민감도.
import {
  Circle,
  CircleDashed,
  CircleDot,
  CircleCheck,
  CircleEllipsis,
  Droplet,
  Droplets,
  Check,
  HelpCircle,
  Meh,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react'
import { BRISTOL_INTERPRETATION } from '@/lib/nutrition/guidelines'

type BristolKey = 1 | 2 | 3 | 4 | 5 | 6 | 7
type GiSensitivity = 'rare' | 'sometimes' | 'frequent' | 'always' | ''

const STOOL_VIEW: Record<
  BristolKey,
  {
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number; color?: string; size?: number }>
    tag: string
    tagTone: 'good' | 'warn' | 'bad'
  }
> = {
  1: { Icon: Circle, tag: '변비', tagTone: 'bad' },
  2: { Icon: CircleDashed, tag: '변비', tagTone: 'bad' },
  3: { Icon: CircleDot, tag: '경계', tagTone: 'warn' },
  4: { Icon: CircleCheck, tag: '이상적', tagTone: 'good' },
  5: { Icon: CircleEllipsis, tag: '경계', tagTone: 'warn' },
  6: { Icon: Droplet, tag: '설사', tagTone: 'bad' },
  7: { Icon: Droplets, tag: '설사', tagTone: 'bad' },
}

export type StoolProps = {
  dogName: string
  bristol: BristolKey | null
  setBristol: (v: BristolKey | null) => void
  giSensitivity: GiSensitivity
  setGiSensitivity: (v: GiSensitivity) => void
}

export default function Stool({
  dogName,
  bristol,
  setBristol,
  giSensitivity,
  setGiSensitivity,
}: StoolProps) {
  return (
    <div className="s-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span className="s-kicker">
          STOOL <span className="s-dot">·</span> BRISTOL SCALE
        </span>
        <span className="s-opt-badge">선택</span>
      </div>
      <h1 className="s-title">
        {dogName}의 평소 변은<br />어떻게 보이나요?
      </h1>
      <p className="s-sub">
        <strong>Bristol Scale</strong> = 변 형태를 7단계로 분류한 의학
        표준. 장 건강과 식이섬유·수분 흡수 신호예요.
        <span className="s-pill">이상: #4</span>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {([1, 2, 3, 4, 5, 6, 7] as const).map((s) => {
          const active = bristol === s
          const view = STOOL_VIEW[s]
          const Icon = view.Icon
          const meta = BRISTOL_INTERPRETATION[s]!
          return (
            <button
              key={s}
              type="button"
              className="s-listbtn"
              aria-pressed={active}
              onClick={() => setBristol(active ? null : s)}
            >
              <span className="s-lb-num">#{s}</span>
              <span
                className="s-lb-icon"
                style={{
                  background: active
                    ? 'rgba(255,255,255,.12)'
                    : view.tagTone === 'good'
                      ? '#E6EBD2'
                      : view.tagTone === 'warn'
                        ? '#F5E5C7'
                        : '#F0D8CF',
                }}
              >
                <Icon
                  size={20}
                  strokeWidth={1.8}
                  color={
                    active
                      ? 'var(--bg)'
                      : view.tagTone === 'good'
                        ? '#566729'
                        : view.tagTone === 'warn'
                          ? '#7A5B1B'
                          : 'var(--terracotta)'
                  }
                />
              </span>
              <span className="s-lb-body">
                <span className="s-lb-title">{meta.label}</span>
                <span className="s-lb-sub">{meta.signal}</span>
              </span>
              <span className={'s-tag s-' + view.tagTone}>{view.tag}</span>
            </button>
          )
        })}
        <div className="s-skip-divider"><span>또는</span></div>
        <button
          type="button"
          className={'s-skipbtn' + (bristol === null ? ' s-active' : '')}
          onClick={() => setBristol(null)}
          aria-pressed={bristol === null}
        >
          {bristol === null ? (
            <>
              <Check className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />
              이번엔 건너뛸게요
            </>
          ) : (
            <>
              <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
              잘 모르겠어요 — 건너뛸게요
            </>
          )}
        </button>
      </div>

      <div className="s-sect">
        <div className="s-sect-lbl">
          <span className="s-label-text">사료를 바꿀 때 변이 자주 무르나요?</span>
          <span className="s-opt">선택</span>
        </div>
        <div className="s-chiprow">
          {[
            { v: 'rare', label: '거의 없음', Icon: Check },
            { v: 'sometimes', label: '가끔', Icon: Meh },
            { v: 'frequent', label: '자주', Icon: AlertTriangle },
            { v: 'always', label: '매번', Icon: AlertCircle },
          ].map(({ v, label, Icon }) => {
            const active = giSensitivity === v
            return (
              <button
                key={v}
                type="button"
                className={'s-chip' + (active ? ' s-on' : '')}
                aria-pressed={active}
                onClick={() => setGiSensitivity(v as GiSensitivity)}
              >
                <Icon size={13} strokeWidth={2} />
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
