'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Star, ShoppingBag, Loader2, Check, Camera, X } from 'lucide-react'
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
const REVIEW_PHOTO_BONUS = 300 // 사진 리뷰 추가 적립
const MAX_PHOTOS = 4
const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5MB/장

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
  // photos: 업로드 완료된 public URL 배열. 업로드 중인 로컬 미리보기와 분리해
  // 제출 시 DB 에는 URL 배열만 박히도록. pending 은 낙관 UX (썸네일 즉시 렌더).
  const [photos, setPhotos] = useState<string[]>([])
  const [uploadingCount, setUploadingCount] = useState(0)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // 같은 파일 다시 고를 수 있게 초기화
    if (files.length === 0) return

    const remaining = MAX_PHOTOS - photos.length
    if (remaining <= 0) {
      setError(`사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요`)
      return
    }
    const accepted = files.slice(0, remaining)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    setUploadingCount((c) => c + accepted.length)
    try {
      const urls: string[] = []
      for (const file of accepted) {
        if (file.size > MAX_PHOTO_BYTES) {
          setError('사진은 장당 5MB 이하만 올릴 수 있어요')
          continue
        }
        if (!file.type.startsWith('image/')) {
          setError('이미지 파일만 올릴 수 있어요')
          continue
        }
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        // 경로는 `<uid>/<random>.<ext>` — 스토리지 RLS 가 폴더 첫 세그먼트를
        // auth.uid() 와 비교하므로 이 네이밍을 유지해야 한다.
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('review-photos')
          .upload(path, file, { contentType: file.type, upsert: false })
        if (upErr) {
          setError('사진 업로드에 실패했어요')
          continue
        }
        const { data: pub } = supabase.storage
          .from('review-photos')
          .getPublicUrl(path)
        urls.push(pub.publicUrl)
      }
      if (urls.length > 0) setPhotos((prev) => [...prev, ...urls])
    } finally {
      setUploadingCount((c) => Math.max(0, c - accepted.length))
    }
  }

  function removePhoto(url: string) {
    setPhotos((prev) => prev.filter((u) => u !== url))
    // 스토리지에서 지우는 것까지 여기서 하면 UX 가 막히므로 fire-and-forget.
    // 경로는 public URL 끝부분 `review-photos/<uid>/<file>` 에서 추출.
    const marker = '/review-photos/'
    const idx = url.indexOf(marker)
    if (idx === -1) return
    const path = url.slice(idx + marker.length)
    supabase.storage.from('review-photos').remove([path]).catch(() => {})
  }

  async function submit() {
    setError(null)
    if (content.trim().length < 10) {
      setError('리뷰는 10자 이상 써주세요')
      return
    }
    if (uploadingCount > 0) {
      setError('사진 업로드가 끝난 뒤 등록해주세요')
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
        image_urls: photos,
      })
      .select('id')
      .single()

    if (insertErr || !review) {
      setError('리뷰 등록에 실패했어요. 잠시 후 다시 시도해주세요.')
      setSubmitting(false)
      return
    }

    // 리뷰 작성 적립. 사진이 있으면 보너스까지 묶어서 한 번에 크레딧.
    const rewardAmount =
      REVIEW_POINT_REWARD + (photos.length > 0 ? REVIEW_PHOTO_BONUS : 0)
    await creditPoints(supabase, {
      userId: user.id,
      amount: rewardAmount,
      reason: photos.length > 0 ? '포토 리뷰 작성 적립' : '리뷰 작성 적립',
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
    <main className="pb-8 md:pb-16 mx-auto" style={{ maxWidth: 720 }}>
      <section className="px-5 md:px-6 pt-6 md:pt-8 pb-2 md:pb-4">
        <Link
          href={`/mypage/orders/${orderId}`}
          className="text-[11px] md:text-[12.5px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 주문 상세
        </Link>
        <span className="kicker mt-3 block">Write Review · 리뷰 작성</span>
        <h1
          className="font-serif mt-1.5 md:mt-3 text-[22px] md:text-[34px] lg:text-[40px]"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
          }}
        >
          리뷰 작성
        </h1>
        <p className="text-[11px] md:text-[13px] text-muted mt-1 md:mt-2">
          작성 완료 시{' '}
          <span className="font-bold text-terracotta">
            {REVIEW_POINT_REWARD.toLocaleString()}P
          </span>
          , 사진 포함 시{' '}
          <span className="font-bold text-terracotta">
            +{REVIEW_PHOTO_BONUS.toLocaleString()}P
          </span>{' '}
          적립
        </p>
      </section>

      {/* Product */}
      <section className="px-5 md:px-6 mt-3 md:mt-4">
        <div className="bg-white rounded-xl border border-rule px-4 py-4 md:px-5 md:py-5 flex items-center gap-3 md:gap-4">
          <div className="relative w-14 h-14 md:w-20 md:h-20 rounded-lg bg-bg overflow-hidden flex items-center justify-center shrink-0">
            {productImage ? (
              <Image
                src={productImage}
                alt={productName}
                fill
                sizes="(max-width: 768px) 56px, 80px"
                className="object-cover"
              />
            ) : (
              <ShoppingBag
                className="w-5 h-5 md:w-7 md:h-7 text-muted"
                strokeWidth={1.5}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] md:text-[15px] font-bold text-text leading-snug line-clamp-2">
              {productName}
            </p>
            <p className="text-[10px] md:text-[12px] text-muted mt-0.5 md:mt-1">이 상품의 후기</p>
          </div>
        </div>
      </section>

      {/* Rating */}
      <section className="px-5 md:px-6 mt-3 md:mt-4">
        <div className="bg-white rounded-xl border border-rule px-4 py-5 md:px-6 md:py-7">
          <div className="text-[11px] md:text-[12.5px] font-bold text-muted uppercase tracking-wider">
            별점
          </div>
          <div className="mt-3 md:mt-5 flex items-center justify-center gap-2 md:gap-3">
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
                    className={`w-9 h-9 md:w-12 md:h-12 transition ${
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
          <p className="text-center text-[11px] md:text-[13px] text-muted mt-2 md:mt-3">
            {['', '별로예요', '그저 그래요', '보통이에요', '좋아요', '최고예요!'][rating]}
          </p>
        </div>
      </section>

      {/* Dog tag */}
      {dogs.length > 0 && (
        <section className="px-5 md:px-6 mt-3 md:mt-4">
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
      <section className="px-5 md:px-6 mt-3 md:mt-4">
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

      {/* Photos */}
      <section className="px-5 md:px-6 mt-3 md:mt-4">
        <div className="bg-white rounded-xl border border-rule px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
              사진 (선택)
            </span>
            <span className="text-[10px] text-muted">
              {photos.length}/{MAX_PHOTOS}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((url) => (
              <div
                key={url}
                className="relative aspect-square rounded-lg overflow-hidden bg-bg border border-rule"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="리뷰 사진" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(url)}
                  aria-label="사진 삭제"
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-ink/80 text-white flex items-center justify-center active:scale-90 transition"
                >
                  <X className="w-3 h-3" strokeWidth={3} />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingCount > 0}
                className="aspect-square rounded-lg border border-dashed border-rule-2 bg-bg flex flex-col items-center justify-center gap-1 text-muted hover:border-terracotta hover:text-terracotta transition disabled:opacity-60"
              >
                {uploadingCount > 0 ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Camera className="w-4 h-4" strokeWidth={1.8} />
                )}
                <span className="text-[10px] font-bold">
                  {uploadingCount > 0 ? '업로드 중' : '사진 추가'}
                </span>
              </button>
            )}
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handlePhotoPick}
          />
          <p className="text-[10px] text-muted mt-2 leading-relaxed">
            장당 5MB 이하, 최대 {MAX_PHOTOS}장. 반려견 얼굴이 나오는 사진은 자제해주세요.
          </p>
        </div>
      </section>

      {error && (
        <p className="px-5 md:px-6 mt-3 md:mt-4 text-[12px] md:text-[13.5px] font-bold text-sale">
          {error}
        </p>
      )}

      {/* CTA */}
      <section className="px-5 md:px-6 mt-4 md:mt-6">
        <button
          onClick={submit}
          disabled={submitting || success}
          className={`w-full inline-flex items-center justify-center gap-2 py-3.5 md:py-4.5 rounded-xl text-[13px] md:text-[15px] font-black shadow-sm transition-all disabled:opacity-70 ${
            success
              ? 'bg-moss text-white'
              : 'bg-terracotta text-white hover:shadow-md active:scale-[0.98]'
          }`}
        >
          {success ? (
            <>
              <Check className="w-4 h-4 md:w-5 md:h-5" strokeWidth={3} />
              등록됐어요! +{(REVIEW_POINT_REWARD + (photos.length > 0 ? REVIEW_PHOTO_BONUS : 0)).toLocaleString()}P
            </>
          ) : submitting ? (
            <>
              <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" strokeWidth={2} />
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
