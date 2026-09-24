import type { Metadata } from 'next'
import Image from 'next/image'
import InAppBrowserNotice from '@/components/web/InAppBrowserNotice'
import { business } from '@/lib/business'
import { APP_STORE_LINKS, BIO_EVENT_CARDS, BIO_LINKS, INSTAGRAM_URL } from '@/lib/links'
import s from './link.module.css'

/**
 * /link — 인스타 프로필용 링크인바이오 (litt.ly 대체, 2026-09-24).
 *
 * 웹 마케팅 라우트(/start·/brand 와 같은 부류) — 크롬 없이 한 장짜리.
 * 콘텐츠 목록은 lib/links.ts(config-as-code). 인앱 브라우저 안내 배너 포함.
 * 클릭 추적은 UTM → 자사 퍼널의 기존 수집(lib/utm.ts)이 이어받는다.
 *
 * 2026-09-25 사장님 제보("파워가 약하다·정적이다·이미지가 없다")로 개편:
 * 진입 스태거·눌림 인터랙션(link.module.css) + 이벤트 이미지 카드 +
 * 앱스토어 2종(env 폴백 — 이전엔 iOS env 부재로 Google Play 만 떴다) +
 * 카카오 채널 1:1 문의(lib/business 정본) + 인스타 아이콘.
 */
export const metadata: Metadata = {
  title: '파머스테일 링크',
  description: '파머스테일 — 신선 화식, 맞춤 식단, 이벤트 바로가기',
}

/** 외부 링크만 새 탭 — 내부(/start)는 같은 탭에서 퍼널 진행. */
function extProps(href: string) {
  return href.startsWith('/')
    ? {}
    : { target: '_blank', rel: 'noreferrer' as const }
}

