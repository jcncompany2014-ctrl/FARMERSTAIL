import Link from 'next/link'
import { Heart, Bell, Check } from 'lucide-react'
import { type CurrentFormula, type CheckinStatus } from './types'
import {
  checkinDueDayOffset,
  isCheckinLinkVisible,
} from '@/lib/personalization/cycle'
import { recipeName } from '@/lib/personalization/format'
import type { Formula } from '@/lib/personalization/types'

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

  // 체크인 D-Day = 처방 적용일 + (배송 회차−1)×배송간격. 회차/간격은 정본
  // (lib/personalization/cycle)에서 파생 — 재제안 주기를 바꾸면 여기도 자동으로
  // 따라 움직인다(예전엔 +14/+28 을 손으로 박아둬 크론과 갈라질 위험이 있었다).
  const dueInFor = (checkpoint: 'week_2' | 'week_4'): number | null => {
    if (!appliedFrom || checkinStatus[checkpoint]) return null
    const dueMs =
      appliedFrom.getTime() +
      checkinDueDayOffset(checkpoint) * 24 * 60 * 60 * 1000
    return Math.ceil((dueMs - today.getTime()) / (1000 * 60 * 60 * 24))
  }
  const week2DueIn = dueInFor('week_2')
  const week4DueIn = dueInFor('week_4')

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
                : `맞춤 식단 · ${formula.cycle_number}번째 박스`}
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

        {/* 추천 식단임을 명시 — 실제 받는 박스와 헷갈리지 않게. */}
        <p className="text-[10px] text-muted mb-2 leading-snug">
          {isPending
            ? '새로 추천된 맞춤 식단이에요'
            : '분석 기반 추천 식단 · 실제 받는 박스는 아래 정기배송 카드에서 확인하세요'}
        </p>

        {/* 원물 레시피명(박스=2종 반반, %·라인명 없이 — 알림/이메일과 톤 통일).
            사장님 2026-07-23 Option A. */}
        <p className="text-[14px] font-bold text-ink mt-1 mb-3 leading-snug">
          {recipeName(formula.formula as unknown as Formula)}
        </p>

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
                  {formula.cycle_number}번째 박스 진행
                </span>
                <span className="font-bold text-text">
                  {daysIntoCycle}일째 · 다음 박스 D-{daysToEnd}
                </span>
              </div>
            )}
            {week2DueIn !== null && isCheckinLinkVisible(week2DueIn) && (
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
            {week4DueIn !== null && isCheckinLinkVisible(week4DueIn) && (
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
                이번 박스 체크인 모두 완료
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

