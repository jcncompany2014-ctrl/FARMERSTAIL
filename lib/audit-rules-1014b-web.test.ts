/**
 * 2026-10-14 점검 묶음 '웹 — 느린 폰 첫 화면 · 쿠키 띠 · 앱 뒤로 가기 · 앱 안 링크 모음' 의 규칙 231~235 (가지 fix/1014b-web).
 *
 * 문서에만 적은 규칙은 같은 날 또 어긴다 — 고친 것을 테스트로 박는다. 각 규칙은 고치기 전 코드(32d1ea8c)에서는 빨간불,
 * 지금 코드에서는 초록불인지 검산했다(카나리아 — 보고서에 결과).
 * 카나리아 실행: AUDIT_ROOT=<옛 파일을 같은 경로로 풀어 둔 폴더> 로 이 파일을 돌리면 그 폴더를 읽는다(여기서 불러오는 lib 파일은
 * 다른 꾸러미를 부르지 않으므로 폴더가 저장소 밖이어도 된다).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { brotliDecompressSync } from 'node:zlib'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()

function read(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n')
}

/** 주석을 걷어낸 본문 — 주석 속 설명이 규칙에 걸리지 않게(lib/audit-rules.test.ts 와 같은 방식). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
}

function code(...parts: string[]): string {
  return stripComments(read(...parts))
}

/** 주석을 걷고 공백을 한 칸으로 — JSX 는 문장을 아무 데서나 접으므로 줄바꿈을 넘어 문장을 찾는다. */
function flat(...parts: string[]): string {
  return code(...parts).replace(/\s+/g, ' ')
}

async function load<T>(...parts: string[]): Promise<T> {
  return (await import(pathToFileURL(join(ROOT, ...parts)).href)) as T
}

/** 루트 레이아웃의 본문 글꼴(Pretendard 부분 글꼴) localFont 블록과 그 변수 이름(= Turbopack 이 만드는 글꼴 이름). */
function pretendardFont(): { name: string; block: string } {
  const layout = code('app', 'layout.tsx')
  const decls = [...layout.matchAll(/const (\w+) = localFont\(\{/g)]
  for (const d of decls) {
    const end = layout.indexOf('});', d.index)
    const block = layout.slice(d.index, end)
    if (block.includes('PretendardVariable')) return { name: d[1]!, block }
  }
  assert.fail('루트 레이아웃에서 Pretendard localFont 를 못 찾았다 — 검사가 망가졌다')
}
function pretendardBlock(): string {
  return pretendardFont().block
}

/** globals.css 에서 이름이 family 인 @font-face 블록들. */
function fontFaces(css: string, family: string): string[] {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1] ?? '').filter((b) => new RegExp(`font-family:\\s*${family}\\s*;`).test(b))
}

function pct(block: string, prop: string): number {
  const m = new RegExp(`${prop}:\\s*([\\d.]+)%`).exec(block)
  assert.ok(m, `${prop} 가 없다`)
  return Number(m[1]) / 100
}

// ─────────────────────────────────────────────────────────────────────────────
// 작은 woff2 읽개 — 본문 글꼴 파일에서 em 크기·세로 지표·글자 폭을 직접 읽는다(대체 글꼴 값이 그 파일과 맞는지 보려고).
// woff2 = 표 목록 + brotli 한 덩어리. hmtx·cmap·head·hhea 는 변환 없이 들어 있다(glyf·loca 만 변환 — 쓰지 않는다).
// ─────────────────────────────────────────────────────────────────────────────

const WOFF2_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill']

type FontMetrics = { upm: number; ascent: number; descent: number; lineGap: number; advance: (cp: number) => number | null }

