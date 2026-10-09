import Link from 'next/link'
import { trialPricing, type TrialState } from '@/lib/payments/trial'
import type { ActiveSubscription } from './types'
import { freshTierLabel } from '@/lib/subscription/freshTier'
import {
  subscriptionState,
  SUB_STATE_LABEL,
  type SubState,
} from '@/lib/subscription-state'
import {
  describeUpcomingBox,
  shipTimingLabel,
  weekdayKo,
  type ChargeTiming,
} from '@/lib/shipping-schedule'
import { boxCardColors, boxCardFrame, boxRecipes } from '@/lib/design/pouch'
import { V3, V3Radius } from '@/lib/design/tokens'
import { ArrowRightIcon } from '@/components/v3/dog/DogIcons'

/**
 * 페이지(dogs/[id]/page.tsx)가 구독 행에 덧붙여 내려주는 '지금 말할 박스' 재료(2026-10-01 일정 변경).
 * DogDetailClient 를 거쳐 행 그대로 온다. 없으면(다른 호출처) 결제 시점 모름·결제된 박스 없음으로 본다.
 *  · charge_timing — 일반 = 발송 3일 전 토요일(조리 직전), 서포터즈 체험 구간 = 발송일. null = 조회 실패.
 *  · has_paid_preparing_order — 결제됐고 아직 안 나간 박스(결제됨 + 발송 대기 주문)가 있다.
 *  · paid_preparing_at — 그 박스의 결제 시각. 이번 박스 발송일 정본(paidBoxShipIso)의 재료 — 결제 뒤 미루기에도 맞다.
 */
export type UpcomingBoxHints = {
  charge_timing?: ChargeTiming | null
  has_paid_preparing_order?: boolean
  paid_preparing_at?: string | null
}

