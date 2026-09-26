import { redactTokenPaths } from './token-paths.ts'

/**
 * Sentry 로 가는 이벤트의 한국형 개인정보·열람권 주소 가림 — 브라우저·서버·엣지 공용.
 *
 * Sentry 기본 스크러버는 이메일·카드 같은 글로벌 패턴만 잡고 주민번호·한국 휴대폰·사업자번호·
 * 계좌는 못 잡는다. 에러 메시지·브레드크럼·요청 URL 에 찍힐 수 있어 한 번 더 치운다(오탐 허용 —
 * 로그 가독성보다 유출 방지가 우선). /vet/·/photo-upload/ 주소는 그 자체가 열람권이라 토큰을 가린다.
 *
 * ★2026-09-26 사고 — 이 함수가 세 설정 파일에 각자 복사돼 있었고, 8차 점검에서 성능 트랜잭션
 *   (beforeSendTransaction)에도 붙였더니 **모든 트랜잭션이 `RangeError: Maximum call stack size
 *   exceeded` 로 터졌다**(Sentry FARMERSTAIL-APP-13, 배포 약 2시간 뒤 사장님 메일). 트랜잭션 이벤트는
 *   `sdkProcessingMetadata.capturedSpanScope` 에 Sentry 의 Scope 객체를 싣는데, Scope → Client →
 *   통합(Replay 등) 이 서로를 가리키는 순환 그래프라 무작정 재귀하던 walk 가 끝나지 않았다.
 *   Sentry 는 파이프라인 오류를 새 이벤트로 보내므로 사용자 화면엔 아무 일 없이 알림만 쌓였고,
 *   성능 기록은 전부 버려졌다.
 *   → ① sdkProcessingMetadata 는 SDK 내부용(전송 안 됨)이라 손대지 않고 그대로 둔다
 *     ② 평범한 객체·배열만 들어간다 — Scope·Error·DOM 같은 클래스 인스턴스는 그대로 돌려준다
 *        (보내기 전 Sentry 가 평범한 JSON 으로 정규화하고, 그 결과는 beforeSend 에서 다시 걸러진다)
 *     ③ 이미 본 객체는 다시 들어가지 않는다(순환 안전).
 *   lib/sentry-scrub.test.ts 가 실제 Scope 모양의 순환 객체로 이걸 지킨다.
 */

const RRN = /\b\d{6}-?[1-4]\d{6}\b/g // 주민번호
const PHONE = /\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g // 한국 휴대폰
const BRN = /\b\d{3}-?\d{2}-?\d{5}\b/g // 사업자등록번호
const ACCT = /\b\d{2,4}-\d{2,4}-\d{4,7}\b/g // 계좌번호 대략
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g // 이메일

/** SDK 내부용 칸 — 전송되지 않고, Scope 같은 순환 객체가 들어 있다. 절대 들어가지 않는다. */
const SDK_INTERNAL_KEYS = new Set(['sdkProcessingMetadata'])

export function scrubSentryString(s: string): string {
  return redactTokenPaths(
    s
      .replace(RRN, '[주민번호]')
      .replace(PHONE, '[휴대폰]')
      .replace(BRN, '[사업자번호]')
      .replace(ACCT, '[계좌]')
      .replace(EMAIL, '[이메일]'),
  )
}

function isPlainObject(v: object): v is Record<string, unknown> {
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

/** 이벤트·트랜잭션·브레드크럼 data 어디든. 원본은 바꾸지 않고 가린 사본을 돌려준다. */
export function scrubSentryEvent<T>(event: T): T {
  const seen = new WeakMap<object, unknown>()
  const walk = (val: unknown): unknown => {
    if (typeof val === 'string') return scrubSentryString(val)
    if (!val || typeof val !== 'object') return val
    const done = seen.get(val)
    if (done !== undefined) return done
    if (Array.isArray(val)) {
      const out: unknown[] = []
      seen.set(val, out)
      for (const v of val) out.push(walk(v))
      return out
    }
    if (!isPlainObject(val)) return val
    const out: Record<string, unknown> = {}
    seen.set(val, out)
    for (const [k, v] of Object.entries(val)) out[k] = SDK_INTERNAL_KEYS.has(k) ? v : walk(v)
    return out
  }
  return walk(event) as T
}