function readWoff2(file: Buffer): FontMetrics {
  assert.equal(file.toString('ascii', 0, 4), 'wOF2', '본문 글꼴이 woff2 가 아니다')
  const numTables = file.readUInt16BE(12)
  const compressedLen = file.readUInt32BE(20)
  let off = 48
  const b128 = () => {
    let v = 0
    for (let i = 0; i < 5; i++) {
      const x = file[off++]!
      v = (v << 7) | (x & 0x7f)
      if (!(x & 0x80)) return v >>> 0
    }
    throw new Error('woff2 길이 표기가 이상하다')
  }
  const dir: { tag: string; len: number }[] = []
  for (let i = 0; i < numTables; i++) {
    const flags = file[off++]!
    const idx = flags & 0x3f
    const tv = (flags >> 6) & 3
    let tag: string
    if (idx === 63) {
      tag = file.toString('ascii', off, off + 4)
      off += 4
    } else tag = WOFF2_TAGS[idx]!
    const orig = b128()
    const transformed = tag === 'glyf' || tag === 'loca' ? tv !== 3 : tv !== 0
    const len = transformed ? b128() : orig
    if (transformed && (tag === 'hmtx' || tag === 'cmap' || tag === 'head' || tag === 'hhea')) throw new Error(`${tag} 가 변환돼 있다 — 이 읽개로는 못 읽는다`)
    dir.push({ tag, len })
  }
  const data = brotliDecompressSync(file.subarray(off, off + compressedLen))
  const tables = new Map<string, Buffer>()
  let p = 0
  for (const t of dir) {
    tables.set(t.tag, data.subarray(p, p + t.len))
    p += t.len
  }
  const head = tables.get('head')!
  assert.equal(head.readUInt32BE(12), 0x5f0f3cf5, 'woff2 를 잘못 풀었다(head 표의 표식이 다르다)')
  const hhea = tables.get('hhea')!
  const hmtx = tables.get('hmtx')!
  const nMetrics = hhea.readUInt16BE(34)
  const cmap = tables.get('cmap')!
  // 유니코드 표(3,10 형식 12 → 3,1 형식 4) 하나를 고른다.
  const subs: { pid: number; eid: number; at: number }[] = []
  for (let i = 0; i < cmap.readUInt16BE(2); i++) subs.push({ pid: cmap.readUInt16BE(4 + i * 8), eid: cmap.readUInt16BE(6 + i * 8), at: cmap.readUInt32BE(8 + i * 8) })
  const pick = subs.find((s) => s.pid === 3 && s.eid === 10) ?? subs.find((s) => s.pid === 3 && s.eid === 1) ?? subs.find((s) => s.pid === 0)
  assert.ok(pick, '글꼴에 유니코드 글자표가 없다')
  const fmt = cmap.readUInt16BE(pick.at)
  const glyphOf = (cp: number): number => {
    const t = pick.at
    if (fmt === 12) {
      const n = cmap.readUInt32BE(t + 12)
      for (let i = 0; i < n; i++) {
        const s = cmap.readUInt32BE(t + 16 + i * 12)
        const e = cmap.readUInt32BE(t + 20 + i * 12)
        if (cp >= s && cp <= e) return cmap.readUInt32BE(t + 24 + i * 12) + (cp - s)
      }
      return 0
    }
    assert.equal(fmt, 4, `글자표 형식 ${fmt} 은 이 읽개가 모른다`)
    const segX2 = cmap.readUInt16BE(t + 6)
    const ends = t + 14
    const starts = ends + segX2 + 2
    const deltas = starts + segX2
    const ranges = deltas + segX2
    for (let i = 0; i < segX2 / 2; i++) {
      const end = cmap.readUInt16BE(ends + i * 2)
      if (cp > end) continue
      const start = cmap.readUInt16BE(starts + i * 2)
      if (cp < start) return 0
      const delta = cmap.readInt16BE(deltas + i * 2)
      const ro = cmap.readUInt16BE(ranges + i * 2)
      if (ro === 0) return (cp + delta) & 0xffff
      const g = cmap.readUInt16BE(ranges + i * 2 + ro + (cp - start) * 2)
      return g === 0 ? 0 : (g + delta) & 0xffff
    }
    return 0
  }
  return {
    upm: head.readUInt16BE(18),
    ascent: hhea.readInt16BE(4),
    descent: hhea.readInt16BE(6),
    lineGap: hhea.readInt16BE(8),
    advance: (cp) => {
      const g = glyphOf(cp)
      if (!g) return null
      return hmtx.readUInt16BE(Math.min(g, nMetrics - 1) * 4)
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 규칙231 — 본문 글꼴이 JS 를 앞지르지 않는다(미리 받기 끔 + 느린 연결은 스크립트 뒤에 켜기)
// ─────────────────────────────────────────────────────────────────────────────

type FakeEnv = {
  classes: Set<string>
  store: Map<string, string>
  loadCalls: string[]
  listeners: Map<string, () => void>
  resolveLoad: (faces: unknown[]) => Promise<void>
  rejectLoad: () => Promise<void>
}

/** head 스크립트를 가짜 브라우저에서 돌린다 — connection 이 null 이면 API 가 없는 브라우저(아이폰 사파리). */
function runFontScript(script: string, opts: { connection: { effectiveType?: string; saveData?: boolean } | null; seen?: boolean; storageThrows?: boolean; noFonts?: boolean }): FakeEnv {
  const classes = new Set<string>()
  const store = new Map<string, string>()
  if (opts.seen) store.set('ft_font', '1')
  const loadCalls: string[] = []
  const listeners = new Map<string, () => void>()
  let settle: { res: (v: unknown[]) => void; rej: (e: unknown) => void } | null = null
  const fonts = {
    load(font: string) {
      loadCalls.push(font)
      return new Promise<unknown[]>((res, rej) => {
        settle = { res, rej }
      })
    },
  }
  const localStorage = {
    getItem(k: string) {
      if (opts.storageThrows) throw new Error('blocked')
      return store.get(k) ?? null
    },
    setItem(k: string, v: string) {
      if (opts.storageThrows) throw new Error('blocked')
      store.set(k, v)
    },
  }
  const document = { documentElement: { classList: { add: (c: string) => classes.add(c), contains: (c: string) => classes.has(c) } }, fonts: opts.noFonts ? undefined : fonts }
  const navigator = opts.connection ? { connection: opts.connection } : {}
  const window = { addEventListener: (ev: string, fn: () => void) => listeners.set(ev, fn) }
  new Function('document', 'navigator', 'localStorage', 'window', script)(document, navigator, localStorage, window)
  const tick = () => new Promise<void>((r) => setTimeout(r, 0))
  return {
    classes,
    store,
    loadCalls,
    listeners,
    resolveLoad: async (faces) => {
      ;(settle as { res: (v: unknown[]) => void } | null)?.res(faces)
      await tick()
    },
    rejectLoad: async () => {
      ;(settle as { rej: (e: unknown) => void } | null)?.rej(new Error('net'))
      await tick()
    },
  }
}

test('규칙231: 본문 글꼴(513KB)은 미리 받지 않고, 느린 연결이면 페이지 스크립트가 다 온 뒤에 켠다 — 부분 글꼴(KS X 1001)은 그대로', async () => {
  /**
   * # 왜 (2026-10-14 점검 — scratchpad mail1014/perf 측정)
   * 루트 레이아웃의 preload:true 가 모든 화면에서 Pretendard 부분 글꼴 513KB 를 HTML 머리(Link 헤더)부터 받게 했다.
   * 느린 폰(빠른 3G · CPU 4배)에서 화면을 움직이는 JS 와 회선을 나눠, JS 가 글꼴과 함께 6~8초에야 도착했고 그때까지 가게·로그인·
   * 주문서의 버튼이 움직이지 않았다. 미리 받기를 끄고, 느린 연결(2g·3g·데이터 절약)이면 window load 뒤에 받아 다 온 뒤 켠다.
   * 빠르거나 모르는 연결(아이폰 사파리엔 이 API 가 없다)·한 번 받은 기기는 바로 켠다(예전과 같다).
   * 8차 점검의 부분 글꼴 결정(규칙129 — KS X 1001 2,350자)은 그대로 둔다.
   */
  const block = pretendardBlock()
  assert.match(block, /src: "\.\/fonts\/PretendardVariable-ksx\.woff2"/, '본문 글꼴이 부분 글꼴(KS X 1001)이 아니다 — 8차 점검 결정(규칙129)')
  const fontFile = join(ROOT, 'app', 'fonts', 'PretendardVariable-ksx.woff2')
  assert.ok(existsSync(fontFile) && statSync(fontFile).size < 600_000, '부분 글꼴 파일이 없거나 600KB 를 넘는다 — 전체 글꼴(2MB)로 돌아갔다')
  assert.match(block, /preload:\s*false/, '본문 글꼴을 아직 미리 받는다 — 모든 화면이 JS 보다 513KB 를 먼저 받는다')

  const layout = code('app', 'layout.tsx')
  assert.match(layout, /<script dangerouslySetInnerHTML=\{\{ __html: fontActivationScript\(PRETENDARD_FAMILY\) \}\} \/>/, 'head 에 본문 글꼴 늦게 켜기 스크립트가 없다')
  const { name } = pretendardFont()
  assert.match(layout, new RegExp(`const PRETENDARD_FAMILY = ${name}\\.style\\.fontFamily\\.split\\(","\\)\\[0\\]!\\.trim\\(\\);`), '늦게 켜기 스크립트가 next/font 가 만든 글꼴 이름을 쓰지 않는다')
  // 변수 이름 = 글꼴 이름(Turbopack). 여러 CSS 가 뒤에 받쳐 둔 'Pretendard'·'Pretendard Variable'(기기에 깔린 글꼴을 찾는 이름)과
  // 대소문자 무시로 같으면, 대체 글꼴에 없는 글자(주문서의 ＋ 등) 하나로 늦게 켜기 전에 513KB 를 받기 시작한다(2026-10-14 실측).
  const stacks = stripComments(read('app', 'globals.css')) + stripComments(read('components', 'store', 'store.css'))
  assert.ok(/font-family:[^;]*'Pretendard'[,;\s]/.test(stacks), "CSS 가 'Pretendard' 를 받쳐 두지 않는다 — 이 검사의 전제가 바뀌었다")
  assert.ok(!['pretendard', 'pretendard variable'].includes(name.toLowerCase()), `본문 글꼴 변수 이름(${name})이 CSS 가 받쳐 둔 'Pretendard' 와 같다 — 늦게 켜기 전에 글꼴을 받는다`)
  const headStart = layout.indexOf('<head>')
  const headEnd = layout.indexOf('</head>')
  const at = layout.indexOf('fontActivationScript(PRETENDARD_FAMILY)')
  assert.ok(headStart > 0 && at > headStart && at < headEnd, '늦게 켜기 스크립트가 <head> 안에 없다 — 첫 그림 전에 켜야 하는 경우(빠른 연결·캐시)를 놓친다')

  // 글꼴이 꺼진 동안 쓰는 대체 글꼴 지정 — 스크립트가 붙이는 이름과 CSS 가 같은 이름이어야 한다.
  const css = stripComments(read('app', 'globals.css'))
  assert.match(css, /html:not\(\.ft-font\)\s*\{\s*--font-sans:\s*ft-sans-latin-fallback,\s*ft-sans-ko-fallback;\s*\}/, '글꼴을 켜기 전 대체 글꼴 지정(html:not(.ft-font))이 없다 — 느린 연결에서도 CSS 가 바로 글꼴을 받는다')

  const fa = await load<{ fontActivationScript: (family: string) => string; FONT_ON_CLASS: string; FONT_SEEN_KEY: string }>('lib', 'font-activation.ts')
  assert.equal(fa.FONT_ON_CLASS, 'ft-font')
  assert.equal(fa.FONT_SEEN_KEY, 'ft_font')
  const script = fa.fontActivationScript("'pretendard'")

  // ① 느린 연결(3g) · 처음 — 바로 켜지 않고 글꼴도 아직 안 받는다. load 뒤에 받고, 다 받은 뒤에 켠다 + 기억.
  const slow = runFontScript(script, { connection: { effectiveType: '3g' } })
  assert.ok(!slow.classes.has('ft-font'), '느린 연결에서 글꼴을 바로 켠다 — 513KB 가 JS 와 회선을 나눈다')
  assert.equal(slow.loadCalls.length, 0, '느린 연결에서 페이지 스크립트가 오기 전에 글꼴을 받기 시작한다')
  assert.ok(slow.listeners.has('load'), '느린 연결에서 window load 뒤에 글꼴을 받는 길이 없다 — 글꼴이 영영 안 켜진다')
  slow.listeners.get('load')!()
  assert.deepEqual(slow.loadCalls, ["400 1em 'pretendard'"], 'load 뒤에 본문 글꼴을 받지 않는다')
  assert.ok(!slow.classes.has('ft-font'), '글꼴이 오기 전에 켠다 — 대체 글꼴 → 다시 대체 글꼴 → 글꼴로 두 번 바뀐다')
  await slow.resolveLoad([{}])
  assert.ok(slow.classes.has('ft-font'), '글꼴을 다 받았는데 켜지 않는다')
  assert.equal(slow.store.get('ft_font'), '1', '받은 것을 기억하지 않는다 — 다음 방문도 늦게 켠다')

  // ② 2g · slow-2g · 데이터 절약도 느린 쪽.
  for (const c of [{ effectiveType: '2g' }, { effectiveType: 'slow-2g' }, { effectiveType: '4g', saveData: true }]) {
    const r = runFontScript(script, { connection: c })
    assert.ok(!r.classes.has('ft-font') && r.listeners.has('load'), `${JSON.stringify(c)}: 느린 연결로 보지 않는다`)
  }
  // ③ 받다가 실패해도 켠다(글꼴 없이 대체 글꼴로 남지 않게 — CSS 가 다시 받는다).
  const fail = runFontScript(script, { connection: { effectiveType: '3g' } })
  fail.listeners.get('load')!()
  await fail.rejectLoad()
  assert.ok(fail.classes.has('ft-font'), '느린 연결에서 글꼴 받기가 실패하면 영영 안 켜진다')

  // ④ 빠른 연결 · API 없음(아이폰) · 받은 적 있음 · 저장소 막힘 · document.fonts 없음 — 바로 켠다(예전과 같다).
  for (const [name, o] of [
    ['4g', { connection: { effectiveType: '4g' } }],
    ['연결 API 없음(아이폰 사파리)', { connection: null }],
    ['받은 적 있음 + 3g', { connection: { effectiveType: '3g' }, seen: true }],
    ['저장소 막힘 + 4g', { connection: { effectiveType: '4g' }, storageThrows: true }],
    ['document.fonts 없음 + 3g', { connection: { effectiveType: '3g' }, noFonts: true }],
  ] as const) {
    const r = runFontScript(script, o)
    assert.ok(r.classes.has('ft-font'), `${name}: 바로 켜지 않는다 — 글꼴이 늦게 나온다`)
  }
  // ⑤ 바로 켠 경우에도 다 받으면 기억(글꼴 면이 실제로 맞았을 때만 — 빈 결과는 기억하지 않는다).
  const fast = runFontScript(script, { connection: { effectiveType: '4g' } })
  assert.deepEqual(fast.loadCalls, ["400 1em 'pretendard'"])
  await fast.resolveLoad([])
  assert.equal(fast.store.get('ft_font'), undefined, '맞는 글꼴 면이 없는데(빈 결과) 받은 것으로 기억한다')
})

// ─────────────────────────────────────────────────────────────────────────────
// 규칙232 — 대체 글꼴의 글자 폭·세로 지표를 본문 글꼴 파일에 맞춘다(글꼴이 와도 줄이 안 바뀐다)
// ─────────────────────────────────────────────────────────────────────────────

test('규칙232: 대체 글꼴(라틴 Arial · 한글 1em 기기 글꼴)의 크기·세로 지표가 본문 글꼴 파일에서 잰 값과 맞다', () => {
  /**
   * # 왜 (2026-10-14 점검 — /login 360폭에서 글꼴이 오는 순간 입력 칸·카카오 버튼이 28px 밀림)
   * Next 의 자동 대체 글꼴(adjustFontFallback)은 라틴(Arial)만 맞춘다. 한글은 기기 글꼴(맑은 고딕·Noto Sans CJK KR — 한 글자 1em)로
   * 그려져 Pretendard(0.8643em)보다 16% 넓다 → 줄이 바뀌고, 글꼴이 오는 순간 아래가 전부 밀렸다. 이제 대체 글꼴을 globals.css
   * 에서 직접 정의한다: 한글은 1em 글꼴만 골라 Pretendard 폭으로 줄이고, 세로 지표를 Pretendard 로 덮는다. 값은 글꼴 파일에서
   * 잰 것과 같아야 한다 — 글꼴 파일을 바꾸면 이 시험이 빨개진다(그때 값을 다시 잰다).
   */
  const block = pretendardBlock()
  assert.match(block, /adjustFontFallback:\s*false/, 'Next 자동 대체 글꼴(라틴만)을 아직 쓴다')
  assert.match(block, /fallback:\s*\["ft-sans-latin-fallback",\s*"ft-sans-ko-fallback"\]/, '본문 글꼴 뒤에 맞춘 대체 글꼴(라틴·한글)이 없다')

  const f = readWoff2(readFileSync(join(ROOT, 'app', 'fonts', 'PretendardVariable-ksx.woff2')))
  // 한글 폭은 굵기와 무관하게 같다(가변 축이 한글 폭을 바꾸지 않는다 — fontTools 로 400~900 확인). 표본 몇 글자가 같은지 본다.
  const ko = ['가', '힝', '쿠', '필', '분', '자'].map((ch) => f.advance(ch.codePointAt(0)!))
  assert.ok(ko.every((a) => a !== null && a === ko[0]), `본문 글꼴 한글 폭이 글자마다 다르다(${ko}) — 대체 글꼴 하나로 맞출 수 없다`)
  const koSize = ko[0]! / f.upm
  // Next 와 같은 식(라틴): 'aaabcdeeeefghiijklmnnoopqrrssttuvwxyz      ' 평균 폭 ÷ Arial 평균 폭(934.5116279069767/2048).
  const sample = 'aaabcdeeeefghiijklmnnoopqrrssttuvwxyz      '
  const avg = [...sample].reduce((s, ch) => s + (f.advance(ch.codePointAt(0)!) ?? NaN), 0) / sample.length
  const latinSize = avg / f.upm / (934.5116279069767 / 2048)

  const css = stripComments(read('app', 'globals.css'))
  const latin = fontFaces(css, 'ft-sans-latin-fallback')
  assert.equal(latin.length, 1, '라틴 대체 글꼴(@font-face ft-sans-latin-fallback)이 하나가 아니다')
  assert.match(latin[0]!, /src:\s*local\("Arial"\);/, '라틴 대체 글꼴이 Arial 이 아니다(평균 폭 비가 Arial 기준)')
  const near = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 0.0002, `${what}: CSS ${(a * 100).toFixed(2)}% ≠ 글꼴 파일 ${(b * 100).toFixed(2)}%`)
  near(pct(latin[0]!, 'size-adjust'), latinSize, '라틴 size-adjust')
  near(pct(latin[0]!, 'ascent-override'), Math.abs(f.ascent) / (f.upm * latinSize), '라틴 ascent-override')
  near(pct(latin[0]!, 'descent-override'), Math.abs(f.descent) / (f.upm * latinSize), '라틴 descent-override')

  const kos = fontFaces(css, 'ft-sans-ko-fallback')
  assert.equal(kos.length, 2, '한글 대체 글꼴은 보통·굵게 두 면이어야 한다(굵은 면이 없으면 가짜 굵게로 폭이 바뀔 수 있다)')
  for (const k of kos) {
    // 1em 한글 글꼴만 — 폭이 다른 글꼴(애플 SD 산돌고딕 Neo · Noto Sans KR 0.92em)을 같은 비율로 줄이면 오히려 줄이 바뀐다.
    const srcs = [...k.matchAll(/local\("([^"]+)"\)/g)].map((m) => m[1]!)
    assert.ok(srcs.length > 0, '한글 대체 글꼴에 local() 원본이 없다')
    for (const s of srcs) assert.ok(/^(Malgun ?Gothic|Noto ?Sans ?CJK ?KR|NotoSansCJKkr)/.test(s), `한글 대체 글꼴에 폭을 확인하지 않은 글꼴(${s})이 있다`)
    assert.match(k, /unicode-range:\s*U\+1100-11FF,\s*U\+3130-318F,\s*U\+A960-A97F,\s*U\+AC00-D7A3,\s*U\+D7B0-D7FF;/, '한글 대체 글꼴이 한글 범위에만 걸려 있지 않다(라틴·공백까지 줄어든다)')
    near(pct(k, 'size-adjust'), koSize / 1.0, '한글 size-adjust(1em 글꼴 → Pretendard 한글 폭)')
    near(pct(k, 'ascent-override'), Math.abs(f.ascent) / (f.upm * koSize), '한글 ascent-override')
    near(pct(k, 'descent-override'), Math.abs(f.descent) / (f.upm * koSize), '한글 descent-override')
    assert.match(k, /line-gap-override:\s*0%;/, '한글 line-gap-override 가 0 이 아니다(Pretendard 는 0)')
  }
  const weights = kos.map((k) => /font-weight:\s*(\d+)\s+(\d+);/.exec(k)?.slice(1).map(Number))
  assert.deepEqual(weights, [[100, 550], [551, 1000]], '한글 대체 글꼴 굵기 범위가 보통(100~550)·굵게(551~1000)가 아니다')
  assert.equal(f.lineGap, 0)
})

// ─────────────────────────────────────────────────────────────────────────────
// 규칙233 — 쿠키 안내는 작은 폰에서도 낮고, 높이가 글꼴과 무관하다(문구·선택지·기본값 그대로)
// ─────────────────────────────────────────────────────────────────────────────

test('규칙233: 쿠키 안내 띠 — 문구는 줄마다 한 줄(줄 높이 고정) · 단추 한 줄(높이·너비 고정) · 문구·선택지·거부 기본값 그대로', () => {
  /**
   * # 왜 (2026-10-14 점검 — 360×640 측정)
   * 첫 그림 뒤 6초쯤 화면 아래에 높이 279px(작은 폰 화면의 40%)로 떠, 로그인·가입 화면의 LCP 가 이 안내 문단이 됐다(6~7초).
   * 본문 글꼴이 오는 순간 문단 줄 수가 바뀌어 높이가 279→257 로 줄면서 띠 전체가 움직여 CLS 의 첫 원인이었다(0.10~0.18).
   * 이제 문구를 세 줄(줄마다 한 블록 · 줄 높이 20px 고정)로, 단추를 한 줄(높이 44 · 너비 고정)로 — 높이가 글꼴과 무관하다.
   * 문구·개인정보처리방침 링크·선택지(필수만 = 분석·광고 거부, 세부 설정의 선택 항목은 꺼진 채 시작)는 그대로다.
   */
  const src = code('components', 'CookieConsent.tsx')
  const f = src.replace(/\s+/g, ' ')
  // 문구 그대로 — 세 줄.
  assert.match(f, /lineHeight: '20px'/, '안내 문구 줄 높이가 고정(20px)이 아니다 — 글꼴에 따라 높이가 바뀐다')
  assert.match(f, /<div> <h2 id="cookie-consent-title"[^>]*display: 'inline'[^>]*> 쿠키를 써요\. <\/h2>\{' '\} 꼭 필요한 쿠키는 늘 쓰고, <\/div>/, '첫 줄(쿠키를 써요. 꼭 필요한 쿠키는 늘 쓰고,)이 한 블록이 아니다')
  assert.match(f, /<div>분석·광고 쿠키는 동의하셔야만 써요\.<\/div>/, '둘째 줄(분석·광고 쿠키는 동의하셔야만 써요.)이 한 블록이 아니다')
  assert.match(f, /<div> 자세한 내용은\{' '\} <Link href="\/legal\/privacy" target="_blank"[^>]*> 개인정보처리방침 <\/Link> 에 있어요\. <\/div>/, '셋째 줄(개인정보처리방침 링크)이 한 블록이 아니다')
  assert.ok(!/lineHeight: 1\.6/.test(f), '옛 문단(줄 높이 1.6 · 자유 줄바꿈)이 남아 있다')
  assert.match(f, /max-\[339px\]:text-\[13px\]/, '폭 320 폰에서 셋째 줄이 한 줄에 안 들어간다(13px 로 줄이지 않는다)')
  // 각 줄이 대체 글꼴(한글 1em — 맞춤 대체 글꼴이 없는 기기)에서도 한 줄에 들어간다: 폭 360 은 14px · 폭 320 은 13px.
  const lines = ['쿠키를 써요. 꼭 필요한 쿠키는 늘 쓰고,', '분석·광고 쿠키는 동의하셔야만 써요.', '자세한 내용은 개인정보처리방침에 있어요.']
  const widthEm = (s: string) => [...s].reduce((w, ch) => w + (/[가-힣]/.test(ch) ? 1 : ch === ' ' ? 0.35 : 0.6), 0)
  for (const l of lines) {
    // 카드 안쪽 폭 = 화면 - 바깥 여백 24 - 테두리 4 - 안쪽 여백 28.
    assert.ok(widthEm(l) * 14 <= 360 - 56, `"${l}" 이 폭 360 폰에서 한 줄을 넘는다(${Math.round(widthEm(l) * 14)}px)`)
    assert.ok(widthEm(l) * 13 <= 320 - 56, `"${l}" 이 폭 320 폰에서 한 줄을 넘는다(${Math.round(widthEm(l) * 13)}px)`)
  }
  // 단추 한 줄 — 높이 44. '세부 설정'은 너비 고정, 필수만·모두 허용은 남은 폭을 같은 너비로(글꼴과 무관 · 거부를 작게 만들지 않는다).
  assert.match(f, /style=\{\{ width: 84, height: 44, flexShrink: 0,[^}]*\}\} > 세부 설정 /, "'세부 설정' 단추의 너비·높이가 고정이 아니다 — 글꼴이 바뀌면 옆 단추가 움직인다")
  const choice = (label: string) => new RegExp(`className="text-\\[15px\\] max-\\[339px\\]:text-\\[14px\\]" style=\\{\\{ flex: '1 1 0', minWidth: 0, height: 44,[^}]*\\}\\} > ${label} <\\/button>`)
  assert.match(f, choice('필수만'), "'필수만'(거부) 단추가 허용과 같은 너비(flex 1 1 0)·높이 44 가 아니다")
  assert.match(f, choice("\\{expanded \\? '고른 것 저장' : '모두 허용'\\}"), "'모두 허용' 단추가 거부와 같은 너비(flex 1 1 0)·높이 44 가 아니다")
  assert.ok(!/height: 48/.test(f), '옛 48px 두 줄 단추가 남아 있다')
  // 폭 320 폰에서도 한 줄: 안쪽 폭 264 - 세부 설정 84 - 사이 16 = 164 → 단추당 82. 가장 긴 '고른 것 저장'이 1em 대체 글꼴로도
  // 들어간다(좁은 폰 14px). 폭 360 은 단추당 102 · 15px.
  assert.ok(widthEm('고른 것 저장') * 14 <= (320 - 56 - 84 - 16) / 2, "'고른 것 저장'이 폭 320 폰 단추에 안 들어간다")
  assert.ok(widthEm('고른 것 저장') * 15 <= (360 - 56 - 84 - 16) / 2, "'고른 것 저장'이 폭 360 폰 단추에 안 들어간다")
  assert.ok(widthEm('세부 설정') * 14 + 18 <= 84, "'세부 설정'(14px + 화살표)이 고정 너비 84 에 안 들어간다")
  // 선택지·기본값·저장 동작 그대로.
  assert.match(f, /onClick=\{\(\) => save\(false, false\)\}/, "'필수만'이 분석·광고 거부(save(false,false))가 아니다")
  assert.match(f, /onClick=\{\(\) => \(expanded \? save\(analytics, marketing\) : save\(true, true\)\)\}/, "'모두 허용'/'고른 것 저장' 동작이 바뀌었다")
  assert.match(f, /const \[analytics, setAnalytics\] = useState\(false\)/, '분석 쿠키 선택이 꺼진 채 시작하지 않는다')
  assert.match(f, /const \[marketing, setMarketing\] = useState\(false\)/, '광고 쿠키 선택이 꺼진 채 시작하지 않는다')
  for (const t of ['필수 쿠키', '분석 쿠키', '광고·마케팅 쿠키', '세부 설정']) assert.ok(f.includes(t), `세부 설정 항목 '${t}'가 없다`)
  assert.match(f, /role="region" aria-labelledby="cookie-consent-title"/, '안내 띠의 이름표(region · 제목)가 없다')
  // 앱·링크 모음·토큰 화면에선 여전히 안 뜬다.
  assert.match(f, /if \(pathname === '\/link'\) return null/)
  assert.match(f, /if \(isApp\) return null/)
})

// ─────────────────────────────────────────────────────────────────────────────
// 규칙234 — 앱 첫 화면 ↔ 로그인은 서로 쌓지 않는다(하드웨어 '뒤로' 왕복 방지) · 웹은 그대로
// ─────────────────────────────────────────────────────────────────────────────

test("규칙234: 앱 첫 화면의 '로그인'과 로그인 화면의 '무료 맞춤 분석 시작하기'는 replace — 웹 로그인 판은 그대로", () => {
  /**
   * # 왜 (2026-10-14 점검)
   * 앱 첫 화면(/start 첫 질문)의 '이미 계정이 있어요 · 로그인'과 로그인 화면의 '무료 맞춤 분석 시작하기'가 서로를 새 화면으로
   * 쌓아(push), 하드웨어 '뒤로'(NativeShellBridge — 뒤로 갈 곳이 있으면 router.back)가 두 화면을 번갈아 보여 줬다.
   * 둘 다 윗줄 '←' 없는 뿌리 화면(계층형 '위로'의 맨 위)이라 서로 오갈 때는 바꿔 끼운다(replace) — 뿌리에서 '뒤로'는 앱 닫기.
   */
  const first = code('app', 'start', 'first', 'FirstScreenFlow.tsx').replace(/\s+/g, ' ')
  assert.match(first, /<Link href="\/login" replace className="s-tlink"[^>]*> 이미 계정이 있어요 · 로그인 <\/Link>/, "첫 화면의 '로그인'이 화면을 쌓는다(push)")
  // 이 첫 화면은 앱에서만 그린다(웹 /start 는 행사 링크 설문) — 웹 동작은 그대로다.
  const start = flat('app', 'start', 'page.tsx')
  assert.match(start, /if \(isApp\) return \( <Suspense fallback=\{null\}> <FirstScreenFlow \/> <\/Suspense> \)/, '새 첫 화면이 앱에서만 그려지지 않는다')

  const login = code('app', '(auth)', 'login', 'page.tsx')
  const split = login.indexOf('const signupHref')
  assert.ok(split > 0, '로그인 웹 판 시작을 못 찾았다 — 검사가 망가졌다')
  const app = login.slice(0, split).replace(/\s+/g, ' ')
  const web = login.slice(split).replace(/\s+/g, ' ')
  assert.match(app, /if \(appLook\) \{/, '로그인 앱 판 분기를 못 찾았다')
  assert.match(app, /<AuthOutlineLink href="\/start" replace> 무료 맞춤 분석 시작하기 <\/AuthOutlineLink>/, "로그인 화면(앱)의 '무료 맞춤 분석 시작하기'가 화면을 쌓는다(push)")
  assert.ok(!/replace/.test(web.replace(/router\.replace/g, '')), '로그인 웹 판에 replace 가 들어갔다 — 웹 동작은 그대로여야 한다')
  assert.match(web, /<Link href=\{signupHref\}/, '로그인 웹 판의 가입 링크가 바뀌었다')

  const parts = code('components', 'v3', 'auth', 'AuthAppParts.tsx').replace(/\s+/g, ' ')
  assert.match(parts, /export function AuthOutlineLink\(\{ href, children, style, replace \}: \{ href: string; children: ReactNode; style\?: CSSProperties; replace\?: boolean \}\) \{ return \( <Link href=\{href\} replace=\{replace\}/, 'AuthOutlineLink 가 replace 를 Link 에 넘기지 않는다')
  // 하드웨어 '뒤로'는 그대로 — 갈 곳이 있으면 router.back, 없으면 앱 닫기.
  const bridge = code('components', 'NativeShellBridge.tsx').replace(/\s+/g, ' ')
  assert.match(bridge, /if \(canGoBack\) \{ router\.back\(\) return \} void App\.exitApp\(\)/, '하드웨어 뒤로 동작이 바뀌었다')
})

// ─────────────────────────────────────────────────────────────────────────────
// 규칙235 — 앱 안에서 열린 링크 모음(/link)은 앱 모양 안내 + 브라우저로(안드로이드 14 이하)
// ─────────────────────────────────────────────────────────────────────────────

test("규칙235: 앱 안에서 /link 가 열리면 웹 화면 대신 '링크 모음은 웹에서 열려요' + 브라우저로 열기 + 앱 홈으로", async () => {
  /**
   * # 왜 (2026-10-14 점검)
   * 안드로이드 14 이하는 매니페스트의 앱 링크 제외(15 부터 — 규칙204)를 읽지 않아, 앱이 깔린 폰에서 인스타 프로필 링크(/link)를
   * 누르면 앱이 열리고 웹 화면이 그대로 떴다 — 앱 안에서 '앱에서 맞춤 정기배송'(/app — 규칙165) 버튼까지. 가게(규칙205)처럼
   * 앱 모양 안내를 띄우고 같은 방식(lib/external-browser — 크롬 intent · 빌드 번호 문지기 / target="_blank")으로 브라우저에 넘긴다.
   * 아이폰은 AASA 가 /link 를 이미 뺀다(규칙175).
   */
  assert.ok(existsSync(join(ROOT, 'app', 'link', 'layout.tsx')), '링크 모음에 앱 문맥 갈래(app/link/layout.tsx)가 없다 — 앱 안에서 웹 화면이 그대로 뜬다')
  const layout = code('app', 'link', 'layout.tsx')
  assert.match(layout, /if \(await isAppContextServer\(\)\) return <LinkInAppNotice \/>/, '앱에서 링크 모음 주소가 안내 화면이 아니다')
  assert.ok(!/redirect\(/.test(layout), '링크 모음 틀이 앱 손님을 다른 곳으로 튕긴다')
  const notice = code('app', 'link', 'LinkInAppNotice.tsx')
  assert.ok(notice.includes('링크 모음은 웹에서 열려요'), "안내 제목이 '링크 모음은 웹에서 열려요'가 아니다")
  assert.match(notice, /<AuthAppMain>/, '링크 모음 안내가 앱 모양(AuthAppMain)이 아니다')
  assert.ok(!/@\/components\/store\/|store\.css|link\.module\.css/.test(notice), '링크 모음 안내(앱)가 웹 화면 부품을 쓴다 — 웹 화면이 앱에 보인다')
  assert.match(notice, /<AuthPrimaryAnchor href=\{LINK_WEB_URL\} target="_blank"/, '브라우저로 여는 링크가 target="_blank" 가 아니다(아이폰 앱에서 사파리로 못 나간다)')
  assert.match(notice, /androidChromeIntentUrl\(url\)/, '안드로이드가 크롬 intent 로 넘기지 않는다(WebView 는 _blank 를 같은 화면에서 연다)')
  assert.match(notice, /buildAtLeast\(info\.build, NATIVE_FEATURE_MIN_BUILD\.androidIntentLinks\)/, '옛 안드로이드 빌드(intent 처리 없음)에서 오류 화면이 뜬다 — 빌드 번호를 안 본다')
  // 2026-10-19 — 서포터즈 링크(/link/코드)는 그 주소 그대로 넘긴다(규칙303).
  assert.match(notice, /const url = linkWebUrl\(window\.location\.search, window\.location\.pathname\)/, '브라우저로 넘기는 주소가 링크 모음 정본(linkWebUrl)이 아니다')
  assert.match(notice.replace(/\s+/g, ' '), /<AuthOutlineLink href="\/dashboard"[^>]*> 앱 홈으로 <\/AuthOutlineLink>/, "'앱 홈으로'가 없다")
  assert.ok(!/['"`]\/app[?'"`]/.test(notice), '링크 모음 안내가 앱 소개(/app)로 보낸다 — 앱 안에서 앱을 받으라는 화면')
  for (const w of ['처방', '언제든']) assert.ok(!notice.includes(w), `링크 모음 안내에 금지어 '${w}'`)

  // 링크로 앱이 처음 열려도 첫 실행 관문이 안내를 새 첫 화면으로 덮지 않는다(가게와 같은 자리, 옮기기 전에).
  const gate = code('components', 'OnboardingGate.tsx')
  const linkSkip = gate.indexOf("if (pathname === '/link') return")
  assert.ok(linkSkip > 0 && linkSkip < gate.indexOf("router.replace('/start')"), '링크 모음으로 앱을 처음 연 손님을 첫 실행 관문이 새 첫 화면으로 보낸다')
  // 아이폰 AASA 는 /link 를 이미 앱으로 열지 않는다(규칙175) — 안내는 안드로이드 14 이하·설치형용이다.
  const aasa = code('app', '.well-known', 'apple-app-site-association', 'route.ts')
  assert.ok(aasa.includes("{ '/': '/link', exclude: true }"), 'AASA 가 /link 를 뺀 줄이 없어졌다(규칙175)')

  const eb = await load<{ LINK_WEB_URL: string; linkWebUrl: (s?: string) => string; androidChromeIntentUrl: (u: string) => string | null; storeWebUrl: (p: string, s?: string) => string }>('lib', 'external-browser.ts')
  assert.equal(eb.LINK_WEB_URL, 'https://www.farmerstail.kr/link')
  assert.equal(eb.linkWebUrl(), 'https://www.farmerstail.kr/link')
  assert.equal(eb.linkWebUrl('?utm_source=instagram&utm_medium=bio'), 'https://www.farmerstail.kr/link?utm_source=instagram&utm_medium=bio')
  assert.equal(eb.linkWebUrl('?a=1#frag'), 'https://www.farmerstail.kr/link', '# 이 섞인 검색어를 붙였다')
  assert.equal(eb.linkWebUrl('nope'), 'https://www.farmerstail.kr/link', '? 로 시작하지 않는 검색어를 붙였다')
  assert.equal(
    eb.androidChromeIntentUrl('https://www.farmerstail.kr/link?utm_source=instagram'),
    'intent://www.farmerstail.kr/link?utm_source=instagram#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.android.chrome;end',
  )
  for (const bad of ['https://www.farmerstail.kr/link/x', 'https://www.farmerstail.kr/links', 'https://www.farmerstail.kr/linkx', 'https://evil.com/link', 'http://www.farmerstail.kr/link', 'https://user@www.farmerstail.kr/link']) {
    assert.equal(eb.androidChromeIntentUrl(bad), null, `${bad}: intent 를 만들었다`)
  }
  // 가게 쪽(규칙205)은 그대로.
  assert.equal(eb.storeWebUrl('/store/chicken', '?from=insta'), 'https://www.farmerstail.kr/store/chicken?from=insta')
  assert.ok(eb.androidChromeIntentUrl('https://www.farmerstail.kr/store')?.includes(';package=com.android.chrome;'))
})
