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
      <h2 className="s-title" style={{ fontSize: 24, margin: '6px 0 8px' }}>
        {dogName} 맞춤 영양<br />설계 중이에요
      </h2>
      <p
        style={{
          fontSize: 11.5,
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
                  <Check size={11} strokeWidth={3} color="#fff" />
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
          style={{
            marginTop: 14,
            appearance: 'none',
            border: '1px solid var(--terracotta)',
            background: '#fff',
            color: 'var(--terracotta)',
            padding: '10px 20px',
            borderRadius: 99,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          다시 시도
        </button>
      )}
    </div>
  )
}
