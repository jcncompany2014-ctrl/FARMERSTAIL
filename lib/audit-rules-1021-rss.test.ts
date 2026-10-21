/**
 * 2026-10-21 네이버 서치어드바이저 최적화 — 네이버는 새 글을 RSS 로 가장 빨리 가져가는데 /rss.xml 이 404 였다.
 * 매거진 글 RSS 를 만들고 홈·매거진 화면에 RSS 주소를 알린다. 조회 실패를 빈 피드로 내면 네이버가 '글이 없어졌다'로 읽는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n')

test('규칙307: /rss.xml — 공개 매거진 글 RSS 2.0 · 조회 실패는 503(빈 피드 금지) · 홈·매거진이 RSS 주소를 알린다', () => {
  const rss = read('app', 'rss.xml', 'route.ts')
  assert.match(rss, /\.from\('blog_posts'\)/)
  assert.match(rss, /\.eq\('is_published', true\)/, '비공개 글이 RSS 로 나간다')
  assert.match(rss, /if \(error\) \{[\s\S]*?status: 503/, '조회 실패를 빈 피드로 낸다')
  assert.match(rss, /application\/rss\+xml/)
  assert.match(rss, /<rss version="2\.0"/)
  const robots = read('app', 'robots.ts')
  assert.ok(!/['"]\/rss/.test(robots), 'robots 가 RSS 를 막는다')
  for (const f of [['app', 'page.tsx'], ['app', 'blog', '(index)', 'page.tsx']]) {
    assert.match(read(...f), /types: \{ 'application\/rss\+xml': '\/rss\.xml' \}/, `${f.join('/')} 에 RSS 알림이 없다`)
  }
})
