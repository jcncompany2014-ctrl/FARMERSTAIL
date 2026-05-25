// audit #96: SurveyClient.tsx 분할 — muscle step. MCS 4-grade (선택).
import {
  Dumbbell,
  Activity,
  TrendingDown,
  AlertTriangle,
  Check,
  HelpCircle,
} from 'lucide-react'
import { MCS_DESCRIPTIONS, type McsKey } from '@/lib/nutrition/guidelines'

const MCS_VIEW: Record<
  McsKey,
  {
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number; color?: string; size?: number }>
    tag: string
    tagTone: 'good' | 'warn' | 'bad'
  }
> = {
  1: { Icon: Dumbbell, tag: '양호', tagTone: 'good' },
  2: { Icon: Activity, tag: '경도', tagTone: 'warn' },
  3: { Icon: TrendingDown, tag: '주의', tagTone: 'warn' },
  4: { Icon: AlertTriangle, tag: '위험', tagTone: 'bad' },
}

export type MuscleProps = {
  mcs: McsKey | null
  setMcs: (v: McsKey | null) => void
}

export default function Muscle({ mcs, setMcs }: MuscleProps) {
  return (
    <div className="s-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span className="s-kicker">
          MUSCLE <span className="s-dot">·</span> WSAVA
        </span>
        <span className="s-opt-badge">선택</span>
      </div>
      <h1 className="s-title">근육 상태는<br />어떤가요?</h1>
      <p className="s-sub">
        <strong>MCS (Muscle Condition Score)</strong> = 근육 상태 점수.
        척추뼈 / 견갑골 / 골반 위 근육을 만져 평가해요. 노령견 근감소증
        조기 발견에 중요해요.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {([1, 2, 3, 4] as McsKey[]).map((s) => {
          const active = mcs === s
          const view = MCS_VIEW[s]
          const Icon = view.Icon
          const meta = MCS_DESCRIPTIONS[s]
          return (
            <button
              key={s}
              type="button"
              // R35 revert: R34b 의 MCS 1 sage default 강조 제거. 모든 카드
              // default 동일 — 시스템이 정답 유도 X. (Body 와 동일 정책)
              className="s-listbtn"
              aria-pressed={active}
              onClick={() => setMcs(active ? null : s)}
            >
              <span className="s-lb-num">MCS {s}</span>
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
                <span className="s-lb-sub">{meta.desc}</span>
              </span>
              <span className={'s-tag s-' + view.tagTone}>{view.tag}</span>
            </button>
          )
        })}
        <div className="s-skip-divider"><span>또는</span></div>
        <button
          type="button"
          className={'s-skipbtn' + (mcs === null ? ' s-active' : '')}
          onClick={() => setMcs(null)}
          aria-pressed={mcs === null}
        >
          {mcs === null ? (
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
    </div>
  )
}
