/**
 * 2026-10-19 약국 봉투 QR 이벤트 화면(사장님 "A로 가고 … 앱 깔면 처음 뜨는 강아지 이름·나이·견종·성별 받고 도장 찍고 하잖아 그걸 띄우고
 * 가입시키고 나서 앱 설치 버튼 띄우고 … '이미 계정이 있어요' 누르라고 잘 알 수 있게") — 규칙 297~301.
 *
 *   297 이벤트 화면 = /p/코드 — 열려 있는지는 행사표로(꺼진·끝난·인원 찬 코드면 '끝났어요'), 앱 안이면 앱 첫 화면(/start?p=)으로, 검색 제외
 *   298 가입 카드(이벤트) — 카카오·애플만(이메일 없음), 착지 /p/코드/done, 광고 수신 동의는 선택(처음 꺼짐), 약관 고지, 웹엔 '맞춤' 없음, 앱 첫 실행 표식 안 남김
 *   299 가입 완료 — 이 코드로 혜택 저장, **강아지만** 만든다(설문·분석 없음), 동의는 서버 함수로만, 저장된 혜택은 본인 기록만 읽는다
 *   300 앱 로그인 뒤 — 설문 안 한 강아지가 있으면 홈 대신 그 설문으로(카카오·애플 허브·이메일 둘 다), 조회 실패면 홈
 *   301 새로 뽑는 QR·링크 = /p/코드, 첫 실행 관문은 /p/ 를 덮지 않는다, 아이폰 앱 링크는 /p/ 를 가져가지 않는다
 *
 * 고친 코드를 일부러 되돌려 빨간불을 검산했다. if 안에 단언을 넣지 않는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

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

/** start 글자부터 end 글자 앞까지(둘 다 있어야 한다). */
function slice(src: string, start: string, end: string): string {
  const a = src.indexOf(start)
  assert.ok(a >= 0, `구간 시작을 못 찾음: ${start}`)
  const b = src.indexOf(end, a + start.length)
  assert.ok(b > a, `구간 끝을 못 찾음: ${end}`)
  return src.slice(a, b)
}

test('규칙297: 이벤트 화면 /p/코드 — 행사표로 열림 판정·앱 안이면 앱 첫 화면·검색 제외', () => {
  const page = code('app', 'p', '[code]', 'page.tsx')
  assert.match(page, /const code = normalizePromoCode\(raw\)\s*\n\s*if \(!code\) notFound\(\)/, '이벤트 코드 모양 검사가 없다')
  assert.match(page, /if \(await isAppContextServer\(\)\) redirect\(user \? `\/p\/\$\{code\}\/done` : `\/start\?p=\$\{code\}`\)/, '앱 안에서 열린 이벤트 화면을 앱 첫 화면(?p=)·앱 착지로 넘기지 않는다')
  // 앱 안 로그인 사용자 — /start 는 /dogs/new 로 돌려보내 ?p= 를 아무도 안 읽는다(10/19 검토). 착지가 이 계정에 저장한다.
  const donePage = code('app', 'p', '[code]', 'done', 'page.tsx')
  assert.match(donePage, /if \(await isAppContextServer\(\)\) \{\s*if \(!user\) redirect\(`\/start\?p=\$\{code\}`\)\s*return <AppEventClaim code=\{code\} \/>/, '앱 안 로그인 사용자의 혜택을 저장하지 않는다')
  assert.match(code('app', 'p', '[code]', 'done', 'AppEventClaim.tsx'), /\.rpc\('claim_promotion', \{ p_code: code \}\)/, '앱 착지가 혜택을 저장하지 않는다')
  assert.match(page, /const promo = await loadEventPromo\(code\)/, '행사표로 열림을 판정하지 않는다')
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/, '이벤트 화면이 검색에 걸린다')

  const flow = code('app', 'p', '[code]', 'EventFlow.tsx')
  assert.match(flow, /if \(promo\.state !== 'open'\) return <EventClosed/, '닫힌 이벤트에서도 첫 질문·가입이 열린다(거짓 약속)')
  assert.match(flow, /<FirstScreenFlow event=\{\{ code, ratePct: promo\.ratePct, maxDiscount: promo\.maxDiscount \}\} \/>/, '첫 질문이 앱 첫 화면 부품(이벤트 모드)이 아니다')
  // 인앱 브라우저 안내는 한 칸 안 맨 위 띠로 — .page(가로 flex) 바로 아래 두면 안내서 폭을 먹는다(10/19 검토).
  assert.match(flow, /<div className=\{s\.col\}>\s*(?:\{\s*\}\s*)?<div className=\{s\.notice\}>\s*<InAppBrowserNotice \/>/,'인앱 브라우저 안내가 한 칸 밖에 있다(안내서가 찌그러진다)')
  // 할인율은 DB 에서 읽은 값만 — 숫자를 손으로 적지 않는다.
  assert.doesNotMatch(flow, /\b50%|\b50\s*퍼센트/, '할인율을 손으로 적었다(행사표 값을 써야 한다)')

  const load = code('lib', 'promotions-load.ts')
  assert.match(load, /const gate = promotionGate\(like, now, count \?\? 0\)/, '열림 판정이 promotionGate(관리자 목록과 같은 순서)가 아니다')
  assert.match(load, /if \(error\) return \{ state: 'error' \}/, '행사표 조회 실패를 오류로 다루지 않는다(규칙1)')
  assert.match(load, /if \(countErr\) return \{ state: 'error' \}/, '가입 수 조회 실패를 오류로 다루지 않는다(규칙1)')
  assert.doesNotMatch(load, /\.select\('\*'\)/, '행사표 전체 칸을 읽는다(화면에 쓸 칸만)')
})

