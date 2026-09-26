/**
 * lib/sentry-scrub — 한국형 개인정보·열람권 주소 가림 (2026-09-26 FARMERSTAIL-APP-13 사고 후).
 *
 * 핵심은 마지막 두 테스트: **실제 Sentry SDK 파이프라인**에 트랜잭션을 흘려서 ① 트랜잭션이 가려진 채
 * 전송되고 ② 'Event processing pipeline threw' 로 생기는 RangeError 이벤트가 없는지 본다. 사고 때
 * 스크러버는 문자열·평범한 객체 단위 테스트로는 멀쩡했다 — 트랜잭션에만 실려 오는 Scope(순환 객체)를
 * 만났을 때만 터졌으므로, 가짜 모양이 아니라 SDK 가 만든 진짜 이벤트로 검사한다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  Client,
  createTransport,
  initAndBind,
  getCurrentScope,
  getIsolationScope,
  parseEnvelope,
  resolvedSyncPromise,
  setCurrentClient,
  startSpan,
  captureException,
} from '@sentry/core'
import { scrubSentryEvent, scrubSentryString } from './sentry-scrub.ts'

test('문자열: 주민번호·휴대폰·사업자번호·계좌·이메일·열람권 토큰을 가린다', () => {
  const s = scrubSentryString(
    '900101-1234567 010-1234-5678 123-45-67890 110-123-456789 a.b@c.kr /vet/abcDEF123 /photo-upload/t0k?x=1',
  )
  assert.equal(s, '[주민번호] [휴대폰] [사업자번호] [계좌] [이메일] /vet/[token] /photo-upload/[token]?x=1')
})

test('평범한 객체·배열은 끝까지 들어가 가리고, 원본은 바꾸지 않는다', () => {
  const ev = { request: { url: 'https://x/vet/tok' }, spans: [{ description: 'GET /photo-upload/zz' }], extra: { a: ['010 1234 5678'] } }
  const out = scrubSentryEvent(ev)
  assert.equal(out.request.url, 'https://x/vet/[token]')
  assert.equal(out.spans[0]?.description, 'GET /photo-upload/[token]')
  assert.deepEqual(out.extra.a, ['[휴대폰]'])
  assert.equal(ev.request.url, 'https://x/vet/tok', '원본을 바꿨다')
})

test('★순환 객체에서 멈춘다 — 평범한 객체 순환 · 클래스 인스턴스 순환', () => {
  const a: Record<string, unknown> = { name: '/vet/tok' }
  a.self = a
  const out = scrubSentryEvent({ a }) as { a: Record<string, unknown> }
  assert.equal(out.a.name, '/vet/[token]')
  assert.equal(out.a.self, out.a, '순환 구조를 보존하지 않았다')

  class Node2 { next: Node2 | null = null; label = '010-1234-5678' }
  const n1 = new Node2()
  const n2 = new Node2()
  n1.next = n2
  n2.next = n1
  const out2 = scrubSentryEvent({ n: n1 }) as { n: Node2 }
  assert.equal(out2.n, n1, '클래스 인스턴스는 그대로 돌려줘야 한다(Sentry 가 전송 전에 정규화한다)')
})

test('★sdkProcessingMetadata(Scope)는 들어가지도 바꾸지도 않는다', () => {
  const scope = getCurrentScope()
  const iso = getIsolationScope()
  const meta = { capturedSpanScope: scope, capturedSpanIsolationScope: iso, dynamicSamplingContext: {} }
  const out = scrubSentryEvent({ type: 'transaction', transaction: '/vet/tok', sdkProcessingMetadata: meta })
  assert.equal(out.sdkProcessingMetadata, meta)
  assert.equal(out.transaction, '/vet/[token]')
})

// ── 실제 SDK 파이프라인 ─────────────────────────────────────────────────────────
type TestClientOptions = Parameters<typeof initAndBind>[1]
class TestClient extends Client {
  constructor(options: TestClientOptions) {
    super(options)
  }
  eventFromException(e: unknown) {
    const err = e as Error
    return resolvedSyncPromise({ exception: { values: [{ type: err?.name, value: err?.message }] } })
  }
  eventFromMessage(message: string) {
    return resolvedSyncPromise({ message })
  }
}

async function runPipeline(): Promise<{ items: { type: string; payload: Record<string, unknown> }[] }> {
  const sent: (string | Uint8Array)[] = []
  const transport = createTransport({ recordDroppedEvent: () => {} }, (req) => {
    sent.push(req.body)
    return resolvedSyncPromise({ statusCode: 200 })
  })
  // 브라우저 클라이언트엔 서로를 가리키는 통합이 붙는다(Replay: ReplayContainer.clickDetector ↔
  // ClickDetector._replay). 트랜잭션의 capturedSpanScope → Scope._client → 옵션 → 통합으로 이어지는
  // 그 순환이 사고의 모양이다 — 코어만으로는 순환이 없어 옛 스크러버도 통과하므로 똑같이 달아 준다.
  type Cyclic = { name: string; setupOnce: () => void; container?: { detector: { owner?: unknown } } }
  const cyclic: Cyclic = { name: 'CyclicLikeReplay', setupOnce: () => {} }
  const container: { detector: { owner?: unknown } } = { detector: {} }
  container.detector.owner = container
  cyclic.container = container
  const client = new TestClient({
    dsn: 'https://public@o0.ingest.sentry.io/0',
    tracesSampleRate: 1,
    integrations: [cyclic],
    transport: () => transport,
    stackParser: () => [],
    beforeSend: (event) => scrubSentryEvent(event),
    beforeSendTransaction: (event) => scrubSentryEvent(event),
  })
  getCurrentScope().setClient(client)
  setCurrentClient(client)
  client.init()
  startSpan({ name: 'GET /vet/abcTOKEN123', op: 'pageload' }, () => {
    startSpan({ name: 'fetch /photo-upload/zzz' }, () => {})
  })
  captureException(new Error('보호자 010-1234-5678 결제 실패'))
  await client.flush(2000)
  const items: { type: string; payload: Record<string, unknown> }[] = []
  for (const body of sent) {
    const [, envItems] = parseEnvelope(body)
    for (const [header, payload] of envItems) items.push({ type: String(header.type), payload: payload as Record<string, unknown> })
  }
  return { items }
}

test('★실제 SDK: 트랜잭션이 가려진 채 전송되고, 파이프라인 RangeError 이벤트가 없다(FARMERSTAIL-APP-13)', async () => {
  const { items } = await runPipeline()
  const tx = items.find((i) => i.type === 'transaction')
  assert.ok(tx, `트랜잭션이 전송되지 않았다 — 파이프라인이 버렸다: ${JSON.stringify(items.map((i) => i.type))}`)
  assert.equal(tx.payload.transaction, 'GET /vet/[token]')
  const spans = (tx.payload.spans as { description?: string }[]) ?? []
  assert.ok(spans.some((s) => s.description === 'fetch /photo-upload/[token]'), '하위 스팬 이름의 토큰을 안 가렸다')
  const events = items.filter((i) => i.type === 'event')
  const internal = events.filter((e) => JSON.stringify(e.payload).includes('Maximum call stack'))
  assert.deepEqual(internal, [], '스크러버가 트랜잭션에서 터져 RangeError 이벤트가 생겼다')
  const errEv = events.find((e) => JSON.stringify(e.payload).includes('결제 실패'))
  assert.ok(errEv, '에러 이벤트가 전송되지 않았다')
  assert.ok(!JSON.stringify(errEv.payload).includes('010-1234-5678'), '에러 이벤트의 휴대폰을 안 가렸다')
})
