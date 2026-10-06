// npm run cap:sync — 안드로이드는 늘, iOS 는 **맥에서만** 동기화한다.
//
// 왜 (2026-10-06 11차 점검 C): Capacitor CLI 8.4.x 는 iOS Package.swift 의 플러그인 경로를 path.relative 로 만드는데,
// 윈도우에선 백슬래시가 들어가 Xcode 가 "Invalid escape sequence" 로 빌드를 못 한다(ionic-team/capacitor#8549, 8.5.1 수정).
// 예전 `npx cap sync` 는 두 플랫폼을 다 돌려서 이 PC 에서 돌리면 iOS 프로젝트 파일이 깨졌다.
// iOS 동기화는 맥에서 `npm run cap:sync`(또는 cap:sync:ios) — 그때 Package.swift 가 정상 경로로 다시 써진다.
import { execSync } from 'node:child_process'

const run = (cmd) => {
  console.log(`[cap:sync] ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

run('node scripts/cap-webdir.mjs')
run('npx cap sync android')
if (process.platform === 'darwin') {
  run('npx cap sync ios')
} else {
  console.log('[cap:sync] iOS 는 건너뜀 — 윈도우에서 sync 하면 Package.swift 경로가 깨진다. 맥에서 npm run cap:sync 로.')
}
