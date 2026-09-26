import { isNativeApp, getPlatform } from '@/lib/capacitor'

/**
 * 설치된 앱의 빌드 번호 — 네이티브 설정이 필요한 웹 기능의 문지기 (2026-09-26 출시 전 점검 8차).
 *
 * # 왜 필요한가
 * 앱은 원격 사이트를 띄우므로 **웹 배포는 설치된 모든 앱 버전에 즉시** 닿는다. 그런데 권한 문구
 * (Info.plist)·네이티브 코드(MainActivity)·capacitor.config 는 **스토어 업데이트로만** 바뀐다.
 * 그 틈에서 실제로 일이 났다: 9/25 웹이 앱의 '이미지 저장'을 공유 시트로 바꿨는데, 설치된 iOS 빌드 2
 * 에는 사진 추가 권한 문구가 없어 공유 시트의 '이미지 저장'을 누르면 iOS 가 앱을 종료한다.
 *
 * 그래서 네이티브에 기대는 웹 기능은 **날짜가 아니라 빌드 번호**로 막는다 — 옛 앱을 계속 쓰는 사람을
 * 지키려면 그것뿐이다. 빌드 번호 = 안드로이드 versionCode · iOS CFBundleVersion.
 */
export const NATIVE_FEATURE_MIN_BUILD = {
  /** iOS — Info.plist NSPhotoLibraryAddUsageDescription(7f9ddb6d)이 들어간 첫 빌드. */
  iosPhotoAdd: 3,
} as const

export type NativeBuildInfo = {
  platform: 'ios' | 'android'
  /** 빌드 번호(정수). 못 읽으면 0. */
  build: number
  /** 표시 버전(예: '1.0.11'). */
  version: string
}

let cached: Promise<NativeBuildInfo | null> | null = null

/** 웹이면 null. 앱에서 @capacitor/app 을 못 읽어도 null — 호출부가 '모름'을 안전한 쪽으로 처리한다. */
export function nativeBuildInfo(): Promise<NativeBuildInfo | null> {
  if (!isNativeApp()) return Promise.resolve(null)
  cached ??= (async () => {
    try {
      const { App } = await import('@capacitor/app')
      const info = await App.getInfo()
      return {
        platform: getPlatform() === 'ios' ? 'ios' : 'android',
        build: Number.parseInt(String(info.build), 10) || 0,
        version: info.version,
      } satisfies NativeBuildInfo
    } catch {
      return null
    }
  })()
  return cached
}

/** 비교 전용 순수 함수(테스트용). 빌드를 모르면(0) 지원하지 않는 것으로 본다. */
export function buildAtLeast(build: number, min: number): boolean {
  return Number.isFinite(build) && build > 0 && build >= min
}
