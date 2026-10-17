/**
 * 2026-10-13 점검 묶음 '알림·결제·운영·DB' 의 규칙 190~199 (가지 fix/1013-ops).
 *
 * 문서에만 적은 규칙은 같은 날 또 어긴다 — 고친 것을 테스트로 박는다. 각 규칙은 고치기 전 코드
 * (df28b40a)에서는 빨간불, 지금 코드에서는 초록불인지 검산했다(카나리아 — 보고서에 결과).
 * 카나리아 실행: AUDIT_ROOT=<옛 파일을 같은 경로로 풀어 둔 폴더> 로 이 파일을 돌리면 그 폴더를 읽는다.
 *
 * 순수 함수의 단위 테스트는 따로 있다: lib/supabase/in-chunks.test.ts · lib/chatbot 폴더의 테스트 두 개 ·
 * lib/push-preferences.test.ts · lib/auth/unverified-signup.test.ts · lib/admin/tracking-duplicates.test.ts.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
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

async function load<T>(...parts: string[]): Promise<T> {
  return (await import(pathToFileURL(join(ROOT, ...parts)).href)) as T
}

function migration(nameIncludes: string): string {
  const dir = join(ROOT, 'supabase', 'migrations')
  const f = readdirSync(dir).find((n) => n.startsWith('20261013') && n.includes(nameIncludes))
  assert.ok(f, `마이그레이션 *${nameIncludes}* 이 없다`)
  return readFileSync(join(dir, f!), 'utf8')
}

test('규칙190: 포장 목록은 결제 증거 조회가 실패하면 목록을 계산하지 않는다 · id 목록은 200개씩 묻는다', () => {
  const page = code('app', 'admin', 'personalization', 'picking-list', 'page.tsx')
  // 두 결제 증거 조회(발송한 주문·발송 대기 주문) 실패가 모두 '믿을 수 없음'으로 이어진다.
  assert.match(page, /if \(shippedErr\) \{[\s\S]{0,200}paidEvidenceError = /, '발송한 주문 조회 실패가 목록을 멈추지 않는다')
  assert.match(page, /if \(ordersErr\) \{[\s\S]{0,200}paidEvidenceError \?\?= /, '발송 대기 주문 조회 실패가 목록을 멈추지 않는다')
  assert.match(page, /if \(paidEvidenceError\) \{\s*return <PickingListUnreliable/, '결제 증거를 모르는데 목록을 그린다')
  assert.ok(page.indexOf('if (paidEvidenceError)') < page.indexOf('const rows: PickingRow[]'), '목록 계산이 실패 확인보다 먼저다')
  assert.ok(read('app', 'admin', 'personalization', 'picking-list', 'page.tsx').includes('목록을 믿을 수 없어요, 새로고침해 주세요'), '오류 화면 문구가 없다')
  // 한 번에 넣는 id 목록 조회 금지 — 약 390개부터 16KB 머리 한도로 실패한다.
  for (const raw of ["'subscription_id', subIds", "'id', movedIds", "'user_id', needCurrent", "'id', needCurrent", "'user_id', userIds", "'id', dogIds", "'dog_id', dogIds"]) {
    assert.ok(!page.includes(`.in(${raw})`), `포장 목록이 .in(${raw}) 를 한 번에 묻는다 — selectInChunks 로 나눌 것`)
  }
  const timing = code('lib', 'payments', 'charge-timing.ts')
  assert.ok(!timing.includes(".in('user_id', ids)"), '결제 사전 알림이 전 구독자 id 를 한 번에 묻는다')
  assert.match(timing, /selectInChunks\(ids,/, '결제 시점 조회가 나눠 묻지 않는다')
  assert.ok(existsSync(join(ROOT, 'lib', 'supabase', 'in-chunks.ts')), '공용 나눔 도우미가 없다')
})

test('규칙191: AI 상담은 설문 알레르기를 읽고, 모르면 묻고, 정기배송 중인 보호자만 쓴다', async () => {
  for (const f of [['app', 'api', 'chatbot', 'route.ts'], ['app', 'api', 'chatbot', 'stream', 'route.ts']]) {
    const src = code(...f)
    assert.ok(!/from\('dogs'\)[\s\S]{0,200}allergies/.test(src), `${f.join('/')}: 늘 비어 있는 dogs.allergies 를 읽는다`)
    assert.match(src, /loadChatDogInfo\(user\.id, dogId\)/, `${f.join('/')}: 강아지 정보를 설문 기준 도우미로 읽지 않는다`)
    assert.match(src, /checkChatbotAccess\(user\.id\)/, `${f.join('/')}: 정기배송 여부를 확인하지 않는다`)
    assert.match(src, /code: CHATBOT_SUBSCRIBERS_ONLY[\s\S]{0,120}status: 403/, `${f.join('/')}: 정기배송 아닌 보호자에게 403 을 안 준다`)
    assert.ok(src.indexOf('checkChatbotAccess') < src.indexOf('checkAiUserDailyLimit('), `${f.join('/')}: 하루 한도를 먼저 센다`)
  }
  const server = code('lib', 'chatbot', 'server.ts')
  assert.match(server, /from\('surveys'\)[\s\S]{0,120}answers, chronic_conditions/, '최신 설문을 읽지 않는다')
  assert.match(server, /order\('created_at', \{ ascending: false \}\)\s*\.limit\(1\)/, '최신 설문 한 건이 아니다')
  const prompt = read('lib', 'chatbot-system-prompt.ts')
  assert.ok(prompt.includes('어떤 형태로도 권하지 않아요'), '시스템 프롬프트에 알레르기 재료 금지 규칙이 없다')
  assert.ok(prompt.includes("'알 수 없음'") && prompt.includes('먼저'), '시스템 프롬프트에 모르면 먼저 묻기 규칙이 없다')
  const page = code('app', '(main)', 'chat', 'page.tsx')
  assert.match(page, /checkChatbotAccess\(user\.id\)[\s\S]{0,200}ChatSubscribersOnly/, '챗봇 화면이 정기배송 아닌 보호자에게 안내를 안 보인다')
  assert.ok(read('app', '(main)', 'chat', 'ChatParts.tsx').includes('href="/mypage/subscriptions"'), '안내 화면에 정기배송 시작 길이 없다')

  const ctx = await load<typeof import('./chatbot/dog-context.ts')>('lib', 'chatbot', 'dog-context.ts')
  const dog = { name: '땅콩', breed: '셸티', age_value: 3, age_unit: '살', weight: 9, gender: '수컷', neutered: true }
  const withAllergy = ctx.buildDogInfoBlock(dog, { answers: { allergies: ['소고기', '계란'] }, chronic_conditions: [] })
  assert.match(withAllergy, /알러지: 소고기, 계란/, '설문 알레르기가 AI 에게 안 간다')
  assert.ok(!ctx.buildDogInfoBlock(dog, null).includes('알러지: 없음'), '설문이 없는데 알레르기를 없음으로 넘긴다')
  const elig = await load<typeof import('./chatbot/eligibility.ts')>('lib', 'chatbot', 'eligibility.ts')
  const sub = { next_delivery_date: '2026-10-20', failed_charge_count: 0, requires_billing_key_renewal: false, has_billing_key: true }
  assert.equal(elig.canUseChatbot([{ ...sub, status: 'active' as const }]), true)
  assert.equal(elig.canUseChatbot([{ ...sub, status: 'paused' as const }]), true)
  assert.equal(elig.canUseChatbot([{ ...sub, status: 'active' as const, has_billing_key: false }]), false, '카드 없는 유령 구독도 허용한다')
  assert.equal(elig.canUseChatbot([]), false)
})

test('규칙192: 결제 3회 실패로 멈추면 재시도 일정을 지우고, 메일·웹은 "카드 다시 등록"으로 안내한다', async () => {
  const cron = code('app', 'api', 'cron', 'subscription-charge', 'route.ts')
  const clear = cron.indexOf('if (shouldPause) nextRetryAt = null')
  assert.ok(clear > 0, '정지할 때 next_retry_at 을 지우지 않는다')
  assert.ok(clear < cron.indexOf('next_retry_at: nextRetryAt'), '재시도 일정을 지우기 전에 저장값을 만든다')

  const t = await load<typeof import('./email/templates/subscription.ts')>('lib', 'email', 'templates', 'subscription.ts')
  const base = { recipientName: '보호자', productLabel: '닭고기 화식', amount: 90900, attemptCount: 3, reason: '잔액 부족' }
  const paused = t.renderSubscriptionChargeFailed({ ...base, paused: true, errorClass: 'transient', nextRetryAt: '2026-10-14T00:05:00Z' })
  assert.ok(!paused.html.includes('다음 재시도') && !paused.html.includes('다시 시도해드릴게요'), '멈춘 구독에 재시도 예정을 말한다')
  assert.ok(paused.html.includes('카드를 다시 등록하면 바로 다시 시작돼요'), '멈춘 구독에 카드 재등록 안내가 없다')
  const unknown = t.renderSubscriptionChargeFailed({ ...base, paused: false, errorClass: 'unknown', outcomeUnknown: true, reason: '결제 실패' })
  assert.ok(!unknown.html.includes('결제 실패'), '결과 확인 중 메일에 "결제 실패"가 있다')
  assert.ok(!unknown.html.includes('사유:'), '결과 확인 중 메일에 실패 사유 줄이 있다')
  assert.ok(!/다른 카드|새로 등록/.test(unknown.html), '결과 확인 중 메일이 다른 카드 등록을 권한다')

  const web = code('app', 'account', 'subscriptions', 'SubscriptionsWebClient.tsx')
  assert.match(web, /sub\.next_retry_at && !needsRenewal && sub\.status !== 'paused' && <span/, "웹 화면이 멈춘 구독에 '재시도 예정'을 보인다")
})

test('규칙193: 알림 설정은 보낸 칸만 바꾸고, 읽기 오류를 기본값으로 착각하지 않는다', async () => {
  const route = code('app', 'api', 'push', 'preferences', 'route.ts')
  assert.ok(!/\.\.\.DEFAULTS,\s*\.\.\.\(existing/.test(route), '기본값·읽은 값·보낸 값을 합쳐 통째로 쓴다')
  assert.match(route, /ignoreDuplicates: true/, '행이 없을 때 기본값 행을 on conflict do nothing 으로 만들지 않는다')
  assert.match(route, /\.update\(\{ \.\.\.patch, updated_at/, '보낸 칸만 update 하지 않는다')
  assert.match(route, /if \(readErr\) \{\s*return dbError\([^)]*503\)/, '읽기 오류에 503 을 안 준다')
  assert.match(route, /export async function GET[\s\S]*?if \(error\) \{\s*return dbError\([^)]*500\)/, 'GET 조회 오류를 기본값으로 접는다')
  assert.match(route, /patch\.notify_marketing !== prev\.notify_marketing/, '광고 동의 변화를 실제 이전 값과 비교하지 않는다')
  const panel = code('app', '(main)', 'mypage', 'notifications', 'PreferencesPanel.tsx')
  assert.match(panel, /const locked = saving !== null/, '저장 중 잠금 판정이 없다')
  assert.match(panel, /const busy = locked/, '토글이 저장 중에 다른 칸을 잠그지 않는다')
  assert.equal((panel.match(/disabled=\{locked\}/g) ?? []).length, 3, '방해 금지 체크·시각 고르기가 저장 중에 잠기지 않는다')

  const p = await load<typeof import('./push-preferences.ts')>('lib', 'push-preferences.ts')
  const cur = { ...p.PUSH_PREF_DEFAULTS, quiet_hours_start: 22, quiet_hours_end: 8 }
  assert.equal(p.validateQuietHours(cur, { quiet_hours_start: 23 }), null, '한쪽 시각만 바꾸면 거절한다')
  assert.equal(p.parsePrefsPatch({ user_id: 'x' }).ok, false, '모르는 칸(user_id)을 받아들인다')
})

test('규칙194: 체중 기록 날짜는 한국 날짜', () => {
  for (const f of [['app', '(main)', 'dogs', '[id]', 'DogDetailClient.tsx'], ['components', 'v3', 'sheet', 'QuickWeightSheet.tsx']]) {
    const src = code(...f)
    assert.match(src, /from\('weight_logs'\)[\s\S]{0,200}measured_at: todayKstIsoDate\(\)/, `${f.join('/')}: 체중 저장에 한국 날짜를 안 넣는다`)
  }
  const mig = migration('weight_logs_measured_at_kst')
  assert.match(mig, /alter column measured_at set default \(\(now\(\) at time zone 'Asia\/Seoul'\)::date\)/, '기본값이 한국 날짜가 아니다')
})

test("규칙195: 앱에 없는 '마이페이지'를 알림·메일에 쓰지 않는다 · 메일은 앱 경로를 가리키지 않는다", async () => {
  const m = await load<typeof import('./push-marketing.ts')>('lib', 'push-marketing.ts')
  assert.ok(!m.AD_OPT_OUT_LINE.includes('마이페이지') && m.AD_OPT_OUT_LINE.includes('내 정보'), `광고 수신거부 안내가 없는 메뉴를 가리킨다: ${m.AD_OPT_OUT_LINE}`)
  const cron = code('app', 'api', 'cron', 'subscription-charge', 'route.ts')
  const pushBody = cron.slice(cron.indexOf('const pushBody'), cron.indexOf('const pushBody') + 600)
  assert.ok(!pushBody.includes('마이페이지'), "결제 실패 푸시가 '마이페이지'를 안내한다")
  for (const f of [['lib', 'email', 'templates', 'subscription.ts'], ['lib', 'email', 'templates', 'newsletter.ts']]) {
    const src = code(...f)
    assert.ok(!src.includes('마이페이지'), `${f.join('/')}: 메일이 '마이페이지'를 안내한다`)
    assert.ok(!/SITE_URL\}\/mypage/.test(src), `${f.join('/')}: 메일 링크가 앱 경로(/mypage)를 가리킨다`)
  }
  assert.ok(!code('lib', 'email', 'templates', 'newsletter.ts').includes('언제든'), "메일에 금지어 '언제든'")
})

test('규칙196: 심장 검진 안내 크론은 꺼져 있고, 인증 안 한 가입 30일 정리 크론이 하루 한 번 돈다', async () => {
  const vercel = JSON.parse(read('vercel.json')) as { crons: Array<{ path: string; schedule: string }>; functions: Record<string, unknown> }
  assert.ok(!vercel.crons.some((c) => c.path.includes('dcm-screening-reminder')), '심장 검진 크론이 아직 일정에 있다')
  assert.ok(!Object.keys(vercel.functions).some((k) => k.includes('dcm-screening-reminder')), '꺼진 크론의 실행시간 설정이 남았다')
  const purge = vercel.crons.find((c) => c.path === '/api/cron/unverified-signup-purge')
  assert.ok(purge, '인증 안 한 가입 정리 크론이 일정에 없다')
  assert.match(purge!.schedule, /^\d+ \d+ \* \* \*$/, '정리 크론이 하루 1회가 아니다')
  assert.ok('app/api/cron/unverified-signup-purge/route.ts' in vercel.functions, '정리 크론 실행시간이 없다')
  const route = code('app', 'api', 'cron', 'unverified-signup-purge', 'route.ts')
  assert.match(route, /isUnverifiedPurgeCandidate\(u, nowMs\)/, '대상 판정 정본을 안 쓴다')
  for (const t of ['dogs', 'orders', 'subscriptions']) {
    assert.ok(route.includes(`admin.from('${t}').select('user_id').in('user_id', chunk)`), `${t} 가 있는 계정을 거르지 않는다`)
  }
  assert.match(route, /if \(lookupErr\) \{[\s\S]{0,200}status: 500/, '확인 조회가 실패해도 지운다')
  assert.match(route, /auth\.admin\.deleteUser\(id\)/, 'auth 사용자를 지우지 않는다')
  const tracking = read('lib', 'cron-tracking.ts')
  for (const k of ["'purged'", "'keptWithData'", "'checked'"]) assert.ok(tracking.includes(k), `cron_health 요약이 ${k} 를 자른다`)
  // 2026-10-14 사장님 "이때까지 인증 안 한 사람은 냅두고 앞으로는 제대로" — 방침 시행일(7일 전 고지) 이후 가입만 정리.
  const privacy = read('app', 'legal', 'privacy', 'page.tsx')
  assert.ok(privacy.includes('30일 안에 이메일 인증을 마치지 않은 가입 정보는') && privacy.includes('2026년 10월 21일 이후 가입한 계정부터 적용합니다'), '개인정보처리방침에 30일 정리 고지(적용 시작일 포함)가 없다')
  const u = await load<typeof import('./auth/unverified-signup.ts')>('lib', 'auth', 'unverified-signup.ts')
  const eff = privacy.match(/const EFFECTIVE_DATE = '(\d{4}-\d{2}-\d{2})'/)?.[1]
  assert.equal(eff, u.UNVERIFIED_PURGE_APPLIES_FROM.slice(0, 10), '방침 시행일과 정리 적용 시작일이 다르다(고지 전에 지우게 된다)')
  const start = Date.parse(u.UNVERIFIED_PURGE_APPLIES_FROM)
  const fresh = { id: 'a', created_at: new Date(start + 86_400_000).toISOString(), email_confirmed_at: null, last_sign_in_at: null, app_metadata: { provider: 'email', providers: ['email'] } }
  const later = start + 40 * 86_400_000
  assert.equal(u.isUnverifiedPurgeCandidate(fresh, later), true)
  assert.equal(u.isUnverifiedPurgeCandidate({ ...fresh, app_metadata: { provider: 'kakao', providers: ['kakao'] } }, later), false, '카카오 가입을 지운다')
  assert.equal(u.isUnverifiedPurgeCandidate({ ...fresh, created_at: '2026-09-02T05:00:00Z' }, later), false, '방침 시행 전 가입(사장님: 냅두기)을 지운다')
})

test('규칙197: 운영 메모·동의 기록·해시·수의사 공유·기록 주인 칸 — DB 잠금과 코드가 같이 옮겨졌다', () => {
  // (a) 운영 메모
  const notes = migration('admin_user_notes')
  assert.match(notes, /create table if not exists public\.admin_user_notes/, '운영 메모 표가 없다')
  assert.match(notes, /using \(public\.is_admin\(\)\)/, '운영 메모를 관리자만 읽게 하지 않는다')
  assert.match(notes, /revoke all on table public\.admin_user_notes from anon, authenticated/, '고객 권한을 회수하지 않는다')
  const drop = migration('drop_profiles_admin_note')
  assert.match(drop, /raise exception[\s\S]*alter table public\.profiles drop column admin_note/, '옛 칸을 확인 없이 지운다')
  for (const f of [
    ['app', 'api', 'admin', 'users', '[id]', 'note', 'route.ts'],
    ['app', 'admin', 'users', '[id]', 'message', 'page.tsx'],
    ['app', 'api', 'account', 'delete', 'route.ts'],
  ]) {
    assert.ok(!code(...f).includes('admin_note'), `${f.join('/')}: 옛 칸 profiles.admin_note 를 아직 쓴다`)
  }
  assert.ok(code('app', 'api', 'account', 'delete', 'route.ts').includes("admin.from('admin_user_notes').delete().eq('user_id', user.id)"), '탈퇴 때 운영 메모를 지우지 않는다')
  assert.ok(!read('lib', 'supabase', 'types.ts').includes('admin_note'), '타입에 옛 칸이 남았다')
  // (b) 동의 기록
  const consent = migration('consent_log_lock')
  assert.match(consent, /revoke insert, update, delete, truncate on table public\.consent_log from anon, authenticated/, '고객이 동의 기록을 쓸 수 있다')
  assert.match(consent, /before insert or update of agree_email, agree_email_at, agree_sms, agree_sms_at/, '동의 시각 트리거가 없다')
  const signup = code('lib', 'auth', 'applySignupProfile.ts')
  assert.ok(!signup.includes("from('consent_log')") && !signup.includes('agree_email_at'), '가입 복원이 동의 기록·시각을 고객 권한으로 직접 쓴다')
  assert.match(signup, /rpc\('set_marketing_consent'/, '가입 동의가 서버 함수를 거치지 않는다')
  const prefs = code('app', 'api', 'push', 'preferences', 'route.ts')
  assert.ok(!/supabase\s*\.from\('consent_log'\)/.test(prefs) && prefs.includes("createAdminClient().from('consent_log')"), '푸시 동의 기록을 고객 권한으로 쓴다')
  // (c) 해시
  assert.match(migration('sha256_hex'), /set search_path = public, extensions, pg_catalog/, 'sha256_hex 가 digest 를 못 찾는다')
  assert.match(code('app', 'api', 'account', 'delete', 'route.ts'), /const \{ data: hashData, error: hashErr \} = await admin\.rpc\('sha256_hex'/, '해시 RPC 오류를 안 본다')
  // (d) 수의사 공유
  const vet = migration('fetch_vet_share')
  assert.match(vet, /s\.answers -> 'allergies'/, '수의사 공유가 설문 알레르기를 안 읽는다')
  assert.ok(!/weight_measured_at,\s*allergies\s*INTO v_dog/.test(vet), '수의사 공유가 아직 dogs.allergies 를 읽는다')
  // (e) 기록 주인 칸
  const recs = migration('dog_records_lock_user_id')
  for (const t of ['weight_logs', 'dog_medications', 'dog_vaccinations']) {
    assert.ok(recs.includes(`revoke update on table public.${t} from anon, authenticated;`), `${t} 표 단위 UPDATE 를 회수하지 않는다`)
    const grant = new RegExp(`grant update \\(([^)]*)\\)\\s*on table public\\.${t} to authenticated`).exec(recs)
    assert.ok(grant && !/\buser_id\b/.test(grant[1]!), `${t}: user_id 를 다시 열었다`)
  }
})

test('규칙198: 같은 택배사·송장번호가 다른 주문에 있으면 확인해야 저장된다(경고만, DB 제약 없음)', () => {
  for (const f of [['app', 'api', 'admin', 'orders', '[id]', 'tracking', 'route.ts'], ['app', 'api', 'admin', 'orders', '[id]', 'status', 'route.ts']]) {
    const src = code(...f)
    assert.match(src, /if \(body\.confirmDuplicate !== true\) \{\s*const dup = await findTrackingDuplicates\(/, `${f.join('/')}: 송장 중복을 확인하지 않는다`)
    assert.match(src, /if \(dup\.error\) \{[\s\S]{0,200}status: 409/, `${f.join('/')}: 중복 확인 실패를 '중복 없음'으로 넘긴다`)
  }
  const ui = code('app', 'admin', 'orders', '[id]', 'ShippingControl.tsx')
  assert.match(ui, /data\.code === DUPLICATE_TRACKING \|\| data\.code === DUPLICATE_TRACKING_CHECK_FAILED[\s\S]{0,200}window\.confirm/, '중복 경고 확인 창이 없다')
  assert.match(ui, /res = await send\(true\)/, '확인 뒤 다시 보내지 않는다')
  const migs = readdirSync(join(ROOT, 'supabase', 'migrations')).filter((n) => n.startsWith('20261013'))
  for (const n of migs) {
    assert.ok(!/unique[^;]*tracking_number/i.test(readFileSync(join(ROOT, 'supabase', 'migrations', n), 'utf8')), `${n}: 송장번호 DB 제약을 걸었다(사장님 결정은 화면 경고만)`)
  }
})

test('규칙199: 체험팩은 14,900원(사장님 10/17, 10/13 은 13,900원) — 숫자는 상품표 한 곳에서만', async () => {
  const c = await load<typeof import('./store/catalog.ts')>('lib', 'store', 'catalog.ts')
  assert.equal(c.TRIAL_PRICE, 14_900)
  assert.equal(c.TRIAL_ITEM.price, 14_900)
  assert.equal(c.TRIAL_PRICE % 4, 0, '체험팩 값이 4로 나누어떨어지지 않으면 품목 합이 어긋난다')
  // 옛 가격을 글자로 적은 곳이 없어야 한다 — 숫자는 TRIAL_PRICE 를 따라간다.
  for (const f of [['lib', 'store', 'catalog.ts'], ['app', 'llms.txt', 'route.ts'], ['lib', 'store', 'faq.ts'], ['app', 'our-food', 'page.tsx'], ['app', 'store', 'page.tsx']]) {
    assert.ok(!/14[,_]?000|13[,_]?900/.test(code(...f)), `${f.join('/')}: 옛 체험팩 가격(14,000·13,900)이 남았다`)
  }
  // 체험팩은 50g 팩 — 100g(단품 팩)으로 소개하지 않는다.
  assert.ok(!/종을 \$\{PACK_G\}g씩 맛보는 체험팩/.test(code('app', 'our-food', 'page.tsx')), '체험팩을 100g씩이라고 소개한다(실제 50g)')
})
