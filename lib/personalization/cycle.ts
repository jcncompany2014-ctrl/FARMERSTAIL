/**
 * 처방 사이클 — **정본 (single source of truth).**
 *
 * # 왜 한 파일에 묶었나 (2026-07-17)
 *
 * 오늘 잡은 버그가 **전부 같은 모양**이었다: 서로 물려 있는 숫자가 여러 곳에 흩어져
 * 있다가, 한쪽만 바뀌면서 **에러 없이 조용히** 기능이 죽는 것.
 *   · push-lifecycle — 코드는 hourly 전제, vercel.json 은 daily → 복약 알림 23/24 시각 사망
 *   · onboarding-funnel — 윈도우 6일 vs 크론 1일 → 중복 발송
 *   · progression — CYCLE_DAYS=30 인데 /order·plan·boxPricing 은 14 → 주석까지 거짓말
 *
 * 사이클도 똑같은 위험이 있다: **재제안 주기 · 체크인 시점 · 커버 기간**이 서로
 * 물려 있는데 크론과 UI 에 따로 적혀 있었다. 그래서 여기 하나만 둔다.
 * 값을 바꾸면 크론·UI·admin 이 **같이** 움직인다.
 *
 * ⚠️ 여기 숫자를 다른 파일에 다시 적지 말 것. import 해서 쓴다.
 *
 * # 모델 (사장님 2026-07-17 확정)
 *
 * 기준은 **날짜가 아니라 배송 회차**다. 발송이 화요일 2주 간격이므로 회차로 세면
 * 자동으로 화요일에 정렬되고, 승인이 늦어도 밀리지 않으며, 일시정지하면 사이클도
 * 함께 멈춘다. (날짜 기준이던 시절엔 시작점이 '설문한 날/승인 누른 날' 이라 요일이
 * 떠돌고 승인 지연만큼 계속 밀렸다.)
 *
 *   박스 1 (day 0)  ─┐
 *   박스 2 (day 14)  ├─ 같은 처방 A
 *   박스 3 (day 28) ─┘   ← 이 박스가 나갈 때 크론이 새 처방 B 제안(승인 대기)
 *   박스 4 (day 42)      ← 승인했으면 여기서부터 B
 *
 * # 왜 3개(=4주)인가
 * 체크인이 **박스 2개째(적응)·3개째(종합)** 에 물려 있고, **종합 만족도는 3개째에서만**
 * 받는다. 그 데이터로 다시 설계하려면 3개째 이후에 재계산해야 한다.
 * 2개(2주)로 줄이면 종합 체크인이 영영 발생하지 않아 알고리즘이 반쪽이 된다.
 */

/** 배송 간격 (일). 2주 고정 — lib/shipping-schedule 의 화요일 발송 규칙과 같은 리듬. */
export const DELIVERY_INTERVAL_DAYS = 14

/** 몇 박스마다 처방을 다시 볼지. 3 = 4주. */
export const BOXES_PER_CYCLE = 3

/**
 * 체크인을 요청할 **박스 회차**.
 *  · week_2 = 2번째 박스 받을 때쯤 — 적응 체크(변·모질·식욕)
 *  · week_4 = 3번째 박스 받을 때쯤 — 종합 평가(**종합 만족도는 여기서만** 수집)
 *
 * 이름이 week_* 인 건 DB enum 이 그렇기 때문(dog_checkins.checkpoint).
 * 의미는 '주차' 가 아니라 **박스 회차**다 — 2주 배송이라 우연히 2주차·4주차와 같다.
 */
export const CHECKIN_AT_BOX: Record<'week_2' | 'week_4', number> = {
  week_2: 2,
  week_4: 3,
}

/**
 * 처방이 **먹이는 기간** (일) = 박스 3개 × 14일치 = 42.
 *
 * 재제안 트리거(배송 회차)와 **별개**다. 이건 picking 이 "이 날짜엔 어떤 처방?" 을
 * 물을 때 답이 있도록 보장하는 커버 구간이다. 예전엔 이 둘이 CYCLE_DAYS=30 하나에
 * 묶여 있어, 3번째 박스가 28일에 나가고 그 밥을 41일까지 먹는데 커버는 30일에 끝나
 * **30~41일 구간에 활성 처방이 없는 공백**이 났다.
 */
export const CYCLE_COVER_DAYS = BOXES_PER_CYCLE * DELIVERY_INTERVAL_DAYS

/** 승인 대기 기간 (일). 지나면 자동으로 이전 비율 유지(= 금액도 유지). */
export const APPROVAL_WINDOW_DAYS = 5

/** 재제안 만기인가 — 이 처방이 적용된 뒤 나간 박스 수로 판정. */
export function isCycleDue(boxesShipped: number): boolean {
  return boxesShipped >= BOXES_PER_CYCLE
}

/**
 * 재제안 후보 쿼리의 하한 날짜 게이트 (쿼리 바운딩 전용 — 만기 판정은 실 배송 회차로).
 * 박스가 DELIVERY_INTERVAL_DAYS 마다 나가므로 BOXES_PER_CYCLE 개는 최소 (N-1)×간격
 * 걸린다. 여유를 둬 반 간격만큼 이르게 자른다: 진짜 만기를 **절대 제외하지 않으면서**
 * (보수적) 후보 수를 묶는다. (progression 크론 + admin 미리보기가 공유.)
 */
export const MIN_DAYS_BEFORE_DUE =
  (BOXES_PER_CYCLE - 1) * DELIVERY_INTERVAL_DAYS - DELIVERY_INTERVAL_DAYS / 2

/**
 * 이 체크인이 요청될 날짜 (처방 적용 시작일 기준).
 *
 * 박스 N 은 applied_from + (N-1)×14 일에 나간다 → 2번째=+14, 3번째=+28.
 * **배송 회차에서 파생**되므로 BOXES_PER_CYCLE·CHECKIN_AT_BOX 를 바꾸면 자동으로
 * 따라 움직인다(따로 적힌 상수가 없다).
 */
export function checkinDueDayOffset(checkpoint: 'week_2' | 'week_4'): number {
  return (CHECKIN_AT_BOX[checkpoint] - 1) * DELIVERY_INTERVAL_DAYS
}

/** 체크인 링크 노출 창 — D-7 ~ D+3. (요청일 전후로 보여줘야 응답률이 산다.) */
export const CHECKIN_WINDOW_BEFORE = 7
export const CHECKIN_WINDOW_AFTER = 3

/** 지금 이 체크인 링크를 띄울 때인가. `dueIn` = 요청일까지 남은 일수(음수=지남). */
export function isCheckinLinkVisible(dueIn: number): boolean {
  return dueIn >= -CHECKIN_WINDOW_AFTER && dueIn <= CHECKIN_WINDOW_BEFORE
}
