'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useModalA11y } from '@/lib/ui/useModalA11y'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Star, ThumbsUp, MessageSquare, BadgeCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * ProductReviews — 제품 상세 하단 리뷰 블록.
 *
 * 톤: /products/[slug]의 paper-tone 섹션 카드와 같은 언어 — kicker 헤더,
 * serif 평균 점수, gold 별점 + 분포 바. 모든 색은 토큰 경유.
 */

type Review = {
  id: string
  user_id: string
  rating: number
  title: string | null
  content: string
  helpful_count: number
  created_at: string
  image_urls: string[]
  verified: boolean
  dog?: { name: string } | null
  author?: { name: string | null } | null
}

type SortKey = 'latest' | 'helpful' | 'photo' | 'top'

function timeAgo(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const day = Math.floor(diff / 86400000)
  if (day < 1) return '오늘'
  if (day < 7) return `${day}일 전`
  if (day < 30) return `${Math.floor(day / 7)}주 전`
  if (day < 365) return `${Math.floor(day / 30)}개월 전`
  return `${Math.floor(day / 365)}년 전`
}

function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= Math.round(value)
        return (
          <Star
            key={i}
            width={size}
            height={size}
            strokeWidth={1.5}
            color={filled ? 'var(--gold)' : 'var(--rule-2)'}
            fill={filled ? 'var(--gold)' : 'transparent'}
          />
        )
      })}
    </div>
  )
}

