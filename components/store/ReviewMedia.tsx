'use client'

/**
 * 네이버 스마트스토어 후기 한 편(상품 상세 후기 칸·홈 작은 카드) — 사장님 2026-10-17 "스마트스토어 후기라는 거 달아 놓고, 아이디도 그대로".
 * 출처 딱지(네이버 초록 + 검정 글자 — 흰 글자는 대비 2.3:1) · 별점 · 글(그대로) · 사진·영상(정사각형) · 가린 아이디 · 날짜 · 산 상품.
 * 사진을 누르면 크게 본다(화면 전체, 다시 누르거나 닫기). 영상은 화면에 반쯤 보이면 소리 없이 돌고, 벗어나면 멈춘다 —
 * 아이폰 저전력 모드처럼 재생을 막으면 포스터 그림 + 재생 단추로 바뀐다(reference_ios_low_power_video).
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { RECIPE_BAND, RECIPE_TITLE } from '@/lib/store/catalog'
import { reviewDate, reviewDogLine, reviewerLabel, type ReviewPhoto, type StoreReview } from '@/lib/store/reviews'

export const NAVER_GREEN = '#03C75A'

export function SmartstoreBadge({ small = false }: { small?: boolean }) {
  return (
    <span style={{ height: small ? 22 : 26, padding: small ? '0 7px' : '0 9px', borderRadius: 2, background: NAVER_GREEN, color: '#141414', fontSize: small ? 12 : 13, fontWeight: 800, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      네이버 스마트스토어 후기
    </span>
  )
}

export function Stars({ rating, size = 15 }: { rating: number; size?: number }) {
  const full = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <span role="img" aria-label={`별점 5점 중 ${full}점`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: size, lineHeight: 1, whiteSpace: 'nowrap' }}>
      <span aria-hidden style={{ letterSpacing: 1, color: '#141414' }}>
        {'★'.repeat(full)}
        <span style={{ color: '#D0D0D0' }}>{'★'.repeat(5 - full)}</span>
      </span>
      <span aria-hidden style={{ fontWeight: 800 }}>{full}</span>
    </span>
  )
}

/** 정사각형 후기 영상 — 보이면 돈다. preload 없음(보일 때 처음 받는다). */
export function ReviewVideo({ src, poster, alt, size }: { src: string; poster: string; alt: string; size: number | string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [blocked, setBlocked] = useState(false)
  useEffect(() => {
    const v = ref.current
    if (!v || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e) return
        if (e.isIntersecting) v.play().catch(() => setBlocked(true))
        else v.pause()
      },
      { threshold: 0.5 },
    )
    io.observe(v)
    return () => io.disconnect()
  }, [])
  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      aria-label={alt}
      muted
      loop
      playsInline
      preload="none"
      controls={blocked}
      style={{ width: size, height: size, objectFit: 'cover', display: 'block', background: '#E5E5E5', borderRadius: 4 }}
    />
  )
}

function Zoom({ photo, onClose }: { photo: ReviewPhoto; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label="후기 사진 크게 보기" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,20,20,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 12 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.src} alt={photo.alt} style={{ width: '100%', maxWidth: 560, aspectRatio: '1 / 1', objectFit: 'contain', display: 'block' }} />
      {photo.caption && <span style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 700 }}>{photo.caption}</span>}
      <button type="button" onClick={onClose} style={{ height: 44, padding: '0 20px', borderRadius: 4, border: '1.5px solid #FFFFFF', background: 'transparent', color: '#FFFFFF', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
        닫기
      </button>
    </div>
  )
}

