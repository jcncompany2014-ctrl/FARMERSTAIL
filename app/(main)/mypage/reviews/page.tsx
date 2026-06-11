import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Star, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { V3, V3FontWeight, V3LetterSpacing, V3Radius } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

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
    timeZone: 'Asia/Seoul',
  })
}

function Stars({ value }: { value: number }) {
  return (
    <div className="inline-flex items-center" style={{ gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={12}
          strokeWidth={1.5}
          color={i <= value ? V3.yellow : V3.inkFaint}
          fill={i <= value ? V3.yellow : 'none'}
        />
      ))}
    </div>
  )
}

/**
 * /mypage/reviews — 내 리뷰 리스트 (v3 reskin, 2026-05-22 R9-7).
 */
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
    <div style={{ paddingBottom: 32 }}>
      <section style={{ padding: '24px 20px 8px' }}>
        <Mono color="inkMute" size="xs" weight={500}>
          Reviews · 내 리뷰
        </Mono>
        <h1
          style={{
            margin: '6px 0 0',
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 28,
            lineHeight: 1,
            color: V3.ink,
            letterSpacing: V3LetterSpacing.heading,
          }}
        >
          내 리뷰
        </h1>
        <Mono
          color="inkMute"
          size="xxs"
          weight={500}
          letterSpacing="0.08em"
          style={{ marginTop: 6, display: 'inline-block' }}
        >
          ({String(list.length).padStart(2, '0')})
        </Mono>
      </section>

      {list.length === 0 ? (
        <section style={{ padding: '20px 20px 0' }}>
          <div
            className="text-center"
            style={{
              borderRadius: V3Radius.sm,
              border: `1.5px dashed ${V3.rule}`,
              padding: '48px 24px',
              background: V3.paperHi,
            }}
          >
            <div
              className="mx-auto flex items-center justify-center"
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: V3.paper,
                border: `1px solid ${V3.rule}`,
                marginBottom: 12,
              }}
            >
              <MessageSquare size={24} color={V3.inkMute} strokeWidth={1.3} />
            </div>
            <Mono color="inkMute" size="xxs" weight={600}>
              Empty
            </Mono>
            <h3
              style={{
                margin: '8px 0 0',
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.black,
                fontSize: 16,
                color: V3.ink,
                letterSpacing: '-0.02em',
              }}
            >
              아직 작성한 리뷰가 없어요
            </h3>
            <p
              style={{
                fontSize: 10.5,
                color: V3.inkMute,
                marginTop: 6,
              }}
            >
              주문 상세에서 구매한 상품에 리뷰를 남겨보세요
            </p>
            <Link
              href="/mypage/orders"
              className="inline-block active:scale-[0.98] transition"
              style={{
                marginTop: 20,
                padding: '12px 22px',
                fontSize: 12,
                fontWeight: V3FontWeight.bold,
                borderRadius: V3Radius.pill,
                background: V3.ink,
                color: V3.paperHi,
                textDecoration: 'none',
              }}
            >
              주문 내역 보기
            </Link>
          </div>
        </section>
      ) : (
        <section
          style={{
            padding: '12px 20px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {list.map((r) => (
            <div
              key={r.id}
              style={{
                background: V3.paperHi,
                border: `1px solid ${V3.rule}`,
                borderRadius: V3Radius.sm,
                padding: '14px 16px',
              }}
            >
              <Link
                href={`/products/${r.products?.slug ?? ''}#reviews`}
                className="flex items-center"
                style={{ gap: 12, textDecoration: 'none', color: V3.ink }}
              >
                <div
                  className="relative overflow-hidden flex items-center justify-center shrink-0"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: V3Radius.xs,
                    background: V3.paper,
                    border: `1px solid ${V3.rule}`,
                  }}
                >
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
                  <p
                    className="truncate"
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-sans)',
                      fontSize: 12,
                      fontWeight: V3FontWeight.bold,
                      color: V3.ink,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {r.products?.name ?? '삭제된 상품'}
                  </p>
                  <div
                    className="flex items-center"
                    style={{ gap: 8, marginTop: 4 }}
                  >
                    <Stars value={r.rating} />
                    <Mono
                      color="inkMute"
                      size="xxs"
                      weight={500}
                      letterSpacing="0.06em"
                    >
                      {formatDate(r.created_at)}
                    </Mono>
                  </div>
                </div>
              </Link>
              {r.title && (
                <h3
                  style={{
                    margin: '12px 0 0',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13.5,
                    fontWeight: V3FontWeight.black,
                    color: V3.ink,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {r.title}
                </h3>
              )}
              <p
                className="line-clamp-4"
                style={{
                  margin: '4px 0 0',
                  fontSize: 12,
                  color: V3.ink,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-line',
                }}
              >
                {r.content}
              </p>
              {r.helpful_count > 0 && (
                <p
                  style={{
                    margin: '8px 0 0',
                    fontSize: 10.5,
                    color: V3.accent,
                    fontWeight: V3FontWeight.bold,
                  }}
                >
                  👍 {r.helpful_count}명에게 도움이 됐어요
                </p>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
