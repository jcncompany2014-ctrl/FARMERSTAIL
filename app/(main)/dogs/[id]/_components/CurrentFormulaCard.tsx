import Link from 'next/link'
import { type CurrentFormula, type CheckinStatus } from './types'
import {
  checkinDueDayOffset,
  isCheckinLinkVisible,
} from '@/lib/personalization/cycle'
import { ALL_LINES } from '@/lib/personalization/lines'
import { recipeColorOfLine, recipeNameOfLine } from '@/components/analysis/display'
import { todayKstIsoDate, diffDaysKst, addDaysKst } from '@/lib/datetime-kst'
import type { Formula } from '@/lib/personalization/types'
import { V3, V3Radius } from '@/lib/design/tokens'
import { CheckIcon } from '@/components/v3/dog/DogIcons'

/**
 * 맞춤 영양 처방 카드 — 분석 기반 **추천** 비율 + cycle 체크인.
 *
 * ⚠️ 이건 '현재 박스'(실제 배송되는 박스)가 **아니다**. 실제 배송 레시피는
 * SubscriptionCard 가 subscription_items 로 보여준다(2026-07-16 분리). 여기 비율은
 * dog_formulas 의 알고리즘 추천이라, 재고·SKU 스냅으로 실제 박스와 다를 수 있다.
 * 그래서 예전 "현재 박스" 표기를 "맞춤 영양 처방(추천)"으로 고쳤다. 이 카드의 진짜
 * 역할은 ① 새 비율 승인(pending) ② cycle 체크인 D-Day 안내다.
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 AppDog '맞춤 식단'): 위 2px 먹선 + 머리줄(회색 머리말 · 오른쪽
 * 밑줄 링크 '히스토리'·'상세 →') → 레시피 색 네모 + 레시피 이름(제목 글꼴 24) → "9월 30일 시작 · 8일째"
 * → 체크인 줄(회색 면 + 왼쪽 6px 머스타드 띠, D-N 은 숫자 글꼴) → 안내 한 줄(13px 회색).
 * 레시피 색은 분석 화면과 같은 정본(components/analysis/display RECIPE_COLOR — 시안 닭 #D4A24C · 흑돼지 #2E3338).
 */

/** 체크인 D-Day 글자 — 오늘 / N일 지남 / D-N. */
function dueText(dueIn: number): string {
  return dueIn === 0 ? '오늘' : dueIn < 0 ? `${-dueIn}일 지남` : `D-${dueIn}`
}

/** 체크인 한 줄 — 회색 면 + 왼쪽 머스타드 띠(시안). */
function CheckinRow({ href, label, dueIn }: { href: string; label: string; dueIn: number }) {
  const text = dueText(dueIn)
  return (
    <Link
      href={href}
      style={{
        height: 52,
        boxSizing: 'border-box',
        padding: '0 14px',
        borderRadius: V3Radius.sm,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 16,
        fontWeight: 800,
        color: V3.ink,
        textDecoration: 'none',
        background: V3.soft,
        borderLeft: `6px solid ${V3.mustard}`,
      }}
    >
      <span>
        {label}{' '}
        {text.startsWith('D-') ? (
          <span className="ft-num">{text}</span>
        ) : (
          <span>{text}</span>
        )}
      </span>
      <span aria-hidden>→</span>
    </Link>
  )
}

