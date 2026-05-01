/**
 * Native push 발송 — APNs (iOS) + FCM v1 (Android).
 *
 * 외부 라이브러리 없이 Node 22 의 crypto + fetch 만 사용.
 *
 * # 환경변수
 * - APNS_TEAM_ID                  Apple Developer Team ID (10자)
 * - APNS_KEY_ID                   Apple Auth Key ID
 * - APNS_PRIVATE_KEY              Apple Auth Key (.p8) PEM 본문 (\n 그대로)
 * - APNS_BUNDLE_ID                'com.farmerstail.app'
 * - APNS_USE_SANDBOX              '1' 이면 development gateway (실 기기 dev build)
 * - FCM_PROJECT_ID                Firebase 프로젝트 id
 * - FCM_CLIENT_EMAIL              service account email
 * - FCM_PRIVATE_KEY               service account private key PEM
 *
 * # 비용 / 신뢰성
 * - APNs HTTP/2 단일 POST 당 BadDeviceToken / Unregistered 응답이면 토큰 stale.
 *   호출처가 native_push_tokens row 삭제 책임.
 * - FCM v1 도 비슷한 NOT_FOUND / INVALID_ARGUMENT 응답.
 */
import crypto from 'node:crypto'

export type NativePushPayload = {
  title: string
  body: string
  /** 깊링크 URL (앱 라우팅) — Capacitor 가 click 시 처리. */
  url?: string
  /** 알림 배지 숫자 (iOS only). 미지정 시 변경 없음. */
  badge?: number
  /** Notification group / collapse — 같은 thread 알림이 묶이도록. */
  threadId?: string
  /** 사용자 정의 data — Capacitor PushNotifications listener 에 전달. */
  data?: Record<string, string>
}

export type NativePushResult = {
  ok: boolean
  /** 토큰이 stale (BadDeviceToken / Unregistered) — 호출처가 DB row 삭제. */
  unregistered?: boolean
  status?: number
  errorCode?: string
  errorMessage?: string
}

// ──────────────────────────────────────────────────────────────────────────
// APNs
// ──────────────────────────────────────────────────────────────────────────

let cachedApnsJwt: { token: string; expiresAt: number } | null = null
const APNS_JWT_TTL_MS = 50 * 60 * 1000 // 토큰은 1h 유효, 안전마진으로 50분

/**
 * APNs JWT 발급. ES256 (P-256) 서명. Apple 권장: 1시간마다 갱신.
 *
 * Node `crypto.createSign('SHA256')` 의 ECDSA 결과는 ASN.1 DER. JOSE 는
 * raw r||s (각 32 bytes) 를 요구하므로 변환 필요.
 */