/** 상품 상세 후기 칸의 스마트스토어 후기 한 편 — 먹선 사이 한 줄 목록(상자 없이). */
export function SmartstoreReview({ r }: { r: StoreReview }) {
  const [zoom, setZoom] = useState<ReviewPhoto | null>(null)
  const dog = reviewDogLine(r)
  const CELL = 148
  return (
    <article style={{ padding: '18px 0', borderBottom: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SmartstoreBadge />
          {r.rating !== null && <Stars rating={r.rating} />}
        </span>
        <span style={{ fontSize: 14, color: '#595959' }}>{reviewDate(r.date)}</span>
      </div>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: '#141414', whiteSpace: 'pre-line' }}>{r.body}</p>
      {(r.video || r.photos.length > 0) && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {r.video && (
            <span style={{ flexShrink: 0 }}>
              <ReviewVideo src={r.video.src} poster={r.video.poster} alt={r.video.alt} size={CELL} />
            </span>
          )}
          {r.photos.map((p) => (
            <span key={p.src} style={{ flexShrink: 0, width: CELL, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button type="button" onClick={() => setZoom(p)} aria-label={`${p.alt} 크게 보기`} style={{ width: CELL, height: CELL, padding: 0, border: 0, borderRadius: 4, overflow: 'hidden', background: '#E5E5E5', cursor: 'zoom-in' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={p.alt} loading="lazy" width={600} height={600} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} />
              </button>
              {/* 손님이 올린 토핑·간식 — 사진 아래 작은 글씨(작은 칸 위에 얹으면 사진을 가린다) */}
              {p.caption && <span style={{ fontSize: 12, lineHeight: 1.4, color: '#595959' }}>{p.caption}</span>}
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>
          {reviewerLabel(r)}
          {dog && <span style={{ fontWeight: 600, color: '#595959' }}> · {dog}</span>}
        </span>
        <span style={{ fontSize: 14, color: '#595959' }}>
          {r.product} 구매 · {r.note}
        </span>
      </div>
      {zoom && <Zoom photo={zoom} onClose={() => setZoom(null)} />}
    </article>
  )
}

/**
 * 인스타 게시 동의 후기 큰 카드(상품 상세·후기 화면) — 사진은 첫 장 크게 + 나머지 두 칸씩, 전부 1:1(파일도 정사각형 — 규칙288).
 * 예전 2:1 고정 높이 칸은 좁은 칸의 사진 양옆을 잘랐다. 레시피 딱지 · 고른 한 줄 · 글 · 누구 · 옮긴 방법.
 */
export function FeaturedReview({ r }: { r: StoreReview }) {
  if (!r.recipe) return null
  const recipe = r.recipe
  return (
    <article style={{ border: '2px solid #141414', borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* PC(폭 1024 이상)에선 사진 셋을 한 줄로(store.css .fts-feat-photos) — 첫 장을 칸 너비만큼 키우면 820px 정사각형이 된다 */}
      <div className="fts-feat-photos" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, background: '#141414' }}>
        {r.photos.map((p, i) => (
          <figure key={p.src} style={{ margin: 0, position: 'relative', gridColumn: i === 0 || (i === r.photos.length - 1 && i % 2 === 1) ? '1 / -1' : undefined }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.src} alt={p.alt} loading="lazy" width={600} height={600} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} />
            {p.caption && (
              <figcaption style={{ position: 'absolute', left: 8, bottom: 8, padding: '3px 8px', borderRadius: 2, background: 'rgba(20,20,20,0.78)', color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>
                {p.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
      <div style={{ padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ alignSelf: 'flex-start', height: 28, padding: '0 10px', borderRadius: 2, background: '#F6F4F5', color: '#141414', fontSize: 14, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden style={{ width: 8, height: 8, background: RECIPE_BAND[recipe] }} />
          {RECIPE_TITLE[recipe]}
        </span>
        {r.title && (
          <strong className="d" style={{ fontSize: 24, lineHeight: 1.2, fontWeight: 400, textWrap: 'balance' }}>
            &ldquo;{r.title}&rdquo;
          </strong>
        )}
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: '#3D3D3D' }}>{r.body}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 12, borderTop: '1px solid #E5E5E5' }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>
            {reviewerLabel(r)}
            {r.breed ? <span style={{ fontWeight: 600, color: '#595959' }}> · {r.breed}</span> : null}
          </span>
          <span style={{ fontSize: 14, color: '#595959' }}>{r.note}</span>
        </div>
      </div>
    </article>
  )
}

/**
 * 후기 모아 보기(우리 음식·브랜드 이야기 화면) — 별점 한 줄 + 스마트스토어 후기 작은 카드 몇 개 + '후기 전체 보기'(/reviews).
 * 10/18: 두 화면이 후기를 11편 올린 뒤에도 "첫 후기를 모으는 중이에요"라고 말하고 있었다.
 */
export function ReviewDigest({ reviews, summary }: { reviews: StoreReview[]; summary: { stars: string; reviews: number; asOf: string } }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', paddingBottom: 12 }}>
        <span className="n" style={{ fontSize: 28, lineHeight: 1 }}>
          ★ {summary.stars}
        </span>
        <span style={{ fontSize: 15, color: '#595959' }}>
          네이버 스마트스토어 후기 {summary.reviews}건 · {summary.asOf} 기준
        </span>
      </span>
      <div style={{ borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
        {reviews.map((r) => (
          <SmartstoreReviewCard key={r.id} r={r} />
        ))}
        <Link href="/reviews" style={{ minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 16, fontWeight: 800, color: '#141414', textDecoration: 'none', borderBottom: '1px solid #E5E5E5' }}>
          후기 전체 보기
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </div>
  )
}

/** 홈 작은 카드 — 정사각형 그림 하나 · 딱지·별점 · 글 세 줄 · 아이디·레시피. 누르면 그 상품 상세 후기 칸으로. */
export function SmartstoreReviewCard({ r }: { r: StoreReview }) {
  if (!r.recipe) return null
  const thumb = r.photos[0]?.src ?? r.video?.poster ?? null
  const dog = reviewDogLine(r)
  return (
    <Link href={`/store/${r.recipe}#reviews`} style={{ padding: '14px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: thumb ? '88px minmax(0, 1fr)' : 'minmax(0, 1fr)', columnGap: 14, alignItems: 'start', color: '#141414', textDecoration: 'none' }}>
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" width={176} height={176} loading="lazy" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 4, display: 'block', background: '#E5E5E5' }} />
      )}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SmartstoreBadge small />
          {r.rating !== null && <Stars rating={r.rating} size={13} />}
        </span>
        <span style={{ fontSize: 15, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.body}</span>
        <span style={{ fontSize: 13, color: '#595959' }}>
          {reviewerLabel(r)}
          {dog ? ` · ${dog}` : ''} · {RECIPE_TITLE[r.recipe]}
        </span>
      </span>
    </Link>
  )
}
