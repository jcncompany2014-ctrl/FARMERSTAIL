/**
 * 2026-10-22 상품 상세 구조 다시 짜기 — 규칙 311.
 *
 * 사장님 10/21 "상세페이지 구조 자체를 더 이쁘게, 잘 짜인 상세페이지 레퍼런스 다 긁어와서 우리 입맛에 맞게" · 10/22 "디자인도 더 강력하게, 끝내놔".
 * 레퍼런스 20곳(Lyka·Nom Nom·Ollie·JFFD·Spot&Tango / 컬리·정육각·하림·어니스트밀·29CM / Graza·Huel… + Baymard·NN/g)을 실제로 열어 본
 * 공통 공식으로 다시 짰다. 이 파일은 그 구조가 조용히 되돌아가지 않게 잠근다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

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

test('규칙311: 상품 상세 구조(10/22) — 바로가기 줄·제목 밑 별점·한눈에 검정 띠·01~05 순서·다른 레시피는 아래·바꾸는 단계에 % 없음', () => {
  const pd = code('components', 'store', 'ProductDetail.tsx')

  // ① 바로가기 줄 — 내용은 펼친 채 건너뛰기만(Baymard: 가로 탭에 숨기지 말 것). 칸마다 그 id 가 실제로 있다.
  assert.match(pd, /aria-label="상세 바로가기"/, '상세 바로가기 줄이 없다')
  assert.match(pd, /<JumpNav \/>/, '바로가기 줄을 그리지 않는다')
  const jump = /const JUMP[^=]*=\s*\[([\s\S]*?)\]\n/.exec(pd)?.[1] ?? ''
  const ids = [...jump.matchAll(/\['([a-z]+)', '([^']+)'\]/g)].map((m) => m[1]!)
  assert.deepEqual(ids, ['ing', 'make', 'calc', 'reviews', 'info'], '바로가기 칸이 재료·만드는 법·급여량·후기·상품 정보가 아니다')
  for (const id of ids) assert.match(pd, new RegExp(`<section id="${id}"`), `바로가기 '${id}' 칸이 가리키는 구획이 없다`)
  // 바로가기는 구매 상자 뒤, 한눈에 앞
  assert.ok(pd.indexOf('<JumpNav />') > pd.indexOf('className="fts-pd-buy"') && pd.indexOf('<JumpNav />') < pd.indexOf('<Kicker color={color}>한눈에</Kicker>'), '바로가기 줄 자리가 구매 상자 뒤 · 한눈에 앞이 아니다')

  // ② 별점·후기 수는 제목 바로 아래(레퍼런스 전부 같은 자리), 소개 글보다 위. 별점은 실제 후기 별점 평균만.
  const h1 = pd.indexOf('<RecipeName recipe={recipe} size={38} as="h1" />')
  const rate = pd.indexOf('<a href="#reviews"', h1)
  assert.ok(h1 > 0 && rate > h1 && rate < pd.indexOf('{recipeIntro(recipe)}'), '별점·후기 수 줄이 제목 바로 아래가 아니다')
  assert.match(pd, /const rated = reviews\.filter\(\(r\) => typeof r\.rating === 'number'\)/, '별점이 후기 정본의 실제 별점에서 나오지 않는다')
  assert.doesNotMatch(pd, /avg\s*=\s*[45](\.\d)?\b/, '별점을 숫자로 박았다')

  // ③ 순서 — 한눈에(검정 띠) → 01 재료 → 02 만드는 법 → 03 급여량 → 04 주는 법 → 05 믿고 먹일 수 있게 → 후기 → 이런 아이에게·질문 → 4가지 레시피 → 상품 정보
  const order = [
    '<Kicker color={color}>한눈에</Kicker>',
    '<section id="ing"',
    '<section id="make"',
    '<section id="calc"',
    '녹여서 담으면 끝',
    '믿고 먹일 수 있게',
    '<section id="reviews"',
    '이런 아이에게 좋아요',
    '자주 묻는 질문',
    '<Head no="07"',
    '<section id="info"',
  ]
  const at = order.map((s) => pd.indexOf(s))
  order.forEach((s, i) => assert.ok(at[i]! > 0, `상세에서 '${s}' 구획을 찾지 못했다`))
  for (let i = 1; i < order.length; i++) assert.ok(at[i]! > at[i - 1]!, `상세 순서가 어긋났다: '${order[i - 1]}' 다음에 '${order[i]}'가 와야 한다`)
  for (const no of ['01', '02', '03', '04', '05', '06', '07', '08']) assert.match(pd, new RegExp(`<Head no="${no}"`), `구획 번호 ${no} 가 없다`)

  // ④ 한눈에 = 검정 띠 + 숫자 칸(kcal 은 상품표에서) + 흐르는 글자 띠
  assert.match(pd, /className="fts-sec fts-pd-glance" style=\{\{[^}]*background: '#141414'/, '한눈에가 검정 띠가 아니다')
  assert.match(pd, /<Stat k="100g당" v=\{String\(kcalPer100g\(recipe\)\)\}/, '한눈에 kcal 이 상품표(kcalPer100g)에서 나오지 않는다')
  assert.match(pd, /className="fts-marq" aria-hidden/, '흐르는 글자 띠가 없다(또는 읽기 프로그램에 두 번 읽힌다)')

  // ⑤ 처음 바꿀 땐 — 비율%를 쓰지 않는다(고객 문구 규칙: 비율% 금지, 그릇 채움 그림으로만)
  const sw = pd.slice(pd.indexOf('처음 바꿀 땐 일주일에 걸쳐'), pd.indexOf('<Head no="05"'))
  assert.ok(sw.length > 100, "'처음 바꿀 땐' 단계를 찾지 못했다")
  assert.doesNotMatch(sw, /\d\s*%/, "'처음 바꿀 땐' 단계에 % 숫자가 들어갔다")

  // ⑥ 사진마다 큰 한 줄(사진부터 보는 사람이 절반)
  const photos = /const photos[^=]*= \[([\s\S]*?)\n {2}\]/.exec(pd)?.[1] ?? ''
  assert.equal((photos.match(/cap: '/g) ?? []).length, 4, '상품 사진 4장에 한 줄 설명이 다 붙어 있지 않다')
  assert.doesNotMatch(photos, /pouch-ft|\/pkg\/|meal-recipe/, '상품 사진에 지운 사진(겉봉투·옛 팩)이 돌아왔다')
  // 첫 장 = 강아지·그릇·팩 실촬영(사장님 10/22 시안 A) · 대표 썸네일(공유 미리보기·검색 구조화 정보)은 스튜디오 팩 그대로(사장님 "스튜디오 팩 사진이 썸네일로")
  assert.match(photos.trim().split('\n')[0] ?? '', /real-serving\.webp/, '상세 첫 사진이 강아지 실촬영(real-serving)이 아니다')
  const page = code('app', 'store', '[slug]', 'page.tsx')
  assert.match(page, /openGraph: \{[^\n]*images: \[\{ url: RECIPE_STUDIO_IMG\[r\]/, '공유 미리보기 썸네일이 스튜디오 팩 사진이 아니다')
  assert.match(page, /image: `\$\{SITE\}\$\{RECIPE_STUDIO_IMG\[recipe\]\}`/, '검색 구조화 정보 대표 이미지가 스튜디오 팩 사진이 아니다')
  // 폰: 첫 사진 위 큰 이름(읽기 프로그램엔 숨김) + 구매 상자 이름은 화면 밖(검색·읽기용) / PC: 포스터 숨기고 이름 다시 보임
  assert.match(pd, /\{photo === 0 && \(\s*<div aria-hidden className="fts-pd-poster"/, '첫 사진 위 포스터 이름이 없다(또는 읽기 프로그램에 두 번 읽힌다)')
  assert.match(pd, /<div className="fts-pd-name" style=\{SR_MOBILE\}>[\s\S]{0,400}<RecipeName recipe=\{recipe\} size=\{38\} as="h1" \/>/, '구매 상자 이름(h1)이 폰 읽기용 칸 안에 없다')
  const pcCss = read('components', 'store', 'store.css').slice(read('components', 'store', 'store.css').indexOf('@media (min-width: 1024px)'))
  assert.match(pcCss, /\.fts-pd-poster \{\s*display: none !important;/, 'PC 에서 포스터 이름을 숨기지 않는다(이름이 두 번 보인다)')
  assert.match(pcCss, /\.fts-pd-name \{\s*position: static !important;/, 'PC 에서 구매 상자 이름이 다시 보이지 않는다')

  // ⑦ 재료 원물 카드 — 레시피마다 주재료·간염통 사진, 모든 '더한 것'에 사진이 있고 파일이 있다
  const ri = read('lib', 'recipe-ingredients.ts')
  const toppings = [...ri.matchAll(/toppings: \['([^']+)', '([^']+)'\]/g)].flatMap((m) => [m[1]!, m[2]!])
  assert.ok(toppings.length >= 8, '레시피 재료표에서 더한 재료를 읽지 못했다')
  const map = /const TOPPING_IMG[^=]*= \{([^}]*)\}/.exec(pd)?.[1] ?? ''
  for (const t of new Set(toppings)) {
    const key = new RegExp(`${t}: '([a-z]+)'`).exec(map)?.[1]
    assert.ok(key, `더한 재료 '${t}'의 원물 사진이 정해지지 않았다(TOPPING_IMG)`)
    assert.ok(existsSync(join(ROOT, 'public', 'store', 'ing', `${key}.webp`)), `원물 사진 파일이 없다: ${key}.webp`)
  }
  for (const r of ['chicken', 'duck', 'pork', 'beef']) {
    for (const k of ['main', 'organs']) assert.ok(existsSync(join(ROOT, 'public', 'store', 'ing', `${r}-${k}.webp`)), `원물 사진 파일이 없다: ${r}-${k}.webp`)
  }
  assert.ok(existsSync(join(ROOT, 'public', 'store', 'ing', 'veg.webp')), '채소·곡물 원물 사진 파일이 없다')

  // ⑧ 후기 — 사진 후기 줄 + 글 후기는 세 개만 보이고 '더 보기'(지우지 않고 화면에서만 접는다)
  assert.match(pd, /const reviewPhotos = reviews\.flatMap\(\(r\) => r\.photos\)/, '사진 후기 줄이 후기 정본 사진을 모으지 않는다')
  assert.match(pd, /className="fts-revlist" data-all=\{allReviews \? 'true' : undefined\}/, '글 후기 접기(fts-revlist)가 없다')
  assert.match(read('components', 'store', 'store.css'), /\.fts-revlist:not\(\[data-all='true'\]\) > :nth-child\(n \+ 4\) \{\s*display: none !important;/, '글 후기 네 번째부터 접는 규칙이 없다(후기 칸이 인라인 display:flex 라 !important 가 있어야 접힌다)')

  // ⑨ 바로가기 멈춤 위치는 웹 전체 scroll-padding-top 96 을 전제로 뺀 값이다 — 한쪽만 바뀌면 제목이 줄 밑에 숨거나 멀리 떨어진다
  assert.match(read('app', 'globals.css'), /html:not\(:has\(\[data-ft-chrome='app'\]\)\) \{\s*scroll-padding-top: 96px;/, '웹 scroll-padding-top 96 이 바뀌었다 — 상세 scrollMarginTop(-40·-16)도 같이 다시 재야 한다')
  assert.match(pd, /const SEC: CSSProperties = \{[^}]*scrollMarginTop: -40 \}/, '상세 구획 멈춤 위치가 바뀌었다(웹 scroll-padding 96 과 같이 잴 것)')

  // ⑩ 흐르는 글자 띠는 움직임 줄이기 설정이면 멈춘다
  const css = read('components', 'store', 'store.css')
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.fts-marq-track \{\s*animation: none;/, '흐르는 글자 띠가 움직임 줄이기 설정에서도 돈다')
})