function generateApnsJwt(): string | null {
  const teamId = process.env.APNS_TEAM_ID
  const keyId = process.env.APNS_KEY_ID
  const privateKeyPem = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!teamId || !keyId || !privateKeyPem) return null

  const now = Math.floor(Date.now() / 1000)
  if (cachedApnsJwt && cachedApnsJwt.expiresAt - 60 > now) {
    return cachedApnsJwt.token
  }

  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' }
  const payload = { iss: teamId, iat: now }
  const headerB64 = base64url(JSON.stringify(header))
  const payloadB64 = base64url(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`

  // ES256 서명 — DER 형식 결과를 raw r||s 로 변환.
  let derSig: Buffer
  try {
    const signer = crypto.createSign('SHA256')
    signer.update(signingInput)
    derSig = signer.sign(privateKeyPem)
  } catch {
    return null
  }
  const rawSig = derToJose(derSig)
  if (!rawSig) return null

  const token = `${signingInput}.${base64urlBuf(rawSig)}`
  cachedApnsJwt = { token, expiresAt: now + APNS_JWT_TTL_MS / 1000 }
  return token
}

/**
 * APNs DER → JOSE raw 변환. ECDSA-with-SHA256 (P-256) 의 r,s 는 각 32 bytes.
 * DER 인코딩이 leading 0 / negative bit 처리로 1~33 bytes 를 줄 수 있어 정규화.
 */
function derToJose(der: Buffer): Buffer | null {
  // SEQUENCE { INTEGER r, INTEGER s }
  if (der[0] !== 0x30) return null
  let offset = 2
  if (der[1] & 0x80) offset = 2 + (der[1] & 0x7f) // 긴 length
  if (der[offset] !== 0x02) return null
  const rLen = der[offset + 1]
  const r = der.subarray(offset + 2, offset + 2 + rLen)
  offset = offset + 2 + rLen
  if (der[offset] !== 0x02) return null
  const sLen = der[offset + 1]
  const s = der.subarray(offset + 2, offset + 2 + sLen)

  const out = Buffer.alloc(64)
  // r,s 가 33 bytes (leading 0) 면 첫 byte 스킵, 32 bytes 면 그대로, 더 짧으면 padding.
  copyPadded(r, out, 0)
  copyPadded(s, out, 32)
  return out
}

function copyPadded(src: Buffer, dest: Buffer, destStart: number) {
  const start = src.length > 32 ? src.length - 32 : 0
  const len = Math.min(32, src.length - start)
  dest.fill(0, destStart, destStart + 32)
  src.copy(dest, destStart + (32 - len), start, start + len)
}

function base64url(s: string): string {
  return base64urlBuf(Buffer.from(s, 'utf8'))
}
function base64urlBuf(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * APNs HTTP/2 발송. Node 22 의 fetch 가 HTTP/2 지원.
 */
export async function sendApnsPush(
  token: string,
  payload: NativePushPayload,
): Promise<NativePushResult> {
  const jwt = generateApnsJwt()
  const bundleId = process.env.APNS_BUNDLE_ID ?? 'com.farmerstail.app'
  if (!jwt) {
    return {
      ok: false,
      errorCode: 'APNS_NOT_CONFIGURED',
      errorMessage: 'APNS_TEAM_ID / KEY_ID / PRIVATE_KEY 미설정',
    }
  }
  const useSandbox = process.env.APNS_USE_SANDBOX === '1'
  const host = useSandbox
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com'

  const apsBody: Record<string, unknown> = {
    aps: {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      sound: 'default',
      ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
      ...(payload.threadId ? { 'thread-id': payload.threadId } : {}),
    },
    ...(payload.data ?? {}),
    ...(payload.url ? { url: payload.url } : {}),
  }

  try {
    const res = await fetch(`${host}/3/device/${token}`, {
      method: 'POST',
      headers: {
        Authorization: `bearer ${jwt}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'content-type': 'application/json',
      },
      body: JSON.stringify(apsBody),
      // APNs 는 idle 시 빠름. 하지만 connection setup 에 5s 정도 걸릴 수 있어 10s.
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) {
      return { ok: true, status: res.status }
    }
    // 410 Unregistered / 400 BadDeviceToken — 토큰 stale.
    let errCode = ''
    try {
      const j = (await res.json()) as { reason?: string }
      errCode = j.reason ?? ''
    } catch {
      /* */
    }
    const unregistered =
      res.status === 410 ||
      errCode === 'BadDeviceToken' ||
      errCode === 'Unregistered'
    return {
      ok: false,
      unregistered,
      status: res.status,
      errorCode: errCode || `HTTP_${res.status}`,
    }
  } catch (err) {
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      errorMessage: err instanceof Error ? err.message : 'unknown',
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// FCM v1
// ──────────────────────────────────────────────────────────────────────────

let cachedFcmAccessToken: { token: string; expiresAt: number } | null = null

async function getFcmAccessToken(): Promise<string | null> {
  const email = process.env.FCM_CLIENT_EMAIL
  const privateKeyPem = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!email || !privateKeyPem) return null

  const now = Math.floor(Date.now() / 1000)
  if (cachedFcmAccessToken && cachedFcmAccessToken.expiresAt - 60 > now) {
    return cachedFcmAccessToken.token
  }

  // service account JWT (RS256). exp 1시간.
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const headerB64 = base64url(JSON.stringify(header))
  const payloadB64 = base64url(JSON.stringify(claims))
  const signingInput = `${headerB64}.${payloadB64}`
  let sig: Buffer
  try {
    const signer = crypto.createSign('RSA-SHA256')
    signer.update(signingInput)
    sig = signer.sign(privateKeyPem)
  } catch {
    return null
  }
  const jwt = `${signingInput}.${base64urlBuf(sig)}`

  // OAuth2 token endpoint 로 교환.
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      access_token?: string
      expires_in?: number
    }
    if (!data.access_token) return null
    cachedFcmAccessToken = {
      token: data.access_token,
      expiresAt: now + (data.expires_in ?? 3600),
    }
    return data.access_token
  } catch {
    return null
  }
}

export async function sendFcmPush(
  token: string,
  payload: NativePushPayload,
): Promise<NativePushResult> {
  const accessToken = await getFcmAccessToken()
  const projectId = process.env.FCM_PROJECT_ID
  if (!accessToken || !projectId) {
    return {
      ok: false,
      errorCode: 'FCM_NOT_CONFIGURED',
      errorMessage: 'FCM_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY 미설정',
    }
  }

  const message = {
    message: {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        ...(payload.url ? { url: payload.url } : {}),
        ...(payload.threadId ? { thread_id: payload.threadId } : {}),
        ...(payload.data ?? {}),
      },
      android: {
        notification: {
          channel_id: 'default',
          // collapse_key 로 같은 thread 묶음.
          ...(payload.threadId ? { tag: payload.threadId } : {}),
        },
      },
    },
  }

  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (res.ok) return { ok: true, status: res.status }

    // FCM v1 에러 코드 — UNREGISTERED, INVALID_ARGUMENT, NOT_FOUND
    let errCode = ''
    try {
      const j = (await res.json()) as {
        error?: { details?: Array<{ errorCode?: string }>; message?: string }
      }
      errCode = j.error?.details?.[0]?.errorCode ?? j.error?.message ?? ''
    } catch {
      /* */
    }
    const unregistered =
      res.status === 404 ||
      errCode === 'UNREGISTERED' ||
      errCode === 'NOT_FOUND'
    return {
      ok: false,
      unregistered,
      status: res.status,
      errorCode: errCode || `HTTP_${res.status}`,
    }
  } catch (err) {
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      errorMessage: err instanceof Error ? err.message : 'unknown',
    }
  }
}

/**
 * 통합 dispatch — platform 분기.
 */
export async function sendNativePush(
  platform: 'ios' | 'android',
  token: string,
  payload: NativePushPayload,
): Promise<NativePushResult> {
  return platform === 'ios'
    ? sendApnsPush(token, payload)
    : sendFcmPush(token, payload)
}
