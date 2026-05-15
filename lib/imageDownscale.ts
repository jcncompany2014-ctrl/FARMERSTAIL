/**
 * Client-side image downscale (audit #95).
 *
 * 모바일에서 5MB 카메라 JPEG 를 base64 로 변환하면 ~6.7MB 문자열 + 메모리
 * 13-15MB spike → 저가 안드로이드 OOM 위험. Vercel function payload 1MB/4.5MB
 * 한계와도 충돌.
 *
 * 해결: OffscreenCanvas 로 long edge 1280px 다운샘플 + JPEG 0.85 재인코딩
 * → 보통 300-500KB Blob. 메인 스레드 부담 최소화 (OffscreenCanvas 가능 시
 * Worker 단계에서도 처리 가능하나 우선 메인 스레드).
 *
 * 사용:
 *   const file = e.target.files?.[0]
 *   const blob = await downscaleImage(file, { maxEdge: 1280, quality: 0.85 })
 *   const form = new FormData()
 *   form.append('image', blob, 'photo.jpg')
 *   await fetch(url, { method: 'POST', body: form })
 */

export interface DownscaleOptions {
  /** Long edge 최대 픽셀. 기본 1280. */
  maxEdge?: number
  /** JPEG 품질 0.0~1.0. 기본 0.85. */
  quality?: number
  /** 출력 mime — 기본 'image/jpeg'. PNG 투명도 유지 필요 시 'image/png'. */
  mime?: 'image/jpeg' | 'image/png' | 'image/webp'
}

/**
 * Blob 으로 다운스케일. 원본보다 크게는 만들지 않음 (작은 이미지는 그대로).
 */
export async function downscaleImage(
  file: Blob,
  opts: DownscaleOptions = {},
): Promise<Blob> {
  const maxEdge = opts.maxEdge ?? 1280
  const quality = opts.quality ?? 0.85
  const mime = opts.mime ?? 'image/jpeg'

  // 1) decode — createImageBitmap 이 EXIF 회전 자동 처리 (imageOrientation: 'from-image').
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  })

  try {
    const { width: w, height: h } = bitmap

    // 2) 다운스케일 비율 계산. 원본이 이미 작으면 그대로 (단 mime 변환 위해 재인코딩).
    const longest = Math.max(w, h)
    const scale = longest > maxEdge ? maxEdge / longest : 1
    const targetW = Math.round(w * scale)
    const targetH = Math.round(h * scale)

    // 3) draw — OffscreenCanvas 가능 시 (Chrome 69+, Safari 16.4+) 사용, fallback DOM canvas.
    const canvas: OffscreenCanvas | HTMLCanvasElement =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(targetW, targetH)
        : Object.assign(document.createElement('canvas'), {
            width: targetW,
            height: targetH,
          })

    const ctx = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null
    if (!ctx) throw new Error('canvas context unavailable')

    // JPEG 변환 시 투명 배경이 검정으로 나오는 것 방지.
    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, targetW, targetH)
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)

    // 4) Blob 추출 — OffscreenCanvas 는 convertToBlob, DOM canvas 는 toBlob.
    let blob: Blob
    if ('convertToBlob' in canvas) {
      blob = await canvas.convertToBlob({ type: mime, quality })
    } else {
      blob = await new Promise<Blob>((resolve, reject) => {
        ;(canvas as HTMLCanvasElement).toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
          mime,
          quality,
        )
      })
    }

    return blob
  } finally {
    // bitmap close — GPU 메모리 즉시 해제 (모바일에서 중요).
    if ('close' in bitmap) {
      try {
        bitmap.close()
      } catch {
        /* ignore */
      }
    }
  }
}
