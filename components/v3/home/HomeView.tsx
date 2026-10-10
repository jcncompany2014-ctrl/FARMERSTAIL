/**
 * HomeView — 앱 홈 화면의 배치(그리기만). 데이터 판정은 홈(app/(main)/dashboard/page.tsx)이 하고
 * 이 컴포넌트는 정해진 값을 시안 순서대로 놓는다 (앱 새 디자인 'A 포스터', 2026-10-09).
 *
 * 왜 따로 뺐나: 홈은 로그인해야 열린다. 배치를 한 곳에 두면 점검 화면(/design-check, 미리보기 전용)이
 * 같은 컴포넌트에 예시 값을 넣어 모든 상태(한 마리·두 마리·박스 사이·카드 등록 전·결제 멈춤·일시정지·
 * 강아지 없음·불러오기 실패)를 로그인 없이 시안과 나란히 볼 수 있다 — 점검 화면만 따로 그리면 실제와 갈라진다.
 *
 * 배치(캔버스 AppHome·AppHomeMultiTabs·T01~T06):
 *   인사 → (손을 써야 하면) 알림 한 줄 → 박스 카드(결제된 박스 1개 / 여러 마리 묶음) 또는 다음 정기배송 카드
 *   → (여러 마리면) "우리 아이" 고르기 탭 → 강아지 카드 → (7일 이상 연속이면) 연속 기록 → 이번 주
 *   강아지가 없으면 인사 아래 첫 아이 등록 카드(조회 실패면 다시 불러오기).
 * 도장 그림자는 한 화면에 한 곳: 위에 박스/다음 정기배송 카드가 있으면 그 카드, 없으면 강아지 카드.
 */

import GreetingSection, { type TimeOfDay } from './GreetingSection'
import HomeBillingAlert from './HomeBillingAlert'
import BoxProgressCard from './BoxProgressCard'
import MultiBoxCard, { type MultiBoxRow } from './MultiBoxCard'
import DeliveryStripCard from './DeliveryStripCard'
import HomeDogTabs, { type HomeDogTab } from './HomeDogTabs'
import ActiveDogCard, { type DogMetric, type DogStatusTone } from './ActiveDogCard'
import ThisWeekSection, { type QuickAction, type WeekDay } from './ThisWeekSection'
import EmptyHomeNoDogs from './EmptyHomeNoDogs'
import HomeLoadFailed from './HomeLoadFailed'
import StreakRewards from '../StreakRewards'
import type { BoxStage } from '@/lib/commerce/box-progress'
import type { PouchLine } from '@/lib/design/pouch'

export interface HomeBox extends MultiBoxRow {
  stage: BoxStage
  lines: PouchLine[]
  /** 아래 줄 바로가기 — "자세히" / "배송 조회". */
  linkLabel: string
}

export interface HomeViewModel {
  userName: string
  /** 강아지 수 — 0 이면 첫 아이 등록(또는 불러오기 실패). */
  dogCount: number
  /** 내 정보 조회 실패 — 0마리로 그리지 않는다(규칙1). */
  loadFailed: boolean
  billingAlert: { text: string; cta: string; tone: 'danger' | 'notice' } | null
  /** 결제된 박스(아이마다 가장 최근 하나). */
  boxes: HomeBox[]
  /** 박스 사이 — 다음 정기배송. 결제된 박스가 움직이는 중이면 홈이 null 로 넘긴다(같은 이야기). */
  nextDelivery: {
    daysUntil: number | null
    shipDateLabel: string | null
    checkDetail: string | null
    itemLabel: string | null
    lines: PouchLine[]
  } | null
  /** 2마리 이상이면 고르기 탭. */
  dogTabs: HomeDogTab[]
  activeDog: {
    id: string
    name: string
    metaLine: string
    photoUrl: string | null
    statusLabel: string
    statusTone: DogStatusTone
    metrics: DogMetric[]
  } | null
  streak: number
  weekDays: WeekDay[]
  quickActions: QuickAction[]
  /** 점검 화면용 — 인사 고정(날짜·시간대·멘트). 실제 홈은 비워 둔다. */
  greetingFixture?: { dateLabel: string; timeOfDay: TimeOfDay; variant: number }
}

export default function HomeView({ model }: { model: HomeViewModel }) {
  const { activeDog, boxes, nextDelivery } = model
  const multi = model.dogTabs.length > 1
  const hasTopCard = boxes.length > 0 || nextDelivery != null
  return (
    // ft-stagger: 홈 섹션들이 위에서 순서대로 떠오르는 진입 연출 (B9).
    <div className="ft-stagger" style={{ paddingBottom: 28 }}>
      <GreetingSection
        userName={model.userName}
        familyCount={model.dogCount}
        welcome={model.dogCount === 0 && !model.loadFailed}
        forceDateLabel={model.greetingFixture?.dateLabel}
        forceTimeOfDay={model.greetingFixture?.timeOfDay}
        forceVariant={model.greetingFixture?.variant}
      />

      {model.billingAlert && (
        <HomeBillingAlert text={model.billingAlert.text} cta={model.billingAlert.cta} tone={model.billingAlert.tone} />
      )}

      {boxes.length >= 2 ? (
        <MultiBoxCard rows={boxes} />
      ) : boxes.length === 1 ? (
        <BoxProgressCard
          dogLabel={boxes[0]!.dogLabel}
          stage={boxes[0]!.stage}
          detail={boxes[0]!.detail}
          itemLabel={boxes[0]!.itemLabel}
          lines={boxes[0]!.lines}
          href={boxes[0]!.href}
          linkLabel={boxes[0]!.linkLabel}
        />
      ) : nextDelivery ? (
        <DeliveryStripCard
          daysUntil={nextDelivery.daysUntil}
          shipDateLabel={nextDelivery.shipDateLabel}
          checkDetail={nextDelivery.checkDetail}
          itemLabel={nextDelivery.itemLabel}
          lines={nextDelivery.lines}
        />
      ) : null}

      {activeDog && multi && <HomeDogTabs dogs={model.dogTabs} activeId={activeDog.id} />}

      {activeDog && (
        <ActiveDogCard
          dogName={activeDog.name}
          metaLine={activeDog.metaLine}
          photoUrl={activeDog.photoUrl}
          statusLabel={activeDog.statusLabel}
          statusTone={activeDog.statusTone}
          metrics={activeDog.metrics}
          href={`/dogs/${activeDog.id}`}
          priority
          core={!hasTopCard}
          kicker={hasTopCard ? '지금 보고 있는 아이' : '우리 아이'}
          variant={multi ? 'multi' : 'single'}
        />
      )}

      {activeDog && model.streak >= 7 && <StreakRewards currentStreak={model.streak} />}

      {activeDog && (
        <ThisWeekSection
          dogId={activeDog.id}
          dogName={activeDog.name}
          streak={model.streak}
          days={model.weekDays}
          quickActions={model.quickActions}
          recordTodayHref={`/dogs/${activeDog.id}/health`}
        />
      )}

      {model.dogCount === 0 && (model.loadFailed ? <HomeLoadFailed /> : <EmptyHomeNoDogs addDogHref="/dogs/new" />)}
    </div>
  )
}
