// /dogs/[id]/formulas 를 그리는 부분 — page.tsx(서버)가 조회한 값을 받아 그리기만 한다.
// 2026-10-09 앱 새 디자인('A 포스터', 시안 S20-formulas · S21-formulas-pending · I03-FormulasEmpty):
//   page.tsx 에서 그리는 부분만 그대로 옮겨 왔다(조회·정렬·리다이렉트는 page.tsx 에 그대로) — 로그인 없이
//   점검 화면(/design-check/box)에서 예시 값으로 시안과 나란히 보려고. 값은 시안 원본 HTML 그대로.
//   · 맨 위(최신) 카드 = 박스 레시피 파우치 색(lib/design/pouch — 한 가지 = 그 색 바탕 + 먹 도장 그림자,
//     두 가지 = 첫째 색 바탕 + 둘째 색 3px 테두리·그림자). 지난 카드 = 흰 바탕 + 회색 테두리.
//   · 레시피 이름·막대 색은 boxLines.ts 한곳에서(이름 = POUCH_NAME '닭고기', 막대 = 시안 막대 색).
//   · 영어 머리말(MY BOX)·비율 %·알고리즘 버전 글자는 뺐다(고객 문구 규칙 — 앱시안 결정 '영어·전문용어').
import Link from 'next/link'
import { petName } from '@/lib/korean'
import { boxCardColors, boxCardFrame, FOOD_LINE_POUCH } from '@/lib/design/pouch'
import { isPlainCustomerText } from '@/lib/personalization/plain-reason'
import {
  boxLineColor,
  boxLineName,
  orderedBoxLines,
  pouchLinesOf,
  type BoxLine,
} from './boxLines'
import './formulas.css'

/** 화면에 그리는 한 회차 — page.tsx 가 dog_formulas 행에서 만든다. */
export type FormulaViewRow = {
  id: string
  cycle_number: number
  approval_status: 'auto_applied' | 'pending_approval' | 'approved' | 'declined'
  formula: { lineRatios: Record<string, number>; toppers: { vegetable: number; protein: number } }
  reasoning: Array<{ chipLabel: string; ruleId: string }>
  daily_kcal: number
  /** 하루 급여량(g) — 저장 칸이 아니라 kcal + 레시피 비율로 다시 센 값(page.tsx 가 센다). */
  grams: number
  applied_from: string | null
  applied_until: string | null
  user_adjusted: boolean
  algorithm_version: string
  created_at: string
}

export default function FormulasView({
  dogId,
  dogName,
  rows,
}: {
  dogId: string
  dogName: string
  rows: FormulaViewRow[]
}) {
  return (
    <div className="fh-page">
      <section className="fh-hero">
        <span className="fh-kicker">
          <span className="fh-kicker-mark" aria-hidden />
          맞춤 박스
        </span>
        <h1>
          {petName(dogName)}의<br />
          맞춤 박스 구성
        </h1>
        <p>
          분석 결과로 만든 우리 아이 전용 레시피예요. 배송은 2주마다 받고,
          체크인 기록이 쌓이면 알고리즘이 비율을 다듬어 다음 박스에 반영해요.
        </p>
      </section>

      {rows.length === 0 ? (
        <section className="fh-empty" aria-label="박스 기록 없음">
          <BoxIcon />
          <p className="fh-empty-title">아직 박스 기록이 없어요</p>
          <p className="fh-empty-text">
            분석을 받고 첫 박스를 시작하면
            <br />
            여기에 박스마다 기록이 쌓여요.
          </p>
          <Link href={`/dogs/${dogId}/analysis`} className="fh-empty-cta">
            첫 박스 추천 받기
          </Link>
        </section>
      ) : (
        <ol className="fh-timeline">
          {rows.map((row, i) => (
            <FormulaCard
              key={row.id}
              row={row}
              isLatest={i === 0}
              isLast={i === rows.length - 1}
              dogId={dogId}
            />
          ))}
        </ol>
      )}

      <div className="fh-end" aria-hidden />
    </div>
  )
}

