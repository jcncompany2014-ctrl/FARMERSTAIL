/**
 * Canvas pixel 분석 헬퍼 — W_image 입력 신호 산출 (B-22).
 *
 * captured dataURL 또는 video 프레임을 canvas 에 그려 pixel 통계 추출:
 *  · brightness — 평균 luminance 0~255
 *  · sharpness  — variance of Laplacian 근사 0~∞
 *  · coverageRatio — 비-배경 픽셀 비율 (간단 — 평균 밝기보다 어두운 픽셀)
 *
 * # PCT 무관
 * 발명 핵심 알고리즘은 lib/vision/w-image.ts. 이 파일은 단순 pixel
 * 통계 추출이라 flag 가드 X.
 *
 * # 사용
 *
 *   const img = new Image()
 *   img.src = dataUrl
 *   await new Promise(r => { img.onload = r })
 *   const stats = analyzeImage(img)
 *   // → computeWImage(stats) 에 전달
 */

export type ImageStats = {
  brightness: number
  sharpness: number
  coverageRatio: number
}

/**
 * `<img>` 또는 `<video>` 원소를 canvas 에 그리고 pixel 분석.
 *
 * 성능: 640x480 ≈ 30만 픽셀. 50ms 이내. 너무 큰 이미지는 일부만 sample.
 */
export function analyzeImage(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
): ImageStats {
  // canvas 생성 — 최대 256x256 sample
  const sw =
    source instanceof HTMLImageElement
      ? source.naturalWidth
      : source instanceof HTMLVideoElement
        ? source.videoWidth
        : source.width
  const sh =
    source instanceof HTMLImageElement
      ? source.naturalHeight
      : source instanceof HTMLVideoElement
        ? source.videoHeight
        : source.height

  const scale = Math.min(1, 256 / Math.max(sw, sh, 1))
  const w = Math.max(1, Math.floor(sw * scale))
  const h = Math.max(1, Math.floor(sh * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return { brightness: 0, sharpness: 0, coverageRatio: 0 }
  }
  ctx.drawImage(source, 0, 0, w, h)
  const imgData = ctx.getImageData(0, 0, w, h)
  const pixels = imgData.data

  // brightness — 평균 luminance (Rec. 601)
  let lumSum = 0
  const grayBuf = new Uint8Array(w * h)
  for (let i = 0; i < grayBuf.length; i += 1) {
    const o = i * 4
    const r = pixels[o]
    const g = pixels[o + 1]
    const b = pixels[o + 2]
    const y = (0.299 * r + 0.587 * g + 0.114 * b) | 0
    grayBuf[i] = y
    lumSum += y
  }
  const brightness = lumSum / grayBuf.length

  // sharpness — Laplacian variance 근사 (3x3 커널 단순화)
  let sumSq = 0
  let count = 0
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x
      const lap =
        4 * grayBuf[i] -
        grayBuf[i - 1] -
        grayBuf[i + 1] -
        grayBuf[i - w] -
        grayBuf[i + w]
      sumSq += lap * lap
      count += 1
    }
  }
  const sharpness = count > 0 ? sumSq / count : 0

  // coverage — 평균 밝기보다 어두운 픽셀이 비-배경 (대략적). 실측 정확도 X
  let darkCount = 0
  for (const p of grayBuf) {
    if (p < brightness * 0.85) darkCount += 1
  }
  const coverageRatio = darkCount / grayBuf.length

  return {
    brightness: Math.round(brightness),
    sharpness: Math.round(sharpness * 10) / 10,
    coverageRatio: Math.round(coverageRatio * 100) / 100,
  }
}
