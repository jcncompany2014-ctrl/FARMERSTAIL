/**
 * 감사 규칙 200~205 — 앱 동선·웹·앱 설정 묶음(2026-10-13, 가지 fix/1013-appflow).
 *
 * 규칙은 문서가 아니라 테스트로 박는다(같은 날 또 어기지 않게). 각 규칙은 고치기 전 코드(df28b40a)에서 빨간불,
 * 지금 코드에서 초록불인지 카나리아로 확인했다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { OFFLINE_RETRY_ATTR, OFFLINE_RETRY_SCRIPT } from './offline-retry.ts'
import { APP_ZOOM_LOCK, withAppZoomLock } from './app-viewport.ts'
import { ANDROID_CHROME_PACKAGE, STORE_WEB_HOME, androidChromeIntentUrl, storeWebUrl } from './external-browser.ts'

const ROOT = process.cwd()

function read(...segs: string[]): string {
  return readFileSync(join(ROOT, ...segs), 'utf8').replace(/\r\n/g, '\n')
}

/** 주석을 걷어 낸 소스 — 주석 속 옛 코드가 검사를 속이지 않게(lib/audit-rules.test.ts 의 stripComments 와 같은 규칙). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
}

// ─────────────────────────────────────────────────────────────────────────────
// 규칙200 — 오프라인 '다시 시도하기'는 스크립트 묶음 없이도 동작한다
// ─────────────────────────────────────────────────────────────────────────────

type FakeAnchor = { href: string; setAttribute: (n: string, v: string) => void }

function runOfflineScript(pathname: string, search = '') {
  const anchors: FakeAnchor[] = [0, 1].map(() => ({
    href: '/',
    setAttribute(n: string, v: string) {
      if (n === 'href') this.href = v
    },
  }))
  const selectors: string[] = []
  const handlers: Record<string, () => void> = {}
  const replaced: string[] = []
  runInNewContext(OFFLINE_RETRY_SCRIPT, {
    location: { pathname, search, replace: (u: string) => replaced.push(u) },
    document: {
      querySelectorAll: (sel: string) => {
        selectors.push(sel)
        return anchors
      },
    },
    window: { addEventListener: (type: string, fn: () => void) => (handlers[type] = fn) },
  })
  return { anchors, selectors, handlers, replaced }
}

test('규칙200: 오프라인 화면의 다시 시도하기 = 일반 링크(앱·웹 둘 다) + 인라인 스크립트 — 하이드레이션이 안 돼도 동작한다', () => {
  /**
   * # 왜 (2026-10-12 안드로이드 에뮬레이터 재현)
   * 서비스 워커는 /offline HTML 만 담고 스크립트 묶음(_next/static)은 담지 않는다(audit #94). 오프라인에서 이 화면이 뜨면
   * 하이드레이션이 안 되고, onClick(reload) 버튼엔 처리기가 붙지 않아 눌러도 아무 일이 없었다.
   */
  const page = stripComments(read('app', 'offline', 'page.tsx'))
  assert.ok(!/onClick/.test(page), '오프라인 화면에 onClick 이 남아 있다 — 오프라인에선 스크립트가 안 와 먹통이다')
  assert.ok(!/location\.reload/.test(page), '오프라인 화면이 아직 reload() 처리기에 기대고 있다')
  assert.ok(!/<button/.test(page) && !/AuthPrimaryButton/.test(page), '오프라인 화면의 다시 시도하기가 아직 버튼이다(링크여야 한다)')
  // 앱 갈래·웹 갈래 각각 일반 링크(href="/" + 표식).
  const appAt = page.indexOf('if (appLook)')
  assert.ok(appAt > 0, '오프라인 화면의 앱 갈래를 못 찾았다')
  const appPart = page.slice(appAt, page.indexOf('</AuthAppMain>', appAt))
  const webPart = page.slice(page.indexOf('</AuthAppMain>', appAt))
  assert.match(appPart, /<AuthPrimaryAnchor href="\/" data-ft-retry="">/, '앱 갈래의 다시 시도하기가 일반 링크(href="/" data-ft-retry)가 아니다')
  assert.match(webPart, /<a\s+href="\/"\s+data-ft-retry=""/, '웹 갈래의 다시 시도하기가 일반 링크(href="/" data-ft-retry)가 아니다')
  // 앱 주 버튼 모양 링크는 next/link 가 아니라 <a> 여야 한다(하이드레이션 뒤 앱 안 이동으로 바뀌지 않게).
  const parts = stripComments(read('components', 'v3', 'auth', 'AuthAppParts.tsx'))
  assert.match(parts, /export function AuthPrimaryAnchor\([^)]*\)\s*\{\s*return \(\s*<a \{\.\.\.rest\}/, 'AuthPrimaryAnchor 가 일반 <a> 가 아니다')
  // 표식 이름이 화면과 스크립트에서 같다.
  assert.equal(OFFLINE_RETRY_ATTR, 'data-ft-retry')
  // 인라인 스크립트는 틀(layout)이 화면(children) **뒤**에 싣는다 — 링크가 먼저 있어야 찾는다.
  const layout = stripComments(read('app', 'offline', 'layout.tsx'))
  const childrenAt = layout.indexOf('{children}')
  const scriptAt = layout.indexOf('<script dangerouslySetInnerHTML={{ __html: OFFLINE_RETRY_SCRIPT }} />')
  assert.ok(childrenAt > 0 && scriptAt > childrenAt, '오프라인 틀이 다시 시도 스크립트를 화면 뒤에 싣지 않는다')
})

