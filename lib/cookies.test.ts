/**
 * cookies.ts unit tests — Node native test runner.
 *
 * cookies.ts 는 `window` / `localStorage` / `CustomEvent` 에 의존하는 브라우저
 * 전용 헬퍼다. vitest/jsdom 이 Windows App Control 에 걸려 native binding 이
 * 차단됐기 때문에, 여기선 의존성 0 짜리 미니 스텁(globalThis.window + 인메모리
 * localStorage + EventTarget) 을 손수 꽂아 준다. 프로덕션 런타임은 진짜 브라우저
 * 이므로 스텁은 단위 테스트에서만 유효.
 */
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'

type Win = EventTarget & {
  localStorage: Storage
  gtag?: (...args: unknown[]) => void
  fbq?: (...args: unknown[]) => void
  dataLayer?: unknown[]
  dispatchEvent: EventTarget['dispatchEvent']
}

function makeLocalStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) as string) : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  }
}

// 전역 스텁은 모듈 임포트 시점에 이미 필요 — cookies.ts 의 `typeof window`
// 체크가 모듈-로드 타임이 아니라 호출 시점이라 동적으로도 붙여도 되지만,
// localStorage 는 전역에도 노출해야 해서 before 가 아니라 탑레벨에서 세팅.
const target = new EventTarget() as Win
target.localStorage = makeLocalStorage()
;(globalThis as unknown as { window: Win }).window = target
;(globalThis as unknown as { localStorage: Storage }).localStorage =
  target.localStorage
// CustomEvent 는 Node 19+ 에서 글로벌로 존재하므로 별도 폴리필 불필요.

const {
  COOKIE_POLICY_VERSION,
  applyConsentToTrackers,
  readConsent,
  resetConsent,
  writeConsent,
} = await import('./cookies.ts')

beforeEach(() => {
  target.localStorage.clear()
  delete target.gtag
  delete target.fbq
  delete target.dataLayer
})

afterEach(() => {
  mock.reset()
})

describe('readConsent', () => {
  it('returns null when nothing is stored', () => {
    assert.equal(readConsent(), null)
  })

  it('returns null when version does not match (forces re-consent on policy bump)', () => {
    target.localStorage.setItem(
      'ft_cookie_consent',
      JSON.stringify({ version: 'v0', analytics: true, marketing: true }),
    )
    assert.equal(readConsent(), null)
  })

  it('coerces missing booleans to false', () => {
    target.localStorage.setItem(
      'ft_cookie_consent',
      JSON.stringify({ version: COOKIE_POLICY_VERSION }),
    )
    const c = readConsent()
    assert.notEqual(c, null)
    assert.equal(c?.analytics, false)
    assert.equal(c?.marketing, false)
    assert.equal(c?.necessary, true)
  })

  it('returns null on malformed JSON', () => {
    target.localStorage.setItem('ft_cookie_consent', 'not json')
    assert.equal(readConsent(), null)
  })
})

describe('writeConsent', () => {
  it('persists with version + decidedAt', () => {
    const result = writeConsent({ analytics: true, marketing: false })
    assert.equal(result.version, COOKIE_POLICY_VERSION)
    assert.match(result.decidedAt, /^\d{4}-\d{2}-\d{2}T/)

    const reread = readConsent()
    assert.equal(reread?.analytics, true)
    assert.equal(reread?.marketing, false)
  })

  it('dispatches ft-consent-change event', () => {
    let calls = 0
    const handler = () => {
      calls += 1
    }
    target.addEventListener('ft-consent-change', handler)
    writeConsent({ analytics: true, marketing: true })
    assert.equal(calls, 1)
    target.removeEventListener('ft-consent-change', handler)
  })
})

describe('applyConsentToTrackers', () => {
  it('calls gtag with correct granted/denied states', () => {
    const gtag = mock.fn()
    target.gtag = gtag as unknown as Win['gtag']

    applyConsentToTrackers({
      necessary: true,
      analytics: true,
      marketing: false,
      version: COOKIE_POLICY_VERSION,
      decidedAt: '2026-01-01T00:00:00Z',
    })

    assert.equal(gtag.mock.callCount(), 1)
    assert.deepEqual(gtag.mock.calls[0].arguments, [
      'consent',
      'update',
      {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'granted',
      },
    ])
  })

  it('passes grant/revoke to fbq', () => {
    const fbq = mock.fn()
    target.fbq = fbq as unknown as Win['fbq']

    applyConsentToTrackers({
      necessary: true,
      analytics: false,
      marketing: true,
      version: COOKIE_POLICY_VERSION,
      decidedAt: '2026-01-01T00:00:00Z',
    })
    assert.equal(fbq.mock.callCount(), 1)
    assert.deepEqual(fbq.mock.calls[0].arguments, ['consent', 'grant'])
  })

  it('is a no-op when trackers are not loaded', () => {
    // fbq/gtag 가 undefined 여도 (스크립트 미탑재/사용자 차단) 예외가
    // 새지 않아야 한다.
    assert.doesNotThrow(() =>
      applyConsentToTrackers({
        necessary: true,
        analytics: true,
        marketing: true,
        version: COOKIE_POLICY_VERSION,
        decidedAt: '2026-01-01T00:00:00Z',
      }),
    )
  })
})

describe('resetConsent', () => {
  it('clears storage and dispatches reset event', () => {
    writeConsent({ analytics: true, marketing: true })
    assert.notEqual(readConsent(), null)

    let calls = 0
    const handler = () => {
      calls += 1
    }
    target.addEventListener('ft-consent-reset', handler)
    resetConsent()
    assert.equal(calls, 1)
    assert.equal(readConsent(), null)
    target.removeEventListener('ft-consent-reset', handler)
  })
})

// `before` is imported to satisfy future extension points without lint noise.
void before
