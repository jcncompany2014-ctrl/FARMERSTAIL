// audit #96: SurveyClient.tsx 분할 — loading step. 분석 진행 stage + 실패 시 retry.
import { Check, Loader2, AlertCircle } from 'lucide-react'
import DogPawMark from '@/components/DogPawMark'

export type LoadingProps = {
  dogName: string
  loadingStage: number
  err: string
  saving: boolean
  onRetry: () => void
  /** 저장 실패 시 마지막 입력 단계로 복귀 — loading 화면에 갇히지 않도록. */
  onBack?: () => void
}

export default function Loading({
  dogName,
  loadingStage,
  err,
  saving,
  onRetry,
  onBack,
}: LoadingProps) {
  return (
    <div className="s-loading-page">
      <div className="s-orb">
        <DogPawMark size={38} />
      </div>
      <span className="s-kicker">ANALYZING</span>
      <h2
        className="s-title"
        // R34e: line-height 1.25 명시 — 두 줄 호흡 (홈/카탈로그/카트 heading 통일).
        style={{ margin: '6px 0 8px', lineHeight: 1.25 }}
      >
        {dogName} 맞춤 영양<br />설계 중이에요
      </h2>
      <p
        style={{
          fontSize: 12,
          color: 'var(--fd-muted)',
          lineHeight: 1.7,
          fontFamily: 'var(--font-sans), Pretendard, sans-serif',
          letterSpacing: 0.04,
        }}
      >
        NRC · AAFCO
        <br />
        FEDIAF · WSAVA
      </p>
      <ul className="s-stages">
        {[
          '체형 평가',
          'RER · MER 계산',
          'AAFCO 매크로 비교',
          '맞춤 보충제 매핑',
        ].map((s, i, arr) => {
          // 로딩 화면이 떠 있는 동안 마지막 단계가 '완료(체크)'로 보이면
          // "다 됐는데 왜 안 넘어가지" 모순(스샷처럼 4개 다 체크인데 계속 분석중).
          // → activeIdx 를 length-1 로 클램프 = 마지막 단계는 결과로 넘어가기
          // 전까지 항상 진행중(spinner). 라벨에서 '처리/중' 제거(체크=완료로 읽힘).
          const activeIdx = Math.min(loadingStage, arr.length - 1)
          const cls =
            i < activeIdx ? 's-done' : i === activeIdx ? 's-active' : ''
          return (
            <li key={i} className={cls}>
              <span className="s-ic-stage">
                {i < activeIdx ? (
                  <Check size={11} strokeWidth={2.5} color="#fff" />
                ) : i === activeIdx ? (
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
          // 다시 시도 CTA — 설문 next-btn 과 동일 FD pill grammar
          // (평면 coral fill, 글로우 그림자 제거). [회차313 FD 정렬]
          style={{
            marginTop: 14,
            appearance: 'none',
            border: 'none',
            background: 'var(--fd-coral)',
            color: '#fff',
            padding: '13px 22px',
            borderRadius: 99,
            fontSize: 13.5,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: 'none',
            opacity: saving ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          다시 시도
        </button>
      )}
      {err && onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          // 보조(ghost) — 재시도가 계속 실패해도 갇히지 않게 입력 단계로 탈출.
          style={{
            marginTop: 10,
            appearance: 'none',
            border: 'none',
            background: 'transparent',
            color: 'var(--fd-muted)',
            padding: '8px 14px',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            opacity: saving ? 0.6 : 1,
          }}
        >
          이전 단계로 돌아가기
        </button>
      )}
    </div>
  )
}
