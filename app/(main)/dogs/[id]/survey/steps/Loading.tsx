// audit #96: SurveyClient.tsx 분할 — loading step. 분석 진행 stage + 실패 시 retry.
//
// 2026-10-09 앱 새 디자인('A 포스터', 시안 E18 · L33): 설문 카드 안에 도장 로고 + "땅콩이 맞춤 식단을 만들고 있어요"
// + 네 단계 줄(끝난 단계 = 먹색 체크 · 지금 = 도는 고리 · 남은 = 빈 동그라미). 단계 이름은 쉬운 말로
// ("맞춤 보충제 매핑" → "맞춤 박스 고르기" — 앱시안 결정 3번). 저장 실패(L33)면 도장을 작게·흐리게, 멈춘 단계에
// 빨간 '!', 아래에 실패 상자 + 카드 버튼 자리에 '다시 시도'·'이전 단계로 돌아가기'(LoadingCta).
import { petName } from '@/lib/korean'
import { CheckIcon } from './ScreenShell'

export type LoadingProps = {
  dogName: string
  loadingStage: number
  err: string
}

const STAGES = ['체형 살펴보기', '하루 필요 열량 계산', '영양 기준과 비교', '맞춤 박스 고르기'] as const

export default function Loading({ dogName, loadingStage, err }: LoadingProps) {
  // 로딩 화면이 떠 있는 동안 마지막 단계가 '완료(체크)'로 보이면
  // "다 됐는데 왜 안 넘어가지" 모순(스샷처럼 4개 다 체크인데 계속 분석중).
  // → activeIdx 를 length-1 로 클램프 = 마지막 단계는 결과로 넘어가기
  // 전까지 항상 진행중(spinner). 라벨에서 '처리/중' 제거(체크=완료로 읽힘).
  const activeIdx = Math.min(loadingStage, STAGES.length - 1)
  const failed = err !== ''
  return (
    <div className="s-loading" data-failed={failed ? 'true' : undefined}>
      <span className="s-stamp" aria-hidden="true" />
      <h1 className="s-title">
        {petName(dogName)} 맞춤 식단을
        <br />
        만들고 있어요
      </h1>
      {!failed && <p className="s-sub">국제 영양 기준에 맞춰 계산하고 있어요</p>}
      <ul className="s-steps">
        {STAGES.map((s, i) => {
          const state =
            i < activeIdx ? 'done' : i === activeIdx ? (failed ? 'failed' : 'active') : 'todo'
          return (
            <li key={s} data-state={state}>
              <span className="s-step-ic" aria-hidden="true">
                {state === 'done' ? <CheckIcon /> : state === 'failed' ? '!' : null}
              </span>
              {s}
            </li>
          )
        })}
      </ul>
      {failed && (
        <div className="s-failbox" role="alert" aria-live="polite">
          <strong>{err}</strong>
          <span>답한 내용은 그대로 있어요. 다시 시도해 주세요.</span>
        </div>
      )}
    </div>
  )
}

/** 저장 실패 시 카드 버튼 자리 — 다시 시도(먹색) · 이전 단계로 돌아가기(테두리). */
export function LoadingCta({
  saving,
  onRetry,
  onBack,
}: {
  saving: boolean
  onRetry: () => void
  /** 저장 실패 시 마지막 입력 단계로 복귀 — loading 화면에 갇히지 않도록. */
  onBack?: () => void
}) {
  return (
    <>
      <button type="button" className="s-btn-primary" onClick={onRetry} disabled={saving}>
        다시 시도
      </button>
      {/* 보조 — 재시도가 계속 실패해도 갇히지 않게 입력 단계로 탈출. 핸들러가 없으면 그리지 않는다(규칙38). */}
      {onBack && (
        <button type="button" className="s-btn-secondary" onClick={onBack} disabled={saving}>
          이전 단계로 돌아가기
        </button>
      )}
    </>
  )
}