test('규칙200(단위): 다시 시도 스크립트 — 링크를 지금 주소로, 인터넷이 돌아오면 그 주소로 다시 불러온다', () => {
  // 서비스 워커가 원래 가려던 주소에 오프라인 화면을 대신 보여 준 경우 → 그 주소를 다시.
  const a = runOfflineScript('/dogs/abc', '?tab=diary')
  assert.deepEqual(a.selectors, [`a[${OFFLINE_RETRY_ATTR}]`])
  assert.deepEqual(a.anchors.map((x) => x.href), ['/dogs/abc?tab=diary', '/dogs/abc?tab=diary'])
  assert.equal(typeof a.handlers.online, 'function', "'online' 처리기가 없다")
  a.handlers.online?.()
  assert.deepEqual(a.replaced, ['/dogs/abc?tab=diary'])
  // 주소가 /offline 그 자체면(미리 담은 화면을 직접 연 경우) 홈으로 — 같은 화면을 다시 부르지 않는다.
  const b = runOfflineScript('/offline')
  assert.deepEqual(b.anchors.map((x) => x.href), ['/', '/'])
  b.handlers.online?.()
  assert.deepEqual(b.replaced, ['/'])
  // 스크립트가 터져도 화면은 그대로(링크 href="/" 가 남는다).
  assert.doesNotThrow(() => runInNewContext(OFFLINE_RETRY_SCRIPT, { location: {}, document: null, window: {} }))
  // 옛 웹뷰에서도 돌게 ES5 — 화살표·let/const 없음.
  assert.ok(!/=>|\blet\b|\bconst\b/.test(OFFLINE_RETRY_SCRIPT), '다시 시도 스크립트에 ES5 밖 문법이 있다')
})

// ─────────────────────────────────────────────────────────────────────────────
// 규칙201 — 첫 실행 동선: 무한 왕복 없음 · 로그아웃한 앱 손님의 홈 = 새 첫 화면
// ─────────────────────────────────────────────────────────────────────────────

