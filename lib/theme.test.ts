/**
 * theme.ts unit tests — Node native test runner.
 *
 * cookies.test.ts 와 같은 이유로 jsdom 대신 인메모리 스텁을 손수 끼운다.
 * documentElement 는 최소한 getAttribute / setAttribute / removeAttribute 만
 * 흉내 내면 충분.
 */
import { before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'

type AttrStore = Map<string, string>

function makeHtmlElement(store: AttrStore) {
  return {
    getAttribute(name: string) {
      return store.has(name) ? store.get(name)! : null
    },
    setAttribute(name: string, value: string) {
      store.set(name, String(value))
    },
    removeAttribute(name: string) {
      store.delete(name)
    },
  }
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
    getItem(key) {
      return store.has(key) ? store.get(key)! : null
    },
    key(i) {
      return Array.from(store.keys())[i] ?? null
    },
    removeItem(key) {
      store.delete(key)
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
  }
}

type MatchMediaFn = (query: string) => MediaQueryList

type StubWindow = {
  localStorage: Storage
  matchMedia?: MatchMediaFn
}
type StubDocument = {
  documentElement: ReturnType<typeof makeHtmlElement>
}

let themeMod: typeof import('./theme.ts')
let htmlAttrs: AttrStore
let prefersDark: boolean

before(async () => {
  htmlAttrs = new Map()
  prefersDark = false
  const win: StubWindow = {
    localStorage: makeLocalStorage(),
    matchMedia: (query) => {
      // 아주 단순한 prefers-color-scheme 매칭만 흉내.
      const matches =
        query.includes('prefers-color-scheme: dark') && prefersDark
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      } as unknown as MediaQueryList
    },
  }
  const doc: StubDocument = {
    documentElement: makeHtmlElement(htmlAttrs),
  }
  ;(globalThis as unknown as { window: StubWindow }).window = win
  ;(globalThis as unknown as { document: StubDocument }).document = doc
  themeMod = await import('./theme.ts')
})

beforeEach(() => {
  htmlAttrs.clear()
  window.localStorage.clear()
  prefersDark = false
})

describe('readThemeChoice', () => {
  it("defaults to 'system' when nothing is stored", () => {
    assert.equal(themeMod.readThemeChoice(), 'system')
  })

  it('returns the stored choice when valid', () => {
    window.localStorage.setItem(themeMod.THEME_STORAGE_KEY, 'dark')
    assert.equal(themeMod.readThemeChoice(), 'dark')
  })

  it("ignores a garbled value and falls back to 'system'", () => {
    window.localStorage.setItem(themeMod.THEME_STORAGE_KEY, 'hot-pink')
    assert.equal(themeMod.readThemeChoice(), 'system')
  })
})

describe('writeThemeChoice', () => {
  it("sets data-theme on <html> and persists when choice is 'dark'", () => {
    themeMod.writeThemeChoice('dark')
    assert.equal(htmlAttrs.get('data-theme'), 'dark')
    assert.equal(
      window.localStorage.getItem(themeMod.THEME_STORAGE_KEY),
      'dark',
    )
  })

  it("removes data-theme and storage when choice is 'system'", () => {
    themeMod.writeThemeChoice('light')
    themeMod.writeThemeChoice('system')
    assert.equal(htmlAttrs.has('data-theme'), false)
    assert.equal(
      window.localStorage.getItem(themeMod.THEME_STORAGE_KEY),
      null,
    )
  })
})

describe('resolveEffectiveTheme', () => {
  it("returns the explicit choice when not 'system'", () => {
    assert.equal(themeMod.resolveEffectiveTheme('dark'), 'dark')
    assert.equal(themeMod.resolveEffectiveTheme('light'), 'light')
  })

  it("consults matchMedia when 'system' — dark OS", () => {
    prefersDark = true
    assert.equal(themeMod.resolveEffectiveTheme('system'), 'dark')
  })

  it("consults matchMedia when 'system' — light OS", () => {
    prefersDark = false
    assert.equal(themeMod.resolveEffectiveTheme('system'), 'light')
  })
})

describe('readDomThemeChoice', () => {
  it("returns 'system' when <html> has no data-theme attribute", () => {
    assert.equal(themeMod.readDomThemeChoice(), 'system')
  })

  it('mirrors the data-theme attribute when set to a valid value', () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    assert.equal(themeMod.readDomThemeChoice(), 'dark')
  })

  it("treats an unknown attribute value as 'system'", () => {
    document.documentElement.setAttribute('data-theme', 'sepia')
    assert.equal(themeMod.readDomThemeChoice(), 'system')
  })
})
