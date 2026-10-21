/**
 * 2026-10-21 사장님 "두 번째 설문하는 사람들은 그거에 맞춰서 나가야" — 서포터즈 낑콩이가 설문을 다시 했는데 박스는 첫 설문 그대로였다
 * (재제안 크론은 박스 3개마다만 계산). 결정: 바로 다음 박스부터 제안. 다시 한 설문 → 재제안 크론 앞당김 요청(규칙258 장치 재사용).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n')

test('규칙309: 다시 한 설문(정기배송 진행 중) → 앞당김 요청 — 첫 설문 제외·강아지당 1건·고객이 직접 못 부름·계산은 크론 정본', () => {
  const sql = read('supabase', 'migrations', '20261021120000_resurvey_proposal_request.sql').replace(/--[^\n]*/g, '')
  assert.match(sql, /check \(reason in \('admin_allergy_edit', 'resurvey'\)\)/, "요청 사유에 'resurvey' 가 없다")
  assert.match(sql, /after insert on public\.surveys/, '설문 저장 트리거가 없다')
  assert.match(sql, /security definer\s+set search_path = public, pg_temp/, '트리거 함수가 search_path 고정 SECURITY DEFINER 가 아니다')
  assert.match(sql, /revoke all on function public\.queue_resurvey_proposal\(\) from public, anon, authenticated/, '고객이 트리거 함수를 직접 부를 수 있다')
  assert.match(sql, /s\.id <> new\.id/, '첫 설문에도 요청을 만든다(이전 설문 확인이 없다)')
  assert.match(sql, /sub\.status = 'active' and sub\.billing_key is not null/, '정기배송 진행 중일 때만이 아니다')
  assert.match(sql, /on conflict \(dog_id\) where processed_at is null do nothing/, '대기 요청이 있으면 그대로 두지 않는다(강아지당 1건)')
  // 트리거는 요청만 남긴다 — 식단·금액은 크론(decideNextBox → 동의)이 정본. 여기서 dog_formulas·subscriptions 를 쓰면 동의 없이 바뀐다.
  assert.ok(!/(insert into|update) public\.(dog_formulas|subscriptions)/.test(sql), '트리거가 식단·구독을 직접 바꾼다')
  // 크론은 앞당김 요청이 있으면 박스 수를 기다리지 않는다(사유는 보지 않는다).
  const cron = read('app', 'api', 'cron', 'personalization-progression', 'route.ts')
  assert.match(cron, /!isCycleDue\(boxesShipped \?\? 0\) && !earlyDogIds\.has\(dogId\)/)
  // 어드민 알레르기 수정은 같은 설문 행 뒤에 요청을 넣는다 — 트리거가 먼저 넣은 요청과 부딪히면(23505) 성공으로 읽어야 한다.
  assert.match(read('app', 'api', 'admin', 'users', '[id]', 'allergies', 'route.ts'), /code === '23505'/)
})
