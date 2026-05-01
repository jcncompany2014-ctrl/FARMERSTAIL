import { NextResponse } from 'next/server'

/**
 * Apple Universal Links — `apple-app-site-association` (AASA).
 *
 * iOS Safari/Mail/Messages 가 우리 도메인의 링크를 누를 때 시스템이 이 파일을
 * GET 해서 "이 도메인은 이 앱과 연결됨" 을 확인. 일치하면 Safari 가 아니라
 * 앱 자체로 deep-link.
 *
 * # 요구사항
 * - **반드시 https**, status 200, Content-Type 은 `application/json` (확장자 .json
 *   금지). path 는 `/.well-known/apple-app-site-association`.
 * - Apple bot 이 직접 fetch 하므로 **CORS 무관**, **redirect 금지**.
 * - 캐시는 24h 권장 — 그 이상은 앱 업데이트 후 반영 지연.
 *
 * # appID 형식
 * `<TeamID>.<BundleID>` — 예: `ABCDE12345.com.farmerstail.app`.
 * TeamID 는 Apple Developer Portal Membership 페이지의 "Team ID" 10자리.
 *
 * # 환경변수
 * `APPLE_APP_SITE_TEAM_ID` 만 외부 주입. BundleID 는 capacitor.config.ts 와
 * 일치해야 하므로 코드에 박는다.
 *
 * # paths 매칭
 * `paths: ["*"]` 로 두면 모든 경로가 앱으로 가는데, /admin / /api / 결제
 * webhook 등은 web 으로만 처리해야 하니 명시적 deny 후 allow.
 */
export async function GET() {
  const teamId = process.env.APPLE_APP_SITE_TEAM_ID
  // teamId 가 비면 빈 응답 — Universal Links 는 사실상 비활성. iOS 가 그냥
  // Safari 로 연다. 빌드 통과 + 운영자가 환경변수 채우면 즉시 활성.
  if (!teamId) {
    return NextResponse.json(
      { applinks: { details: [] } },
      { headers: { 'cache-control': 'public, max-age=300' } },
    )
  }
  const bundleId = 'com.farmerstail.app'
  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appIDs: [`${teamId}.${bundleId}`],
            components: [
              // exclude 가 먼저 — 결제 webhook / admin / API 는 항상 web.
              { '/': '/admin/*', exclude: true },
              { '/': '/api/*', exclude: true },
              { '/': '/auth/callback', exclude: true },
              { '/': '/.well-known/*', exclude: true },
              // 그 외 모든 경로 deep-link 허용.
              { '/': '/*' },
            ],
          },
        ],
      },
      // webcredentials: 비밀번호 자동입력 SharedWebCredentials. 필요해지면 활성.
    },
    {
      headers: {
        'content-type': 'application/json',
        // Apple bot 은 24h 캐시. 너무 길게 잡으면 paths 변경 반영이 늦어짐.
        'cache-control': 'public, max-age=86400',
      },
    },
  )
}
