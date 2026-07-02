/**
 * JSON-LD / OG helper unit tests. Node native runner.
 *
 * SITE_URL 은 env.NEXT_PUBLIC_SITE_URL 로 결정되므로 여기선 기본 fallback
 * 값을 assert 한다. CI 에서 다른 URL 이 주입되면 prefix match 로 느슨하게.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  SITE_URL,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  ogImageUrl,
} from './jsonld.ts'

describe('buildOrganizationJsonLd', () => {
  it('emits a stable @id so other entities can reference it', () => {
    const ld = buildOrganizationJsonLd()
    assert.equal(ld['@context'], 'https://schema.org')
    assert.equal(ld['@type'], 'Organization')
    assert.equal(ld['@id'], `${SITE_URL}/#organization`)
    assert.equal(ld.url, SITE_URL)
  })
})

describe('buildWebSiteJsonLd', () => {
  // SearchAction 은 2026-07-03 감사에서 제거 — 대상(/products 검색)이 구독전용
  // 전환으로 폐지됐고 Google 도 sitelinks search box 지원을 종료함.
  it('emits WebSite without a potentialAction', () => {
    const ld = buildWebSiteJsonLd()
    assert.equal(ld['@type'], 'WebSite')
    assert.equal('potentialAction' in ld, false)
    assert.equal(ld.publisher['@id'], `${SITE_URL}/#organization`)
  })
})

describe('buildBreadcrumbJsonLd', () => {
  it('absolutizes relative paths with SITE_URL prefix', () => {
    const ld = buildBreadcrumbJsonLd([
      { name: '홈', path: '/' },
      { name: '제품', path: '/products' },
    ])
    assert.equal(ld.itemListElement.length, 2)
    assert.equal(ld.itemListElement[0]!.item, `${SITE_URL}/`)
    assert.equal(ld.itemListElement[1]!.item, `${SITE_URL}/products`)
  })

  it('leaves absolute URLs untouched', () => {
    const ld = buildBreadcrumbJsonLd([
      { name: '외부', path: 'https://example.com/x' },
    ])
    assert.equal(ld.itemListElement[0]!.item, 'https://example.com/x')
  })

  it('numbers positions starting from 1', () => {
    const ld = buildBreadcrumbJsonLd([
      { name: 'A', path: '/a' },
      { name: 'B', path: '/b' },
      { name: 'C', path: '/c' },
    ])
    assert.deepEqual(
      ld.itemListElement.map((i) => i.position),
      [1, 2, 3],
    )
  })
})

describe('buildArticleJsonLd', () => {
  it('truncates long headlines to 110 chars (Google limit)', () => {
    const long = 'ㅁ'.repeat(200)
    const ld = buildArticleJsonLd({
      title: long,
      slug: 's',
      description: 'd',
      coverUrl: null,
      publishedAt: '2025-01-01T00:00:00Z',
    }) as { headline: string }
    assert.equal(ld.headline.length, 110)
  })

  it('uses publishedAt as dateModified fallback', () => {
    const ld = buildArticleJsonLd({
      title: 't',
      slug: 's',
      description: 'd',
      coverUrl: null,
      publishedAt: '2025-06-01T00:00:00Z',
    }) as { datePublished: string; dateModified: string }
    assert.equal(ld.dateModified, '2025-06-01T00:00:00Z')
  })

  it('author becomes Person when authorName is set', () => {
    const ld = buildArticleJsonLd({
      title: 't',
      slug: 's',
      description: 'd',
      coverUrl: null,
      publishedAt: null,
      authorName: '김수의사',
    }) as { author: { '@type': string } }
    assert.equal(ld.author['@type'], 'Person')
  })
})

describe('buildFaqJsonLd', () => {
  it('wraps each Q/A in Question + Answer nodes', () => {
    const ld = buildFaqJsonLd([
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: 'A2' },
    ])
    assert.equal(ld.mainEntity.length, 2)
    assert.deepEqual(ld.mainEntity[0], {
      '@type': 'Question',
      name: 'Q1',
      acceptedAnswer: { '@type': 'Answer', text: 'A1' },
    })
  })
})

describe('ogImageUrl', () => {
  it('encodes Korean characters safely', () => {
    const url = ogImageUrl({ title: '브랜드 이야기', tag: 'About' })
    // URLSearchParams uses application/x-www-form-urlencoded (space → '+'),
    // so assert individual Korean byte sequences are percent-encoded rather
    // than comparing to encodeURIComponent's %20 form.
    assert.ok(url.includes(encodeURIComponent('브랜드')))
    assert.ok(url.includes(encodeURIComponent('이야기')))
    assert.ok(url.includes('tag=About'))
  })

  it('omits variant=default (treated as empty)', () => {
    const url = ogImageUrl({ title: 't' })
    assert.equal(url.includes('variant='), false)
  })

  it('includes variant only when not default', () => {
    assert.ok(ogImageUrl({ title: 't', variant: 'product' }).includes('variant=product'))
  })
})
