// audit #96: SurveyClient.tsx 분할 — stool step. Bristol 1~7 + GI 민감도.
import { useState } from 'react'
import {
  Check,
  HelpCircle,
  Meh,
  AlertTriangle,
  AlertCircle,
  Plus,
} from 'lucide-react'
import { petName } from '@/lib/korean'

type BristolKey = 1 | 2 | 3 | 4 | 5 | 6 | 7
type GiSensitivity = 'rare' | 'sometimes' | 'frequent' | 'always' | ''

/**
 * 변 상태 4단계 — 알고리즘상 의미 있는 상태만 (2026-07-12 사장님: 7단계 과함).
 * value 는 nutrition.ts 의 bristolScore 임계(≤2 변비 섬유+3 / 4 이상 / ≥6 무름
 * 섬유+2 / 7 설사 +수의상담)에 그대로 매핑 → 7→4 축소로 알고리즘 신호 손실 없음.
 * (3·5 '경계'는 별도 조치가 없어 제거.)
 */
const BRISTOL_OPTIONS: {
  v: BristolKey
  label: string
  signal: string
  tag: string
  tone: 'good' | 'warn' | 'bad'
  /** 상태별 아웃라인 아이콘(/survey/stool/*.png, pine 단색 실루엣).
   *  CSS mask 로 칠해서 톤 색·선택 시 흰색 로직을 그대로 쓴다(2026-07-23 사장님
   *  방향: 굵은 아웃라인 벡터 — 추상 lucide 원/물방울보다 상태가 즉시 읽힘). */
  img: string
}[] = [
  { v: 2, label: '딱딱한 편', signal: '수분·섬유가 부족한 신호', tag: '변비', tone: 'bad', img: '/survey/stool/hard.png' },
  { v: 4, label: '적당해요', signal: '건강한 변이에요', tag: '이상적', tone: 'good', img: '/survey/stool/ideal.png' },
  { v: 6, label: '조금 무른 편', signal: '식이섬유를 보강하면 좋아요', tag: '무름', tone: 'warn', img: '/survey/stool/soft.png' },
  { v: 7, label: '물설사 같아요', signal: '잦으면 수의사 상담 권장', tag: '설사', tone: 'bad', img: '/survey/stool/watery.png' },
]

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
  // 뒤로 접기 — GI 민감도는 기본 숨김, 탭하면 열림(이미 답했으면 펼쳐진 채).
  const [giOpen, setGiOpen] = useState(giSensitivity !== '')
  return (
    <div className="s-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span className="s-kicker">
          STOOL <span className="s-dot">·</span> 변 상태
        </span>
        <span className="s-opt-badge">선택</span>
      </div>
      <h1 className="s-title">
        {petName(dogName)}의 평소 변은<br />어떻게 보이나요?
      </h1>
      <p className="s-sub">
        변 상태는 장 건강과 식이섬유·수분 배합에 반영돼요.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {BRISTOL_OPTIONS.map(({ v, label, signal, tag, tone, img }) => {
          const active = bristol === v
          return (
            <button
              key={v}
              type="button"
              // 설사(7) 극단만 selected 시 danger 색.
              className={'s-listbtn' + (v === 7 ? ' s-listbtn-danger' : '')}
              aria-pressed={active}
              onClick={() => setBristol(active ? null : v)}
            >
              <span
                className="s-lb-icon s-lb-icon-lg"
                style={{
                  background: active
                    ? 'rgba(255,255,255,.12)'
                    : tone === 'good'
                      ? '#E6EBD2'
                      : tone === 'warn'
                        ? '#F5E5C7'
                        : '#F0D8CF',
                }}
              >
                <span
                  className="s-stool-ic"
                  aria-hidden
                  style={{
                    WebkitMaskImage: `url(${img})`,
                    maskImage: `url(${img})`,
                    // active 는 코랄 채움 위 — var(--bg) 대신 #fff 리터럴
                    // (다크모드 도입 시 --bg 가 어두워져도 항상 흰색 보장).
                    backgroundColor: active
                      ? '#fff'
                      : tone === 'good'
                        ? 'var(--sage)'
                        : tone === 'warn'
                          ? '#7A5B1B'
                          : 'var(--fd-coral)',
                  }}
                />
              </span>
              <span className="s-lb-body">
                <span className="s-lb-title">{label}</span>
                <span className="s-lb-sub">{signal}</span>
              </span>
              <span className={'s-tag s-' + tone}>{tag}</span>
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
        {!giOpen ? (
          <button
            type="button"
            className="s-skipbtn"
            onClick={() => setGiOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
            사료를 바꾸면 배앓이를 하는 편인가요?
          </button>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}
