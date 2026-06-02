// audit #96: SurveyClient.tsx 분할 — loading step. 분석 진행 stage + 실패 시 retry.
import { Dog as DogIcon, Check, Loader2, AlertCircle } from 'lucide-react'

export type LoadingProps = {
  dogName: string
  loadingStage: number
  err: string
  saving: boolean
  onRetry: () => void
}

export default function Loading({
  dogName,
  loadingStage,
  err,
  saving,
  onRetry,
}: LoadingProps) {
  return (
    <div className="s-loading-page">
      <div className="s-orb">
        <DogIcon size={38} strokeWidth={1.4} />
      </div>
      <span className="s-kicker">ANALYZING</span>
      <h2
        className="s-title"
        // R34e: line-height 1.25 명시 — 두 줄 호흡 (홈/카탈로그/카트 heading 통일).
        style={{ fontSize: 24, margin: '6px 0 8px', lineHeight: 1.25 }}
      >
        {dogName} 맞춤 영양<br />설계 중이에요
      </h2>
      <p
        style={{
          fontSize: 12,
          color: 'var(--muted)',
          lineHeight: 1.7,
          fontFamily: 'var(--font-mono), JetBrains Mono, monospace',
          letterSpacing: 0.04,
        }}
      >
        NRC 2006 · AAFCO 2024
        <br />
        FEDIAF 2021 · WSAVA
      </p>
      <ul className="s-stages">
        {[
          '체형 평가 처리',
          'RER · MER 계산 중',
          'AAFCO 매크로 비교',
          '맞춤 보충제 매핑',
        ].map((s, i) => {
          const cls =
            i < loadingStage ? 's-done' : i === loadingStage ? 's-active' : ''
          return (
            <li key={i} className={cls}>
              <span className="s-ic-stage">
                {i < loadingStage ? (
                  <Check size={11} strokeWidth={2.5} color="#fff" />
                ) : i === loadingStage ? (
                  <Loader2 size={11} strokeWidth={2.5} color="#fff" />
                ) : null}
              </span>
              {s}
            </li>
          )
        })}
      </ul>
      {!err && (
        <div className="s-dots" style={{ marginTop: 24 }}>
          <span />
          <span />
          <span />
        </div>
      )}
      {err && (
        <div
          className="s-errbar"
          role="alert"
          aria-live="polite"
          style={{ marginTop: 20 }}
        >
          <AlertCircle size={14} strokeWidth={2.2} />
          <span>{err}</span>
        </div>
      )}
      {err && (
        <button
          type="button"
          onClick={onRetry}
          disabled={saving}
          // R34e: 다시 시도 CTA 를 다른 step 의 next-btn 과 동일 grammar
          // (terracotta fill + 그라데이션 shadow + inset highlight). 강한
          // 행동 유도. 카트 sticky CTA / 설문 next-btn 호응.
          style={{
            marginTop: 14,
            appearance: 'none',
            border: '1px solid rgba(178, 58, 26, 0.6)',
            background: 'var(--terracotta)',
            color: '#fff',
            padding: '11px 22px',
            borderRadius: 99,
            fontSize: 13.5,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow:
              '0 8px 22px -6px rgba(220, 83, 42, 0.48), 0 2px 8px rgba(220, 83, 42, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
            opacity: saving ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          다시 시도
        </button>
      )}
    </div>
  )
}