test('규칙298: 가입 카드(이벤트) — 카카오·애플만·착지 /p/코드/done·동의는 선택·약관 고지·맞춤 없음', () => {
  const fs = code('app', 'start', 'first', 'FirstScreenFlow.tsx')
  assert.match(fs, /if \(!event\) markOnboarded\(\)/, '웹 이벤트 화면이 앱 첫 실행 표식을 남긴다')
  assert.match(fs, /const \[consent, setConsent\] = useState\(false\)/, '광고 수신 동의가 처음부터 켜져 있다(선택 동의는 꺼진 채 시작)')
  const ev = slice(fs, '{event ? (', ') : (\n')
  assert.match(ev, /<KakaoLoginButton variant="signup" next=\{`\/p\/\$\{event\.code\}\/done`\}/, '카카오 가입 착지가 이벤트 완료 화면이 아니다')
  assert.match(ev, /<AppleLoginButton variant="signup" next=\{`\/p\/\$\{event\.code\}\/done`\}/, '애플 가입 착지가 이벤트 완료 화면이 아니다')
  assert.doesNotMatch(ev, /\/start\/join|\/start\/onboard|\/start\/claim/, '이벤트 가입 카드에 이메일 가입·앱 착지가 섞였다(웹에선 혜택·강아지가 안 붙는다)')
  assert.match(ev, /type="checkbox"/, '광고 수신 동의 칸이 없다')
  assert.match(ev, /\[선택\]/, '광고 수신 동의가 선택이라고 적혀 있지 않다')
  assert.match(ev, /이용약관[\s\S]*개인정보처리방침[\s\S]*만 14세/, '약관·만 14세 고지가 없다')
  assert.doesNotMatch(ev, /맞춤/, "이벤트(웹) 가입 카드에 '맞춤'")
  // 이벤트 화면 전체에도 '맞춤' 없음
  for (const f of [['app', 'p', '[code]', 'EventFlow.tsx'], ['app', 'p', '[code]', 'EventParts.tsx'], ['app', 'p', '[code]', 'done', 'EventDone.tsx']]) {
    assert.doesNotMatch(code(...f), /맞춤/, `웹 이벤트 화면에 '맞춤': ${f.join('/')}`)
  }
  // 앱 첫 화면(이벤트 아님)은 그대로 — 로그인 링크·앱 착지
  assert.match(fs, /<Link href="\/login" replace className="s-tlink"/, '앱 첫 화면의 로그인 링크가 바뀌었다(규칙234)')
  assert.match(fs, /next="\/start\/onboard" look="flow" label="카카오로 가입하고 시작"/, '앱 첫 화면 카카오 착지가 바뀌었다')
})

