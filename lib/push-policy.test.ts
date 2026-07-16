/**
 * 푸시 카테고리·잔소리 상한 정책 — 소스 자체를 읽어 규칙을 지킨다.
 *
 * pushToUser 는 Supabase·web-push 를 물고 있어 단위 테스트가 어렵다. 그런데 여기서
 * 나는 실수는 **조용하다** — 아무도 에러를 안 보고, 그냥 알림이 안 갈 뿐이다.
 * 실제로 2026-07-16 에 세 건이나 그렇게 새고 있었다:
 *
 *  1. 체중 경보가 category:'order' 로 나갔다 → 배송 알림을 끈 사람은 경보도 못 받았다.
 *  2. "첫 박스 어떠셨나요" 가 category:'marketing'(기본 OFF) 이었다 → 아무에게도 안 갔다.
 *  3. 주 2건 상한이 폐지된 cart/restock 에 걸려 있었다 → 아무것도 안 막았다.
 *
 * 그래서 호출부를 소스 레벨로 감시한다. 무식하지만 이 셋을 다시 못 내게 막는다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/** 건강 알림을 보내는 크론 — 전부 category:'health' 여야 한다. */
const HEALTH_CRONS = [
  'app/api/cron/weight-reminder/route.ts',
  'app/api/cron/weight-change-detect/route.ts',
  'app/api/cron/dcm-screening-reminder/route.ts',
  'app/api/cron/intervention-alerts/route.ts',
  'app/api/cron/first-box-checkin/route.ts',
]

/**
 * 잘리면 안 되는 경보 — nudge 를 붙이면 "체중 재세요" 잔소리에 밀려 주 2건 상한에
 * 걸릴 수 있다. 절대 붙이지 말 것.
 */
const ALERT_CRONS = [
  'app/api/cron/weight-change-detect/route.ts',
  'app/api/cron/dcm-screening-reminder/route.ts',
  'app/api/cron/intervention-alerts/route.ts',
]

describe('푸시 카테고리 — 건강 알림이 배송으로 위장하지 않는다', () => {
  it("PushCategory 는 order|health|marketing 3종 (폐지된 restock/cart 부활 금지)", () => {
    const src = read('lib/push.ts')
    assert.match(src, /export type PushCategory = 'order' \| 'health' \| 'marketing'/)
    assert.ok(!/category === 'cart'|category === 'restock'/.test(src), 'cart/restock 게이팅 잔재')
  })

  it("건강 크론은 전부 category: 'health' — 'order' 재사용 금지", () => {
    for (const p of HEALTH_CRONS) {
      const src = read(p)
      assert.ok(
        src.includes("category: 'health'"),
        `${p} 가 health 로 안 보낸다 — 보호자가 배송 알림을 끄면 같이 꺼진다`,
      )
      assert.ok(
        !src.includes("category: 'order'"),
        `${p} 가 아직 'order' 로 위장해 보낸다`,
      )
    }
  })

  it('체크인은 marketing 이 아니다 — marketing 기본 OFF 라 아무에게도 안 간다', () => {
    const src = read('app/api/cron/first-box-checkin/route.ts')
    assert.ok(!src.includes("category: 'marketing'"), '체크인은 광고가 아니다')
  })
})

describe('잔소리 상한 — 경보는 절대 상한에 걸리지 않는다', () => {
  it('상한은 카테고리가 아니라 nudge 표식에 걸린다', () => {
    const src = read('lib/push.ts')
    assert.match(src, /if \(opts\?\.nudge\)/, '상한이 nudge 기반이 아니다')
    assert.match(src, /\.eq\('nudge', true\)/, '7일 윈도우가 nudge 를 세지 않는다')
  })

  it('경보 크론엔 nudge 가 붙어 있지 않다 (붙으면 잔소리에 밀려 잘린다)', () => {
    for (const p of ALERT_CRONS) {
      assert.ok(!read(p).includes('nudge: true'), `${p} 경보에 nudge 가 붙었다`)
    }
  })

  it('안 보내도 되는 권유성엔 nudge 가 붙어 있다', () => {
    for (const p of [
      'app/api/cron/weight-reminder/route.ts',
      'app/api/cron/first-box-checkin/route.ts',
      'app/api/cron/onboarding-funnel/route.ts',
      'app/api/admin/push-campaigns/route.ts',
    ]) {
      assert.ok(read(p).includes('nudge: true'), `${p} 에 nudge 표식이 없다 — 상한 밖`)
    }
  })

  it('발송 이력에 nudge 를 남긴다 (안 남기면 다음 주 상한이 못 센다)', () => {
    assert.match(read('lib/push.ts'), /nudge: opts\?\.nudge \?\? false/)
  })
})

describe('설정 화면 — 보호자가 끌 수 있는 단위와 1:1', () => {
  it('알림 설정에 건강 항목이 있다', () => {
    const src = read('app/(main)/mypage/notifications/PreferencesPanel.tsx')
    assert.ok(src.includes('notify_health'), '건강 알림을 끌 방법이 없다')
    assert.ok(!/notify_cart|notify_restock/.test(src), '폐지된 항목 잔재')
  })

  it('알림함 라벨이 PushCategory 와 1:1 (안 뜨는 라벨 금지)', () => {
    const src = read('app/(main)/notifications/NotificationsClient.tsx')
    for (const dead of ['restock:', 'cart:', 'reminder:', 'approval:', 'checkin:']) {
      assert.ok(!src.includes(dead), `발송 타입에 없는 라벨 '${dead}' — 영원히 안 뜬다`)
    }
    assert.ok(src.includes('health:'), '건강 라벨 없음')
  })
})
