import type { Metadata } from 'next'
import Image from 'next/image'
import InAppBrowserNotice from '@/components/web/InAppBrowserNotice'
import { business } from '@/lib/business'
import {
  APP_STORE_LINKS,
  BIO_COVER,
  BIO_EVENT_CARDS,
  BIO_LINKS,
  BIO_MOMENTS,
  INSTAGRAM_URL,
} from '@/lib/links'
import ShareButton from './ShareButton'
import s from './link.module.css'

/**
 * /link — 인스타 프로필용 링크인바이오 (litt.ly 대체, 2026-09-24).
 *
 * 웹 마케팅 라우트(/start·/brand 와 같은 부류) — 크롬 없이 한 장짜리.
 * 콘텐츠 목록은 lib/links.ts(config-as-code). 인앱 브라우저 안내 배너 포함.
 * 클릭 추적은 UTM → 자사 퍼널의 기존 수집(lib/utm.ts)이 이어받는다.
 *
 * 2026-09-25 사장님 제보로 2차 개편(킥고잉 링크인바이오 문법):
 * ① 풀블리드 커버 사진 + 겹치는 로고 + 공유 버튼, ② 번호 공지줄과 짝지어진
 * 큰 타이포 배너 카드, ③ 사진 가로 스트립, ④ 다크 앱 다운로드 밴드,
 * ⑤ 카카오 채널 문의 + 소셜. ⛔사진은 실물·생활감 스냅만
 * (엑스표 4장: 밭길 뒷모습·셰퍼드·대리석 원물·푸들 — 앞 둘은 저장소에서 삭제).
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

      {/* ── 커버 — 풀블리드 실물 사진, 아래로 갈수록 페이지 배경에 녹는다 ── */}
      <div className="relative">
        <div className="relative h-[235px] overflow-hidden">
          <Image
            src={BIO_COVER}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_62%]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-[#FAF9F5]"
          />
        </div>
        <ShareButton />
      </div>

      <div className="mx-auto max-w-[430px] px-5 pb-16 text-center">
        {/* ── 프로필 — 커버에 살짝 겹치는 로고 ─────────────────────── */}
        <header className="-mt-11">
          <Image
            src="/logo-stamp.png"
            alt="파머스테일"
            width={84}
            height={84}
            priority
            className={`${s.stampIn} mx-auto rounded-full shadow-[0_4px_18px_rgba(0,0,0,0.14)] ring-4 ring-[#FAF9F5]`}
          />
          <div className={`${s.fadeUp} ${s.d1}`}>
            <h1 className="mt-3.5 font-serif text-[23px] font-extrabold tracking-[-0.02em] text-[#1E1A14]">
              파머스테일
            </h1>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[#6B6353]">
              사료 대신, 진짜 음식 한 끼 🐾
            </p>
          </div>
        </header>

        {/* ── 빠른 이동 버튼 ───────────────────────────────────────── */}
        <div className={`mt-6 grid gap-3 ${s.fadeUp} ${s.d2}`}>
          {BIO_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              {...extProps(l.href)}
              className={`${s.pressable} block rounded-full px-6 py-4 text-left no-underline ${
                l.primary
                  ? 'bg-[#C86B45] text-white shadow-[0_6px_18px_rgba(200,107,69,0.35)]'
                  : 'border border-black/10 bg-white text-[#1E1A14] shadow-[0_2px_10px_rgba(0,0,0,0.04)]'
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-[15px] font-extrabold">{l.label}</span>
                  {l.sub && (
                    <span
                      className={`mt-0.5 block text-[12px] ${
                        l.primary ? 'text-white/80' : 'text-[#9A9282]'
                      }`}
                    >
                      {l.sub}
                    </span>
                  )}
                </span>
                <ArrowIcon className={l.primary ? 'text-white/85' : 'text-[#B6AB93]'} />
              </span>
            </a>
          ))}
        </div>

        {/* ── 알려드려요 — 번호 공지줄 + 큰 타이포 배너 ─────────────── */}
        {BIO_EVENT_CARDS.length > 0 && (
          <section className={`mt-11 ${s.fadeUp} ${s.d3} ${s.revealOnScroll}`}>
            <h2 className="text-[16.5px] font-extrabold tracking-[-0.015em] text-[#1E1A14]">
              파머스테일이 알려드려요 📣
            </h2>
            <p className="mt-1 text-[12px] text-[#9A9282]">알아두면 좋은 소식</p>

            <div className="mt-5 grid gap-7">
              {BIO_EVENT_CARDS.map((c, i) => (
                <div key={c.title}>
                  <p className="flex items-start gap-2 text-left">
                    <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#C86B45]/10 text-[11px] font-extrabold text-[#C86B45]">
                      {i + 1}
                    </span>
                    <span className="text-[13.5px] font-bold tracking-[-0.01em] text-[#3A3428]">
                      {c.notice}
                    </span>
                  </p>
                  {c.variant === 'products' ? (
                    /* 글자(위 흰 띠)와 제품 사진(아래 한 줄)이 겹치지 않는 배너. */
                    <a
                      href={c.href}
                      {...extProps(c.href)}
                      className={`${s.card} ${s.pressable} mt-2.5 block overflow-hidden rounded-3xl border border-black/5 bg-white text-left no-underline shadow-[0_4px_18px_rgba(0,0,0,0.07)]`}
                    >
                      <div className="flex items-start justify-between gap-3 px-5 pt-5">
                        <span className="min-w-0">
                          <span className="inline-block rounded-full bg-[#1E1A14] px-2.5 py-1 text-[11px] font-bold text-[#FAF9F5]">
                            {c.badge}
                          </span>
                          <span className="mt-2.5 block font-serif text-[23px] font-extrabold leading-snug tracking-[-0.02em] text-[#1E1A14]">
                            {c.title}
                          </span>
                          <span className="mt-1 block text-[12.5px] font-semibold text-[#6B6353]">
                            {c.sub}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1E1A14]/8 text-[#1E1A14]"
                        >
                          <ArrowIcon />
                        </span>
                      </div>
                      <div className={`${s.cardImg} mt-3 grid grid-cols-4 gap-1 bg-gradient-to-b from-white to-[#F4EFE6] px-3 pb-4 pt-2`}>
                        {c.images.map((src) => (
                          <div key={src} className="relative aspect-square">
                            <Image src={src} alt="" fill sizes="110px" className="object-contain" />
                          </div>
                        ))}
                      </div>
                    </a>
                  ) : (
                  <a
                    href={c.href}
                    {...extProps(c.href)}
                    className={`${s.card} ${s.pressable} mt-2.5 block overflow-hidden rounded-3xl text-left no-underline shadow-[0_4px_18px_rgba(0,0,0,0.07)] ${
                      c.variant === 'paper' ? 'border border-black/5 bg-white' : ''
                    }`}
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={c.image}
                        alt=""
                        fill
                        sizes="430px"
                        className={`${s.cardImg} object-cover ${
                          c.variant === 'paper' ? 'object-left' : ''
                        }`}
                      />
                      {c.variant === 'photo' && (
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"
                        />
                      )}
                      {c.variant === 'paper' && (
                        /* 왼쪽 텍스트 자리만 살짝 하얗게 — 잉크 글자 가독. */
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 bg-gradient-to-r from-white/85 via-white/20 to-transparent"
                        />
                      )}
                      <span
                        className={`absolute left-4 top-4 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          c.variant === 'photo'
                            ? 'bg-[#C86B45] text-white'
                            : 'bg-[#1E1A14] text-[#FAF9F5]'
                        }`}
                      >
                        {c.badge}
                      </span>
                      <span
                        className={`absolute bottom-4 left-4 right-14 ${
                          c.variant === 'photo' ? 'text-[#FAF9F5]' : 'text-[#1E1A14]'
                        }`}
                      >
                        <span className="block font-serif text-[23px] font-extrabold leading-snug tracking-[-0.02em]">
                          {c.title}
                        </span>
                        <span
                          className={`mt-1 block text-[12.5px] font-semibold ${
                            c.variant === 'photo' ? 'text-white/85' : 'text-[#6B6353]'
                          }`}
                        >
                          {c.sub}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full ${
                          c.variant === 'photo'
                            ? 'bg-white/25 text-white backdrop-blur'
                            : 'bg-[#1E1A14]/8 text-[#1E1A14]'
                        }`}
                      >
                        <ArrowIcon />
                      </span>
                    </div>
                  </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 사진 스트립 — 파머스테일의 하루 ──────────────────────── */}
        {BIO_MOMENTS.length > 0 && (
          <section className={`mt-11 ${s.fadeUp} ${s.d4} ${s.revealOnScroll}`}>
            <h2 className="text-[16.5px] font-extrabold tracking-[-0.015em] text-[#1E1A14]">
              파머스테일의 하루
            </h2>
            <p className="mt-1 text-[12px] text-[#9A9282]">
              오늘도 부엌에서, 진짜 음식을 만들고 있어요
            </p>
            {/* 2장 이하면 스크롤이 안 생기므로 가운데 정렬이 안전하다. */}
            <div
              className={`${s.scrollRow} -mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 ${
                BIO_MOMENTS.length <= 2 ? 'justify-center' : ''
              }`}
            >
              {BIO_MOMENTS.map((src) => (
                <div
                  key={src}
                  className="relative aspect-[4/5] w-[150px] shrink-0 snap-start overflow-hidden rounded-2xl"
                >
                  <Image src={src} alt="" fill sizes="150px" className="object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 파머스테일 앱 — 브랜드 밴드 ──────────────────────────── */}
        <section
          className={`mt-11 rounded-3xl bg-[#1E1A14] px-6 pb-6 pt-7 ${s.fadeUp} ${s.d5} ${s.revealOnScroll}`}
        >
          <h2 className="font-serif text-[19px] font-extrabold tracking-[-0.02em] text-[#FAF9F5]">
            파머스테일 앱
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#FAF9F5]/70">
            식사 기록부터 정기배송 관리까지, 앱이 제일 편해요
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <a
              href={APP_STORE_LINKS.android}
              target="_blank"
              rel="noreferrer"
              className={`${s.pressable} flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3.5 text-[13px] font-bold text-[#1E1A14] no-underline`}
            >
              <PlayStoreIcon />
              Google Play
            </a>
            <a
              href={APP_STORE_LINKS.ios}
              target="_blank"
              rel="noreferrer"
              className={`${s.pressable} flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3.5 text-[13px] font-bold text-[#1E1A14] no-underline`}
            >
              <AppleIcon />
              App Store
            </a>
          </div>
        </section>

        {/* ── 카카오톡 문의 ────────────────────────────────────────── */}
        {business.kakaoChannelUrl && (
          <section className={`mt-8 ${s.fadeUp} ${s.d5} ${s.revealOnScroll}`}>
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

        {/* ── 푸터 ─────────────────────────────────────────────────── */}
        <footer className={`mt-12 ${s.fadeUp} ${s.d6} ${s.revealOnScroll}`}>
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
