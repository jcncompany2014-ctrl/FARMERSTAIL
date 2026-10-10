// 설문 — 아래에서 올라오는 창 (2026-10-09 앱 새 디자인('A 포스터'), 시안 F25 · F26 · L34 · L20).
//
// 틀은 공용 components/ui/BottomSheet(<dialog> — 바탕 누르기·아래로 끌기·하드웨어 뒤로가기로 닫힘)를 그대로 쓰고,
// 안쪽만 시안대로 그린다: 위 모서리 28 · 흰 바탕 · 큰 제목(제목 글꼴 24) · 회색 설명 · 먹색 버튼(높이 60).
// 모서리·그래버 색은 survey.css 의 .s-sheet-host 안에서만 덮는다(다른 화면의 창은 그대로).
//
// ExitSheet — 나가기 확인. 사장님 결정(앱시안 결정 2번): '계속하기'가 진한(먹색) 위 버튼, '나가기'가 아래 테두리 버튼.
// 공용 확인창(useConfirm)은 확인 = 오른쪽 진한 버튼이라 모양이 반대다 — 공용을 바꾸지 않고 설문 안에 따로 둔다.
// 뜻은 예전과 같다: 계속하기(·바탕 누르기·뒤로가기) = 그대로 머무름, 나가기 = 부르는 쪽이 정한 곳으로 이동.
import type { ReactNode } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'

export function SurveySheet({
  open,
  onClose,
  title,
  optional = false,
  sub,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  /** 제목 옆 회색 "선택". */
  optional?: boolean
  sub?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="s-sheet-host">
      <BottomSheet open={open} onClose={onClose} ariaLabel={title}>
        <div className="s-sheet">
          <div className="s-sheet-titlerow">
            {/* 제목 글꼴은 앱 틀의 h2 규칙이 준다(Black Han Sans) — 여기서 글꼴을 정하지 않는다. */}
            <h2 className="s-sheet-title">{title}</h2>
            {optional && <span className="s-sheet-opt">선택</span>}
          </div>
          {sub && <p className="s-sheet-sub">{sub}</p>}
          {children}
          {/* 고르거나 적는 즉시 답에 들어간다 — '확인'은 창을 닫기만 한다. */}
          <button type="button" className="s-btn-primary s-sheet-ok" onClick={onClose}>
            확인
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}

export function ExitSheet({
  open,
  refine,
  onStay,
  onLeave,
}: {
  open: boolean
  /** 정확도 올리기(추가 답변)에서 나가기 — 문구가 다르다(시안 L20). */
  refine: boolean
  onStay: () => void
  onLeave: () => void
}) {
  const title = refine ? '추가 답변을 그만둘까요?' : '설문을 나갈까요?'
  return (
    <div className="s-sheet-host">
      <BottomSheet open={open} onClose={onStay} ariaLabel={title}>
        <div className="s-sheet">
          <h2 className="s-sheet-title">{title}</h2>
          <p className="s-sheet-body">
            {refine ? (
              '지금까지 적은 추가 답변은 저장되지 않아요.'
            ) : (
              <>
                지금까지 답한 내용은 저장돼 있어요.
                <br />
                다시 들어오면 이어서 할 수 있어요.
              </>
            )}
          </p>
          <div className="s-sheet-btns">
            <button type="button" className="s-btn-primary" onClick={onStay}>
              계속하기
            </button>
            <button type="button" className="s-btn-secondary" onClick={onLeave}>
              나가기
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
