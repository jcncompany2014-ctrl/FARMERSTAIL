import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { notFound } from 'next/navigation'
import StoreShell from '@/components/store/StoreShell'
import MagazineRecipeEnd from '@/components/store/MagazineRecipeEnd'
import { renderMarkdown } from '@/lib/markdown'
import { fillRecipeCards } from '@/lib/magazine/recipe-card'
import { withToc } from '@/lib/magazine/toc'
import { MAGAZINE_POST_CSS } from '@/lib/magazine/post-css'

/**
 * 매거진 초안 미리보기 — docs/magazine/<달>/<파일>.md 를 글 화면(app/blog/[slug])과 같은 모양으로 그린다(2026-10-11 매거진 기획).
 * 사장님이 DB 에 넣기 전에 화면 그대로 확인하는 용도. 운영에선 점검 화면 자체가 404(규칙172 ⑤).
 * 초안 파일: 맨 위 --- 사이에 title·excerpt·category·cover, 본문은 '본문 시작'~'본문 끝' 주석 사이(그 밖은 사장님 확인 메모).
 */
export default function MagazineDraftPreview({ month, file }: { month: string; file: string }) {
  if (!/^\d{4}-\d{2}$/.test(month) || !/^[a-z0-9-]+$/.test(file)) notFound()
  let src: string
  try {
    src = readFileSync(join(process.cwd(), 'docs', 'magazine', month, `${file}.md`), 'utf8').replace(/\r\n/g, '\n')
  } catch {
    notFound()
  }
  const meta = (key: string) => new RegExp(`^${key}:\\s*(.+?)\\s*(#.*)?$`, 'm').exec(src.split('\n---\n')[0] ?? '')?.[1] ?? ''
  const body = /<!-- 본문 시작[^>]*-->\n([\s\S]*?)\n<!-- 본문 끝 -->/.exec(src)?.[1] ?? ''
  const cover = meta('cover')
  const filled = fillRecipeCards(renderMarkdown(body))
  return (
    <StoreShell>
      <style>{MAGAZINE_POST_CSS}</style>
      <div style={{ lineHeight: 'normal' }}>
        <section style={{ padding: '8px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <span style={{ height: 48, display: 'flex', alignItems: 'center', fontSize: 16, fontWeight: 700 }}>← 매거진</span>
          <span style={{ marginTop: 12, fontSize: 15, fontWeight: 800, color: '#595959' }}>{meta('category')}</span>
          <h1 className="d" style={{ margin: '8px 0 0', fontSize: 32, lineHeight: 1.2 }}>
            {meta('title')}
          </h1>
          <p style={{ margin: '14px 0 0', fontSize: 17, lineHeight: 1.65, color: '#3D3D3D' }}>{meta('excerpt')}</p>
          <div style={{ marginTop: 16, padding: '16px 0', borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', fontSize: 15, color: '#595959' }}>
            초안 미리보기 · {Math.max(1, Math.round(body.length / 500))}분 읽기
          </div>
          {cover.startsWith('/') && (
            <span style={{ marginTop: 20, position: 'relative', display: 'block', width: '100%', aspectRatio: '350 / 197', borderRadius: 4, overflow: 'hidden', background: '#F6F4F5' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </span>
          )}
        </section>
        <article className="ftb-post" style={{ padding: '28px 20px 0' }} dangerouslySetInnerHTML={{ __html: withToc(filled.html).html }} />
        <MagazineRecipeEnd keys={filled.keys} />
        <div aria-hidden style={{ height: 64 }} />
      </div>
    </StoreShell>
  )
}
