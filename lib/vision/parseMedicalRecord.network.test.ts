import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseMedicalRecord, normalize } from './parseMedicalRecord.ts'

type SpiedCall = { url: string; body: unknown }

/**
 * fetch 를 대체해 나간 요청을 기록한다. **테스트가 외부 네트워크를 타지 않게**
 * 하는 게 목적이고, 동시에 "무엇을 보냈는지" 를 검증할 수 있게 한다.
 * 어떤 경우에도 원래 fetch 를 복원한다.
 */
async function withFetchSpy(
  run: () => Promise<void>,
  respond: () => Response = () =>
    new Response(JSON.stringify({ error: { type: 'authentication_error' } }), {
      status: 401,
    }),
): Promise<SpiedCall[]> {
  const calls: SpiedCall[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown, init?: { body?: unknown }) => {
    calls.push({ url: String(input), body: init?.body })
    return respond()
  }) as unknown as typeof globalThis.fetch
  try {
    await run()
  } finally {
    globalThis.fetch = original
  }
  return calls
}

/**
 * [D1] parseMedicalRecord — Anthropic API 호출 분기 / 에러 처리 테스트.
 *
 * ★fetch 를 **실제로** 대체한다 (2026-08-08 테스트 감사).
 *  예전 docstring 은 "실제 API 호출 없이 fetch mock 으로 검증" 이라고 적었지만
 *  **mock 이 없었다** — `npm test` 를 돌릴 때마다 api.anthropic.com 으로
 *  진짜 HTTPS 요청이 나갔고(CI 포함), 단언은 `assert.ok(!r.ok)` 하나라
 *  네트워크가 끊겨도·차단돼도·키가 틀려도 전부 통과했다. 테스트 이름은
 *  "mime default" 인데 mime 에 대해 아무것도 검증하지 않았다.
 *  AGENTS.md 규칙4 — 없는 방어를 주장하는 주석.
 */
describe('parseMedicalRecord — error handling', () => {
  it('빈 base64 → INVALID_IMAGE (네트워크 안 탐)', async () => {
    const calls = await withFetchSpy(async () => {
      const r = await parseMedicalRecord('', 'fake-key')
      assert.equal(r.ok, false)
      assert.match(r.code, /INVALID/)
    })
    // 이미지가 비었으면 API 를 부르기 전에 걸러야 한다.
    assert.equal(calls.length, 0, '빈 이미지인데 API 를 호출했다')
  })

  it('raw base64 → data url 없이도 image/jpeg 로 보낸다', async () => {
    const calls = await withFetchSpy(
      async () => {
        const r = await parseMedicalRecord('aGVsbG8=', 'fake-key')
        // 401 응답 → AI_ERROR 계열. ok:false 만 보면 아무것도 안 지킨다.
        assert.equal(r.ok, false)
      },
      // 인증 실패를 흉내낸다(예전엔 진짜 서버가 이걸 돌려줬다).
      () =>
        new Response(
          JSON.stringify({ error: { type: 'authentication_error' } }),
          { status: 401 },
        ),
    )
    assert.equal(calls.length, 1, 'API 를 정확히 한 번 불러야 한다')
    const body = JSON.parse(String(calls[0]!.body)) as {
      messages: Array<{
        content: Array<{ type: string; source?: { media_type?: string; data?: string } }>
      }>
    }
    const img = body.messages[0]!.content.find((c) => c.type === 'image')
    assert.ok(img, '이미지 블록이 없다')
    // ★이 테스트 이름이 주장하는 것 — data url prefix 가 없으면 jpeg 기본값.
    assert.equal(img.source?.media_type, 'image/jpeg')
    assert.equal(img.source?.data, 'aGVsbG8=')
  })

  it('data url 이면 그 mime 을 그대로 쓴다', async () => {
    const calls = await withFetchSpy(
      async () => {
        await parseMedicalRecord(
          'data:image/png;base64,aGVsbG8=',
          'fake-key',
        )
      },
      () => new Response(JSON.stringify({ error: { type: 'x' } }), { status: 401 }),
    )
    const body = JSON.parse(String(calls[0]!.body)) as {
      messages: Array<{
        content: Array<{ type: string; source?: { media_type?: string; data?: string } }>
      }>
    }
    const img = body.messages[0]!.content.find((c) => c.type === 'image')
    assert.equal(img?.source?.media_type, 'image/png')
    // prefix 는 벗겨서 순수 base64 만 보내야 한다.
    assert.equal(img?.source?.data, 'aGVsbG8=')
  })

  it('네트워크가 끊기면 NETWORK_ERROR', async () => {
    await withFetchSpy(
      async () => {
        const r = await parseMedicalRecord('aGVsbG8=', 'fake-key')
        assert.equal(r.ok, false)
        assert.equal(r.code, 'NETWORK_ERROR')
      },
      () => {
        throw new TypeError('fetch failed')
      },
    )
  })
})

describe('parseMedicalRecord — normalize edge cases', () => {
  it('medications 의 name 만 있고 dosage 없음 → frequency null', () => {
    const r = normalize({
      medications: [{ name: '아포퀠' }],
    })
    assert.equal(r.medications.length, 1)
    assert.equal(r.medications[0]!.dosage, null)
    assert.equal(r.medications[0]!.frequency, null)
  })

  it('visitDate 비-string → null', () => {
    const r = normalize({ visitDate: 12345 })
    assert.equal(r.visitDate, null)
  })

  it('weightKg infinity → null', () => {
    const r = normalize({ weightKg: Infinity })
    assert.equal(r.weightKg, null)
  })
})
