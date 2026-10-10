/**
 * /blog 라우트 로딩 폴백 — 웹 시안 WEB-C08 자리 그대로의 회색 칸: 머리말·제목·소개·카테고리 단추 → 최신 글 사진 → 목록 줄.
 * 가게 틀(StoreShell)로 감싸 로딩 중에도 머리줄이 그대로 있다(본 화면으로 바뀔 때 머리줄이 사라졌다 나타나지 않게).
 * ★이 파일은 app/blog/(index)/ 에 있어야 한다 — app/blog/ 로 올리면 [slug] 까지 감싸 없는 글이 404 대신 200 이 된다
 *   (2026-08-02 검수, app/blog/[slug]/page.tsx 주석 참조).
 */
import StoreShell from '@/components/store/StoreShell'

const GRAY: React.CSSProperties = { display: 'block', background: '#F6F4F5', borderRadius: 4 }

export default function BlogLoading() {
  return (
    <StoreShell>
      <div role="status" aria-label="매거진을 불러오는 중" style={{ lineHeight: 'normal' }}>
        <section style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <span style={{ ...GRAY, width: 52, height: 16 }} />
          <span style={{ ...GRAY, marginTop: 10, width: '58%', height: 88 }} />
          <span style={{ ...GRAY, marginTop: 14, width: '92%', height: 58 }} />
          <span style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} style={{ ...GRAY, height: 48 }} />
            ))}
          </span>
        </section>

        <section style={{ padding: '28px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <span style={{ ...GRAY, width: '100%', aspectRatio: '350 / 220' }} />
          <span style={{ ...GRAY, marginTop: 14, width: 96, height: 26 }} />
          <span style={{ ...GRAY, marginTop: 8, width: '88%', height: 62 }} />
          <span style={{ ...GRAY, marginTop: 8, width: '100%', height: 50 }} />
        </section>

        <section style={{ padding: '32px 20px 64px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: '16px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '1fr 96px', columnGap: 14, alignItems: 'start' }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ ...GRAY, width: 40, height: 14 }} />
                  <span style={{ ...GRAY, width: '92%', height: 44 }} />
                  <span style={{ ...GRAY, width: 110, height: 14 }} />
                </span>
                <span style={{ ...GRAY, width: 96, height: 96 }} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </StoreShell>
  )
}
