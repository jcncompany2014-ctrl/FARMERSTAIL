/**
 * 2026-10-21 사장님 제보 "앱 화면에서 왜 아직 택배사의 배송정보를 불러오지 못했어요 라고 뜨는지".
 *
 * 운영 로그: GET /api/tracking 마다 "[tracking] 택배사 응답 실패 400". 상류(tracker.delivery) 문서상 TrackInfo.events 는
 * Relay 연결(TrackEventConnection — edges.node, first/last/after/before)인데 조회문이 `events { time … }` 목록으로 물어
 * 조회문 형식 오류(400)가 났다. 키 없이·틀린 키로 보내면 200 + 인증 오류가 먼저 와서(실측), 키를 넣은 뒤에야 드러났다.
 * 고객 배송 조회 화면만 깨졌다 — tracking-poll 크론은 lastEvent 만 묻는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n')
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')

test('규칙305: 배송 조회 조회문 — events 는 연결(edges.node)로 묻고, 응답도 edges 에서 꺼낸다', () => {
  const src = stripComments(read('app', 'api', 'tracking', 'route.ts'))
  const q = src.slice(src.indexOf('const QUERY = `'), src.indexOf('`', src.indexOf('const QUERY = `') + 16) + 1)
  assert.ok(q.length > 20, '조회문을 못 찾았다(카나리아)')
  assert.match(q, /events\(last: \$\{MAX_EVENTS\}\)\s*\{\s*edges\s*\{\s*node\s*\{/, 'events 를 연결(edges.node)로 묻지 않는다 — 상류가 400 을 돌려준다')
  assert.doesNotMatch(q, /events\s*\{\s*time/, '옛 목록 형식(events { time … })이 돌아왔다')
  assert.match(src, /const MAX_EVENTS = \d+/)
  assert.match(src, /track\.events\?\.edges \?\? \[\]/, '응답의 edges 에서 이력을 꺼내지 않는다')
  assert.doesNotMatch(src, /track\.events\[track\.events\.length - 1\]/, '연결을 배열처럼 읽는다')
  // 상류 오류 본문을 서버 기록에 남긴다 — 상태코드만 남겨 원인 찾기가 늦었다.
  assert.match(src, /console\.error\('\[tracking\] 택배사 응답 실패', res\.status, detail\.slice\(0, 300\)\)/)
  // 매일 크론은 lastEvent 만 묻는다(events 를 묻게 바꾸면 같은 규칙을 지켜야 한다).
  const poll = stripComments(read('app', 'api', 'cron', 'tracking-poll', 'route.ts'))
  const pq = poll.slice(poll.indexOf('const QUERY = `'), poll.indexOf('`', poll.indexOf('const QUERY = `') + 16) + 1)
  assert.ok(pq.includes('lastEvent'), '크론 조회문 카나리아')
  assert.doesNotMatch(pq, /events\s*\{\s*time/, '크론이 events 를 옛 목록 형식으로 묻는다')
})
