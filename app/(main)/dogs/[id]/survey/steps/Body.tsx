// audit #96: SurveyClient.tsx 분할 — body step. BCS 9-point + 6개월 체중 추세.
// SurveyClient 의 useState 를 props 로 받음 (상태는 부모에 집중).
import {
  HelpCircle,
  MoonStar,
  Moon,
  Sun,
  CloudSun,
  Cloud,
  Sparkle,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react'
import { BCS_DESCRIPTIONS, type BcsKey } from '@/lib/nutrition/guidelines'

// BCS 9-point — 디자인의 시각 위계 그대로 (group + icon + tag)
const BCS_VIEW: Record<
  BcsKey,
  {
    group: 'under' | 'ideal' | 'over'
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number; color?: string; size?: number }>
    tag: string
    tagTone: 'good' | 'warn' | 'bad'
  }
> = {
  1: { group: 'under', Icon: MoonStar, tag: '위험', tagTone: 'bad' },
  2: { group: 'under', Icon: Moon, tag: '주의', tagTone: 'warn' },
  3: { group: 'under', Icon: MoonStar, tag: '주의', tagTone: 'warn' },
  4: { group: 'ideal', Icon: Sparkle, tag: '양호', tagTone: 'good' },
  5: { group: 'ideal', Icon: Sparkles, tag: '이상적', tagTone: 'good' },
  6: { group: 'over', Icon: Sun, tag: '주의', tagTone: 'warn' },
  7: { group: 'over', Icon: Sun, tag: '주의', tagTone: 'warn' },
  8: { group: 'over', Icon: CloudSun, tag: '위험', tagTone: 'bad' },
  9: { group: 'over', Icon: Cloud, tag: '위험', tagTone: 'bad' },
}

type WeightTrend = 'stable' | 'gained' | 'lost' | 'unknown' | ''

export type BodyProps = {
  dogName: string
  bcs: BcsKey | null
  setBcs: (v: BcsKey | null) => void
  weightTrend: WeightTrend
  setWeightTrend: (v: WeightTrend) => void
}

export default function Body({
  dogName,
  bcs,
  setBcs,
  weightTrend,
  setWeightTrend,
}: BodyProps) {
  return (
    <div className="s-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span className="s-kicker">
          BODY <span className="s-dot">·</span> WSAVA
        </span>
      </div>
      <h1 className="s-title">
        {dogName}의 체형을<br />선택해 주세요
      </h1>
      <p className="s-sub">
        <strong>BCS (Body Condition Score)</strong> = 체형 점수. 위에서
        봤을 때 허리, 옆에서 봤을 때 배 라인 기준{' '}
        <strong>9점 척도</strong>예요. 5번이 이상적.
      </p>

      <div className="s-grid-3">
        {([1, 2, 3, 4, 5, 6, 7, 8, 9] as BcsKey[]).map((s) => {
          const active = bcs === s
          const view = BCS_VIEW[s]
          const Icon = view.Icon
          const stroke = s === 5 ? 2.2 : 1.6
          const color = active
            ? 'var(--bg)'
            : view.group === 'ideal'
              ? '#566729'
              : view.group === 'under'
                ? '#A6BEDA'
                : view.tagTone === 'bad'
                  ? 'var(--terracotta)'
                  : '#D4B872'
          return (
            <button
              key={s}
              type="button"
              className="s-pickcard"
              aria-pressed={active}
              onClick={() => setBcs(s)}
            >
              {s === 5 && <span className="s-ideal">IDEAL</span>}
              <div className="s-num">{s}/9</div>
              <div className="s-swatch">
                <Icon size={28} strokeWidth={stroke} color={color} />
              </div>
              <div className="s-lbl">{BCS_DESCRIPTIONS[s].label.replace('BCS ', '')}</div>
            </button>
          )
        })}
      </div>

      {bcs !== null && (
        <div className="s-hint">
          <div className="s-iconwrap">
            {(() => {
              const Icon = BCS_VIEW[bcs].Icon
              return <Icon size={14} strokeWidth={2} />
            })()}
          </div>
          <div>
            <div className="s-row">
              <strong>{BCS_DESCRIPTIONS[bcs].label}</strong>
              <span className={'s-tag s-' + BCS_VIEW[bcs].tagTone}>
                {BCS_VIEW[bcs].tag}
              </span>
            </div>
            {BCS_DESCRIPTIONS[bcs].desc}
          </div>
        </div>
      )}

      <div className="s-sect">
        <div className="s-sect-lbl">
          <span className="s-label-text">최근 6개월 체중 변화</span>
          <span className="s-opt">선택</span>
        </div>
        <div className="s-chiprow">
          {[
            { v: 'stable', label: '비슷', Icon: Minus },
            { v: 'gained', label: '늘었음', Icon: TrendingUp },
            { v: 'lost', label: '빠졌음', Icon: TrendingDown },
            { v: 'unknown', label: '잘 모름', Icon: HelpCircle },
          ].map(({ v, label, Icon }) => {
            const active = weightTrend === v
            return (
              <button
                key={v}
                type="button"
                className={'s-chip' + (active ? ' s-on' : '')}
                aria-pressed={active}
                onClick={() => setWeightTrend(v as WeightTrend)}
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
