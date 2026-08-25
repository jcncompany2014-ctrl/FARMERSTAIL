/**
 * iOS 앱 아이콘·스플래시 생성 — @capacitor/assets 우회 정본 (안드로이드판: gen-android-icons.mjs).
 *
 * ⚠️ 아이콘에 `npx @capacitor/assets generate` 를 쓰지 말 것 — 안드로이드에서
 * adaptive 레이어를 절반 해상도로 뽑는 버그로 화질이 깨졌던 그 도구다
 * (2026-08-23 실측, 규칙61). iOS 도 같은 원칙으로 이 스크립트가 정본.
 *
 * iOS 규격 (Xcode 14+ single-size):
 *  - AppIcon = 1024×1024 **알파 채널 없음** (알파가 있으면 App Store 업로드 거부)
 *  - Splash  = 2732×2732 불투명 1장 (Capacitor 기본 imageset 이 3파일 이름으로 참조)
 *
 * 사용: node scripts/gen-ios-icons.mjs
 * 소스: assets/icon-only.png (1024px) · assets/splash.png (2732px)
 */
import sharp from 'sharp'

const CREAM = { r: 245, g: 240, b: 230 } // #F5F0E6 — capacitor.config backgroundColor 와 동일

const iconset = 'ios/App/App/Assets.xcassets/AppIcon.appiconset'
const splashset = 'ios/App/App/Assets.xcassets/Splash.imageset'

await sharp('assets/icon-only.png')
  .resize(1024, 1024)
  .flatten({ background: CREAM })
  .png()
  .toFile(`${iconset}/AppIcon-512@2x.png`)
console.log('AppIcon 1024 (alpha 제거) →', `${iconset}/AppIcon-512@2x.png`)

const splash = await sharp('assets/splash.png')
  .resize(2732, 2732)
  .flatten({ background: CREAM })
  .png()
  .toBuffer()
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await sharp(splash).toFile(`${splashset}/${name}`)
}
console.log('Splash 2732 ×3 →', splashset)
