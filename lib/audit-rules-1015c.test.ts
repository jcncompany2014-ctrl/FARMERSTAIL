/**
 * 2026-10-15 첫 박스 체크인 다듬기(사장님 "세개 ㄱㄱ") — 규칙 282~284.
 *
 *   282 손님 체크인 알림 제목에 이모지를 넣지 않는다(체크인 화면에서 🐾 를 뺀 앱 시안 결정과 같게)
 *   283 메모 칸 예시 = 사장님이 고른 세 가지(변 상태·가려움·잘 먹어요 — 10/15 결정, 광고에 옮길 땐 따로 판단)
 *   284 '잘 안 먹어요'는 사장님 폰에 바로 — 잠금 화면이라 이름·메모 없이, 한 번만(답한 지 1시간 안 + 경보 첫 생성), 관리자 목록 정본
 *   285 흑돼지 레시피 부위 = 안심 — 화면·정본 어디에도 뒷다리살이 없다(사장님 10/15 정정, 8/25 기록은 틀림)
 *   286 가게 후기 — 질병 이름·치료 효과 문장 없음(로아 원문 '항암' → '치료 중이라', 사장님 10/15), 옮긴 방법 밝힘, 사진 실재
 *   287 앱 화면 비중 — 홈 인사 작게·추천 딱지 작게(이름 위)·둘러보기는 탭바 위까지(사장님 10/15 폰 캡처)
 *   288 가게 후기 사진 — 정사각형 파일·1:1 칸·세 장 다·토핑 사진은 밝힘(사장님 10/17 "애매하게 잘렸다")
 *
 * 고친 코드를 일부러 되돌려 빨간불을 검산했다. if 안에 단언을 넣지 않는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

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

/** 이모지(그림 문자) — 한글·영문·문장부호는 걸리지 않는다. */
const EMOJI_RE = /\p{Extended_Pictographic}/u