/** yyyy-mm-dd → '10월 13일(화)'. KST 날짜 문자열에서 직접 뽑는다(Date 로 파싱해 서버 tz 로 포맷하면 하루 밀린다). */
function dateLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일(${weekdayKo(iso)})`
}

/** "닭고기 화식 (120g 한 끼)" → "닭고기". 레시피 이름만 '·' 로 잇는다(시안 "닭고기·흑돼지 · 곁들임"). */
function shortRecipe(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*화식$/, '').trim()
}

/**
 * 진행중 정기배송 카드 — 강아지 단위.
 *
 * 케이스
 *  · 활성/일시정지 구독 1개 이상 → 상태 + 다음 배송일 + 결제 + 현재 레시피
 *  · 구독 없고 처방 있음 → "정기배송 시작" CTA
 *  · 구독 없고 처방 없음 → 카드 자체 숨김 (분석 카드가 이미 onboarding 안내)
 *
 * # 상태 표기 (2026-07-16 수정)
 * status 컬럼만 보면 거짓말한다 — 카드 미등록(billing_key NULL)인 '시작 전'을
 * paused 로 오표시했다. lib/subscription-state.subscriptionState() 로 판정한다.
 *
 * # 현재 레시피 (2026-07-16)
 * dog_formulas(추천 알고리즘)가 아니라 subscription_items(실제 배송 박스)를 보여준다.
 * 예전엔 CurrentFormulaCard 가 옛 추천 비율을 '현재 박스'라 잘못 표기했다.
 *
 * # 2026-10-09 앱 새 디자인('A 포스터', 시안 AppDog '정기배송')
 * 이 화면의 핵심 카드(도장 그림자 한 곳). 색은 박스에 든 레시피 파우치 색 — 홈 박스 카드와 같은 규칙
 * (lib/design/pouch: 한 가지 = 그 색 바탕 + 먹색 2px·4px, 두 가지 = 첫째 바탕 + 둘째 3px·5px, 모르면 머스타드).
 * 머리줄(정기배송 · 전체 관리 ›) → 상태 칸(먹색) + 레시피 · 화식 비율 → 큰 금액(숫자 글꼴) + "/ 2주"
 * → 나눔선 아래 발송일·받은 횟수.
 */
// 라벨은 lib/subscription-state 정본. 여기선 칸 색만 고른다 — 정상 = 먹색, 결제 문제 = 빨강, 쉬는 중 = 회색.
const STATE_CHIP: Record<SubState, string> = {
  needs_card: V3.ink,
  active: V3.ink,
  paused: V3.inkMute,
  card_failed: V3.sale,
  cancelled: V3.inkMute,
}
export default function SubscriptionCard({
  subscriptions,
  dogName,
  dogId,
  hasFormula,
  trial = null,
  chargePreview,
}: {
  subscriptions: ActiveSubscription[]
  dogName: string
  dogId: string
  hasFormula: boolean
  /** 체험단 가격표 — 있으면 금액이 체험가로 표시된다(청구와 같은 판정) */
  trial?: TrialState | null
  /** 구독별 다음 결제액(청구와 같은 resolveAutoDiscount) — 있으면 이것이 우선 */
  chargePreview?: Record<string, number>
}) {
  if (subscriptions.length === 0 && !hasFormula) return null

  // D-day 는 KST 자정 기준. 서버(UTC) 자정으로 세면 홈 ActiveDogCard(KST 기준)와
  // 같은 배송인데 하루 어긋난다(2026-07-17 정합). next_delivery_date 는 KST 달력 날짜.
  // eslint-disable-next-line react-hooks/purity
  const nowKstMs = Date.now() + 9 * 3600 * 1000
  const todayKstIso = new Date(nowKstMs).toISOString().slice(0, 10)
  const todayKstStart = new Date(todayKstIso + 'T00:00:00+09:00').getTime()
  /** KST 날짜까지 남은 날(오늘 = 0). */
  const daysUntil = (iso: string) =>
    Math.round((new Date(`${iso}T00:00:00+09:00`).getTime() - todayKstStart) / 86_400_000)

  // 카드 색 — 첫 구독의 박스 레시피(대부분 강아지당 하나). 없으면 머스타드 + 먹색 도장 그림자.
  const firstItems = (subscriptions[0]?.subscription_items ?? []).map((i) => ({
    name: i.product_name,
    quantity: i.quantity,
  }))
  const colors = boxCardColors(boxRecipes(firstItems).lines)
  const frame = boxCardFrame(colors)

  const card = {
    margin: '26px 20px 0',
    padding: 16,
    borderRadius: V3Radius.sm,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    ...frame,
  }

  if (subscriptions.length === 0) {
    return (
      <section aria-label="정기배송" style={card}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>정기배송</span>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}>
          {/* '매월' 은 옛 4주 모델 문구 — 지금은 2주마다다(2026-07-16). */}
          {dogName} 맞춤 박스를 2주마다 받아보세요. 분석 결과 그대로 g 단위까지 계산해 보내드려요.
        </p>
        {/* 레시피 고르는 단계(/plan)부터 — /order 직행은 레시피 선택을
            건너뛰어 주문 화면이 알고리즘 원본을 보여준다(2026-07-15). */}
        <Link
          href={`/dogs/${dogId}/plan`}
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
            gap: 8,
            textDecoration: 'none',
          }}
        >
          정기배송 시작
          <ArrowRightIcon size={18} />
        </Link>
      </section>
    )
  }

  return (
    <section aria-label="정기배송" style={card}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>정기배송</span>
        <Link href="/mypage/subscriptions" style={{ fontSize: 14, fontWeight: 800, color: 'inherit', textDecoration: 'none' }}>
          전체 관리 ›
        </Link>
      </span>
      {subscriptions.map((s, idx) => {
        /**
         * ★지금 말할 박스 — lib/shipping-schedule describeUpcomingBox 정본(2026-10-01).
         * 일반 고객은 발송 3일 전 토요일에 결제되고, 청구 크론이 곧바로 next_delivery_date 를 다음
         * 주기(+14)로 민다. 그대로 세면 사흘 뒤 나갈 박스를 두고 "17일 후"라고 말한다.
         *  · in_progress — 결제된 박스가 그 화요일에 나간다(D-N 은 그 발송일 기준).
         *  · charge_check — 결제일이 지났는데 결제 증거가 없다 → 날짜를 약속하지 않는다.
         *  · upcoming — 예전 그대로(next_delivery_date = 발송일 기준 D-N).
         */
        const hints = s as ActiveSubscription & UpcomingBoxHints
        const box = describeUpcomingBox({
          nextDeliveryDate: s.next_delivery_date,
          timing: hints.charge_timing ?? null,
          hasPaidPreparingOrder: hints.has_paid_preparing_order === true,
          paidAt: hints.paid_preparing_at ?? null,
          today: todayKstIso,
        })
        const dDay = box ? daysUntil(box.shipIso) : null
        // 날짜 라벨 — 요일까지. 발송은 화요일 고정이라 요일이 곧 "언제 오는지"의
        // 핵심 정보다. 구독 탭·마이페이지는 이미 요일을 보여주는데 여기만
        // 빠져 있었다(2026-08-07 감사).
        const nextLabel = box ? dateLabel(box.shipIso) : ''
        const state = subscriptionState(s)
        const needsCard = state === 'needs_card' || state === 'card_failed'
        // 카드 등록 링크 — billing-auth 는 customerKey 가 필수라, 안 실으면
        // '잘못된 접근이에요' 막다른 길이 된다(2026-07-17 수정). 구독 생성 시
        // billing_customer_key 가 저장되므로 그대로 싣고, 없는 레거시면 구독탭
        // (client goCard 가 fallback 키 생성)으로 우회.
        const cardHref = s.billing_customer_key
          ? `/subscribe/billing-auth?subscriptionId=${encodeURIComponent(s.id)}&customerKey=${encodeURIComponent(s.billing_customer_key)}`
          : `/dogs/${dogId}/subscription`
        // 실제 배송 레시피(정본). 없으면(레거시) 화식 티어 라벨만.
        const recipe = (s.subscription_items ?? [])
          .map((i) => shortRecipe(i.product_name))
          .filter(Boolean)
          .join('·')
        const amount =
          chargePreview?.[s.id] ?? trialPricing(trial, s.total_amount)?.chargeAmount ?? s.total_amount
        // 발송 줄 — 날짜는 굵게(시안 "10월 13일(화) 발송 · 6일 후").
        const day = <strong style={{ fontWeight: 800 }}>{nextLabel}</strong>
        const shipLine =
          state === 'needs_card' ? (
            '결제수단을 등록하면 첫 배송일이 잡혀요'
          ) : box?.kind === 'in_progress' && dDay !== null ? (
            // 결제된 박스는 정지 중이어도 나간다 — 상태와 무관하게 그 발송일을 말한다.
            dDay > 0 ? (
              <>
                결제 완료 · {day} 발송 ({shipTimingLabel(dDay).dLabel})
              </>
            ) : dDay === 0 ? (
              `결제 완료 · ${shipTimingLabel(0).dLabel}`
            ) : (
              '결제 완료 · 발송 준비 중'
            )
          ) : state === 'paused' ? (
            '재개 시 재계산'
          ) : box?.kind === 'charge_check' ? (
            '결제를 확인하고 있어요'
          ) : box && dDay !== null ? (
            // ★예정일이 지난 경우를 '오늘' 로 뭉뚱그리지 않는다(2026-08-07). 결제가 미끄러지면 이 날짜가
            //  과거로 흘러가는데 매일 "오늘 발송 예정" 이라고 말했다.
            dDay < 0 ? (
              '확인 중'
            ) : dDay === 0 ? (
              '오늘 발송 예정'
            ) : (
              <>
                {day} 발송 · {dDay}일 후
              </>
            )
          ) : (
            '-'
          )
        return (
          <div
            key={s.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              ...(idx > 0 ? { paddingTop: 12, borderTop: `1px solid ${colors.divider}` } : null),
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span
                style={{
                  height: 26,
                  padding: '0 8px',
                  borderRadius: V3Radius.sm,
                  background: STATE_CHIP[state],
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                {SUB_STATE_LABEL[state]}
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, minWidth: 0 }}>
                {recipe ? `${recipe} · ${freshTierLabel(s.fresh_ratio)}` : freshTierLabel(s.fresh_ratio)}
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 2, whiteSpace: 'nowrap' }}>
              <span className="ft-num" style={{ fontSize: 34, lineHeight: 1.1 }}>
                {amount.toLocaleString()}
              </span>
              <span className="ft-poster" style={{ fontSize: 18 }}>
                원
              </span>
              <span style={{ marginLeft: 4, fontSize: 15 }}>/ 2주</span>
            </span>
            <span
              style={{
                paddingTop: 10,
                borderTop: `1px solid ${colors.divider}`,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                fontSize: 15,
              }}
            >
              <span style={{ minWidth: 0 }}>{shipLine}</span>
              <span style={{ flexShrink: 0 }}>{s.total_deliveries}회 받음</span>
            </span>
            {needsCard && (
              <Link
                href={cardHref}
                style={{
                  height: 48,
                  borderRadius: V3Radius.sm,
                  background: V3.ink,
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  textDecoration: 'none',
                }}
              >
                {state === 'card_failed' ? '결제수단 다시 등록하기' : '결제수단 등록하고 시작하기'}
                <ArrowRightIcon size={16} />
              </Link>
            )}
            {state === 'paused' && (
              <span style={{ fontSize: 14, lineHeight: 1.5 }}>정기배송 화면에서 다시 시작할 수 있어요</span>
            )}
          </div>
        )
      })}
    </section>
  )
}
