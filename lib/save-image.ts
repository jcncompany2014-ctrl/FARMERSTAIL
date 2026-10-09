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

/**
 * html2canvas 가 글자 기준선을 잴 때 쓰는 1px 투명 GIF(라이브러리 내부 상수 SMALL_IMAGE, 1.4.1).
 * 이 그림에만 맞는 규칙을 걸기 위해 그대로 적어 둔다 — 화면의 다른 img 는 이 주소를 쓰지 않는다.
 */
const HTML2CANVAS_PROBE_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/**
 * 화면 한 덩어리를 그림(canvas)으로 뜬다 — html2canvas 는 이때 불러온다(큰 라이브러리, 첫 진입 비용 없음).
 *
 * ★그림 속 글자가 몇 px 아래로 그려지던 것(2026-10-09 영수증 저장 실측 — 표 머리글이 밑줄에 붙었다):
 *  Tailwind 기본 스타일(preflight)이 img 를 display:block 으로 바꾼다. html2canvas 는 글자 기준선을
 *  '숨은 1px img 를 글자 옆에 붙여' 재는데, 그 img 가 block 이면 다음 줄로 떨어져 기준선이 줄 높이만큼 커진다.
 *  재는 곳은 복제본이 아니라 **지금 화면 문서**라(new FontMetrics(document)) onclone 으로는 안 고쳐진다 —
 *  뜨는 동안만 그 1px 그림에 inline 을 돌려주고 바로 뺀다. 다른 img 는 이 규칙에 걸리지 않아 화면은 그대로다.
 */
export async function captureNodeToCanvas(node: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas')
  const probeFix = document.createElement('style')
  probeFix.textContent = `img[src="${HTML2CANVAS_PROBE_IMG}"] { display: inline !important; }`
  document.head.appendChild(probeFix)
  try {
    return await html2canvas(node, { backgroundColor: '#FFFFFF', scale: 2, useCORS: true })
  } finally {
    probeFix.remove()
  }
}

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