test('규칙282: 첫 박스 체크인 손님 알림 제목·내용에 이모지가 없다', () => {
  const src = code('app', 'api', 'cron', 'first-box-checkin', 'route.ts')
  const title = /title:\s*`([^`]*)`/.exec(src)?.[1] ?? ''
  const body = /body:\s*'([^']*)'/.exec(src)?.[1] ?? ''
  assert.match(title, /어떠신가요\?$/, '체크인 알림 제목이 바뀌었거나 찾지 못했다')
  assert.ok(body.length > 0, '체크인 알림 내용을 찾지 못했다')
  assert.ok(!EMOJI_RE.test(title), `체크인 알림 제목에 이모지가 있다: ${title}`)
  assert.ok(!EMOJI_RE.test(body), `체크인 알림 내용에 이모지가 있다: ${body}`)
})

test('규칙283: 첫 박스 체크인 메모 칸 예시 = 사장님이 고른 세 가지(10/15)', () => {
  /**
   * 사장님 결정(2026-10-15): "변 상태가 좋아졌어요 / 가려움이 줄었어요 / 너무 잘 먹어요". 손님 의견 칸이라 그대로 둔다.
   * 이 답을 나중에 광고·후기 화면에 옮길 때는 건강 효과 문장을 그대로 인용하지 않는다(사료 효능 표시 — 그때 따로 판단).
   */
  const src = code('app', '(main)', 'dogs', '[id]', 'first-checkin', 'FirstCheckinClient.tsx')
  const placeholder = /placeholder="([^"]*)"/.exec(src)?.[1] ?? ''
  assert.equal(placeholder, '예: 변 상태가 좋아졌어요 / 가려움이 줄었어요 / 너무 잘 먹어요', '메모 칸 예시가 사장님이 고른 문구와 다르다')
})

test("규칙284: '잘 안 먹어요'는 사장님 폰에 바로 — 이름·메모 없이, 한 번만, 관리자 목록 정본", () => {
  const src = code('app', '(main)', 'dogs', '[id]', 'first-checkin', 'actions.ts')
  // 관리자 목록은 아침 브리핑과 같은 정본(service_role 전용 RPC) — 쿠키 클라이언트로는 못 부른다(규칙8).
  assert.match(src, /createAdminClient\(\)[\s\S]*?\.rpc\('admin_user_ids'\)/, "관리자 목록을 정본(admin_user_ids, service_role)으로 찾지 않는다")
  assert.match(src, /pushToUser\(a\.id,/, '관리자에게 푸시를 보내지 않는다')
  // '잘 안 먹어요'일 때만.
  assert.match(src, /if \(alert\.kind === 'feeding\.first_checkin_poor'\)\s*\{[\s\S]*?pushOwnerNow\(/, "'잘 안 먹어요'일 때 사장님 즉시 알림을 부르지 않는다")
  // 한 번만 — 답한 지 1시간 안 + 경보가 처음 생긴 때(횟수 1).
  assert.match(src, /OWNER_PUSH_WINDOW_MS\s*=\s*60 \* 60 \* 1000/, '즉시 알림 시간 창(1시간)이 없다')
  assert.match(src, /Date\.now\(\) - new Date\(answeredAt\)\.getTime\(\) > OWNER_PUSH_WINDOW_MS\) return/, '오래된 답에도 즉시 알림이 다시 울릴 수 있다')
  assert.match(src, /occurrences !== 1\) return/, '같은 강아지 경보가 이미 있어도(다시 부르면) 또 울린다')
  // 잠금 화면 — 제목·내용은 고정 문구(강아지·고객 이름, 메모를 끼워 넣지 않는다).
  const push = /pushToUser\(a\.id, \{([\s\S]*?)\}\)/.exec(src)?.[1] ?? ''
  const title = /title:\s*("[^"]*"|'[^']*')/.exec(push)?.[1] ?? ''
  const body = /body:\s*("[^"]*"|'[^']*')/.exec(push)?.[1] ?? ''
  assert.ok(title.length > 2 && body.length > 2, '사장님 즉시 알림의 제목·내용이 고정 문구가 아니다(이름·메모를 끼워 넣을 수 있다)')
  assert.match(push, /url: `\/admin\/users\/\$\{customerId\}#dogs`/, '누르면 그 고객 화면(강아지 칸)으로 가지 않는다')
  // 알림 실패가 손님 답·경보를 깨지 않는다.
  assert.match(src, /try \{\s*await pushOwnerNow\([\s\S]*?\} catch/, '즉시 알림 예외가 손님 동작까지 깨뜨릴 수 있다')
})

/** app·lib·components 의 소스(테스트 제외) — 주석을 걷어 낸 본문과 함께. */
function sources(): Array<{ rel: string; src: string }> {
  const out: Array<{ rel: string; src: string }> = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name === 'node_modules' || name.startsWith('.')) continue
        walk(p)
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) {
        out.push({ rel: relative(ROOT, p).split(sep).join('/'), src: stripComments(read(relative(ROOT, p))) })
      }
    }
  }
  for (const d of ['app', 'lib', 'components']) walk(join(ROOT, d))
  return out
}

