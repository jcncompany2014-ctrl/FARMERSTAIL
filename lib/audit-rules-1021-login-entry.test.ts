/**
 * 2026-10-21 토스 결제경로 심사 가이드 ④ "로그인·회원가입 경로 캡처" — PC 머리줄엔 로그인으로 가는 길이 없었고,
 * 폰 ☰ 메뉴엔 카카오·애플만 있어 이메일 계정(심사용 계정 포함)은 로그인할 곳이 없었다(사장님 "마이페이지가 없냐? 못 찾겠네").
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')

test('규칙306: 웹 머리줄·메뉴에 로그인 길 — PC 로그인/내 주문 단추 · 폰 메뉴 이메일 로그인', () => {
  const header = strip(read('components', 'store', 'StoreHeader.tsx'))
  const pc = header.slice(header.indexOf('<header className="fts-hd-pc">'), header.indexOf('</header>', header.indexOf('<header className="fts-hd-pc">')))
  assert.match(pc, /<AccountLink \/>/, 'PC 머리줄에 로그인 단추가 없다')
  assert.match(header, /signedIn \? '\/mypage\/orders' : `\/login\?next=\$\{encodeURIComponent\(pathname\)\}`/, '로그인 단추가 로그인 화면(돌아올 주소 포함)·내 주문으로 가지 않는다')
  assert.match(header, /\{signedIn \? '내 주문' : '로그인'\}/)
  const menu = strip(read('components', 'store', 'StoreMenu.tsx'))
  const out = menu.slice(menu.indexOf('{signedIn === false && ('), menu.indexOf('{signedIn && ('))
  assert.match(out, /href=\{`\/login\?next=/, '폰 메뉴에 이메일 로그인 길이 없다')
  assert.ok(out.includes('이메일로 로그인'))
})
