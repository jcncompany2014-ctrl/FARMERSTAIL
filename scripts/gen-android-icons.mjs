/**
 * 안드로이드 런처 아이콘 생성 — @capacitor/assets 우회 정본.
 *
 * ⚠️ 아이콘에 `npx @capacitor/assets generate` 를 쓰지 말 것.
 * 그 도구는 adaptive 레이어(foreground/background)를 **레거시 48dp 크기**
 * (xxxhdpi 192px)로 뽑는 버그가 있다 — 규격은 108dp(xxxhdpi 432px)라서
 * 기기가 2.25배 확대해 그리며 모든 기기에서 아이콘이 흐릿해진다
 * (2026-08-23 사장님이 "화질 깨짐"으로 3회 재현, 실측으로 확정).
 * 스플래시(drawable)는 그 도구를 써도 된다 — 아이콘(mipmap)만 이 스크립트로.
 *
 * 사용: node scripts/gen-android-icons.mjs
 * 소스: assets/icon-foreground.png · assets/icon-only.png (1024px)
 * 검증: lib/audit-rules.test.ts 규칙61 이 산출 크기를 고정한다.
 */
import sharp from 'sharp'

const CREAM = { r: 245, g: 240, b: 230, alpha: 1 }
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
const res = 'android/app/src/main/res'

for (const [d, mul] of Object.entries(densities)) {
  const adaptive = Math.round(108 * mul)
  const legacy = Math.round(48 * mul)
  await sharp('assets/icon-foreground.png').resize(adaptive, adaptive)
    .png().toFile(`${res}/mipmap-${d}/ic_launcher_foreground.png`)
  await sharp({ create: { width: adaptive, height: adaptive, channels: 4, background: CREAM } })
    .png().toFile(`${res}/mipmap-${d}/ic_launcher_background.png`)
  await sharp('assets/icon-only.png').resize(legacy, legacy)
    .png().toFile(`${res}/mipmap-${d}/ic_launcher.png`)
  const circle = Buffer.from(`<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`)
  const sq = await sharp('assets/icon-only.png').resize(legacy, legacy).png().toBuffer()
  await sharp(sq).composite([{ input: circle, blend: 'dest-in' }])
    .png().toFile(`${res}/mipmap-${d}/ic_launcher_round.png`)
  console.log(d, 'adaptive', adaptive, 'legacy', legacy)
}
