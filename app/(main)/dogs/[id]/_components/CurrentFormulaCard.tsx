import Link from 'next/link'
import { Heart, Bell, Check } from 'lucide-react'
import {
  type CurrentFormula,
  type CheckinStatus,
  FOOD_LINE_COLORS,
  FOOD_LINE_NAMES,
} from './types'

/**
 * 맞춤 영양 처방 카드 — 분석 기반 **추천** 비율 + cycle 체크인.
 *
 * ⚠️ 이건 '현재 박스'(실제 배송되는 박스)가 **아니다**. 실제 배송 레시피는
 * SubscriptionCard 가 subscription_items 로 보여준다(2026-07-16 분리). 여기 비율은
 * dog_formulas 의 알고리즘 추천이라, 재고·SKU 스냅으로 실제 박스와 다를 수 있다.
 * 그래서 예전 "현재 박스" 표기를 "맞춤 영양 처방(추천)"으로 고쳤다. 이 카드의 진짜
 * 역할은 ① 새 비율 승인(pending) ② cycle 체크인 D-Day 안내다.
 */
export default function CurrentFormulaCard({
  formula,
  checkinStatus,
  dogId,
}: {
  formula: CurrentFormula
  checkinStatus: CheckinStatus
  dogId: string
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 적용 일자 D-day 계산
  const appliedFrom = formula.applied_from
    ? new Date(formula.applied_from)
    : null
  const appliedUntil = formula.applied_until
    ? new Date(formula.applied_until)
    : null
  const daysIntoCycle = appliedFrom
    ? Math.floor(
        (today.getTime() - appliedFrom.getTime()) / (1000 * 60 * 60 * 24),
      )
    : null
  const daysToEnd = appliedUntil
    ? Math.ceil(
        (appliedUntil.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      )
    : null

  // week_2 D-Day = applied_from + 14, week_4 = + 28
  const week2DueIn =
    appliedFrom && !checkinStatus.week_2
      ? Math.ceil(
          (new Date(appliedFrom.getTime() + 14 * 24 * 60 * 60 * 1000).getTime() -
            today.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null
  const week4DueIn =
    appliedFrom && !checkinStatus.week_4
      ? Math.ceil(
          (new Date(appliedFrom.getTime() + 28 * 24 * 60 * 60 * 1000).getTime() -
            today.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null

  const isPending = formula.approval_status === 'pending_approval'

  return (
    <section className="px-5 mt-3">
      <div
        className={`rounded p-5 ${
          isPending
            ? 'bg-terracotta/5 border-2 border-terracotta/30'
            : 'bg-bg-3 border border-rule'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Heart
              className={`w-3.5 h-3.5 ${isPending ? 'text-terracotta' : 'text-moss'}`}
              strokeWidth={2}
            />
            <span className="kicker">
              {isPending
                ? '동의 필요 · 새 박스'
                : `맞춤 영양 처방 · cycle ${formula.cycle_number}`}
            </span>
            {formula.user_adjusted && (
              <span className="text-[9px] font-bold text-terracotta px-1.5 py-0.5 rounded-full bg-terracotta/10">
                직접 조정
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dogs/${dogId}/formulas`}
              className="text-[10.5px] text-muted hover:text-text"
            >
              히스토리
            </Link>
            <Link
              href={`/dogs/${dogId}/analysis`}
              className="text-[10.5px] font-bold text-terracotta"
            >
              상세 →
            </Link>
          </div>
        </div>

        {/* 추천 비율임을 명시 — 실제 받는 박스와 헷갈리지 않게. */}
        <p className="text-[10px] text-muted mb-2 leading-snug">
          {isPending
            ? '새로 추천된 영양 비율이에요'
            : '분석 기반 추천 비율 · 실제 받는 박스는 아래 정기배송 카드에서 확인하세요'}
        </p>

        {/* mini stacked bar */}
        <MiniRatioBar lineRatios={formula.formula.lineRatios} />

        {/* 라인 legend (top 3) */}
        <div className="flex flex-wrap gap-2 mt-3 mb-3">
          {Object.entries(formula.formula.lineRatios)
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([line, v]) => (
              <span
                key={line}
                className="inline-flex items-center gap-1.5 text-[10.5px]"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: FOOD_LINE_COLORS[line] }}
                />
                <span className="text-muted">{FOOD_LINE_NAMES[line]}</span>
                <span className="font-bold text-text">
                  {Math.round(v * 100)}%
                </span>
              </span>
            ))}
        </div>

        {/* 다음 액션 — pending 우선, 그 다음 checkin D-Day */}
        {isPending ? (
          <Link
            href={`/dogs/${dogId}/approve?cycle=${formula.cycle_number}`}
            className="block w-full py-3 px-4 rounded bg-terracotta text-white text-[12px] font-bold text-center transition-transform active:scale-[0.98]"
          >
            새 비율 확인하기 →
          </Link>
        ) : (
          <div className="space-y-1.5">
            {daysIntoCycle !== null && daysToEnd !== null && (
              <div className="flex items-center justify-between text-[10.5px] py-1.5 px-3 rounded-lg bg-bg">
                <span className="text-muted">
                  cycle {formula.cycle_number} 진행
                </span>
                <span className="font-bold text-text">
                  {daysIntoCycle}일째 · 다음 박스 D-{daysToEnd}
                </span>
              </div>
            )}
            {week2DueIn !== null && week2DueIn >= -3 && week2DueIn <= 7 && (
              <Link
                href={`/dogs/${dogId}/checkin?cycle=${formula.cycle_number}&checkpoint=week_2`}
                className="flex items-center justify-between text-[12px] py-2 px-3 rounded-lg bg-moss/8 hover:bg-moss/14 transition-colors"
              >
                <span className="font-bold text-moss inline-flex items-center gap-1.5">
                  <Bell className="w-3 h-3" strokeWidth={2.5} />
                  2주차 체크인
                </span>
                <span className="text-[10.5px] text-moss font-bold">
                  {week2DueIn === 0
                    ? '오늘'
                    : week2DueIn < 0
                      ? `${-week2DueIn}일 지남`
                      : `D-${week2DueIn}`}{' '}
                  →
                </span>
              </Link>
            )}
            {week4DueIn !== null && week4DueIn >= -3 && week4DueIn <= 7 && (
              <Link
                href={`/dogs/${dogId}/checkin?cycle=${formula.cycle_number}&checkpoint=week_4`}
                className="flex items-center justify-between text-[12px] py-2 px-3 rounded-lg bg-terracotta/8 hover:bg-terracotta/14 transition-colors"
              >
                <span className="font-bold text-terracotta inline-flex items-center gap-1.5">
                  <Bell className="w-3 h-3" strokeWidth={2.5} />
                  4주차 종합 체크인
                </span>
                <span className="text-[10.5px] text-terracotta font-bold">
                  {week4DueIn === 0
                    ? '오늘'
                    : week4DueIn < 0
                      ? `${-week4DueIn}일 지남`
                      : `D-${week4DueIn}`}{' '}
                  →
                </span>
              </Link>
            )}
            {checkinStatus.week_2 && checkinStatus.week_4 && (
              <div className="flex items-center justify-center text-[10.5px] py-1.5 text-muted">
                <Check className="w-3 h-3 text-moss mr-1" strokeWidth={2.5} />
                이번 cycle 체크인 모두 완료
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function MiniRatioBar({
  lineRatios,
}: {
  lineRatios: Record<string, number>
}) {
  return (
    <div className="flex h-2.5 rounded-full overflow-hidden bg-rule">
      {Object.entries(lineRatios)
        .filter(([, v]) => v > 0)
        .map(([line, v]) => (
          <span
            key={line}
            style={{
              width: `${Math.round(v * 100)}%`,
              background: FOOD_LINE_COLORS[line] ?? 'var(--muted)',
            }}
            title={`${FOOD_LINE_NAMES[line]} ${Math.round(v * 100)}%`}
          />
        ))}
    </div>
  )
}
