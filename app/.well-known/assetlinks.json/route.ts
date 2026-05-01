import { NextResponse } from 'next/server'

/**
 * Android App Links — `assetlinks.json`.
 *
 * Android 가 우리 도메인 링크를 우리 앱으로 deep-link 하기 위한 verification
 * 파일. iOS 의 AASA 와 동등한 역할.
 *
 * # 요구사항
 * - https, status 200, Content-Type `application/json`, redirect 금지.
 * - path `/.well-known/assetlinks.json`.
 *
 * # SHA256 fingerprints
 * 앱 서명 키의 SHA-256. 디버그/프로덕션 둘 다 등록.
 *   keytool -list -v -keystore <path> -alias <alias>
 * Play App Signing 사용 시 Play Console → Setup → App integrity 에서 복사.
 *
 * # 환경변수
 * - ANDROID_PACKAGE_NAME    e.g. "com.farmerstail.app"
 * - ANDROID_FINGERPRINTS    콤마 구분 SHA-256 (콜론 형식 그대로)
 *   ex) "AA:BB:..,11:22:.."
 */
export async function GET() {
  const pkg = process.env.ANDROID_PACKAGE_NAME ?? 'com.farmerstail.app'
  const raw = process.env.ANDROID_FINGERPRINTS ?? ''
  const fingerprints = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (fingerprints.length === 0) {
    return NextResponse.json([], {
      headers: { 'cache-control': 'public, max-age=300' },
    })
  }

  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: pkg,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=86400',
      },
    },
  )
}
