/**
 * 캡처한 캔버스를 PNG 로 저장 — 웹은 다운로드, 앱은 공유 시트 (2026-09-25 출시 전 점검 4차).
 *
 * # 왜 분기하나
 * 앱(Capacitor WebView)에서 `<a download href="blob:|data:">` 클릭은 **아무 일도 안 일어난다**.
 * iOS 는 Capacitor 가 host 없는 URL 을 UIApplication.open 에 넘기고 취소하며(받을 앱이
 * 없다), 다운로드 델리게이트도 없다. 그런데 등록증 화면은 그 뒤 무조건 "이미지를
 * 저장했어요" 토스트를 띄웠다 — 저장된 건 없는데.
 *
 * 앱에선 파일 공유(Web Share Level 2, iOS 15+ WKWebView 지원)로 시스템 공유 시트를 연다 —
 * 거기에 "이미지 저장"이 있다. 지원하지 않는 환경(안드로이드 WebView)은 `unsupported` 를
 * 돌려주고, 화면이 **정직하게** 안내한다(거짓 성공 금지).
 */
import { isNativeApp, getPlatform } from '@/lib/capacitor'
import { nativeBuildInfo, buildAtLeast, NATIVE_FEATURE_MIN_BUILD } from '@/lib/native-build'

export type SaveImageResult = 'downloaded' | 'shared' | 'cancelled' | 'unsupported'

type FileShareNavigator = Navigator & {
  canShare?: (data: { files: File[] }) => boolean
  share?: (data: { files: File[]; title?: string }) => Promise<void>
}

export async function saveCanvasImage(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<SaveImageResult> {
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob((b) => res(b), 'image/png', 0.95),
  )
  if (!blob) throw new Error('blob-failed')

  if (isNativeApp()) {
    // ★iOS 는 사진 추가 권한 문구가 들어간 빌드에서만(2026-09-26 점검 8차). 설치된 빌드 2 에서
    //   공유 시트의 '이미지 저장'을 누르면 iOS 가 앱을 종료한다 — 빌드를 모르면 막는 쪽으로.
    if (getPlatform() === 'ios') {
      const info = await nativeBuildInfo()
      if (!info || !buildAtLeast(info.build, NATIVE_FEATURE_MIN_BUILD.iosPhotoAdd)) return 'unsupported'
    }
    const file = new File([blob], filename, { type: 'image/png' })
    const nav = navigator as FileShareNavigator
    if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file] })
        return 'shared'
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
        throw e
      }
    }
    return 'unsupported'
  }

  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // 클릭 직후 바로 해제하면 일부 브라우저에서 다운로드가 끊긴다 — 한 박자 뒤에.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return 'downloaded'
}

/** 앱에서 저장을 못 할 때 보여 줄 안내 — 두 화면이 같은 말을 한다. */
export const SAVE_IMAGE_UNSUPPORTED_MESSAGE =
  '앱에서는 이미지 저장이 아직 안 돼요. 화면을 캡처해 주세요.'