test('규칙201: 첫 실행 관문은 옮기기 전에 표식을 남기고 로그인한 사람은 그대로 둔다 · 앱 / 미로그인 = /start(새 첫 화면)', () => {
  /**
   * # 왜 (2026-10-12 에뮬레이터 재현)
   * ① 로그인한 채 첫 실행 표식(ft_onboarded)이 없으면 관문 → /start → 서버가 /dogs/new(규칙62) → 관문이 다시 /start …
   *    표식은 새 첫 화면이 마운트될 때만 남는데 로그인한 사람은 그 화면에 닿지 못해 끝없이 오갔다.
   * ② proxy 가 로그인 안 한 앱 손님의 / 를 옛 디자인 캐러셀(/welcome — 예시 이름 '푸린이'·영어 머리말)로 보냈다.
   */
  const gate = stripComments(read('components', 'OnboardingGate.tsx'))
  const seenAt = gate.indexOf('if (hasSeenOnboarding()) return')
  const markAt = gate.indexOf('markOnboarded()')
  const signedAt = gate.indexOf('if (signedInHint()) return')
  const goAt = gate.indexOf("router.replace('/start')")
  assert.ok(seenAt > 0 && goAt > 0, '첫 실행 관문의 판정·이동을 못 찾았다 — 검사가 망가졌다')
  assert.ok(markAt > seenAt && markAt < goAt, '첫 실행 관문이 /start 로 옮기기 전에 표식(markOnboarded)을 남기지 않는다 — 로그인 사용자가 /start ↔ /dogs/new 를 끝없이 오간다')
  assert.ok(signedAt > markAt && signedAt < goAt, '첫 실행 관문이 로그인한 사람도 /start 로 보낸다(서버가 /dogs/new 로 돌려보낸다)')
  assert.match(gate, /hasSupabaseSessionCookie\(/, '로그인 판정이 세션 쿠키 정본(lib/auth/session-cookie)을 안 쓴다 — 조각 쿠키(.0/.1)를 놓친다')
  // 관문은 /start 에선 비켜선다(같은 곳으로 계속 이동 방지 — 규칙170 과 같은 조건).
  assert.ok(gate.includes("if (pathname.startsWith('/start')) return"), '첫 실행 관문이 /start 에서도 다시 튕긴다')

  const proxy = stripComments(read('proxy.ts'))
  assert.match(proxy, /url\.pathname = hasSession \? '\/dashboard' : '\/start'/, "앱에서 로그인 안 한 손님의 / 가 새 첫 화면(/start)이 아니다")
  assert.ok(!/:\s*'\/welcome'/.test(proxy), 'proxy 가 아직 앱 손님을 옛 캐러셀(/welcome)로 보낸다')
  // /welcome 화면은 스토어 사진용으로 남긴다(지우지 않는다).
  assert.ok(existsSync(join(ROOT, 'app', 'welcome', 'page.tsx')), '/welcome 화면이 없어졌다 — 스토어 사진용으로 남기기로 했다')
  // 앱 /start(로그인 안 함) = 새 첫 화면.
  const start = stripComments(read('app', 'start', 'page.tsx'))
  assert.match(start, /if \(isApp\)\s*return \(\s*<Suspense fallback=\{null\}>\s*<FirstScreenFlow \/>/, '앱 /start 가 새 첫 화면(FirstScreenFlow)을 그리지 않는다')
})

// ─────────────────────────────────────────────────────────────────────────────
// 규칙202 — 첫 박스 체크인(몰입 화면)에 나가는 길
// ─────────────────────────────────────────────────────────────────────────────

test("규칙202: 첫 박스 체크인 화면엔 '나중에 할게요'(계층형 위 = 이 강아지 화면)가 있다 — 윗줄·탭 없는 몰입 화면에 갇히지 않게", () => {
  /**
   * # 왜 (2026-10-12 점검)
   * /dogs/[id]/first-checkin 은 AppChrome FOCUS_PATHS(윗줄 ← · 아래 탭 없음)인데 화면엔 "그냥 닫으셔도 돼요" 글자뿐이었다.
   * 아이폰은 하드웨어 뒤로가 없고 우리 화면에선 밀어서 뒤로도 꺼 두었다(AppDelegate — 계층형 뒤로가 사장님 결정).
   */
  const src = stripComments(read('app', '(main)', 'dogs', '[id]', 'first-checkin', 'FirstCheckinClient.tsx'))
  assert.ok(!src.includes('그냥 닫으셔도'), "'그냥 닫으셔도 돼요' — 닫을 수단이 없는 화면에서 닫으라고 한다")
  const sendAt = src.indexOf("'의견 보내기'")
  const laterAt = src.indexOf('나중에 할게요')
  assert.ok(sendAt > 0 && laterAt > sendAt, "체크인 질문 화면(의견 보내기 아래)에 '나중에 할게요'가 없다")
  const linkStart = src.lastIndexOf('<Link', laterAt)
  const link = src.slice(linkStart, laterAt)
  assert.ok(linkStart > sendAt, "'나중에 할게요'가 링크(<Link>)가 아니다")
  assert.match(link, /href=\{`\/dogs\/\$\{dogId\}`\}/, "'나중에 할게요'가 계층형 위(이 강아지 화면 /dogs/[id])로 가지 않는다")
  assert.match(link, /\breplace\b/, "'나중에 할게요'가 닫은 체크인을 뒤로가기 기록에 남긴다(replace 여야 한다)")
  // 몰입 화면 목록에 그대로 있다(윗줄 ← 가 없는 게 사실이어야 이 버튼이 필요하다).
  const chrome = stripComments(read('components', 'AppChrome.tsx'))
  assert.match(chrome, /const FOCUS_PATHS = \[[^\]]*'\/first-checkin'/, '첫 박스 체크인이 몰입 화면 목록에서 빠졌다 — 이 규칙의 전제를 다시 볼 것')
})

// ─────────────────────────────────────────────────────────────────────────────
// 규칙203 — 확대: 웹은 허용, 앱만 잠금
// ─────────────────────────────────────────────────────────────────────────────

test('규칙203: 확대 잠금은 앱에서만 — 루트는 요청의 앱 문맥(쿠키·UA)을 보고 앱일 때만 잠그고, 웹은 확대 허용', () => {
  /**
   * # 왜 (2026-10-13 사장님 결정 "웹만 풀기")
   * 7/12 "앱 전체 확대 축소 절대 안되게"를 루트 viewport(정적 값)에 박아 웹(가게·매거진)까지 잠겼다(WCAG 1.4.4).
   * 이제 루트 generateViewport 가 앱 문맥 정본(isAppContextServer — ft_app 쿠키 · UA 표식)으로 앱일 때만 잠근다.
   * (요청 정보를 읽어도 잃는 캐시가 없다 — 2026-10-13 프로덕션 빌드 경로표가 이미 전부 동적 ƒ. lib/app-viewport 머리말.)
   */
  const layout = stripComments(read('app', 'layout.tsx'))
  assert.ok(!/export const viewport\b/.test(layout), '루트가 아직 정적 viewport 다 — 앱/웹을 가르지 못한다')
  assert.match(
    layout,
    /export async function generateViewport\(\): Promise<Viewport> \{\s*return withAppZoomLock\(BASE_VIEWPORT, await isAppContextServer\(\)\);?\s*\}/,
    '루트 viewport 가 앱 문맥 정본(isAppContextServer)으로 확대 잠금을 가르지 않는다',
  )
  const baseStart = layout.indexOf('const BASE_VIEWPORT')
  const baseEnd = layout.indexOf('};', baseStart)
  assert.ok(baseStart > 0 && baseEnd > baseStart, '루트 기본 viewport(BASE_VIEWPORT)를 못 찾았다 — 검사가 망가졌다')
  assert.ok(!/maximumScale|userScalable/.test(layout.slice(baseStart, baseEnd)), '루트 기본 viewport 가 확대를 막는다 — 웹 손님도 글자를 못 키운다')
  // 앱 전용 묶음(main)은 판정과 무관하게 잠근다(정의상 앱).
  const main = stripComments(read('app', '(main)', 'layout.tsx'))
  const mainVp = main.slice(main.indexOf('export const viewport'), main.indexOf('export default'))
  assert.match(mainVp, /maximumScale:\s*1/, '앱 전용 묶음(main)의 viewport 가 확대를 막지 않는다')
  assert.match(mainVp, /userScalable:\s*false/, '앱 전용 묶음(main)의 viewport 가 확대를 막지 않는다')
  // cacheComponents 를 켜면 런타임 정보를 읽는 viewport 에 Suspense/instant 처리가 필요하다(문서) — 켜는 날 이 규칙을 다시 볼 것.
  assert.ok(!/cacheComponents\s*:\s*true/.test(stripComments(read('next.config.ts'))), 'cacheComponents 가 켜졌다 — 루트 generateViewport 가 요청 정보를 읽어 문서의 Suspense/instant 처리가 필요하다')
})

test('규칙203(단위): withAppZoomLock — 앱이면 확대 잠금을 더하고, 웹이면 잠금 키 자체가 없으며, 기본값은 건드리지 않는다', () => {
  const base = { themeColor: '#FFFFFF', width: 'device-width', initialScale: 1, viewportFit: 'cover' as const }
  const web = withAppZoomLock(base, false)
  assert.deepEqual(web, base)
  assert.ok(!('maximumScale' in web) && !('userScalable' in web), '웹 viewport 에 잠금 키가 있다')
  const app = withAppZoomLock(base, true)
  assert.deepEqual(app, { ...base, maximumScale: 1, userScalable: false })
  assert.deepEqual(APP_ZOOM_LOCK, { maximumScale: 1, userScalable: false })
  assert.ok(!('maximumScale' in base), '기본값 객체를 바꿨다 — 다음 요청(웹)까지 잠긴다')
  assert.notEqual(web, base, '웹 viewport 가 기본값 객체 그 자체다 — 나중에 고치면 기본값이 바뀐다')
})

// ─────────────────────────────────────────────────────────────────────────────
// 규칙204 — 앱 링크: www 하나만, 웹 전용 화면은 앱이 가져가지 않는다(다음 앱 빌드)
// ─────────────────────────────────────────────────────────────────────────────

test('규칙204: 앱 링크는 www 만 · 안드로이드 15+ 는 가게·행사·링크 모음·로그인 콜백을 앱이 가져가지 않는다(제외 먼저, 끝에 전체 허용)', () => {
  /**
   * # 왜 (2026-10-13 사장님 결정 — 다음 앱 빌드용)
   * 앱이 깔린 폰에서 가게(/store) 링크를 누르면 앱이 열리고, 앱은 가게를 그리지 않아 손님이 가게로 갈 수 없었다.
   * 아이폰은 AASA(서버)로 이미 뺐고(규칙175), 안드로이드는 매니페스트라 새 빌드가 필요하다.
   * uri-relative-filter-group 은 위에서부터 처음 맞는 묶음으로 판정하고, 어느 묶음에도 안 맞으면 거절하는 구현이 있다
   * (AOSP UriRelativeFilterGroup.matchGroupsToUri) → 끝에 전체 허용 묶음이 없으면 앱 링크가 통째로 꺼진다.
   * 묶음 밖에 <data android:path…> 를 두면 그쪽이 먼저 맞아 제외가 무시된다(IntentFilter.matchData 의 hasDataPath).
   */
  const manifest = read('android', 'app', 'src', 'main', 'AndroidManifest.xml').replace(/<!--[\s\S]*?-->/g, '')
  const filters = [...manifest.matchAll(/<intent-filter android:autoVerify="true">([\s\S]*?)<\/intent-filter>/g)].map((m) => m[1] ?? '')
  assert.equal(filters.length, 1, `앱 링크 intent-filter 가 ${filters.length}개다(1개여야 한다)`)
  const f = filters[0] ?? ''
  assert.ok(!/android:host="farmerstail\.kr"/.test(manifest), 'www 없는 주소(farmerstail.kr)를 앱이 아직 가져간다')
  assert.match(f, /<data android:scheme="https" android:host="www\.farmerstail\.kr" \/>/, '앱 링크에 www.farmerstail.kr 가 없다')
  const outside = f.replace(/<uri-relative-filter-group[\s\S]*?<\/uri-relative-filter-group>/g, '')
  assert.ok(!/android:path/.test(outside), '묶음 밖에 경로 <data> 가 있다 — 그쪽이 먼저 맞아 제외가 무시된다')
  const groups = [...f.matchAll(/<uri-relative-filter-group android:allow="(true|false)">([\s\S]*?)<\/uri-relative-filter-group>/g)].map((m) => ({
    allow: m[1] === 'true',
    data: (m[2] ?? '').trim(),
  }))
  const expectedDeny = [
    '<data android:path="/store" />',
    '<data android:pathPrefix="/store/" />',
    '<data android:pathPrefix="/p/" />',
    '<data android:path="/link" />',
    '<data android:path="/auth/callback" />',
  ]
  assert.deepEqual(
    groups.filter((g) => !g.allow).map((g) => g.data).sort(),
    [...expectedDeny].sort(),
    '앱 링크 제외 목록이 가게·행사·링크 모음·로그인 콜백과 다르다',
  )
  const last = groups[groups.length - 1]
  assert.ok(last && last.allow && last.data === '<data android:pathPrefix="/" />', '맨 끝에 전체 허용 묶음(pathPrefix "/")이 없다 — 안드로이드 15+ 에서 앱 링크가 통째로 꺼진다')
  assert.equal(groups.filter((g) => g.allow).length, 1, '허용 묶음은 맨 끝 하나뿐이어야 한다(앞에 있으면 제외보다 먼저 맞는다)')
  // 아이폰 AASA 와 같은 목록(AASA 는 /admin·/api·/.well-known 도 뺀다 — 안드로이드는 /api 링크를 앱이 서버로 넘긴다).
  const aasa = stripComments(read('app', '.well-known', 'apple-app-site-association', 'route.ts'))
  for (const p of ['/store', '/store/*', '/p/*', '/link', '/auth/callback']) {
    assert.ok(aasa.includes(`{ '/': '${p}', exclude: true }`), `AASA 가 ${p} 를 빼지 않는다 — 안드로이드와 목록이 어긋났다`)
  }
  // uri-relative-filter-group·android:allow 는 API 35 — 컴파일 SDK 가 그보다 낮으면 빌드가 깨진다.
  const vars = read('android', 'variables.gradle')
  const compileSdk = Number(/compileSdkVersion\s*=\s*(\d+)/.exec(vars)?.[1] ?? 0)
  assert.ok(compileSdk >= 35, `compileSdk ${compileSdk} — uri-relative-filter-group(API 35)을 쓸 수 없다`)

  const ent = read('ios', 'App', 'App', 'App.entitlements')
  assert.ok(!ent.includes('<string>applinks:farmerstail.kr</string>'), '아이폰 앱이 www 없는 주소를 아직 가져간다')
  assert.ok(ent.includes('<string>applinks:www.farmerstail.kr</string>'), '아이폰 앱 링크에 www.farmerstail.kr 가 없다')
})

// ─────────────────────────────────────────────────────────────────────────────
// 규칙205 — 앱 안에서 가게가 열리면 안내 + 폰 브라우저로
// ─────────────────────────────────────────────────────────────────────────────

test('규칙205: 앱에서 가게가 열리면 앱 홈으로 튕기지 않고 "가게는 웹에서 열려요" + 브라우저로 넘긴다(안드로이드 14 이하용)', () => {
  const layout = stripComments(read('app', 'store', 'layout.tsx'))
  assert.match(layout, /if \(await isAppContextServer\(\)\) return <StoreInAppNotice \/>/, '앱에서 가게 주소가 안내 화면이 아니다')
  assert.ok(!/redirect\(/.test(layout), "가게 틀이 아직 앱 손님을 앱 홈으로 튕긴다 — 가게로 갈 길이 없다")
  const notice = stripComments(read('app', 'store', 'StoreInAppNotice.tsx'))
  assert.ok(notice.includes('가게는 웹에서 열려요'), "안내 제목이 '가게는 웹에서 열려요'가 아니다")
  // 웹 가게 화면(.fts)이 앱에 보이면 안 된다 — 앱 모양 조각만.
  assert.ok(!/@\/components\/store\//.test(notice), '가게 안내(앱)가 웹 가게 부품을 쓴다 — 웹 화면이 앱에 보인다')
  assert.match(notice, /<AuthAppMain>/, '가게 안내가 앱 모양(AuthAppMain)이 아니다')
  // 아이폰·설치형 = target="_blank"(사파리·브라우저), 안드로이드 = 크롬 intent(빌드 번호로 문지기).
  assert.match(notice, /<AuthPrimaryAnchor href=\{STORE_WEB_HOME\} target="_blank"/, '브라우저로 여는 링크가 target="_blank" 가 아니다(아이폰 앱에서 사파리로 못 나간다)')
  assert.match(notice, /androidChromeIntentUrl\(url\)/, '안드로이드가 크롬 intent 로 넘기지 않는다(WebView 는 _blank 를 같은 화면에서 연다)')
  assert.match(notice, /buildAtLeast\(info\.build, NATIVE_FEATURE_MIN_BUILD\.androidIntentLinks\)/, '옛 안드로이드 빌드(intent 처리 없음)에서 오류 화면이 뜬다 — 빌드 번호를 안 본다')
  // 가게 링크로 앱이 처음 열려도 첫 실행 관문이 안내를 새 첫 화면으로 덮지 않는다.
  const gate = stripComments(read('components', 'OnboardingGate.tsx'))
  const storeSkipAt = gate.indexOf("if (pathname === '/store' || pathname.startsWith('/store/')) return")
  assert.ok(storeSkipAt > 0 && storeSkipAt < gate.indexOf("router.replace('/start')"), '가게 링크로 앱을 처음 연 손님을 첫 실행 관문이 새 첫 화면으로 보낸다 — 가게 안내를 못 본다')
  // 문지기 번호 = MainActivity 가 intent: 를 직접 여는 첫 빌드.
  const nb = read('lib', 'native-build.ts')
  assert.match(nb, /androidIntentLinks:\s*12,/, '안드로이드 intent 문지기 번호가 12(1.0.11 — MainActivity intent 처리 첫 빌드)가 아니다')
  const main = read('android', 'app', 'src', 'main', 'java', 'com', 'farmerstail', 'app', 'MainActivity.java')
  assert.match(main, /"intent"\.equalsIgnoreCase\(url\.getScheme\(\)\)/, 'MainActivity 가 intent: 링크를 직접 열지 않는다 — 안드로이드 브라우저 넘기기가 먹통')
  assert.match(main, /intent\.setComponent\(null\);\s*intent\.setSelector\(null\);/, 'MainActivity 가 웹이 만든 intent 의 컴포넌트를 지우지 않는다')
})

test('규칙205(단위): 가게 브라우저 주소 · 크롬 intent — 우리 가게 주소만, 다른 호스트·끼워 넣기는 가게 첫 화면/거절', () => {
  assert.equal(STORE_WEB_HOME, 'https://www.farmerstail.kr/store')
  assert.equal(storeWebUrl('/store'), 'https://www.farmerstail.kr/store')
  assert.equal(storeWebUrl('/store/chicken', '?from=insta'), 'https://www.farmerstail.kr/store/chicken?from=insta')
  assert.equal(storeWebUrl('/store/cart', ''), 'https://www.farmerstail.kr/store/cart')
  for (const [p, s] of [
    ['/dashboard', ''],
    ['/storefront', ''],
    ['//evil.com/store', ''],
    ['/store//evil.com', ''],
    ['/store/\\evil', ''],
    ['/store/a b', ''],
  ] as const) {
    const out = storeWebUrl(p, s)
    assert.ok(out === STORE_WEB_HOME, `${p}: 가게 첫 화면이 아니다 → ${out}`)
  }
  assert.equal(storeWebUrl('/store/x', 'nope'), 'https://www.farmerstail.kr/store/x', '? 로 시작하지 않는 검색어를 붙였다')
  assert.equal(storeWebUrl('/store/x', '?a=1#frag'), 'https://www.farmerstail.kr/store/x', '# 이 섞인 검색어를 붙였다')

  assert.equal(
    androidChromeIntentUrl('https://www.farmerstail.kr/store/chicken?from=insta'),
    `intent://www.farmerstail.kr/store/chicken?from=insta#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=${ANDROID_CHROME_PACKAGE};end`,
  )
  assert.equal(ANDROID_CHROME_PACKAGE, 'com.android.chrome')
  // 패키지가 빠지면 안드로이드 14 이하에서 우리 앱이 그 주소를 다시 받는다.
  assert.ok(androidChromeIntentUrl(STORE_WEB_HOME)?.includes(';package=com.android.chrome;'))
  for (const bad of [
    'https://evil.com/store',
    'http://www.farmerstail.kr/store',
    'https://farmerstail.kr/store',
    'https://www.farmerstail.kr/dashboard',
    'https://user@www.farmerstail.kr/store',
    'https://www.farmerstail.kr.evil.com/store',
    'not a url',
  ]) {
    assert.equal(androidChromeIntentUrl(bad), null, `${bad}: intent 를 만들었다`)
  }
})