test('규칙285: 흑돼지 레시피 부위는 안심 — 화면·정본 어디에도 뒷다리살이 없다(사장님 2026-10-15 정정)', () => {
  /**
   * 2026-08-25 에 '안심 → 뒷다리살'로 바꿨다는 기록이 코드·DB·매거진에 퍼져 있었지만 사장님 확인(10/15)으로 틀렸다 — 안심이다.
   * 정본(lib/recipe-ingredients)과 그것을 손으로 다시 적은 화면 문구가 다시 갈라지지 않게 소스 전체를 본다.
   */
  const src = code('lib', 'recipe-ingredients.ts')
  assert.match(src, /joint: \{[\s\S]*?main: '흑돼지 안심'/, "원재료 정본의 흑돼지 메인 부위가 '흑돼지 안심'이 아니다")
  const hits = sources().filter((f) => /뒷다리살/.test(f.src)).map((f) => f.rel)
  assert.deepEqual(hits, [], `화면·정본에 '뒷다리살'이 남아 있다: ${hits.join(', ')}`)
})

test('규칙286: 가게 후기 — 질병 이름·치료 효과 문장 없음, 옮긴 방법 밝힘, 사진 실재, 상품 화면이 정본을 읽음', async () => {
  /**
   * 상품 페이지에 올린 손님 후기는 우리 광고다. 로아 보호자님 후기 원문의 '항암 치료'는 사장님과 정해 '치료 중이라'로 옮겼다(10/15) —
   * 병명이 다시 들어오거나, 먹고 나았다는 효과로 읽히는 문장이 들어오면 빨간불.
   */
  const { STORE_REVIEWS } = await import('./store/reviews.ts')
  assert.ok(STORE_REVIEWS.length > 0, '후기 목록이 비었다(로아 후기가 빠졌다)')
  const DISEASE = /암|종양|당뇨|신부전|신장병|췌장염|심장병|관절염|아토피|피부병|장염|백혈병|림프종/
  const EFFECT = /나았|완치|낫게|좋아졌|개선|효과|치유|회복됐/
  for (const r of STORE_REVIEWS) {
    const text = `${r.title} ${r.body}`
    assert.ok(!DISEASE.test(text), `후기에 질병 이름이 있다(${r.id}): ${text.match(DISEASE)?.[0]}`)
    assert.ok(!EFFECT.test(text), `후기에 치료 효과로 읽히는 문장이 있다(${r.id}): ${text.match(EFFECT)?.[0]}`)
    assert.ok(r.note.trim().length > 0, `후기를 어디서 어떻게 옮겼는지(note)가 없다(${r.id})`)
    assert.ok(r.photos.length > 0, `후기 사진이 없다(${r.id})`)
    for (const p of r.photos) {
      assert.ok(p.alt.trim().length > 0, `후기 사진 설명(alt)이 없다(${r.id})`)
      assert.ok(statSync(join(ROOT, 'public', ...p.src.split('/').filter(Boolean))).size > 0, `후기 사진 파일이 없다: ${p.src}`)
    }
  }
  const pd = code('components', 'store', 'ProductDetail.tsx')
  assert.match(pd, /const reviews = reviewsFor\(recipe\)/, '상품 화면이 후기 정본(lib/store/reviews)을 읽지 않는다')
  assert.match(pd, /reviews\.length === 0 \?[\s\S]*?첫 후기를 모으는 중이에요/, '후기가 없는 레시피의 안내가 사라졌다')
  assert.ok(!/고치지 않고 이 자리에/.test(pd), "후기를 줄여 옮기면서 '고치지 않고 올려요'라고 말한다")
})

test('규칙287: 앱 화면 비중 — 홈 인사는 작게(제목 ≤ 24·아래 한 줄 기본 없음), 추천 딱지는 이름 위 작은 딱지, 둘러보기는 탭바 위까지 끌어온다', () => {
  /**
   * 사장님 10/15 폰 캡처 세 장: ① 레시피 고르기 '★ 추천'이 카드 오른쪽 위 검은 띠로 커서 영어 이름을 덮음 ② 둘러보기 3/3
   * '기록이 쌓이는 곳'이 하단 탭바 밑에 깔려 숫자가 안 보임 ③ 홈 맨 위 인사가 34·세 줄로 첫 화면을 차지('딱히 중요한 멘트가 아닌데').
   */
  const g = code('components', 'v3', 'home', 'GreetingSection.tsx')
  const h1 = /<h1 style=\{\{[^}]*fontSize: (\d+)/.exec(g)?.[1]
  assert.ok(h1 !== undefined, '홈 인사 제목 크기를 찾지 못했다')
  assert.ok(Number(h1) <= 24, `홈 인사 제목이 다시 커졌다(${h1})`)
  assert.ok(!/subCopy = \{/.test(g), "홈 인사 아래 한 줄('정성스럽게')이 다시 기본으로 붙었다")
  const p = code('app', '(main)', 'dogs', '[id]', 'plan', 'PlanClient.tsx')
  const hero = p.slice(p.indexOf('function HeroCard('), p.indexOf('function', p.indexOf('function HeroCard(') + 20))
  assert.ok(hero.length > 0, 'HeroCard 를 찾지 못했다')
  assert.ok(!/position: 'absolute'[\s\S]{0,200}★ 추천/.test(hero), "추천 딱지가 다시 카드 위에 떠서(absolute) 이름을 덮는다")
  assert.match(hero, /height: 20,[\s\S]{0,200}fontSize: 12,[\s\S]{0,200}★ 추천/, '추천 딱지가 작은 딱지(높이 20·글자 12)가 아니다')
  const t = code('components', 'v3', 'tour', 'ResultTour.tsx')
  assert.match(t, /nav\[aria-label="주 메뉴"\][\s\S]{0,200}getBoundingClientRect\(\)\.top/, '둘러보기가 하단 탭바 윗선을 아래 한계로 보지 않는다')
  assert.match(t, /r0\.bottom > visibleBottom/, '둘러보기가 탭바에 가린 대상을 끌어오지 않는다')
})

test('규칙288: 가게 후기 사진 — 파일은 정사각형, 화면은 1:1 칸(고정 높이로 잘라 담지 않음), 보내 주신 사진은 다 씀, 토핑 사진은 밝힘', async () => {
  /**
   * 사장님 10/17 "리뷰 사진이 애매하게 잘렸다·다른 사진들도 보내줬잖아": 2:1 칸에 높이 232 를 고정해 오른쪽 좁은 칸의 팩 사진이
   * 양옆으로 잘렸고, 세 장 중 그릇 사진(손님이 토핑을 올림)은 빼 두었다. 이제 미리 정사각형으로 잘라 1:1 칸에 그대로 담는다.
   */
  const sharp = (await import('sharp')).default
  const { STORE_REVIEWS } = await import('./store/reviews.ts')
  for (const r of STORE_REVIEWS) {
    for (const p of r.photos) {
      const m = await sharp(join(ROOT, 'public', ...p.src.split('/').filter(Boolean))).metadata()
      assert.equal(m.width, m.height, `후기 사진이 정사각형이 아니다 — 1:1 칸에서 잘린다: ${p.src} (${m.width}x${m.height})`)
    }
  }
  const roa = STORE_REVIEWS.find((r) => r.id === 'roa-2026-10')
  assert.ok(roa, '로아 후기가 없다')
  assert.equal(roa.photos.length, 3, '로아 보호자님이 보내 주신 사진 세 장(먹는 모습·팩·그릇)을 다 쓰지 않는다')
  const bowl = roa.photos.find((p) => p.src.includes('bowl'))
  assert.ok(bowl?.caption?.includes('토핑'), '토핑을 올린 그릇 사진에 "보호자님이 올린 토핑"이라는 설명이 없다(재료 오해)')
  const pd = code('components', 'store', 'ProductDetail.tsx')
  const gStart = pd.indexOf('r.photos.map(')
  const gallery = gStart < 0 ? '' : pd.slice(gStart, pd.indexOf('</figure>', gStart))
  assert.ok(gallery.length > 0, '후기 사진 칸을 찾지 못했다')
  assert.match(gallery, /aspectRatio: '1 \/ 1'/, '후기 사진 칸이 1:1 이 아니다')
  assert.ok(!/height: \d+, objectFit: 'cover'/.test(gallery), '후기 사진을 다시 고정 높이 칸에 잘라 담는다')
  assert.match(gallery, /p\.caption &&/, '후기 사진 설명(caption)을 화면에 보이지 않는다')
})
