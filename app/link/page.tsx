import type { Metadata } from 'next'
import Image from 'next/image'
import InAppBrowserNotice from '@/components/web/InAppBrowserNotice'
import { business } from '@/lib/business'
import { APP_STORE_LINKS, BIO_LINKS, INSTAGRAM_URL, STORE_CARD } from '@/lib/links'
import { loadLinkContent, type LinkBanner } from '@/lib/link-content/load'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { periodLabel } from '@/lib/link-content/status'
import { ACCENT_THEMES } from '@/lib/link-content/accent'
import type { ReactNode } from 'react'
import ShareButton from './ShareButton'
import s from './link.module.css'

/**
 * /link — 인스타 프로필용 링크인바이오 (litt.ly 대체, 2026-09-24).
 *
 * 웹 마케팅 라우트(/start·/brand 와 같은 부류) — 크롬 없이 한 장짜리.
 * 이벤트/모집 배너·'파머스테일의 하루' 사진은 어드민(/admin/link)
 * 저장값(lib/link-content/load.ts)이 정본이고, 고정 콘텐츠(버튼·스토어 카드·
 * 스토어 링크)는 lib/links.ts. 클릭 추적은 UTM → 자사 퍼널의 기존 수집.
 *
 * 배너 기간: 시작 전 숨김 → 진행 중 → 종료 후 14일간 회색 "기간 종료"(클릭 불가)
 * → 자동 숨김 (lib/link-content/status.ts, 사장님 2026-09-26). 페이지는 5분
 * ISR — 어드민 저장은 revalidatePath 로 즉시, 기간 전환은 늦어도 5분 안에.
 *
 * 킥고잉 링크인바이오 문법(2026-09-25): 도장 로고 + 공유(커버 사진은 2026-09-26 제거),
 * 번호 공지줄과 짝지어진 큰 타이포 배너, 사진 스트립, 다크 앱 밴드, 카톡 문의.
 * ⛔사진은 실물·생활감 스냅만.
 */
export const metadata: Metadata = {
  title: '파머스테일 링크',
  description: '파머스테일 — 신선 화식, 맞춤 식단, 이벤트 바로가기',
}

export const revalidate = 300

/** 외부 링크만 새 탭 — 내부(/start)는 같은 탭에서 퍼널 진행. */
function extProps(href: string) {
  return href.startsWith('/')
    ? {}
    : { target: '_blank', rel: 'noreferrer' as const }
}

