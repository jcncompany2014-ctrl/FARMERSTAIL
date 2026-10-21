// 설문 다시 하기 — 바뀐 것만 고르는 요약 한 장(2026-10-21 사장님 "맨 처음 받은 설문을 또 맨 처음부터 하는 게 의미가 있냐").
// 지난 설문 답이 채워진 채 줄마다 보이고, 줄을 누르면 그 질문만 열렸다가 '다음'을 누르면 여기로 돌아온다.
// 맨 아래 '이대로 저장'(SurveyClient 가 틀의 버튼 자리에 넣는다) = 평소와 같은 제출. 줄 묶기·문구는 lib/survey/review.
import type { ReviewRow } from '@/lib/survey/review'
import { ScreenShell } from './ScreenShell'

const rowStyle = {
  width: '100%',
  minHeight: 68,
  padding: '12px 0',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  border: 0,
  borderBottom: '1px solid #EEECE9',
  background: 'transparent',
  textAlign: 'left',
  fontFamily: 'inherit',
  color: '#141414',
  cursor: 'pointer',
} as const

export function ReviewScreen({
  dogName,
  lastAt,
  rows,
  onEdit,
}: {
  dogName: string
  /** 지난 설문 날짜(이미 한국어 날짜 문구). */
  lastAt: string
  rows: ReviewRow[]
  onEdit: (row: ReviewRow) => void
}) {
  const missing = rows.filter((r) => r.empty).length
  return (
    <ScreenShell
      kicker="다시 하기"
      title={
        <>
          지난번 답을
          <br />
          채워 뒀어요
        </>
      }
      sub={`${lastAt} 설문 답이에요. ${dogName}에게 바뀐 것만 눌러 고쳐 주세요.`}
    >
      {missing > 0 && (
        <p role="note" style={{ margin: '14px 0 0', padding: '10px 12px', borderRadius: 4, background: '#FFF4E0', fontSize: 15, lineHeight: 1.5, fontWeight: 700 }}>
          새로 생긴 질문 {missing}개는 답해 주세요
        </p>
      )}
      <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none' }} aria-label="지난 설문 답">
        {rows.map((r) => (
          <li key={r.keys.join('-')}>
            <button type="button" style={rowStyle} onClick={() => onEdit(r)} aria-label={`${r.title} 바꾸기`}>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#595959' }}>{r.title}</span>
                <span style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.4, color: r.empty ? '#B4561E' : '#141414' }}>
                  {r.empty ? '아직 답하지 않았어요' : r.value}
                </span>
              </span>
              <span style={{ flexShrink: 0, fontSize: 15, fontWeight: 800, textDecoration: 'underline', textUnderlineOffset: 3 }}>바꾸기</span>
            </button>
          </li>
        ))}
      </ul>
    </ScreenShell>
  )
}
