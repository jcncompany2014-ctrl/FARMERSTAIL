import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Star, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '내 리뷰',
  robots: { index: false, follow: false },
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function Stars({ value }: { value: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          width={12}
          height={12}
          strokeWidth={1.5}
          className={
            i <= value
              ? 'fill-gold text-gold'
              : 'fill-none text-rule-2'
          }
        />
      ))}
    </div>
  )
}

export default async function MyReviewsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/reviews')

  const { data: reviews } = await supabase
    .from('reviews')
    .select(
      'id, rating, title, content, helpful_count, created_at, product_id, products(name, slug, image_url)'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (reviews ?? []) as any[]

  return (
    <main className="pb-8">
      <section className="px-5 pt-6 pb-2">
        <Link
          href="/mypage"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 내 정보
        </Link>
        <span className="kicker mt-3 block">My Reviews · 내 리뷰</span>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          내 리뷰
        </h1>
        <p className="text-[11px] text-muted mt-1">
          {list.length}개의 리뷰
        </p>
      </section>

      {list.length === 0 ? (
        <section className="px-5 mt-6">
          <div
            className="rounded-2xl border px-6 py-12 text-center"
            style={{
              background: 'var(--bg-2)',
              borderColor: 'var(--rule-2)',
              borderStyle: 'dashed',
            }}
          >
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--rule-2)',
              }}
            >
              <MessageSquare
                className="w-6 h-6 text-muted"
                strokeWidth={1.3}
              />
            </div>
            <span className="kicker">Empty · 리뷰 없음</span>
            <h3
              className="font-serif mt-2"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              아직 작성한 리뷰가 없어요
            </h3>
            <p className="text-[11px] text-muted mt-1.5">
              주문 상세에서 구매한 상품에 리뷰를 남겨보세요
            </p>
            <Link
              href="/mypage/orders"
              className="mt-5 inline-block px-6 py-2.5 rounded-full text-[12px] font-bold active:scale-[0.98] transition"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              주문 내역 보기
            </Link>
          </div>
        </section>
      ) : (
        <section className="px-5 mt-3 space-y-2.5">
          {list.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-xl border border-rule px-4 py-4"
            >
              <Link
                href={`/products/${r.products?.slug ?? ''}#reviews`}
                className="flex items-center gap-3"
              >
                <div className="relative w-12 h-12 rounded-lg bg-bg overflow-hidden flex items-center justify-center shrink-0">
                  {r.products?.image_url ? (
                    <Image
                      src={r.products.image_url}
                      alt={r.products?.name ?? ''}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-text truncate">
                    {r.products?.name ?? '삭제된 상품'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Stars value={r.rating} />
                    <span className="text-[10px] text-muted">
                      {formatDate(r.created_at)}
                    </span>
                  </div>
                </div>
              </Link>
              {r.title && (
                <h3
                  className="mt-3 font-serif"
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: '-0.015em',
                  }}
                >
                  {r.title}
                </h3>
              )}
              <p className="mt-1 text-[12px] text-text leading-relaxed whitespace-pre-line line-clamp-4">
                {r.content}
              </p>
              {r.helpful_count > 0 && (
                <p className="mt-2 text-[10px] text-terracotta font-bold">
                  👍 {r.helpful_count}명에게 도움이 됐어요
                </p>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