test('규칙299: 가입 완료 — 이 코드로 혜택 저장·강아지만·동의는 서버 함수로·본인 혜택만 읽기', () => {
  const done = code('app', 'p', '[code]', 'done', 'EventDone.tsx')
  assert.match(done, /\.rpc\('claim_promotion', \{ p_code: code \}\)/, '이 화면의 코드로 혜택을 저장하지 않는다(초안의 옛 코드가 이길 수 있다)')
  assert.match(done, /await createDogFromDraft\(user\.id, draft\)/, '강아지를 만들지 않는다')
  assert.doesNotMatch(done, /applyAutosignupDraft/, '답하지 않은 기본값으로 설문·분석까지 만든다(앱이 남은 설문을 안 묻는다)')
  assert.match(done, /supabase\.rpc\('set_marketing_consent', \{/, '광고 동의를 서버 함수로 저장하지 않는다(규칙219)')
  assert.doesNotMatch(done, /from\('profiles'\)[\s\S]{0,80}update/, '동의 칸을 직접 고친다(규칙219)')
  assert.match(done, /\/api\/consent\/unsubscribe-ack/, '광고 동의 처리 결과를 알리지 않는다(정보통신망법 §50⑦)')
  // 새로 고침이 끝날 때까지 '저장하고 있어요' — 옛 값(null)으로 '실패' 글이 잠깐 보이지 않게(10/19 검토).
  assert.match(done, /startRefresh\(\(\) => router\.refresh\(\)\)/, '저장 뒤 서버가 혜택을 다시 읽지 않는다(또는 기다리지 않는다)')
  assert.match(done, /const busy = phase === 'working' \|\| refreshing/, '새로 고침 중에도 결과 카드를 그린다')
  // '한 번만' 표식은 확정 결과일 때만, 동의 키는 두 채널 다 저장됐을 때만 지운다(망 오류 때 혜택·동의를 잃지 않게).
  assert.match(done, /if \(settled\) \{\s*try \{\s*window\.sessionStorage\.setItem\(doneKey\(code\), '1'\)/, '실패해도 다시 하지 않게 표식을 남긴다')
  assert.match(done, /if \(saved\.length === 2\) \{\s*try \{\s*window\.localStorage\.removeItem\(EVENT_CONSENT_KEY\)/, '동의 저장이 실패해도 고른 동의를 지운다')
  // 이메일 계정을 '카카오로 시작하기'로 안내하지 않는다 — 실제 단추 글자 그대로.
  assert.match(done, /provider === 'apple' \? 'Apple 로 시작하기' : provider === 'kakao' \? '카카오로 시작하기' : null/, '가입 방법별 로그인 안내가 아니다')

  const page = code('app', 'p', '[code]', 'done', 'page.tsx')
  assert.match(page, /const pending = user \? await loadPendingPromo\(user\.id\) : null/, '저장된 혜택을 본인 기준으로 읽지 않는다')
  const load = code('lib', 'promotions-load.ts')
  assert.match(slice(load, 'export async function loadPendingPromo(', '\n}\n'), /\.eq\('user_id', userId\)/, '혜택 조회가 본인 기록으로 묶이지 않는다(규칙8)')
})

test('규칙300: 앱 로그인 뒤 — 설문 안 한 강아지가 있으면 그 설문으로(허브·이메일), 모르면 홈', async () => {
  const claim = code('app', 'start', 'claim', 'page.tsx')
  const branch = slice(claim, 'if (count && count > 0 && !hasCompleteDraft) {', 'router.replace(home)')
  assert.match(branch, /if \(isApp && !to\) \{\s*const pending = await firstDogWithoutSurvey\(supabase, user\.id\)/, '카카오·애플 로그인 뒤 설문 안 한 강아지를 설문으로 보내지 않는다')
  assert.match(branch, /router\.replace\(surveyStartHref\(pending, isFreshAccount\(user\.created_at\)\)\)/, '설문 주소가 정본(surveyStartHref)이 아니다')

  // 10/19 검토: 허브 ②가 설문 전 초안(surveyDeferred)을 applyAutosignupDraft 로 넘기면 답하지 않은 기본값(알레르기 없음)으로 분석이 생긴다.
  const two = slice(claim, 'if (draft && hasCompleteDraft) {', 'const dogId = await applyAutosignupDraft(user.id, draft)')
  assert.match(two, /if \(draft\.surveyDeferred\) \{[\s\S]*const deferredId = await createDogFromDraft\(user\.id, draft\)/, '허브가 설문 전 초안으로 설문·분석까지 만든다(강아지만 만들어야 한다)')
  assert.match(two, /draft\.promo\s*\?\s*`\/p\/\$\{draft\.promo\}\/done`/, '웹 이벤트 손님을 이벤트 완료 화면(혜택·동의 저장)으로 보내지 않는다')

  const login = code('app', '(auth)', 'login', 'page.tsx')
  assert.match(login, /const pending = await firstDogWithoutSurvey\(supabase, signedIn\.id\)\s*\n\s*if \(pending\) destination = surveyStartHref\(pending, isFreshAccount\(signedIn\.created_at\)\)/, '이메일 로그인 뒤 설문 안 한 강아지를 설문으로 보내지 않는다')

  // 함수 자체 — 실제로 불러 판정을 본다.
  const mod = (await import(pathToFileURL(join(ROOT, 'lib', 'auth', 'surveyPendingDog.ts')).href)) as {
    firstDogWithoutSurvey: (sb: unknown, uid: string) => Promise<string | null>
  }
  const fake = (dogs: unknown, dogErr: unknown, surveys: unknown, sErr: unknown) => ({
    from: (t: string) => ({
      select: () => ({
        eq: () => ({ order: async () => (t === 'dogs' ? { data: dogs, error: dogErr } : { data: null, error: 'x' }) }),
        in: async () => (t === 'surveys' ? { data: surveys, error: sErr } : { data: null, error: 'x' }),
      }),
    }),
  })
  assert.equal(await mod.firstDogWithoutSurvey(fake([{ id: 'a' }, { id: 'b' }], null, [], null), 'u'), 'a', '설문을 한 번도 안 한 계정의 첫 강아지를 못 찾는다')
  assert.equal(await mod.firstDogWithoutSurvey(fake([{ id: 'a' }], null, [{ dog_id: 'a' }], null), 'u'), null, '설문을 마친 기존 회원까지 설문으로 끌고 간다')
  // 10/19 검토: 설문 끝난 첫째 + 등록만 한 둘째 — 로그인마다 둘째 설문으로 끌고 가면 안 된다.
  assert.equal(await mod.firstDogWithoutSurvey(fake([{ id: 'a' }, { id: 'b' }], null, [{ dog_id: 'a' }], null), 'u'), null, '다견 기존 회원을 로그인마다 둘째 강아지 설문으로 끌고 간다')
  assert.equal(await mod.firstDogWithoutSurvey(fake([{ id: 'a' }], null, null, { message: 'boom' }), 'u'), null, '설문 조회 실패를 "설문 없음"으로 읽는다(규칙1)')
  assert.equal(await mod.firstDogWithoutSurvey(fake(null, { message: 'boom' }, [], null), 'u'), null, '강아지 조회 실패에도 설문으로 보낸다(규칙1)')
  assert.equal(await mod.firstDogWithoutSurvey(fake([], null, [], null), 'u'), null, '강아지가 없는데 설문 주소를 만든다')
})

test('규칙301: 새로 뽑는 QR·링크 = /p/코드 · 첫 실행 관문은 /p/ 를 덮지 않는다 · 아이폰 앱 링크 제외', () => {
  const qr = code('app', 'api', 'admin', 'promotions', 'qr', 'route.ts')
  assert.match(qr, /const target = `\$\{siteUrl\}\/p\/\$\{code\}`/, '관리자 QR 이 새 이벤트 화면을 가리키지 않는다')
  const admin = code('app', 'admin', 'promotions', 'PromotionsClient.tsx')
  assert.match(admin, /const linkOf = \(code: string\) => `\$\{siteUrl\}\/p\/\$\{code\}`/, '관리자 복사 링크가 새 이벤트 화면이 아니다')
  assert.doesNotMatch(admin, /\/start\?p=/, '관리자 화면에 옛 행사 주소가 남았다')

  const gate = code('components', 'OnboardingGate.tsx')
  const before = gate.slice(0, gate.indexOf("router.replace('/start')"))
  assert.match(before, /if \(pathname\.startsWith\('\/p\/'\)\) return/, '첫 실행 관문이 이벤트 화면을 앱 첫 화면(코드 없이)으로 덮는다')

  const aasa = code('app', '.well-known', 'apple-app-site-association', 'route.ts')
  assert.match(aasa, /'\/p\/\*'/, '아이폰 앱 링크가 /p/ 를 앱으로 가져간다(이벤트 화면이 브라우저에서 안 열린다)')
  // 옛 행사 주소(/start?p=)는 그대로 살아 있다 — 이미 인쇄된 QR(규칙176).
  assert.match(code('app', 'start', 'page.tsx'), /if \(!isApp && !promo\) permanentRedirect\('\/app'\)/, '옛 행사 QR 경로가 바뀌었다(규칙176)')
})

test('규칙303: 서포터즈 링크 /link/코드 — 다섯 아이·사진 실재·보호자 이름 없음·모르는 코드 404·앱 링크 제외·브라우저로 같은 주소', async () => {
  /**
   * 사장님 2026-10-19 "서포터즈 다섯 명용 링크 페이지 안에 저걸 넣고 … 따로 주소 만들어서 누가 잘 팔았는지".
   * 한 코드 = 링크 모음(/link/코드) + 이벤트 화면(/p/코드) + 행사표(promotions.code) — 가입·결제가 그 아이 몫으로 집계된다.
   */
  const { SUPPORTERS, supporterByCode, DEFAULT_HERO_DOG } = (await import(pathToFileURL(join(ROOT, 'lib', 'supporters.ts')).href)) as typeof import('./supporters.ts')
  const { normalizePromoCode } = (await import(pathToFileURL(join(ROOT, 'lib', 'promotions.ts')).href)) as typeof import('./promotions.ts')
  assert.deepEqual(SUPPORTERS.map((s) => s.name), ['룽지', '낑콩', '펀치', '홀비', '피카'], '서포터즈 다섯 아이가 아니다')
  assert.equal(new Set(SUPPORTERS.map((s) => s.code)).size, SUPPORTERS.length, '코드가 겹친다(두 아이 몫이 섞인다)')
  for (const s of [...SUPPORTERS, { ...DEFAULT_HERO_DOG, code: null }]) {
    if (s.code) assert.equal(normalizePromoCode(s.code), s.code, `${s.name}: 행사 코드 모양이 아니다(/p/ 가 404)`)
    const files = s.media.kind === 'video' ? [s.media.src, s.media.poster] : [s.media.src]
    for (const f of files) assert.ok(existsSync(join(ROOT, 'public', f)), `${s.name}: 사진·영상 파일이 없다 ${f}`)
  }
  assert.equal(supporterByCode('punch')?.name, '펀치')
  assert.equal(supporterByCode('nobody'), null)
  // 공개 화면 — 보호자 이름을 쓰지 않는다(아이 이름만).
  const sup = read('lib', 'supporters.ts')
  for (const person of ['조가영', '가영', '김다혜', '방경연', '김지연', '신다정']) assert.ok(!sup.includes(person), `보호자 이름이 공개 화면 자료에 있다: ${person}`)

  const page = code('app', 'link', '[code]', 'page.tsx')
  assert.match(page, /export const dynamicParams = false/, '목록에 없는 코드도 서포터즈 화면이 된다')
  assert.match(page, /return SUPPORTERS\.map\(\(s\) => \(\{ code: s\.code \}\)\)/)
  assert.match(page, /robots: \{ index: false, follow: true \}/, '같은 본문 다섯 벌이 검색에 걸린다')
  assert.match(page, /loadEventPromo\(dog\.code\)/, '혜택을 행사표에서 읽지 않는다')
  assert.match(page, /<LinkBody content=\{content\} supporter=\{\{ dog, promo \}\} \/>/)
  assert.match(code('app', 'link', 'page.tsx'), /return <LinkBody content=\{content\} \/>/, '기본 링크 모음이 같은 본문을 안 쓴다')
  const body = code('app', 'link', 'LinkBody.tsx')
  const top = slice(body, 'function SupporterTop(', '\n}\n')
  assert.match(top, /const open = promo\.state === 'open' \? promo : null/, '끝난·없는 행사에도 혜택 카드가 뜬다(거짓 약속)')
  assert.match(top, /\{open && \(/)
  assert.match(top, /href=\{`\/p\/\$\{dog\.code\}`\}/, '혜택 단추가 이 아이 코드의 이벤트 화면이 아니다(집계가 끊긴다)')
  assert.doesNotMatch(top, /\b50%|5만원/, '할인율·상한을 손으로 적었다(행사표 값을 써야 한다)')
  // 서포터즈 링크엔 바로 가기 버튼·'파머스테일의 하루'가 없다(사장님 10/21 "너무 파머스테일 페이지 같음").
  assert.match(body, /\{!supporter && \(\s*<nav aria-label="바로 가기"/, '서포터즈 링크에 바로 가기 버튼이 나온다')
  assert.match(body, /\{!supporter && content\.momentUrls\.length > 0 && \(/, "서포터즈 링크에 '파머스테일의 하루'가 나온다")
  assert.match(code('app', 'p', '[code]', 'page.tsx'), /heroDog=\{supporterByCode\(code\) \?\? DEFAULT_HERO_DOG\}/, '서포터즈 이벤트 화면 맨 위가 그 아이가 아니다')

  // 웹 전용 — 앱이 가져가지 않는다(아이폰 AASA·새 안드로이드 매니페스트), 첫 실행 관문이 덮지 않는다.
  assert.match(code('app', '.well-known', 'apple-app-site-association', 'route.ts'), /\{ '\/': '\/link\/\*', exclude: true \}/, '아이폰 앱이 /link/코드 를 가져간다')
  assert.match(read('android', 'app', 'src', 'main', 'AndroidManifest.xml'), /<uri-relative-filter-group android:allow="false">\s*<data android:pathPrefix="\/link\/" \/>/, '안드로이드 앱이 /link/코드 를 가져간다')
  assert.match(code('components', 'OnboardingGate.tsx'), /if \(pathname\.startsWith\('\/link\/'\)\) return/, '첫 실행 관문이 서포터즈 링크를 덮는다')
  // 앱 안에서 열렸을 때 '브라우저로 열기'가 같은 서포터즈 주소로 간다(기본 /link 로 가면 그 아이 몫이 끊긴다).
  assert.match(code('app', 'link', 'LinkInAppNotice.tsx'), /linkWebUrl\(window\.location\.search, window\.location\.pathname\)/)
  const eb = (await import(pathToFileURL(join(ROOT, 'lib', 'external-browser.ts')).href)) as typeof import('./external-browser.ts')
  assert.equal(eb.linkWebUrl('', '/link/punch'), 'https://www.farmerstail.kr/link/punch')
  assert.equal(eb.linkWebUrl('?utm_source=ig', '/link/punch'), 'https://www.farmerstail.kr/link/punch?utm_source=ig')
  assert.equal(eb.linkWebUrl('', '/link/../admin'), 'https://www.farmerstail.kr/link', '이상한 경로를 그대로 연다')
  assert.equal(eb.linkWebUrl(''), 'https://www.farmerstail.kr/link')
  assert.ok(eb.androidChromeIntentUrl('https://www.farmerstail.kr/link/punch'), '안드로이드 크롬으로 못 넘긴다')

  // 이름표엔 이름만 — 견종은 빼라(사장님 10/19 "라벨에 견종은 빼"). 견종 칸 자체를 두지 않는다.
  assert.match(code('components', 'web', 'DogHero.tsx'), /<span className=\{s\.name\}>\{dog\.name\}<\/span>/, '이름표가 이름만이 아니다')
  assert.doesNotMatch(sup, /breed/, '견종 칸이 되살아났다(이름표에 다시 붙는다)')

  // 영상 — 소리 없이, 저전력 모드 거절은 조용히(포스터가 남는다).
  const vid = code('components', 'web', 'HeroVideo.tsx')
  assert.match(vid, /v\.muted = true/)
  assert.match(vid, /v\.play\(\)\.catch\(/)
})

test('규칙302: 이벤트 최대 할인 금액 — DB 칸·청구가 한 번에 읽기·금액으로 견주기·화면이 상한을 말한다', () => {
  /**
   * 사장님 2026-10-19 "할인율 50퍼 · 최대 할인 금액 5만원". 큰 아이 완전 화식 박스는 20만원이 넘어 50%면 10만원 넘게 깎인다.
   * 실제 숫자 검사는 lib/payments/discount-pick.test.ts. 여기선 청구·화면이 그 정본을 실제로 쓰는지 잠근다.
   */
  const mig = read('supabase', 'migrations', '20261019000000_promotion_max_discount.sql')
  assert.match(mig, /add column if not exists max_discount_amount integer\s*\n\s*check \(max_discount_amount is null or max_discount_amount > 0\)/, '상한 칸이 없거나 0·음수를 막지 않는다')
  const fn = slice(mig, 'create or replace function public.pending_promotion_terms', '$function$;')
  assert.match(fn, /security definer\s*\n\s*set search_path to 'public', 'pg_catalog'/, 'SECURITY DEFINER 함수에 search_path 가 없다')
  assert.match(fn, /SELECT p\.discount_rate, p\.max_discount_amount/, '할인율과 상한을 한 번에 읽지 않는다')
  assert.match(fn, /c\.redeemed_order_id IS NULL/, '이미 쓴 혜택까지 읽는다(매 결제 할인)')
  assert.match(mig, /revoke execute on function public\.pending_promotion_terms\(uuid\) from public, anon, authenticated;/, '고객이 남의 혜택을 조회할 수 있다')
  assert.match(mig, /grant execute on function public\.pending_promotion_terms\(uuid\) to service_role;/)

  const ad = code('lib', 'payments', 'auto-discount.ts')
  assert.match(ad, /await rpc\('pending_promotion_terms', \{ p_user_id: userId \}\)/, '청구가 상한을 읽지 않는다')
  // 배포 순서 안전판 — 함수가 아직 없을 때(PGRST202)만 예전 할인율로. 다른 오류는 할인 없음(+오류 이벤트).
  assert.match(ad, /if \(promoErr\?\.code === 'PGRST202'\) \{[\s\S]{0,300}rpc\('pending_promotion_rate'/, '마이그레이션 전 배포에서 이벤트 할인이 통째로 사라진다')
  assert.match(ad, /promo: promoRate > 0 \? \{ rate: promoRate, maxDiscount: promoCap, label: '이벤트 할인' \} : null/, '고르기에 상한이 안 넘어간다')
  assert.doesNotMatch(ad, /applyDiscount\(subtotal, final\.rate\)/, '상한을 무시하고 비율로 다시 깎는다')
  const pick = code('lib', 'payments', 'discount-pick.ts')
  assert.match(pick, /capPromotionDiscount\(applyDiscount\(subtotal, promo\.rate\), promo\.maxDiscount\)/, '이벤트 금액에 상한을 안 건다')
  assert.match(pick, /rate: asRate\(promoAmount\)/, '상한 걸린 이벤트를 비율로 견준다(더 많이 깎는 이웃 할인을 이긴다)')

  // 화면 — 상한이 있으면 그 말을 한다(안내서·단계·가입 카드·완료 화면·옛 완료 화면).
  const flow = code('app', 'p', '[code]', 'EventFlow.tsx')
  assert.match(flow, /\{capText && <p className=\{s\.capNote\}>최대 \{capText\}까지 할인<\/p>\}/, '안내서 큰 숫자 밑에 상한이 없다')
  assert.match(code('lib', 'promotions-load.ts'), /maxDiscount: like\.max_discount_amount \?\? null/, '이벤트 화면이 상한을 안 읽는다')
  assert.match(code('app', 'p', '[code]', 'EventParts.tsx'), /할인돼요\$\{capText \? `\(최대 \$\{capText\}\)` : ''\}/, '받는 순서에 상한이 없다')
  assert.match(code('app', 'start', 'first', 'FirstScreenFlow.tsx'), /event\.maxDiscount \? `\(최대 \$\{formatPromoCap\(event\.maxDiscount\)\}\)`/, '가입 카드에 상한이 없다')
  assert.match(code('app', 'p', '[code]', 'done', 'EventDone.tsx'), /할인은 최대 \$\{capText\}까지예요/, '완료 화면에 상한이 없다')
  assert.match(code('app', 'start', 'done', 'DoneWebView.tsx'), /promo\.maxDiscount \? `\(최대 \$\{formatPromoCap\(promo\.maxDiscount\)\}\)`/, '옛 완료 화면에 상한이 없다')

  // 어드민 — 만들 때 넣고(1,000원~100만원), 감사 기록에 남긴다.
  const api = code('app', 'api', 'admin', 'promotions', 'route.ts')
  assert.match(api, /maxDiscount < 1000 \|\| maxDiscount > 1_000_000/, '상한 값 검사가 없다')
  assert.match(api, /max_discount_amount: maxDiscount,\s*\n\s*\}\)/, '상한을 저장하지 않는다')
  assert.match(api, /max_signups: maxSignups, max_discount_amount: maxDiscount \} \}/, '상한이 감사 기록에 안 남는다')
})
