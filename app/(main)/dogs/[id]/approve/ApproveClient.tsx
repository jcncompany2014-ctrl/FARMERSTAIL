'use client'

// audit #101 — ApproveClient: decide button (approve / decline) 만 client.
// page.tsx (server) 가 auth/dog/pending/previous formula 를 prefetch.
// 2026-10-09 앱 새 디자인('A 포스터', 시안 S22-approve) — 모양만 바꿨다. 금액 계산(page.tsx)·승인/유지 API 호출·
// 판정(notApproved 보류 포함)은 그대로. 영어 머리말(NEEDS APPROVAL)·비율 % 글자는 뺐다(앱시안 결정 '영어·전문용어').
import { useState } from 'react'
import { userFacingError } from '@/lib/error-message'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { petName } from '@/lib/korean'
import { ALL_LINES } from '@/lib/personalization/lines'
import type { Formula, FoodLine } from '@/lib/personalization/types'
import type { ApprovePricing } from './page'
import { haptic } from '@/lib/haptic'
import { trackBoxDecision } from '@/lib/analytics'
import './approve.css'
import { snapBoxRatios } from '@/lib/personalization/boxComposition'
import { plainTrigger, isPlainCustomerText } from '@/lib/personalization/plain-reason'
import { CheckIcon, XIcon } from '@/components/v3/dog/DogIcons'
import { boxLineColor, boxLineName, orderedBoxLines } from '../formulas/boxLines'

type Props = {
  dogId: string
  dogName: string
  cycleNumber: number
  pending: Formula | null
  previous: Formula | null
  /** 2주 청구액 — 서버가 정본 계산으로 재산정. 불확실하면 null(표시 안 함). */
  pricing: ApprovePricing | null
  /**
   * 금액 변경 제안(몸무게·알레르기·건강 정보 변경)인가 — 계기·응답 기한(3일)이 체크인 재제안(5일)과 다르다.
   * (10차 E, 2026-10-06: 이 화면이 모든 대기 건을 '체크인 응답 분석·5일'로만 안내했다.)
   */
  isPriceChange?: boolean
}