export default async function LinkInBioPage() {
  const content = await loadLinkContent(todayKstIsoDate())
  const noticeCount = content.banners.length

  return (
    <main className="min-h-[100dvh] bg-[#FAF9F5]">
      <InAppBrowserNotice />

      <div className="mx-auto max-w-[430px] px-5 pb-16 text-center">
        {/* ── 프로필 — 로고·이름·소개만. 커버 사진은 2026-09-26 사장님 지시로 뺐다
            ("아이콘 뒤에 사진 있는 거 빼자, 난잡"). 공유 버튼은 헤더 우상단. ── */}
        <header className="relative pt-12">
          <ShareButton />
          <Image
            src="/logo-stamp.png"
            alt="파머스테일"
            width={84}
            height={84}
            priority
            className={`${s.stampIn} mx-auto rounded-full bg-[#FAF9F5] shadow-[0_4px_18px_rgba(0,0,0,0.14)] ring-4 ring-[#FAF9F5]`}
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
        {noticeCount > 0 && (
          <section className={`mt-11 ${s.fadeUp} ${s.d3} ${s.revealOnScroll}`}>
            <h2 className="text-[16.5px] font-extrabold tracking-[-0.015em] text-[#1E1A14]">
              파머스테일이 알려드려요 📣
            </h2>
            <p className="mt-1 text-[12px] text-[#9A9282]">알아두면 좋은 소식</p>

            <div className="mt-5 grid gap-7">
              {content.banners.map((b, i) => (
                <div key={b.id}>
                  <NoticeLine n={i + 1} text={b.notice} ended={b.window === 'ended_recent'} />
                  <BannerCard b={b} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 사진 스트립 — 파머스테일의 하루 ──────────────────────── */}
        {content.momentUrls.length > 0 && (
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
                content.momentUrls.length <= 2 ? 'justify-center' : ''
              }`}
            >
              {content.momentUrls.map((src) => (
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
          {/*
            스토어 **공식 배지** 그대로(사장님 2026-09-26 — 직접 그린 알약 버튼이 어색했다).
            app/app-required 와 같은 에셋(ed9ebd68). 배지 그림은 바꾸지 않는다(Apple·Google 가이드).
            눈에 보이는 높이를 40px 로 맞춘다: Apple SVG 는 여백 없음, Google PNG(646×250)는
            위아래 투명 여백이 있어 보이는 부분이 76.8% — 이미지 52px + 위아래 -6px 로 상쇄.
          */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-3">
            <a
              href={APP_STORE_LINKS.android}
              target="_blank"
              rel="noreferrer"
              aria-label="Google Play에서 다운로드"
              className={`${s.pressable} inline-flex`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/badge-googleplay-ko.png"
                alt="Google Play에서 다운로드"
                width={134}
                height={52}
                className="-my-1.5 h-[52px] w-auto"
              />
            </a>
            <a
              href={APP_STORE_LINKS.ios}
              target="_blank"
              rel="noreferrer"
              aria-label="App Store에서 다운로드"
              className={`${s.pressable} inline-flex`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/badge-appstore-ko.svg"
                alt="App Store에서 다운로드"
                width={130}
                height={40}
                className="h-10 w-auto"
              />
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

/* ── 배너 조각 ─────────────────────────────────────────────────────── */

function NoticeLine({ n, text, ended }: { n: number; text: string; ended: boolean }) {
  return (
    <p className="flex items-start gap-2 text-left">
      <span
        className={`mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold ${
          ended ? 'bg-black/5 text-[#9A9282]' : 'bg-[#C86B45]/10 text-[#C86B45]'
        }`}
      >
        {n}
      </span>
      <span
        className={`text-[13.5px] font-bold tracking-[-0.01em] ${
          ended ? 'text-[#9A9282] line-through decoration-[#B6AB93]' : 'text-[#3A3428]'
        }`}
      >
        {text}
        {ended && <span className="ml-1.5 no-underline font-semibold">(종료)</span>}
      </span>
    </p>
  )
}

/**
 * 이벤트·모집 배너 — 세 종류 모두 **글자(배지·기간·조건 → 제목 → 부제 → 화살표)가 위,
 * 비주얼이 아래** (사장님 2026-09-26 "전부 위로"). 비주얼만 다르다:
 *   photo = 가로 16:10 사진 · poster = 세로 4:5 포스터 · products = 파우치 4종 선반 띠.
 * 포인트 컬러(accent — 인스타·네이버·쿠팡·자사몰)는 상단 라인·배지·화살표·테두리.
 * 종료 후 14일은 회색+"기간 종료" 덮개, 링크 없음.
 */
function BannerCard({ b }: { b: LinkBanner }) {
  const ended = b.window === 'ended_recent'
  const t = ACCENT_THEMES[b.accent]
  const meta = [periodLabel(b.startsOn, b.endsOn), b.condition].filter(Boolean).join(' · ')
  const cls = `${s.card} ${ended ? '' : s.pressable} mt-2.5 block overflow-hidden rounded-3xl border bg-white text-left no-underline shadow-[0_4px_18px_rgba(0,0,0,0.07)]`

  const textBand = (
    <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
      <span className="min-w-0">
        {(b.badge || meta) && (
          <span className="mb-1.5 flex flex-wrap items-center gap-2">
            {b.badge && (
              <span
                className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: t.badgeBg, color: t.badgeFg }}
              >
                {b.badge}
              </span>
            )}
            {meta && <span className="text-[11.5px] font-semibold text-[#9A9282]">{meta}</span>}
          </span>
        )}
        <span className="block font-serif text-[23px] font-extrabold leading-snug tracking-[-0.02em] text-[#1E1A14]">
          {b.title}
        </span>
        {b.sub && <span className="mt-1 block text-[12.5px] font-semibold text-[#6B6353]">{b.sub}</span>}
      </span>
      <span
        aria-hidden="true"
        className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: t.arrowBg, color: t.arrowFg }}
      >
        <ArrowIcon />
      </span>
    </div>
  )

  let visual: ReactNode
  if (b.variant === 'products') {
    // 선반 띠 — 제품 컷 배경은 코너 실측 #ECECEC~#F8F3F5 의 은은한 비네트라 색만
    // 맞춰선 네모가 남는다 → 띠를 가장 어두운 코너보다 살짝 어둡게(#EBEAEC) 두고
    // darken 블렌드: 배경 픽셀은 전부 띠 색으로 수렴, 파우치만 남는다.
    visual = (
      <div className={`${s.cardImg} grid grid-cols-4 gap-0 bg-[#EBEAEC] px-3 pb-4 pt-3`}>
        {STORE_CARD.images.map((src) => (
          <div key={src} className="relative aspect-square">
            <Image src={src} alt="" fill sizes="110px" className="object-contain mix-blend-darken" />
          </div>
        ))}
      </div>
    )
  } else {
    visual = (
      <div className={`relative overflow-hidden ${b.variant === 'poster' ? 'aspect-[4/5]' : 'aspect-[16/10]'}`}>
        <Image
          src={b.imageUrl}
          alt=""
          fill
          sizes="430px"
          className={`${s.cardImg} object-cover ${b.variant === 'poster' ? 'object-top' : ''}`}
        />
      </div>
    )
  }

  const inner = (
    <div className={`relative ${ended ? 'grayscale opacity-60' : ''}`}>
      {t.line && <div aria-hidden="true" className="h-1.5 w-full" style={{ background: t.line }} />}
      {textBand}
      {visual}
      {ended && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-[#1E1A14]/85 px-4 py-2 text-[13px] font-extrabold text-[#FAF9F5] shadow-[0_4px_14px_rgba(0,0,0,0.25)]">
            기간 종료
          </span>
        </div>
      )}
    </div>
  )

  if (ended) {
    return (
      <div className={cls} style={{ borderColor: t.border }} aria-label={`${b.title} — 기간 종료`}>
        {inner}
      </div>
    )
  }
  return (
    <a href={b.href} {...extProps(b.href)} className={cls} style={{ borderColor: t.border }}>
      {inner}
    </a>
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