export default function LinkInBioPage() {
  return (
    <main className="min-h-[100dvh] bg-[#FAF9F5]">
      <InAppBrowserNotice />
      <div className="mx-auto max-w-[430px] px-5 pb-16 pt-12 text-center">
        {/* ── 헤더 ─────────────────────────────────────────────── */}
        <header className={`${s.fadeUp} ${s.d1}`}>
          <Image
            src="/logo-stamp.png"
            alt="파머스테일"
            width={76}
            height={76}
            priority
            className="mx-auto rounded-full"
          />
          <h1 className="mt-4 font-serif text-[22px] font-extrabold tracking-[-0.02em] text-[#1E1A14]">
            파머스테일
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#6B6353]">
            사료 대신, 진짜 음식 한 끼 🐾
          </p>
        </header>

        {/* ── 빠른 이동 버튼 ───────────────────────────────────── */}
        <div className={`mt-7 grid gap-3 ${s.fadeUp} ${s.d2}`}>
          {BIO_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              {...extProps(l.href)}
              className={`${s.pressable} block rounded-full px-6 py-4 text-left no-underline ${
                l.primary
                  ? 'bg-[#1E1A14] text-[#FAF9F5]'
                  : 'border border-black/10 bg-white text-[#1E1A14] shadow-[0_2px_10px_rgba(0,0,0,0.04)]'
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-[15px] font-extrabold">{l.label}</span>
                  {l.sub && (
                    <span
                      className={`mt-0.5 block text-[12px] ${
                        l.primary ? 'text-[#FAF9F5]/75' : 'text-[#9A9282]'
                      }`}
                    >
                      {l.sub}
                    </span>
                  )}
                </span>
                <ArrowIcon className={l.primary ? 'text-[#FAF9F5]/80' : 'text-[#B6AB93]'} />
              </span>
            </a>
          ))}
        </div>

        {/* ── 지금 진행 중 — 이미지 카드 ───────────────────────── */}
        {BIO_EVENT_CARDS.length > 0 && (
          <section className={`mt-10 ${s.fadeUp} ${s.d3}`}>
            <h2 className="text-[13px] font-bold tracking-[-0.01em] text-[#9A9282]">
              지금 진행 중
            </h2>
            <div className="mt-3 grid gap-4">
              {BIO_EVENT_CARDS.map((c) => (
                <a
                  key={c.title}
                  href={c.href}
                  {...extProps(c.href)}
                  className={`${s.card} ${s.pressable} block overflow-hidden rounded-3xl border border-black/5 bg-white text-left no-underline shadow-[0_2px_14px_rgba(0,0,0,0.05)]`}
                >
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <Image
                      src={c.image}
                      alt=""
                      fill
                      sizes="430px"
                      className={`${s.cardImg} object-cover`}
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-[#1E1A14]/85 px-2.5 py-1 text-[11px] font-bold text-[#FAF9F5]">
                      {c.badge}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-5 py-4">
                    <span className="min-w-0">
                      <span className="block text-[15.5px] font-extrabold text-[#1E1A14]">
                        {c.title}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] text-[#9A9282]">{c.sub}</span>
                    </span>
                    <ArrowIcon className="text-[#B6AB93]" />
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── 파머스테일 앱 ────────────────────────────────────── */}
        <section className={`mt-10 ${s.fadeUp} ${s.d4}`}>
          <h2 className="text-[13px] font-bold tracking-[-0.01em] text-[#9A9282]">
            파머스테일 앱
          </h2>
          <p className="mt-1 text-[12.5px] text-[#9A9282]">
            식사 기록부터 정기배송 관리까지, 앱이 제일 편해요
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <a
              href={APP_STORE_LINKS.android}
              target="_blank"
              rel="noreferrer"
              className={`${s.pressable} flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-3.5 text-[13px] font-bold text-[#1E1A14] no-underline`}
            >
              <PlayStoreIcon />
              Google Play
            </a>
            <a
              href={APP_STORE_LINKS.ios}
              target="_blank"
              rel="noreferrer"
              className={`${s.pressable} flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-3.5 text-[13px] font-bold text-[#1E1A14] no-underline`}
            >
              <AppleIcon />
              App Store
            </a>
          </div>
        </section>

        {/* ── 카카오톡 문의 ────────────────────────────────────── */}
        {business.kakaoChannelUrl && (
          <section className={`mt-10 ${s.fadeUp} ${s.d5}`}>
            <a
              href={business.kakaoChannelUrl}
              target="_blank"
              rel="noreferrer"
              className={`${s.pressable} flex items-center justify-center gap-2.5 rounded-full bg-[#FEE500] px-6 py-4 text-[15px] font-extrabold text-[#191919] no-underline`}
            >
              <KakaoIcon />
              카카오톡으로 문의하기
            </a>
            <p className="mt-2 text-[11.5px] text-[#9A9282]">
              궁금한 점은 1:1 채팅으로 편하게 물어봐 주세요
            </p>
          </section>
        )}

        {/* ── 푸터 ─────────────────────────────────────────────── */}
        <footer className={`mt-12 ${s.fadeUp} ${s.d6}`}>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="파머스테일 인스타그램"
            className={`${s.pressable} inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-[#1E1A14]`}
          >
            <InstagramIcon />
          </a>
          <p className="mt-3 text-[11.5px] text-[#B6AB93]">www.farmerstail.kr</p>
        </footer>
      </div>
    </main>
  )
}

/* ── 아이콘 (stroke·mono — 페이지 전용이라 여기 둔다) ─────────────── */

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className ?? ''}`}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

function PlayStoreIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
      <path d="M4 2.5v19c0 .4.5.7.8.4l10.9-9.1c.3-.2.3-.6 0-.8L4.8 2.1c-.3-.3-.8 0-.8.4Zm13 6.1 2.9 2.4c.6.5.6 1.5 0 2L17 15.4l-3.3-3.4L17 8.6Z" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
      <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.2 1.7 2.4 3 2.4 1.2 0 1.6-.8 3.1-.8 1.4 0 1.8.8 3.1.8 1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7 0 0-2.6-1-2.7-4Zm-2.3-7.3c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.1-.6 2.8-1.5Z" />
    </svg>
  )
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
      <path d="M12 3C6.5 3 2 6.5 2 10.8c0 2.8 1.9 5.2 4.7 6.6l-1 3.8c-.1.3.3.6.6.4l4.4-2.9c.4 0 .8.1 1.3.1 5.5 0 10-3.5 10-7.9C22 6.5 17.5 3 12 3Z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}
