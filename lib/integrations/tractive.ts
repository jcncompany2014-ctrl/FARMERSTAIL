/**
 * Tractive (GPS / 만보계 tracker) OAuth + API 연동 — 42 deferred #1.
 *
 * # 배경
 * Tractive 는 강아지용 GPS/만보계 BLE 디바이스. 견주 자가 추정 활동량
 * (±30% 편차) 대신 객관적 일일 걸음/거리/active minutes 데이터를 자동
 * 수집할 수 있다. 발명 명세 모듈 A "측정 도구" 의 가장 정확도 높은 source
 * (activity_method='pedometer' 또는 'gps' 의 reliability score 0.95).
 *
 * # Mock mode vs Real mode
 * 환경변수 `TRACTIVE_CLIENT_ID` 가 비어있으면 **mock mode** — OAuth URL 은
 * 자체 안내 페이지로, 토큰 교환은 fake 값, fetch 는 빈 결과. UI 는 정상
 * 렌더하되 "준비 중" badge 표시. 환경변수 셋팅 시 real mode 자동 활성화.
 *
 * # 실제 API 진입 전 필요한 외부 작업
 *  1) https://my.tractive.com/#/account/api 에서 Developer key 발급
 *     (또는 contact partnerships@tractive.com — 공식 OAuth 는 contact 필요)
 *  2) Vercel env 등록: TRACTIVE_CLIENT_ID, TRACTIVE_CLIENT_SECRET,
 *     TRACTIVE_OAUTH_REDIRECT_URI (= https://<app>/api/integrations/tractive/callback)
 *  3) /api/cron/tractive-activity-sync cron 등록 (vercel.json) — 일 1회
 *
 * # 데이터 흐름
 *   사용자 → /mypage/integrations → "Tractive 연동" 클릭
 *   → /api/integrations/tractive/connect (OAuth start, state cookie)
 *   → Tractive OAuth → callback (token 교환 + user_integrations row insert)
 *   → /api/cron/tractive-activity-sync (일 1회) → activity_logs INSERT
 *   → dogs.activity_method = 'pedometer', reliability score 자동 갱신
 */

export type TractiveMode = 'mock' | 'real'

/** 현재 mode 결정 — env 셋팅 여부. server-only 호출. */
export function tractiveMode(): TractiveMode {
  return process.env.TRACTIVE_CLIENT_ID ? 'real' : 'mock'
}

/**
 * OAuth authorize URL — 사용자 브라우저를 이 URL 로 redirect.
 * mock 모드면 자체 안내 페이지 path 반환 (real OAuth 진입 X).
 *
 * @param state - CSRF 방지용 random string. server 가 cookie 에 저장 후
 *   callback 에서 match 검증.
 */
export function tractiveAuthorizeUrl(state: string): string {
  if (tractiveMode() === 'mock') {
    // mock 시: 클라이언트에 "준비 중" 안내 + 자동 cancel.
    return `/mypage/integrations?provider=tractive&mock=1&state=${encodeURIComponent(state)}`
  }
  const clientId = process.env.TRACTIVE_CLIENT_ID!
  const redirect = process.env.TRACTIVE_OAUTH_REDIRECT_URI!
  // Tractive 공식 OAuth 진입은 partnership 라 placeholder URL 사용.
  // 실제 endpoint 는 partnerships@tractive.com 협의 후 갱신 필요.
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    state,
    scope: 'activity:read profile:read',
  })
  return `https://my.tractive.com/oauth/authorize?${params.toString()}`
}

/** OAuth callback 의 code → access_token 교환 결과. */
export interface TractiveTokens {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  scope: string | null
  externalUserId: string | null
}

/**
 * Authorization code → access_token. real mode 만 진짜 fetch.
 * mock 모드는 fake token 반환 → UI 테스트 가능.
 */
export async function exchangeTractiveCode(
  code: string,
): Promise<TractiveTokens> {
  if (tractiveMode() === 'mock') {
    return {
      accessToken: `mock_${code}_${Date.now()}`,
      refreshToken: null,
      expiresAt: null,
      scope: 'mock',
      externalUserId: null,
    }
  }
  const clientId = process.env.TRACTIVE_CLIENT_ID!
  const clientSecret = process.env.TRACTIVE_CLIENT_SECRET!
  const redirect = process.env.TRACTIVE_OAUTH_REDIRECT_URI!
  // Tractive 공식 endpoint placeholder — partnership 협의 후 갱신.
  const res = await fetch('https://graph.tractive.com/4/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
    }),
  })
  if (!res.ok) {
    throw new Error(`Tractive token exchange failed: ${res.status}`)
  }
  const json = (await res.json()) as {
    access_token: string
    refresh_token?: string | null
    expires_in?: number | null
    scope?: string | null
    user_id?: string | null
  }
  // 점검 H: access_token 부재/비정상 응답 시 null 저장 방지 — throw 하면 콜백이
  // token_exchange 에러로 안전 redirect.
  if (!json.access_token || typeof json.access_token !== 'string') {
    throw new Error('Tractive token exchange: missing access_token')
  }
  const expiresAt = json.expires_in
    ? new Date(Date.now() + json.expires_in * 1000)
    : null
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt,
    scope: json.scope ?? null,
    externalUserId: json.user_id ?? null,
  }
}

/** 일일 활동량 한 row. activity_logs INSERT 대상. */
export interface TractiveActivityDay {
  date: string // YYYY-MM-DD (KST)
  steps: number | null
  activeMinutes: number | null
  distanceM: number | null
}

/**
 * 지정 기간 일일 활동량 fetch. real mode 만 진짜 호출.
 * mock 모드는 빈 배열 반환 → cron 이 no-op.
 *
 * @param accessToken - user_integrations.access_token
 * @param fromDate - YYYY-MM-DD inclusive
 * @param toDate - YYYY-MM-DD inclusive
 */
export async function fetchTractiveActivity(
  accessToken: string,
  fromDate: string,
  toDate: string,
): Promise<TractiveActivityDay[]> {
  if (tractiveMode() === 'mock') return []
  // Tractive 공식 endpoint placeholder.
  const params = new URLSearchParams({
    from: fromDate,
    to: toDate,
  })
  const res = await fetch(
    `https://graph.tractive.com/4/activity/daily?${params.toString()}`,
    {
      headers: { authorization: `Bearer ${accessToken}` },
    },
  )
  if (!res.ok) {
    throw new Error(`Tractive activity fetch failed: ${res.status}`)
  }
  const json = (await res.json()) as {
    days?: Array<{
      date?: string
      steps?: number | null
      active_minutes?: number | null
      distance_m?: number | null
    }>
  }
  return (json.days ?? []).map((d) => ({
    date: d.date ?? '',
    steps: d.steps ?? null,
    activeMinutes: d.active_minutes ?? null,
    distanceM: d.distance_m ?? null,
  }))
}

/** 사용자 노출 라벨 — voice-guidelines §1 톤 ("연동" / "자동 추적"). */
export const TRACTIVE_LABEL = 'Tractive (GPS / 만보계)'
export const TRACTIVE_HINT_MOCK =
  '연동 준비 중이에요. 곧 자동 활동량 추적이 가능해져요.'
export const TRACTIVE_HINT_REAL =
  '연동하면 일일 활동량을 자동으로 추적해 더 정확한 케어가 가능해요.'