export default function ApproveClient({
  dogId,
  dogName,
  cycleNumber,
  pending,
  previous,
  pricing,
  isPriceChange = false,
}: Props) {
  const router = useRouter()
  const toast = useToast()

  const [submitting, setSubmitting] = useState<'approve' | 'decline' | null>(
    null,
  )
  const [err, setErr] = useState('')

  async function decide(decision: 'approve' | 'decline') {
    setSubmitting(decision)
    setErr('')
    try {
      const res = await fetch('/api/personalization/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dogId, cycleNumber, decision }),
      })
      const json = (await res.json()) as
        | { ok: true; decision: string; notApproved?: boolean; message?: string }
        | { ok?: false; code?: string; message?: string }
      if (!res.ok || !('ok' in json) || json.ok !== true) {
        const msg =
          ('message' in json && json.message) || '저장하지 못했어요'
        setErr(msg)
        return
      }
      haptic('confirm')
      trackBoxDecision({ dogId, cycleNumber, decision })
      // 서버가 금액 검산 불일치로 보류하면 ok:true + notApproved — '적용됐어요'라고 말하면 안 된다.
      if (json.notApproved) {
        toast.info(json.message ?? '이번 변경은 보류했어요. 확인 후 다시 안내드릴게요.')
      } else if (decision === 'approve') {
        toast.success('새 비율이 적용됐어요')
      } else {
        toast.success('이전 비율 그대로 유지할게요')
      }
      router.push(`/dogs/${dogId}/analysis`)
    } catch (e) {
      setErr(userFacingError(e, '네트워크가 불안정해요. 다시 시도해 주세요'))
    } finally {
      setSubmitting(null)
    }
  }

  if (!pending) {
    return (
      <div className="ap-page">
        <section className="ap-empty">
          <p>
            {cycleNumber > 0 ? `${cycleNumber}번째 박스의 ` : ''}동의 대기 건을 찾을 수 없어요.
            <br />
            이미 응답했거나 응답 기한이 지나 자동 취소됐을 수 있어요.
          </p>
          <Link href={`/dogs/${dogId}/analysis`} className="ap-empty-cta">
            현재 박스 보기
          </Link>
        </section>
      </div>
    )
  }

  const lineChanges = previous ? computeLineChanges(previous, pending) : []
  // 10/6 10차 E: 근거 원문은 임상 표기·문헌 인용(DM 지방 %·FDA 2018 …)이 섞여 있다 — 쉬운 말로 바꾸고,
  // 설명(action)은 그대로 보여도 되는 말일 때만 그린다.
  const reasons = pending.reasoning
    .map((r) => ({ ...r, trigger: plainTrigger(r.trigger) }))
    .filter((r) => isPlainCustomerText(r.trigger) && isPlainCustomerText(r.chipLabel))
    .slice(0, 5)

  return (
    <div className="ap-page">
      <section className="ap-hero">
        <span className="ap-kicker">
          <span className="ap-cycle">{cycleNumber}번째 박스</span>
          동의가 필요해요
        </span>
        <h1 className="ap-h1">
          {petName(dogName)} 다음 박스
          <br />
          비율을 바꿔봐요
        </h1>
        <p className="ap-sub">
          {isPriceChange
            ? '알려주신 정보가 바뀌어 다시 계산했어요. 마음에 들면'
            : '체크인 응답을 분석해서 비율을 조정해봤어요. 마음에 들면'}{' '}
          <strong>적용</strong>, 그대로 두려면 <strong>유지</strong>.
        </p>
      </section>

      {pricing && <PriceChange pricing={pricing} />}

      {(lineChanges.length > 0 || previous) && (
        <section className="ap-sect" aria-labelledby="ap-chg-title">
          <h2 id="ap-chg-title" className="ap-sect-title">
            바뀌는 부분
          </h2>
          {lineChanges.length > 0 && (
            <div className="ap-chip-row">
              {lineChanges.map((c, i) => (
                <span key={i} className={'ap-chip ' + (c.delta > 0 ? 'ap-up' : 'ap-down')}>
                  {c.line && (
                    <span
                      className="ap-chip-mark"
                      style={{ background: boxLineColor(c.line) }}
                      aria-hidden
                    />
                  )}
                  {c.label} {changeWord(c)}
                  {c.delta > 0 ? <UpIcon /> : <DownIcon />}
                </span>
              ))}
            </div>
          )}
          {previous && <CompareBars previous={previous} next={pending} />}
        </section>
      )}

      {reasons.length > 0 && (
        <section className="ap-sect" aria-labelledby="ap-why-title">
          <h2 id="ap-why-title" className="ap-sect-title">
            왜 이렇게 제안했어요
          </h2>
          <ol className="ap-reason-list">
            {reasons.map((r, i) => (
              <li key={i} className="ap-reason">
                <span className="ft-num ap-reason-num">{i + 1}</span>
                <span className="ap-reason-body">
                  <span className="ap-reason-chip">{r.chipLabel}</span>
                  <span className="ap-reason-detail">
                    <strong>{r.trigger}</strong>
                    {isPlainCustomerText(r.action) && <> → {r.action}</>}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="ap-foot">
        <ClockIcon />
        {isPriceChange ? '3일' : '5일'} 안에 응답하지 않으시면 이전 비율 그대로 유지돼요.
      </p>

      {err && (
        <div className="ap-err" role="alert">
          <AlertIcon />
          {err}
        </div>
      )}

      <div className="ap-cta">
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => decide('decline')}
          className="ap-btn ap-decline"
        >
          {submitting === 'decline' ? (
            <Loader2 size={16} strokeWidth={2.4} className="animate-spin" />
          ) : (
            <XIcon size={16} color="#141414" />
          )}
          그대로 유지
        </button>
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => decide('approve')}
          className="ap-btn ap-approve"
        >
          {submitting === 'approve' ? (
            <Loader2 size={18} strokeWidth={2.4} className="animate-spin" />
          ) : (
            <CheckIcon size={18} strokeWidth={2.8} color="#FFFFFF" />
          )}
          새 비율 적용
        </button>
      </div>
    </div>
  )
}

/**
 * 2주 청구액 변화 — **이 화면에서 가장 중요한 정보.**
 *
 * 처방이 바뀌면 박스 분량이 바뀌고 결제 금액도 바뀐다. 이걸 안 보여주고 동의를
 * 받으면 보호자는 **얼마를 내게 되는지 모른 채 승인**하게 된다(2026-07-17 이전
 * 상태). 그래서 히어로 바로 아래 — 승인 버튼에 닿기 전 반드시 지나는 자리에 둔다.
 *
 * 금액이 그대로면 "그대로예요" 로 안심시킨다(침묵하면 오히려 의심스럽다).
 *
 * 2026-10-09 앱 새 디자인: 이 화면의 도장 그림자 한 곳(머스타드 카드 · 큰 숫자 Anton 48). 바뀌는 금액은
 * 시안에 없어 같은 카드 안에 옛 금액(취소선) → 새 금액(큰 숫자) + 차이 칩으로 그린다. 문구는 그대로.
 */
function PriceChange({ pricing }: { pricing: ApprovePricing }) {
  const { currentTotal, newTotal } = pricing
  const delta = newTotal - currentTotal
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same'
  const won = (n: number) => n.toLocaleString('ko-KR')

  return (
    <section className={'ap-price ap-price-' + dir} aria-live="polite" aria-label="2주마다 내시는 금액">
      <span className="ap-price-lbl">2주마다 내시는 금액</span>

      {dir === 'same' ? (
        // 금액이 그대로면 결제 얘기를 더 꺼내지 않는다 — 바뀌는 게 없는데
        // "다음 배송분부터 결제" 를 덧붙이면 없는 불안을 만든다.
        <>
          <span className="ap-price-amount">
            <span className="ft-num ap-price-num">{won(currentTotal)}</span>
            <span className="ft-poster ap-price-won">원</span>
          </span>
          <span className="ap-price-note">
            비율만 바뀌고 <strong>금액은 그대로예요.</strong>
          </span>
        </>
      ) : (
        <>
          <span className="ap-price-old">{won(currentTotal)}원</span>
          <span className="ap-price-amount">
            <span className="ft-num ap-price-num">{won(newTotal)}</span>
            <span className="ft-poster ap-price-won">원</span>
            <span className="ap-price-delta">
              {delta > 0 ? <UpIcon color="#FFFFFF" /> : <DownIcon color="#FFFFFF" />}
              {delta > 0 ? '+' : '−'}
              {won(Math.abs(delta))}원
            </span>
          </span>
          <span className="ap-price-note">
            {delta > 0
              ? '필요한 양이 늘어서 박스가 커졌어요. 유지를 고르시면 금액도 그대로예요.'
              : '필요한 양이 줄어서 박스가 작아졌어요.'}
          </span>
          {/* ⚠️ 문구는 실제 동작만 약속한다. 청구는 배송일에 일어나므로
              "이미 확정된 회차는 옛 금액" 을 보장할 수 없다 → 그렇게 쓰지 않는다.
              지킬 수 없는 약속은 금액에선 특히 위험하다. */}
          <span className="ap-price-when">
            적용하면 <strong>다음 결제부터</strong> 이 금액이에요. 일시정지·해지는 다음
            결제 전까지 바꿀 수 있어요.
          </span>
        </>
      )}
    </section>
  )
}

type LineChange = {
  label: string
  delta: number
  /** 이전·새 값(%포인트) — '늘어요/줄어요/빠져요/들어가요' 를 고르는 데만 쓴다. */
  prev: number
  cur: number
  /** 레시피 줄이면 그 라인(색 네모) — 토퍼는 없다. */
  line?: FoodLine
}

/** 바뀌는 정도를 말로 — 시안 S22 "닭고기 늘어요 · 흑돼지 빠져요". 비율 % 숫자는 그리지 않는다. */
function changeWord(c: LineChange): string {
  if (c.delta > 0) return c.prev === 0 ? '들어가요' : '늘어요'
  return c.cur === 0 ? '빠져요' : '줄어요'
}

/**
 * 라인 + 토퍼별 변화량 (%포인트).
 */
function computeLineChanges(
  previous: Formula,
  next: Formula,
): LineChange[] {
  const out: LineChange[] = []
  // 비교도 **박스 기준**으로 한다 — 고객이 체감하는 변화는 원시 임상 비율이
  // 아니라 실제로 담기는 2종이다. 원시로 비교하면 "오리 10%→0%" 처럼 박스에
  // 담기지도 않던 라인의 변화가 뜬다.
  const prevBox = snapBoxRatios(previous.lineRatios)
  const nextBox = snapBoxRatios(next.lineRatios)
  for (const line of ALL_LINES) {
    const prev = Math.round(prevBox[line] * 100)
    const cur = Math.round(nextBox[line] * 100)
    if (prev === cur) continue
    // 이름은 앱 화면 레시피 이름('닭고기' — lib/design/pouch POUCH_NAME). 엔진 표시명(FOOD_LINE_META)은 파우치 없는 줄만.
    out.push({ label: boxLineName(line), delta: cur - prev, prev, cur, line })
  }
  const toppers: Array<{ key: 'vegetable' | 'protein'; label: string }> = [
    { key: 'vegetable', label: '야채 토퍼' },
    { key: 'protein', label: '육류 토퍼' },
  ]
  for (const { key, label } of toppers) {
    const prev = Math.round(previous.toppers[key] * 100)
    const cur = Math.round(next.toppers[key] * 100)
    if (prev === cur) continue
    out.push({ label, delta: cur - prev, prev, cur })
  }
  out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return out
}

function CompareBars({
  previous,
  next,
}: {
  previous: Formula
  next: Formula
}) {
  return (
    <div className="ap-compare">
      <BarRow label="이전" formula={previous} prev />
      <BarRow label="새 제안" formula={next} />
    </div>
  )
}

function BarRow({
  label,
  formula,
  prev,
}: {
  label: string
  formula: Formula
  prev?: boolean
}) {
  const totalKcal = formula.dailyKcal
  // ★박스로 스냅해서 그린다(2026-08-03, 사장님: "왜 또 네개 조합이야").
  //   여기는 고객이 "이 구성으로 할게요" 를 누르는 **승인 화면**이다. 원시
  //   임상 비율(최대 5종)을 그대로 그리면 동의한 그림과 받는 박스(최대 2종)가
  //   달라진다 — 동의를 받는 화면에서 그러면 안 된다.
  //   원시 비율은 근거일 뿐 배송·표시용이 아니다(boxComposition.ts 첫 문단).
  //   2026-10-09: 범례도 막대와 같은 스냅 값으로(예전 범례는 원시 비율 % 를 그려 막대와 종류 수가 달랐다).
  const lines = orderedBoxLines(formula.lineRatios)
  return (
    <div className={'ap-bar-row ' + (prev ? 'ap-prev' : 'ap-next')}>
      <div className="ap-bar-head">
        <span className="ap-bar-label">{label}</span>
        <span className="ap-bar-meta">
          <span className="ft-num ap-bar-kcal">{totalKcal}</span>
          <span className="ap-bar-unit"> kcal</span>
        </span>
      </div>
      <div className="ap-bar" aria-hidden>
        {lines.map((l) => (
          <span
            key={l.line}
            style={{
              width: `${Math.round(l.ratio * 100)}%`,
              background: boxLineColor(l.line),
            }}
          />
        ))}
      </div>
      <div className="ap-legend">
        {lines.map((l) => (
          <span key={l.line} className="ap-legend-item">
            <span className="ap-legend-mark" style={{ background: boxLineColor(l.line) }} />
            {boxLineName(l.line)}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── 선 그림 — 시안 원본 HTML 의 SVG(24 격자) 그대로. 장식(aria-hidden). ── */

function UpIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  )
}

function DownIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#595959" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, marginTop: 3 }}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5M12 16v.3" />
    </svg>
  )
}
