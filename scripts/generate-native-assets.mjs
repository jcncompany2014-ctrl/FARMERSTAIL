/**
 * 네이티브 앱 원본 자산 생성 (2026-07-26).
 *
 * @capacitor/assets 가 기대하는 `assets/` 폴더를 만들어 둔다. 맥에서
 * `npx @capacitor/assets generate` 한 번이면 iOS/Android 의 모든 크기가
 * 여기서 자동 생성된다.
 *
 * ★ iOS 앱스토어 아이콘(1024)은 **알파 채널이 있으면 심사에서 거절**된다.
 *   그래서 브랜드 배경색으로 flatten 해서 완전 불투명하게 만든다.
 */
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'

const SVG = 'public/icons/icon.svg'
const TERRACOTTA = '#A0452E' // theme_color — 아이콘 배경
const PAPER = '#F5F0E6' // background_color — 스플래시 배경

await mkdir('assets', { recursive: true })

// 1) 앱 아이콘 1024 — 불투명(알파 제거). iOS 심사 필수 조건.
await sharp(SVG, { density: 400 })
  .resize(1024, 1024, { fit: 'contain', background: TERRACOTTA })
  .flatten({ background: TERRACOTTA })
  .png()
  .toFile('assets/icon-only.png')

// 2) Android 적응형 아이콘 — 전경(로고)과 배경(단색)을 분리해야 한다.
//    런처가 원/사각으로 바깥을 깎으므로 전경은 canvas 를 꽉 채우고, 정작
//    중요한 글자(FT)가 안쪽 66% 안전영역 안에 있으면 된다 — SVG 가 이미
//    그 비율이라 100% 로 렌더한다. 66% 로 줄이면 배경(같은 테라코타) 위에
//    로고만 작게 뜬다.
//    88% 로 렌더 — 100% 면 원형 마스크에서 FT 가 테두리에 거의 닿는다(실제
//    마스크를 씌워 확인함). 88% 면 글자가 안드로이드 키라인(안쪽 66%) 안에
//    들어가고, 비는 가장자리는 아래 배경 레이어(같은 테라코타)가 채운다.
const logo = await sharp(SVG, { density: 400 })
  .resize(901, 901, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()

const fgCanvas = sharp({
  create: {
    width: 1024,
    height: 1024,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})

await fgCanvas
  .composite([{ input: logo, gravity: 'center' }])
  .png()
  .toFile('assets/icon-foreground.png')

await sharp({
  create: { width: 1024, height: 1024, channels: 3, background: TERRACOTTA },
})
  .png()
  .toFile('assets/icon-background.png')

// 3) 스플래시 2732x2732 — 어느 화면 비율에서도 중앙이 안 잘리게 정사각 큰 판.
//    로고 크기 주의: 2732 정사각이 폰 화면에 'cover' 로 깔리므로 실제로는
//    훨씬 크게 보인다. 600px(22%) 면 아이폰 세로에서 화면 폭의 약 47% —
//    820px 로 두면 65% 라 과하게 크다.
const splashLogo = await sharp(SVG, { density: 400 })
  .resize(600, 600, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()

for (const [name, bg] of [
  ['assets/splash.png', PAPER],
  ['assets/splash-dark.png', '#1b1815'],
]) {
  await sharp({
    create: { width: 2732, height: 2732, channels: 3, background: bg },
  })
    .composite([{ input: splashLogo, gravity: 'center' }])
    .png()
    .toFile(name)
}

// 검증 — iOS 아이콘에 알파가 남아 있으면 그 자리에서 실패시킨다.
const meta = await sharp('assets/icon-only.png').metadata()
if (meta.hasAlpha) {
  throw new Error('icon-only.png 에 알파가 남아 있음 — iOS 심사 거절 사유')
}
await writeFile('assets/.gitkeep', '')

for (const f of [
  'assets/icon-only.png',
  'assets/icon-foreground.png',
  'assets/icon-background.png',
  'assets/splash.png',
  'assets/splash-dark.png',
]) {
  const m = await sharp(f).metadata()
  console.log(`${f.padEnd(32)} ${m.width}x${m.height}  알파:${m.hasAlpha}`)
}
console.log('\n✅ iOS 아이콘 알파 없음 확인 — 심사 조건 통과')
