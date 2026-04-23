'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Star, ShoppingBag, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { creditPoints } from '@/lib/commerce/points'

type Dog = { id: string; name: string }

type Props = {
  orderId: string
  orderItemId: string
  productId: string
  productName: string
  productImage: string | null
  dogs: Dog[]
}

const REVIEW_POINT_REWARD = 500

export default function ReviewForm({
  orderId,
  orderItemId,
  productId,
  productName,
  productImage,
  dogs,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [rating, setRating] = useState(5)
  const [hover, setHover] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [dogId, setDogId] = useState<string | ''>(dogs[0]?.id ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (content.trim().length < 10) {
      setError('리뷰는 10자 이상 써주세요')
      return
    }
    setSubmitting(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: review, error: insertErr } = await supabase
      .from('reviews')
      .insert({
        user_id: user.id,
        product_id: productId,
        order_item_id: orderItemId,
        dog_id: dogId || null,
        rating,
        title: title.trim() || null,
        content: content.trim(),
      })
      .select('id')
      .single()

    if (insertErr || !review) {
      setError('리뷰 등록에 실패했어요. 잠시 후 다시 시도해주세요.')
      setSubmitting(false)
      return
    }

    // 리뷰 작성 적립 — lib/commerce/points 로 일원화.
    await creditPoints(supabase, {
      userId: user.id,
      amount: REVIEW_POINT_REWARD,
      reason: '리뷰 작성 적립',
      referenceType: 'review',
      referenceId: review.id,
    })

    setSuccess(true)
    setTimeout(() => {
      router.push(`/mypage/reviews`)
      router.refresh()
    }, 1200)
  }

  return (
    <main className="pb-8">
      <section className="px-5 pt-6 pb-2">
        <Link
          href={`/mypage/orders/${orderId}`}
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 주문 상세
        </Link>
        <span className="kicker mt-3 inline-block">Write Review · 리뷰 작성</span>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          리뷰 작성
        </h1>
        <p className="text-[11px] text-muted mt-1">
          작성 완료 시{' '}
          <span className="font-bold text-terracotta">
            {REVIEW_POINT_REWARD.toLocaleString()}P
          </span>{' '}
          적립
        </p>
      </section>

      {/* Product */}
      <section className="px-5 mt-3">
        <div className="bg-white rounded-xl border border-rule px-4 py-4 flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg bg-bg overflow-hidden flex items-center justify-center shrink-0">
            {productImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={productImage}
                alt={productName}
                className="w-full h-full object-cover"
              />
            ) : (
              <ShoppingBag
                className="w-5 h-5 text-muted"
                strokeWidth={1.5}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-text leading-snug line-clamp-2">
              {productName}
            </p>
            <p className="text-[10px] text-muted mt-0.5">이 상품의 후기</p>
          </div>
        </div>
      </section>

      {/* Rating */}
      <section className="px-5 mt-3">
        <div className="bg-white rounded-xl border border-rule px-4 py-5">
          <div className="text-[11px] font-bold text-muted uppercase tracking-wider">
            별점
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => {
              const active = (hover ?? rating) >= n
              return (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setRating(n)}
                  className="p-1 transition active:scale-90"
                  aria-label={`${n}점`}
                >
                  <Star
                    className={`w-9 h-9 transition ${
                      active
                        ? 'fill-gold text-gold'
                        : 'fill-none text-rule-2'
                    }`}
                    strokeWidth={1.3}
                  />
                </button>
              )
            })}
          </div>
          <p className="text-center text-[11px] text-muted mt-2">
            {['', '별로예요', '그저 그래요', '보통이에요', '좋아요', '최고예요!'][rating]}
          </p>
        </div>
      </section>

      {/* Dog tag */}
      {dogs.length > 0 && (
        <section className="px-5 mt-3">
          <div className="bg-white rounded-xl border border-rule px-4 py-4">
            <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-3">
              어느 아이가 먹었나요? (선택)
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDogId('')}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
                  dogId === ''
                    ? 'bg-text text-white border-text'
                    : 'bg-white text-muted border-rule hover:border-text'
                }`}
              >
                선택 안 함
              </button>
              {dogs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDogId(d.id)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
                    dogId === d.id
                      ? 'bg-moss text-white border-moss'
                      : 'bg-white text-muted border-rule hover:border-moss'
                  }`}
                >
                  🐾 {d.name}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Title + Content */}
      <section className="px-5 mt-3">
        <div className="bg-white rounded-xl border border-rule px-4 py-4 space-y-3">
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-wider">
              제목 (선택)
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={50}
              placeholder="예: 우리 강아지가 너무 잘 먹어요"
              className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-bg border border-rule text-[13px] text-text placeholder:text-muted/60 focus:outline-none focus:border-terracotta"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-wider">
              후기 *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1000}
              rows={6}
              placeholder="솔직한 사용 후기를 남겨주세요 (최소 10자)"
              className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-bg border border-rule text-[13px] text-text placeholder:text-muted/60 leading-relaxed focus:outline-none focus:border-terracotta resize-none"
            />
            <p className="text-[10px] text-muted mt-1 text-right">
              {content.length}/1000
            </p>
          </div>
        </div>
      </section>

      {error && (
        <p className="px-5 mt-3 text-[12px] font-bold text-sale">
          {error}
        </p>
      )}

      {/* CTA */}
      <section className="px-5 mt-4">
        <button
          onClick={submit}
          disabled={submitting || success}
          className={`w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-[13px] font-black shadow-sm transition-all disabled:opacity-70 ${
            success
              ? 'bg-moss text-white'
              : 'bg-terracotta text-white hover:shadow-md active:scale-[0.98]'
          }`}
        >
          {success ? (
            <>
              <Check className="w-4 h-4" strokeWidth={3} />
              등록됐어요! +{REVIEW_POINT_REWARD}P
            </>
          ) : submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
              등록 중...
            </>
          ) : (
            '리뷰 등록하기'
          )}
        </button>
      </section>
    </main>
  )
}