export default function CurrentFormulaCard({
  formula,
  checkinStatus,
  dogId,
}: {
  formula: CurrentFormula
  checkinStatus: CheckinStatus
  dogId: string
}) {
  // ★날짜는 전부 KST 문자열로 센다 (2026-09-26 출시 전 점검 6차). 예전엔 기기 로컬 자정과
  //   'YYYY-MM-DD'(UTC 자정)를 섞어 KST 기기에서 첫날 '-1일째'·체크인 D-1 어긋남이 났고,
  //   서버(UTC)와 브라우저가 다른 값을 그렸다.
  const today = todayKstIsoDate()
  const appliedFrom = formula.applied_from ? formula.applied_from.slice(0, 10) : null
  // 0 = 시작일. 음수 = 아직 시작 전(새 식단은 다음 박스부터 — cycle.ts newFormulaAppliedFrom).
  const daysIntoCycle = appliedFrom ? diffDaysKst(today, appliedFrom) : null
  const startLabel = appliedFrom
    ? `${Number(appliedFrom.slice(5, 7))}월 ${Number(appliedFrom.slice(8, 10))}일`
    : null

  // 체크인 D-Day = 처방 적용일 + (배송 회차−1)×배송간격. 회차/간격은 정본
  // (lib/personalization/cycle)에서 파생 — 재제안 주기를 바꾸면 여기도 자동으로
  // 따라 움직인다(예전엔 +14/+28 을 손으로 박아둬 크론과 갈라질 위험이 있었다).
  const dueInFor = (checkpoint: 'week_2' | 'week_4'): number | null => {
    if (!appliedFrom || checkinStatus[checkpoint]) return null
    return diffDaysKst(addDaysKst(appliedFrom, checkinDueDayOffset(checkpoint)), today)
  }
  const week2DueIn = dueInFor('week_2')
  const week4DueIn = dueInFor('week_4')

  const isPending = formula.approval_status === 'pending_approval'

  // 레시피 — 비율 큰 것부터 두 가지(lib/personalization/format recipeName 과 같은 순서·같은 '맞춤' 폴백).
  // 이름은 박스·주문·분석 화면과 같은 말(닭고기·오리·흑돼지·한우 — components/analysis/display 정본).
  // 예전 recipeName 은 엔진 이름('치킨')을 썼다 — 시안·박스 이름은 '닭고기'.
  const ratios = (formula.formula as unknown as Formula).lineRatios ?? {}
  const lines = ALL_LINES.filter((l) => (ratios[l] ?? 0) > 0)
    .sort((a, b) => (ratios[b] ?? 0) - (ratios[a] ?? 0))
    .slice(0, 2)
  const recipeLabel = `${lines.length > 0 ? lines.map(recipeNameOfLine).join('·') : '맞춤'} 레시피`

  return (
    <section
      aria-label="맞춤 식단"
      style={{
        margin: '26px 20px 0',
        borderTop: `2px solid ${V3.ink}`,
        paddingTop: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: isPending ? V3.sale : V3.inkMute }}>
            {isPending
              ? '동의 필요 · 새 박스'
              : // 회차 번호는 박스 번호가 아니다(회차 1개 = 박스 3개) — '번째 식단'.
                `맞춤 식단 · ${formula.cycle_number}번째 식단`}
          </span>
          {formula.user_adjusted && (
            <span
              style={{
                height: 24,
                padding: '0 7px',
                borderRadius: V3Radius.sm,
                background: V3.soft,
                fontSize: 13,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              직접 조정
            </span>
          )}
        </span>
        <span style={{ display: 'flex', gap: 14, fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
          <Link href={`/dogs/${dogId}/formulas`} style={{ color: V3.ink, textDecoration: 'underline' }}>
            히스토리
          </Link>
          <Link href={`/dogs/${dogId}/analysis`} style={{ color: V3.ink, textDecoration: 'underline' }}>
            상세 →
          </Link>
        </span>
      </div>

      {/* 원물 레시피명(박스=2종 반반, %·라인명 없이 — 알림/이메일과 톤 통일).
          사장님 2026-07-23 Option A. */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {lines.length > 0 && (
          <span aria-hidden style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            {lines.map((l) => (
              <span key={l} style={{ width: 14, height: 14, background: recipeColorOfLine(l) }} />
            ))}
          </span>
        )}
        <span className="ft-poster" style={{ fontSize: 24, wordBreak: 'keep-all' }}>
          {recipeLabel}
        </span>
      </span>

      {/* 다음 액션 — pending 우선, 그 다음 checkin D-Day */}
      {isPending ? (
        <>
          <span style={{ fontSize: 15, color: V3.inkSoft }}>새로 추천된 맞춤 식단이에요</span>
          <Link
            href={`/dogs/${dogId}/approve?cycle=${formula.cycle_number}`}
            style={{
              height: 52,
              borderRadius: V3Radius.sm,
              background: V3.ink,
              color: '#FFFFFF',
              fontSize: 16,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
            }}
          >
            새 비율 확인하기 →
          </Link>
        </>
      ) : (
        <>
          {/* 예전 '다음 박스 D-N'은 식단 적용 **종료일**(42일 뒤)까지를 셌다 — 실제 다음
              박스는 정기배송 카드가 보여준다. 여기선 이 식단이 언제 시작하는지만. */}
          {daysIntoCycle !== null && startLabel !== null && (
            <span style={{ fontSize: 15, color: V3.inkSoft }}>
              {daysIntoCycle < 0 ? (
                `${startLabel} 박스부터 시작`
              ) : (
                <>
                  {startLabel} 시작 · <strong style={{ fontWeight: 800, color: V3.ink }}>{daysIntoCycle + 1}일째</strong>
                </>
              )}
            </span>
          )}
          {week2DueIn !== null && isCheckinLinkVisible(week2DueIn) && (
            <CheckinRow
              href={`/dogs/${dogId}/checkin?cycle=${formula.cycle_number}&checkpoint=week_2`}
              label="2주차 체크인"
              dueIn={week2DueIn}
            />
          )}
          {week4DueIn !== null && isCheckinLinkVisible(week4DueIn) && (
            <CheckinRow
              href={`/dogs/${dogId}/checkin?cycle=${formula.cycle_number}&checkpoint=week_4`}
              label="4주차 종합 체크인"
              dueIn={week4DueIn}
            />
          )}
          {checkinStatus.week_2 && checkinStatus.week_4 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 700, color: V3.inkSoft }}>
              <CheckIcon size={16} />
              이번 박스 체크인 모두 완료
            </span>
          )}
          {/* 추천 식단임을 명시 — 실제 받는 박스와 헷갈리지 않게. */}
          <span style={{ fontSize: 13, lineHeight: 1.5, color: V3.inkMute }}>
            분석으로 고른 식단이에요. 실제로 받는 박스는 아래 정기배송에서 확인하세요.
          </span>
        </>
      )}
    </section>
  )
}