function FormulaCard({
  row,
  isLatest,
  isLast,
  dogId,
}: {
  row: FormulaViewRow
  isLatest: boolean
  isLast: boolean
  dogId: string
}) {
  const isPending = row.approval_status === 'pending_approval'
  const isDeclined = row.approval_status === 'declined'
  const dateRange = formatDateRange(row.applied_from, row.applied_until, row.created_at)

  // ★박스로 스냅해서 그린다(2026-08-03, 사장님: "왜 또 네개 조합이야").
  //   이 화면은 제목이 "맞춤 박스 구성"이고 "배송은 2주마다 받고" 라고 말하는데, 예전엔 **원시 임상 비율**을
  //   그대로 그려 오리50·한우30·치킨10·흑돼지10 처럼 4종이 떴다. 실제로 담기는 박스는 최대 2종이다
  //   (boxComposition: 1종 100% / 2종 50:50, 2위가 20% 미만이면 1종). 분석 카드·플랜과 같은 스냅을 거친다
  //   (orderedBoxLines = snapBoxLines + 표시 순서). 원시 비율은 "왜 이 단백질인가"의 근거일 뿐 배송·표시용이
  //   아니다(boxComposition.ts 첫 문단). 근거는 아래 칩이 보여준다.
  const lines = orderedBoxLines(row.formula.lineRatios)

  // 맨 위 카드만 레시피 파우치 색으로 칠한다(도장 그림자는 한 화면에 한 곳). 유지(거절)된 제안은 실제로
  // 담기지 않은 박스라 칠하지 않는다.
  const featured = isLatest && !isDeclined
  const pouch = pouchLinesOf(lines)
  const colors = boxCardColors(pouch)
  const lightText = colors.text === '#FFFFFF'
  // 파우치 바탕과 같은 레시피 줄은 바탕에 묻히니 흰색으로(시안 S20: 닭 바탕 위 닭 = 흰 칸).
  const segColor = (l: BoxLine) =>
    featured && pouch[0] !== undefined && FOOD_LINE_POUCH[l.line] === pouch[0]
      ? '#FFFFFF'
      : boxLineColor(l.line)

  // 근거 칩 — 승인 화면과 같은 기준으로 영문 약어·문헌 표기가 든 칩은 그리지 않는다(plain-reason).
  const chips = row.reasoning.filter((r) => isPlainCustomerText(r.chipLabel))
  const hasTopper = row.formula.toppers.vegetable > 0 || row.formula.toppers.protein > 0

  const status =
    row.approval_status === 'auto_applied'
      ? { icon: <SparkleIcon />, text: '자동 적용' }
      : row.approval_status === 'approved'
        ? { icon: <CheckSmallIcon />, text: '사용자 승인' }
        : isDeclined
          ? { icon: <HeartIcon />, text: '이전 유지 선택' }
          : null

  const dotClass = isPending
    ? 'is-pending'
    : isLatest
      ? isDeclined
        ? 'is-declined'
        : ''
      : 'is-hollow'

  return (
    <li className="fh-item">
      <span className="fh-marker" aria-hidden>
        {!isLatest && <span className="fh-line is-top" />}
        <span className={`fh-dot ${isLatest ? 'is-first' : ''} ${dotClass}`} />
        {!isLast && <span className="fh-line is-rest" />}
      </span>

      <article
        className={
          'fh-card' +
          (featured ? '' : ' is-past') +
          (isDeclined ? ' is-declined' : '') +
          (isLatest ? '' : ' is-later')
        }
        style={featured ? boxCardFrame(colors) : undefined}
      >
        <div className="fh-head">
          <span className="fh-head-left">
            <span className="ft-poster fh-cycle">{row.cycle_number}번째 박스</span>
            {isLatest && <span className="fh-tag">최신</span>}
            {row.user_adjusted && <span className="fh-tag is-adjusted">직접 조정</span>}
            {isPending && <span className="fh-tag is-pending">동의 필요</span>}
            {isDeclined && <span className="fh-tag is-declined">유지됨</span>}
          </span>
          <span className="fh-date">{dateRange}</span>
        </div>

        {lines.length > 0 && (
          <>
            <div className="fh-bar" aria-hidden>
              {lines.map((l) => (
                <span
                  key={l.line}
                  style={{ width: `${Math.round(l.ratio * 100)}%`, background: segColor(l) }}
                />
              ))}
            </div>
            <div className="fh-legend">
              {lines.map((l) => (
                <span key={l.line} className="fh-legend-item">
                  <span className="fh-legend-mark" style={{ background: segColor(l) }} />
                  {boxLineName(l.line)}
                </span>
              ))}
            </div>
          </>
        )}

        <div
          className="fh-stats"
          style={
            featured
              ? { background: lightText ? 'rgba(20,20,20,0.18)' : 'rgba(255,255,255,0.5)' }
              : undefined
          }
        >
          <span>
            <span className="ft-num fh-stat-num">{row.daily_kcal}</span>
            <span className="fh-stat-unit"> kcal</span>
          </span>
          <span className="fh-stat-div" style={lightText && featured ? { background: colors.divider } : undefined} />
          <span>
            <span className="ft-num fh-stat-num">{row.grams}</span>
            <span className="fh-stat-unit"> g/일</span>
          </span>
          {hasTopper && (
            <>
              <span className="fh-stat-div" style={lightText && featured ? { background: colors.divider } : undefined} />
              {/* 토퍼 비중(%)은 그리지 않는다 — 비율 % 는 고객 문구에서 뺐다(2026-10-09). */}
              <span className="fh-stat-unit">+ 토퍼</span>
            </>
          )}
        </div>

        {chips.length > 0 && (
          <div className="fh-chips">
            {chips.slice(0, 4).map((r, i) => (
              <span key={i} className="fh-chip">
                {r.chipLabel}
              </span>
            ))}
            {chips.length > 4 && <span className="fh-chip-more">+{chips.length - 4}</span>}
          </div>
        )}

        {isPending && (
          <Link href={`/dogs/${dogId}/approve?cycle=${row.cycle_number}`} className="fh-cta">
            <span className="fh-cta-label">
              <AlertIcon />새 비율 확인하기
            </span>
            <ArrowIcon />
          </Link>
        )}

        {status && (
          <div
            className="fh-foot"
            style={
              featured
                ? {
                    color: colors.text,
                    borderTopColor: lightText ? colors.divider : 'rgba(20,20,20,0.2)',
                  }
                : undefined
            }
          >
            {status.icon}
            {status.text}
          </div>
        )}
      </article>
    </li>
  )
}

function formatDateRange(
  from: string | null,
  until: string | null,
  fallback: string,
): string {
  // KST 기준 M.D. 서버는 UTC 라 raw getMonth/getDate 는 시간 성분 있는 값
  // (created_at 폴백)에서 하루 틀렸다 — 특히 progression 크론이 KST 05시(UTC 전날
  // 20시)에 만든 pending 처방의 created_at 이 전날로 표시됐다. +9h 시프트 후 UTC
  // 파트 읽기(datetime-kst 의 currentKstHour 와 같은 패턴). date-only 는 불변.
  const fmt = (iso: string) => {
    const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
    return `${kst.getUTCMonth() + 1}.${kst.getUTCDate()}`
  }
  if (from && until) return `${fmt(from)} – ${fmt(until)}`
  if (from) return `${fmt(from)} ~`
  return fmt(fallback)
}

/* ── 선 그림 — 시안 원본 HTML 의 SVG(24 격자)를 그대로. 전부 장식(aria-hidden). ── */

function BoxIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#595959" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    </svg>
  )
}

function CheckSmallIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5M12 16v.3" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}
