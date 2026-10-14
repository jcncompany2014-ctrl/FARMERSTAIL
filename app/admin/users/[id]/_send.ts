/**
 * 고객 화면 쓰기 요청 — 문의 메모·운영 메모·배송지·알레르기 폼이 같이 쓴다 (2026-10-15 F-b, 규칙277).
 *
 * # 왜
 * 폼마다 fetch 를 try 없이 불러서, 폰 신호가 약해 요청이 던지면 setSaving(false) 까지 가지 못해 단추가 '저장 중'에서 멈췄고
 * 아무 안내도 없었다(새로고침하면 적던 내용이 사라진다). 여기서 끊김·서버 오류·JSON 아닌 응답(504 등)을 전부 결과로 바꾼다 —
 * 던지지 않는다. 호출부는 finally 로 단추를 풀고, 실패면 이 문구를 보여 주고 입력은 그대로 둔다.
 */

export const OFFLINE_MESSAGE = '인터넷 연결을 확인하고 다시 눌러 주세요 — 적은 내용은 그대로 있어요'

export type SendResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number | null; offline: boolean; code: string | null; message: string; data: Record<string, unknown> | null }

export async function sendAdminJson<T = Record<string, unknown>>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  payload: Record<string, unknown>,
  fallbackMessage = '저장하지 못했어요',
): Promise<SendResult<T>> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    return { ok: false, status: null, offline: true, code: null, message: OFFLINE_MESSAGE, data: null }
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok) {
    const message = typeof json?.message === 'string' && json.message ? json.message : `${fallbackMessage}(${res.status})`
    const code = typeof json?.code === 'string' ? json.code : null
    return { ok: false, status: res.status, offline: false, code, message, data: json }
  }
  return { ok: true, status: res.status, data: (json ?? {}) as T }
}
