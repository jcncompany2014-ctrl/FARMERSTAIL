// Capacitor webDir 준비 — 원격 URL 모드라 index.html 은 자리표시.
// error.html = server.errorPath(capacitor.config.ts) — 오프라인·서버 장애 때 앱이 띄우는 한국어 안내.
// capacitor-web/ 은 .gitignore 된 임시 폴더라 원본은 scripts/capacitor-error.html 에 두고 여기서 복사한다
// (2026-09-26 출시 전 점검 7차 — 원본을 임시 폴더에만 두면 맥 빌드에서 사라진다).
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs'

mkdirSync('capacitor-web', { recursive: true })
writeFileSync('capacitor-web/index.html', '<!doctype html><meta charset="utf-8"><title>Farmer\'s Tail</title>')
copyFileSync('scripts/capacitor-error.html', 'capacitor-web/error.html')
console.log('[cap:webdir] capacitor-web/index.html + error.html')