export default function ProductReviews({ productId }: { productId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [reviews, setReviews] = useState<Review[]>([])
  const [avg, setAvg] = useState<number | null>(null)
  const [count, setCount] = useState(0)
  const [distribution, setDistribution] = useState<Record<number, number>>({})
  const [helpful, setHelpful] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('latest')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const lightboxRef = useRef<HTMLDivElement>(null)

  // useModalA11y — Esc / focus trap / focus restore / body scroll lock.
  useModalA11y({
    open: lightbox !== null,
    onClose: () => setLightbox(null),
    containerRef: lightboxRef,
  })

  useEffect(() => {
    let mounted = true
    async function load() {
      // fetch latest reviews (top 20) with joined dog, photos, and verified-purchase flag
      // (order_item_id NOT NULL 을 서버에서 bool 로 환산하는 SELECT 표현식은 PostgREST
      // 에서 안 되니 프론트에서 order_item_id 를 받아 파생.)
      const { data: rows } = await supabase
        .from('reviews')
        .select(
          'id, user_id, rating, title, content, helpful_count, image_urls, order_item_id, created_at, dogs(name)'
        )
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(50)

      // fetch author names separately (profiles.id → auth.users.id, not a direct FK on reviews)
      const authorIds = Array.from(
        new Set(((rows ?? []) as { user_id: string }[]).map((r) => r.user_id))
      )
      const { data: profRows } =
        authorIds.length > 0
          ? await supabase
              .from('profiles')
              .select('id, name')
              .in('id', authorIds)
          : { data: [] as { id: string; name: string | null }[] }
      const profMap = new Map<string, string | null>()
      for (const p of profRows ?? []) profMap.set(p.id, p.name)

      // fetch aggregate stats independently so header is correct even if list is trimmed
      const { data: allRatings } = await supabase
        .from('reviews')
        .select('rating')
        .eq('product_id', productId)

      let totalCount = 0
      let sum = 0
      const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      for (const r of allRatings ?? []) {
        totalCount++
        sum += r.rating
        dist[r.rating] = (dist[r.rating] || 0) + 1
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      let userHelpful = new Set<string>()
      if (user && rows && rows.length > 0) {
        const { data: likes } = await supabase
          .from('review_helpful')
          .select('review_id')
          .eq('user_id', user.id)
          .in(
            'review_id',
            (rows as { id: string }[]).map((r) => r.id)
          )
        userHelpful = new Set(
          ((likes ?? []) as { review_id: string }[]).map((l) => l.review_id)
        )
      }

      if (!mounted) return
      setReviews(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (rows ?? []).map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          rating: r.rating,
          title: r.title,
          content: r.content,
          helpful_count: r.helpful_count,
          image_urls: (r.image_urls ?? []) as string[],
          verified: Boolean(r.order_item_id),
          created_at: r.created_at,
          dog: r.dogs ?? null,
          author: { name: profMap.get(r.user_id) ?? null },
        }))
      )
      setCount(totalCount)
      setAvg(totalCount > 0 ? sum / totalCount : null)
      setDistribution(dist)
      setHelpful(userHelpful)
      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [productId, supabase])

  // 정렬/필터를 useMemo 로. 서버 재요청하지 않고 클라이언트에서 끝 —
  // 50건 정도까지는 체감 차이 없음.
  const visibleReviews = useMemo(() => {
    const list = [...reviews]
    if (sort === 'photo') return list.filter((r) => r.image_urls.length > 0)
    if (sort === 'helpful') {
      list.sort((a, b) => b.helpful_count - a.helpful_count)
      return list
    }
    if (sort === 'top') return list.filter((r) => r.rating === 5)
    // latest
    list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    return list
  }, [reviews, sort])

  async function toggleHelpful(reviewId: string) {
    if (pending) return
    setPending(reviewId)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push(
        `/login?next=${encodeURIComponent(pathname ?? '/')}`
      )
      return
    }

    const already = helpful.has(reviewId)
    // optimistic
    setHelpful((prev) => {
      const next = new Set(prev)
      if (already) next.delete(reviewId)
      else next.add(reviewId)
      return next
    })
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? {
              ...r,
              helpful_count: Math.max(
                0,
                r.helpful_count + (already ? -1 : 1)
              ),
            }
          : r
      )
    )

    if (already) {
      await supabase
        .from('review_helpful')
        .delete()
        .eq('review_id', reviewId)
        .eq('user_id', user.id)
    } else {
      await supabase
        .from('review_helpful')
        .insert({ review_id: reviewId, user_id: user.id })
    }
    setPending(null)
  }

  return (
    <section
      id="reviews"
      className="rounded-2xl px-5 py-5 md:px-7 md:py-7 mb-3"
      style={{
        background: 'var(--bg-2)',
        boxShadow: 'inset 0 0 0 1px var(--rule)',
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4 md:mb-5">
        <span className="kicker">Reviews · 리뷰</span>
        <div
          className="flex-1 h-px"
          style={{ background: 'var(--rule-2)' }}
        />
        <span
          className="text-[11px] md:text-[13px] font-semibold"
          style={{ color: 'var(--muted)' }}
        >
          {count}개
        </span>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center">
          <div
            className="w-5 h-5 border-2 rounded-full animate-spin"
            style={{
              borderColor: 'var(--terracotta)',
              borderTopColor: 'transparent',
            }}
          />
        </div>
      ) : count === 0 ? (
        <div className="py-10 flex flex-col items-center text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: 'var(--bg)' }}
          >
            <MessageSquare
              className="w-5 h-5"
              strokeWidth={1.5}
              color="var(--muted)"
            />
          </div>
          <span className="kicker kicker-muted">Empty · 리뷰 없음</span>
          <p
            className="font-serif mt-2 text-[14px] font-black"
            style={{ color: 'var(--text)' }}
          >
            아직 등록된 리뷰가 없어요
          </p>
          <p
            className="text-[11px] mt-1"
            style={{ color: 'var(--muted)' }}
          >
            첫 리뷰를 남기고 적립금을 받아보세요
          </p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div
            className="flex items-center gap-5 md:gap-8 pb-4 md:pb-5"
            style={{ borderBottom: '1px solid var(--rule-2)' }}
          >
            <div className="text-center shrink-0">
              <div
                className="font-serif font-black leading-none text-[36px] md:text-[48px]"
                style={{
                  color: 'var(--terracotta)',
                  letterSpacing: '-0.02em',
                }}
              >
                {avg?.toFixed(1) ?? '—'}
              </div>
              <div className="mt-2 md:mt-3">
                <Stars value={avg ?? 0} size={12} />
              </div>
            </div>
            <div className="flex-1 space-y-1 md:space-y-1.5">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = distribution[n] ?? 0
                const pct = count > 0 ? (c / count) * 100 : 0
                return (
                  <div
                    key={n}
                    className="flex items-center gap-2 md:gap-3 text-[10px] md:text-[11.5px]"
                    style={{ color: 'var(--muted)' }}
                  >
                    <span
                      className="w-3 md:w-4 font-bold"
                      style={{ color: 'var(--text)' }}
                    >
                      {n}
                    </span>
                    <div
                      className="flex-1 h-1.5 md:h-2 rounded-full overflow-hidden"
                      style={{ background: 'var(--bg)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: 'var(--gold)',
                        }}
                      />
                    </div>
                    <span className="w-6 md:w-8 text-right">{c}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sort chips — count 노출. 사진 리뷰는 별도 강조 색. */}
          {(() => {
            const photoCount = reviews.filter(
              (r) => r.image_urls && r.image_urls.length > 0,
            ).length
            const topCount = reviews.filter((r) => r.rating === 5).length
            const opts: {
              k: SortKey
              label: string
              count?: number
              accent?: 'terracotta' | 'gold'
            }[] = [
              { k: 'latest', label: '최신순' },
              { k: 'helpful', label: '도움 많은 순' },
              {
                k: 'photo',
                label: '포토 리뷰',
                count: photoCount,
                accent: 'terracotta',
              },
              {
                k: 'top',
                label: '⭐ 5점만',
                count: topCount,
                accent: 'gold',
              },
            ]
            return (
              <div className="mt-4 md:mt-5 flex flex-wrap gap-1.5 md:gap-2">
                {opts.map((opt) => {
                  const active = sort === opt.k
                  const accentColor =
                    opt.accent === 'gold'
                      ? 'var(--gold)'
                      : 'var(--terracotta)'
                  return (
                    <button
                      key={opt.k}
                      type="button"
                      onClick={() => setSort(opt.k)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 md:px-3.5 md:py-1.5 rounded-full text-[10px] md:text-[12px] font-bold transition active:scale-95"
                      style={{
                        color: active
                          ? opt.accent
                            ? accentColor
                            : 'var(--terracotta)'
                          : 'var(--muted)',
                        background: active
                          ? `color-mix(in srgb, ${
                              opt.accent ? accentColor : 'var(--terracotta)'
                            } 8%, transparent)`
                          : 'var(--bg)',
                        boxShadow: active
                          ? `inset 0 0 0 1px ${opt.accent ? accentColor : 'var(--terracotta)'}`
                          : 'inset 0 0 0 1px var(--rule-2)',
                      }}
                    >
                      {opt.label}
                      {typeof opt.count === 'number' && opt.count > 0 && (
                        <span
                          className="tabular-nums"
                          style={{ opacity: active ? 1 : 0.6 }}
                        >
                          {opt.count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })()}

          {/* Reviews list */}
          <ul className="mt-4 md:mt-6 space-y-4 md:space-y-6">
            {visibleReviews.length === 0 && (
              <li className="py-6 text-center text-[11px] text-muted">
                조건에 맞는 리뷰가 없어요
              </li>
            )}
            {visibleReviews.map((r, idx) => {
              const liked = helpful.has(r.id)
              const authorName =
                r.author?.name?.trim() ||
                (r.user_id ? `고객 ${r.user_id.slice(0, 4)}` : '고객')
              const isLast = idx === visibleReviews.length - 1
              return (
                <li
                  key={r.id}
                  className="pb-4"
                  style={{
                    borderBottom: isLast
                      ? 'none'
                      : '1px solid var(--rule-2)',
                    paddingBottom: isLast ? 0 : undefined,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Stars value={r.rating} size={12} />
                      <span
                        className="text-[11px] font-black"
                        style={{ color: 'var(--text)' }}
                      >
                        {authorName}
                      </span>
                      {r.verified && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{
                            color: 'var(--moss)',
                            background:
                              'color-mix(in srgb, var(--moss) 10%, transparent)',
                          }}
                          title="실제 구매 확인된 리뷰"
                        >
                          <BadgeCheck className="w-3 h-3" strokeWidth={2.2} />
                          구매 확인
                        </span>
                      )}
                      {r.dog?.name && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{
                            color: 'var(--moss)',
                            background:
                              'color-mix(in srgb, var(--moss) 10%, transparent)',
                          }}
                        >
                          🐾 {r.dog.name}
                        </span>
                      )}
                    </div>
                    <span
                      className="text-[10px]"
                      style={{ color: 'var(--muted)' }}
                    >
                      {timeAgo(r.created_at)}
                    </span>
                  </div>
                  {r.title && (
                    <h3
                      className="font-serif mt-2 md:mt-3 text-[13px] md:text-[16px] font-black leading-snug"
                      style={{
                        color: 'var(--ink)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {r.title}
                    </h3>
                  )}
                  <p
                    className="mt-1 md:mt-1.5 text-[12px] md:text-[14px] leading-relaxed whitespace-pre-line"
                    style={{ color: 'var(--text)' }}
                  >
                    {r.content}
                  </p>
                  {r.image_urls.length > 0 && (
                    <div className="mt-2.5 md:mt-3.5 flex gap-1.5 md:gap-2 overflow-x-auto scrollbar-hide">
                      {r.image_urls.map((url) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setLightbox(url)}
                          className="relative shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden bg-bg border border-rule active:scale-95 transition"
                        >
                          <Image
                            src={url}
                            alt="리뷰 사진"
                            fill
                            sizes="(max-width: 768px) 80px, 96px"
                            loading="lazy"
                            className="object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => toggleHelpful(r.id)}
                    disabled={pending === r.id}
                    className="mt-2.5 md:mt-3.5 inline-flex items-center gap-1 md:gap-1.5 px-2.5 py-1 md:px-3.5 md:py-1.5 rounded-full text-[10px] md:text-[12px] font-bold transition active:scale-95"
                    style={{
                      color: liked ? 'var(--terracotta)' : 'var(--muted)',
                      background: liked
                        ? 'color-mix(in srgb, var(--terracotta) 6%, transparent)'
                        : 'var(--bg)',
                      boxShadow: liked
                        ? 'inset 0 0 0 1px var(--terracotta)'
                        : 'inset 0 0 0 1px var(--rule-2)',
                    }}
                  >
                    <ThumbsUp
                      className="w-3 h-3 md:w-3.5 md:h-3.5"
                      strokeWidth={liked ? 2.5 : 2}
                    />
                    도움이 돼요{' '}
                    {r.helpful_count > 0 && `· ${r.helpful_count}`}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {lightbox && (
        <div
          ref={lightboxRef}
          role="dialog"
          aria-modal="true"
          aria-label="리뷰 사진 확대"
          tabIndex={-1}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4 outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="리뷰 사진 확대"
            className="max-h-[92vh] max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </section>
  )
}
