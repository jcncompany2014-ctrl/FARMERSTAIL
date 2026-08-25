/**
 * Sign in with Apple — Supabase 에 넣을 **client secret(JWT)** 생성기.
 *
 * # 왜 이 스크립트가 있나
 * 애플 로그인은 `.p8` 키를 그대로 쓰지 않는다. 그 키로 서명한 JWT 를 만들어
 * Supabase Auth → Providers → Apple 의 *Secret Key* 에 넣는다. 그리고 **애플이
 * 최대 6개월 만료를 강제**한다 — 갱신을 놓치면 애플 로그인이 전부 실패한다
 * (Supabase 문서: "will cause authentication failures if missed").
 * 즉 이 작업은 1회성이 아니라 **반년마다 돌아오는 정비**다. 그때 방법을 다시
 * 찾아 헤매지 않도록 저장소에 남긴다.
 *
 * # 사용
 *   node scripts/apple-client-secret.mjs <p8경로> <KeyID> <TeamID> <ServicesID>
 *
 * 예) node scripts/apple-client-secret.mjs ~/Desktop/키/AuthKey_XXX.p8 \
 *       B33ZGJJAK3 QH8PQUT2NR com.farmerstail.app.signin
 *
 * # 보안
 * 생성된 JWT 도 비밀이므로 **화면에 출력하지 않는다.** 클립보드에 복사하고
 * `.p8` 옆에 `supabase-apple-secret.txt` 로 저장한다(저장소 밖). 만료일만 표시.
 *
 * ⚠️ ServicesID 는 애플 포털의 **Services ID 식별자**다(앱 Bundle ID 아님).
 *    이 값이 다르면 애플이 `invalid_client` 로 거부한다.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const [p8Path, keyId, teamId, servicesId] = process.argv.slice(2)
if (!p8Path || !keyId || !teamId || !servicesId) {
  console.error('사용법: node scripts/apple-client-secret.mjs <p8경로> <KeyID> <TeamID> <ServicesID>')
  process.exit(1)
}

const pem = fs.readFileSync(p8Path.replace(/^~/, process.env.HOME ?? '~'), 'utf8')
let key
try {
  key = crypto.createPrivateKey(pem)
} catch (e) {
  console.error('❌ .p8 를 읽지 못했습니다:', e.message)
  process.exit(1)
}
if (key.asymmetricKeyType !== 'ec') {
  console.error(`❌ 애플 키는 타원곡선(ec) 이어야 하는데 ${key.asymmetricKeyType} 입니다.`)
  process.exit(1)
}

// 애플 상한 = 6개월(15777000초). 상한 그대로 쓰되 하루 여유를 둔다.
const SIX_MONTHS = 15777000
const now = Math.floor(Date.now() / 1000)
const exp = now + SIX_MONTHS - 86400

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const header = b64({ alg: 'ES256', kid: keyId })
const payload = b64({
  iss: teamId,
  iat: now,
  exp,
  aud: 'https://appleid.apple.com',
  sub: servicesId,
})

// ES256 = ECDSA P-256 + SHA-256. Node 의 sign() 은 ASN.1 DER 을 주므로
// JOSE 가 요구하는 raw r||s(각 32바이트)로 변환한다. (lib/push/native.ts 와 동일 이슈)
const der = crypto.createSign('SHA256').update(`${header}.${payload}`).sign(key)
let off = 2
if (der[1] & 0x80) off += der[1] & 0x7f
const readInt = () => {
  const len = der[off + 1]
  let start = off + 2
  let end = start + len
  while (der[start] === 0x00 && end - start > 32) start++
  const buf = Buffer.alloc(32)
  der.copy(buf, 32 - (end - start), start, end)
  off = end
  return buf
}
const r = readInt()
const s = readInt()
const jwt = `${header}.${payload}.${Buffer.concat([r, s]).toString('base64url')}`

// 자체 검증 — 만든 JWT 가 실제로 이 키의 공개키로 검증되는지 확인한다.
// (형식만 맞고 서명이 틀린 값을 넘기면 Supabase 에서 로그인할 때야 드러난다)
const pub = crypto.createPublicKey(key)
const ok = crypto
  .createVerify('SHA256')
  .update(`${header}.${payload}`)
  .verify({ key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(jwt.split('.')[2], 'base64url'))
if (!ok) {
  console.error('❌ 서명 자체검증 실패 — 이 값을 쓰면 안 됩니다.')
  process.exit(1)
}

const outPath = path.join(path.dirname(p8Path.replace(/^~/, process.env.HOME ?? '~')), 'supabase-apple-secret.txt')
fs.writeFileSync(outPath, jwt + '\n', { mode: 0o600 })
try {
  execFileSync('pbcopy', { input: jwt })
} catch {
  /* 클립보드 실패해도 파일은 남는다 */
}

const expDate = new Date(exp * 1000)
console.log('✅ 애플 client secret 생성 완료 (자체 서명검증 통과)')
console.log(`   Services ID : ${servicesId}`)
console.log(`   Team / Key  : ${teamId} / ${keyId}`)
console.log(`   만료일      : ${expDate.toLocaleDateString('ko-KR')} — 이 전에 반드시 재생성`)
console.log(`   저장 위치   : ${outPath}`)
console.log('   클립보드에도 복사됨 — Supabase 의 Secret Key 칸에 그대로 붙여넣으세요.')
console.log('   (값은 비밀이라 화면에 출력하지 않습니다)')
