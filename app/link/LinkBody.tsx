import Image from 'next/image'
import type { ReactNode } from 'react'
import InAppBrowserNotice from '@/components/web/InAppBrowserNotice'
import OpenExternalInChrome from '@/components/web/OpenExternalInChrome'
import DogHero from '@/components/web/DogHero'
import { business } from '@/lib/business'
import { APP_STORE_LINKS, BIO_LINKS, INSTAGRAM_URL, STORE_CARD, type BioLink } from '@/lib/links'
import type { LinkBanner, LinkContent } from '@/lib/link-content/load'
import { periodLabel } from '@/lib/link-content/status'
import { ACCENT_THEMES } from '@/lib/link-content/accent'
import { petName } from '@/lib/korean'
import { formatPromoCap } from '@/lib/promotions'
import type { EventPromo } from '@/lib/promotions-load'
import type { Supporter } from '@/lib/supporters'
import '@/components/store/store.css'
import ShareButton from './ShareButton'
import s from './link.module.css'

/**
 * 링크 모음 본문 — /link(기본)와 /link/코드(서포터즈 다섯 아이, 2026-10-19)가 같이 그린다. 모양·규칙은 app/link/page.tsx 머리 주석.
 * 서포터즈면 맨 위가 이 아이 사진·혜택 카드(SupporterTop)로 바뀌고, 그 아래(바로 가기·알려드려요·하루·앱·문의)는 같다.
 */

/**
 * 외부 링크만 새 탭 — 내부(/app)는 같은 탭.
 * data-ext="1" 은 OpenExternalInChrome 이 안드로이드 인앱 브라우저에서 크롬 intent 로
 * 바꾸는 표식(인스타 안에서 스마트스토어를 열면 네이버 로그인이 뜨는 문제).
 */
function extProps(href: string) {
  return href.startsWith('/') ? {} : { target: '_blank', rel: 'noreferrer' as const, 'data-ext': '1' }
}

/** 서포터즈 링크(/link/코드)일 때 — 이 아이와 그 코드의 행사표 판정. 없으면 기본 링크 모음. */
export type LinkSupporter = { dog: Supporter; promo: EventPromo }

export default function LinkBody({ content, supporter = null }: { content: LinkContent; supporter?: LinkSupporter | null }) {
  const noticeCount = content.banners.length

  return (
    <main className="fts">
      <InAppBrowserNotice />
      <OpenExternalInChrome />

      {/* 줄 높이 기본값 = 시안(normal). 여러 줄 글은 각자 값을 준다. */}
      <div className="fts-col" style={{ lineHeight: 'normal', display: 'flex', flexDirection: 'column' }}>
        {/* ── 서포터즈 링크 — 이 아이 사진·이름 → 혜택 카드(맨 위). 기본 링크 모음엔 없다. ── */}
        {supporter && <SupporterTop dog={supporter.dog} promo={supporter.promo} />}

        {/* ── 도장 로고·이름. 커버 사진은 2026-09-26 사장님 지시로 뺐다("아이콘 뒤에 사진 있는 거 빼자, 난잡"). ── */}
        {!supporter && (
        <header style={{ position: 'relative', padding: '44px 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <ShareButton />
          {/* 시안은 도장을 -6° 기울인다 — '쿵' 찍히는 움직임(stampIn, 끝 = 0°)은 안쪽 그림에, 기울기는 바깥 칸에. */}
          <span style={{ display: 'block', transform: 'rotate(-6deg)' }}>
            <Image src="/logo-stamp.png" alt="파머스테일" width={88} height={88} priority className={s.stampIn} style={{ display: 'block' }} />
          </span>
          <div className={`${s.fadeUp} ${s.d1}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1 className="d" style={{ margin: '14px 0 0', fontSize: 30, lineHeight: 1.1 }}>
              파머스테일
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 17, color: '#3D3D3D' }}>사료 대신, 진짜 음식 한 끼</p>
          </div>
        </header>
        )}

        {/* ── 바로 가기 — 서포터즈 링크엔 없다(사장님 10/21 "너무 파머스테일 페이지 같음", 혜택 카드가 그 자리) ── */}
        {!supporter && (
        <nav aria-label="바로 가기" className={`${s.fadeUp} ${s.d2}`} style={{ padding: '26px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {BIO_LINKS.map((l) => (
            <BioRow key={l.href} l={l} />
          ))}
        </nav>
        )}

        {/* ── 알려드려요 — 번호 공지줄 + 배너 ── */}
        {noticeCount > 0 && (
          <section className={`${s.fadeUp} ${s.d3} ${s.revealOnScroll}`} style={{ padding: '44px 20px 0', display: 'flex', flexDirection: 'column' }}>
            <h2 className="d" style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>
              파머스테일이 알려드려요
            </h2>
            <span style={{ marginTop: 4, fontSize: 15, color: '#595959' }}>알아 두면 좋은 소식</span>
            {content.banners.map((b, i) => (
              <div key={b.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <NoticeLine n={i + 1} text={b.notice} ended={b.window === 'ended_recent'} first={i === 0} />
                <BannerCard b={b} />
              </div>
            ))}
          </section>
        )}

        {/* ── 파머스테일의 하루 — 사진 줄(옆으로 넘긴다) ── */}
        {/* 서포터즈 링크엔 '파머스테일의 하루'를 두지 않는다(같은 이유) */}
        {!supporter && content.momentUrls.length > 0 && (
          <section className={`${s.fadeUp} ${s.d4} ${s.revealOnScroll}`} style={{ padding: '44px 0 0', display: 'flex', flexDirection: 'column' }}>
            <h2 className="d" style={{ margin: '0 20px', fontSize: 24, lineHeight: 1.2 }}>
              파머스테일의 하루
            </h2>
            <span style={{ margin: '4px 20px 0', fontSize: 15, color: '#595959' }}>오늘도 부엌에서 진짜 음식을 만들고 있어요</span>
            <div className={s.scrollRow} style={{ marginTop: 16, padding: '0 20px', display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory' }}>
              {content.momentUrls.map((src) => (
                <div key={src} style={{ position: 'relative', flexShrink: 0, width: 150, height: 188, borderRadius: 4, overflow: 'hidden', scrollSnapAlign: 'start' }}>
                  <Image src={src} alt="" fill sizes="150px" style={{ objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 파머스테일 앱 — 숲색 띠(앱 세계) ── */}
        <section
          className={`${s.fadeUp} ${s.d5} ${s.revealOnScroll}`}
          style={{ margin: '44px 20px 0', padding: '26px 20px 24px', borderRadius: 4, background: '#1D3B2F', color: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
        >
          <h2 className="d" style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>
            파머스테일 앱
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 16, lineHeight: 1.55, color: '#C9D6CD' }}>
            식사 기록부터 정기배송 관리까지
            <br />
            앱이 제일 편해요
          </p>
          {/*
            스토어 **공식 배지** 그대로(사장님 2026-09-26 — 직접 그린 알약 버튼이 어색했다). 배지 그림은 바꾸지 않는다(Apple·Google 가이드).
            눈에 보이는 높이를 맞춘다: Apple SVG 는 여백 없음(40px), Google PNG(646×250)는 위아래 투명 여백이 있어 52px + 위아래 -6px.
          */}
          <div style={{ marginTop: 16, width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <a
              href={APP_STORE_LINKS.android}
              target="_blank"
              rel="noreferrer"
              aria-label="Google Play에서 받기"
              className={s.pressable}
              style={{ height: 56, borderRadius: 4, background: '#0B0B0B', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/badge-googleplay-ko.png" alt="Google Play에서 다운로드" width={134} height={52} style={{ height: 52, margin: '-6px 0', width: 'auto', display: 'block' }} />
            </a>
            <a
              href={APP_STORE_LINKS.ios}
              target="_blank"
              rel="noreferrer"
              aria-label="App Store에서 받기"
              className={s.pressable}
              style={{ height: 56, borderRadius: 4, background: '#0B0B0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/badge-appstore-ko.svg" alt="App Store에서 다운로드" width={130} height={40} style={{ height: 40, width: 'auto', display: 'block' }} />
            </a>
          </div>
        </section>

        {/* ── 카카오톡 문의 ── */}
        {business.kakaoChannelUrl && (
          <section className={`${s.fadeUp} ${s.d5} ${s.revealOnScroll}`} style={{ padding: '28px 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <a
              href={business.kakaoChannelUrl}
              target="_blank"
              rel="noreferrer"
              className={s.pressable}
              style={{ width: '100%', height: 56, borderRadius: 4, background: '#FEE500', color: '#191919', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 17, fontWeight: 800, textDecoration: 'none' }}
            >
              <KakaoIcon />
              카카오톡으로 문의하기
            </a>
            <span style={{ marginTop: 8, fontSize: 14, color: '#595959' }}>궁금한 점은 1:1 채팅으로 편하게 물어봐 주세요</span>
          </section>
        )}

        {/* ── 바닥 — 인스타·주소 ── */}
        <footer
          className={`${s.fadeUp} ${s.d6} ${s.revealOnScroll}`}
          style={{ marginTop: 36, padding: '24px 20px 28px', background: '#F6F4F5', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
        >
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="파머스테일 인스타그램"
            className={s.pressable}
            style={{ width: 48, height: 48, boxSizing: 'border-box', borderRadius: 24, border: '1px solid #D9D9D9', background: '#FFFFFF', color: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <InstagramIcon />
          </a>
          <span style={{ fontSize: 14, color: '#595959' }}>www.farmerstail.kr</span>
        </footer>
      </div>
    </main>
  )
}

/**
 * 서포터즈 링크 맨 위(2026-10-19) — 이 아이 사진·영상(DogHero, 이벤트 화면과 같은 칸) → "펀치가 먹는 파머스테일" → 혜택 카드.
 * 혜택 카드는 행사표(DB)가 열려 있을 때만 — 할인율·최대 할인 금액은 거기서 읽는다(손으로 적지 않는다). 꺼졌거나 끝났으면 카드 없이
 * 링크 모음만 보인다(거짓 약속 금지). 단추는 /p/코드 — 거기서 가입하면 이 코드(= 이 아이) 몫으로 집계된다.
 */
function SupporterTop({ dog, promo }: { dog: Supporter; promo: EventPromo }) {
  const open = promo.state === 'open' ? promo : null
  const cap = open?.maxDiscount ? formatPromoCap(open.maxDiscount) : null
  const who = petName(dog.name)
  return (
    <>
      <DogHero dog={dog} />
      <header className={`${s.fadeUp} ${s.d1}`} style={{ position: 'relative', padding: '22px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <ShareButton />
        <span style={{ paddingRight: 56, fontSize: 14, fontWeight: 800, color: '#595959' }}>파머스테일 서포터즈</span>
        <h1 className="d" style={{ margin: '6px 0 0', paddingRight: 56, fontSize: 30, lineHeight: 1.15 }}>
          {who}가 먹는
          <br />
          파머스테일
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 17, color: '#3D3D3D' }}>사료 대신, 진짜 음식 한 끼</p>
      </header>
      {open && (
        <section
          className={`${s.fadeUp} ${s.d2}`}
          style={{ margin: '20px 20px 0', padding: 18, border: '2px solid #141414', borderRadius: 4, display: 'flex', flexDirection: 'column' }}
        >
          <span style={{ fontSize: 14, fontWeight: 800, color: '#595959' }}>{who}네 링크로 오신 분께</span>
          <p style={{ margin: '6px 0 0', display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }} aria-label={`첫 박스 ${open.ratePct}퍼센트 할인`}>
            <span className="d" style={{ fontSize: 24, lineHeight: 1.15, paddingBottom: 4 }}>
              첫 박스
            </span>
            <span className="n" style={{ fontSize: 56, lineHeight: 0.95, padding: '0 4px', background: 'linear-gradient(transparent 62%, #F2C94C 62%)' }}>
              {open.ratePct}%
            </span>
            <span className="d" style={{ fontSize: 24, lineHeight: 1.15, paddingBottom: 4 }}>
              할인
            </span>
          </p>
          <span style={{ marginTop: 8, fontSize: 15, lineHeight: 1.55, color: '#3D3D3D' }}>
            {cap ? `최대 ${cap} · ` : ''}앱 정기배송 첫 결제에 들어가요
          </span>
          <a
            href={`/p/${dog.code}`}
            className={s.pressable}
            style={{ marginTop: 14, height: 56, borderRadius: 4, background: '#141414', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, textDecoration: 'none', boxShadow: '4px 4px 0 #D4A24C' }}
          >
            혜택 받고 시작하기
          </a>
        </section>
      )}
    </>
  )
}

/* ── 바로 가기 한 줄 — 강조(먹색 바탕) · 바깥 링크(회색 테·↗) · 그 밖(먹색 2px 테). ── */

function BioRow({ l }: { l: BioLink }) {
  const external = !l.href.startsWith('/')
  const base: React.CSSProperties = {
    minHeight: 72,
    padding: '0 18px',
    boxSizing: 'border-box',
    borderRadius: 4,
    display: 'grid',
    gridTemplateColumns: '1fr 18px',
    alignItems: 'center',
    textDecoration: 'none',
  }
  const tone: React.CSSProperties = l.primary
    ? { background: '#141414', color: '#FFFFFF' }
    : external
      ? { border: '1px solid #BDBDBD', color: '#141414' }
      : { border: '2px solid #141414', color: '#141414' }
  const subColor: React.CSSProperties = l.primary ? { color: '#CFCFCF' } : external ? { color: '#595959' } : { color: '#1D3B2F', fontWeight: 700 }
  return (
    <a href={l.href} {...extProps(l.href)} className={s.pressable} style={{ ...base, ...tone }}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '12px 0' }}>
        <span style={{ fontSize: 18, fontWeight: 800 }}>{l.label}</span>
        {l.sub && <span style={{ fontSize: 15, ...subColor }}>{l.sub}</span>}
      </span>
      {external ? <ExternalIcon /> : <ChevronIcon />}
    </a>
  )
}

/* ── 배너 조각 ── */

function NoticeLine({ n, text, ended, first }: { n: number; text: string; ended: boolean; first: boolean }) {
  return (
    <p
      style={{
        margin: `${first ? 20 : 28}px 0 0`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        fontSize: 16,
        fontWeight: ended ? 600 : 700,
        lineHeight: 1.5,
        color: ended ? '#8A8A8A' : '#141414',
      }}
    >
      <span
        className="n"
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: 4,
          background: ended ? '#EFEDEE' : '#141414',
          color: ended ? '#8A8A8A' : '#FFFFFF',
          fontSize: 14,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {n}
      </span>
      {ended ? (
        <span>
          <span style={{ textDecoration: 'line-through' }}>{text}</span> (종료)
        </span>
      ) : (
        text
      )}
    </p>
  )
}

/**
 * 이벤트·모집 배너 — 글자(배지·기간·조건 → 제목 → 부제 → 화살표)가 위, 비주얼이 아래(사장님 2026-09-26 "전부 위로").
 * 비주얼만 다르다: photo = 가로 16:10 사진 · poster = 세로 4:5 포스터 · products = 팩 4종 선반 띠.
 * 포인트 색(accent — 인스타·네이버·쿠팡·자사몰)은 위 띠·배지·화살표·테두리. 종료 후 14일은 회색 + "기간 종료", 링크 없음.
 */
function BannerCard({ b }: { b: LinkBanner }) {
  const ended = b.window === 'ended_recent'
  const t = ACCENT_THEMES[b.accent]
  const meta = [periodLabel(b.startsOn, b.endsOn), b.condition].filter(Boolean).join(' · ')

  const textBand = (
    <span style={{ padding: '16px 16px 14px', display: 'grid', gridTemplateColumns: '1fr 40px', columnGap: 10, alignItems: 'start' }}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        {(b.badge || meta) && (
          <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {b.badge && (
              <span style={{ height: 26, padding: '0 9px', borderRadius: 4, background: t.badgeBg, color: t.badgeFg, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center' }}>
                {b.badge}
              </span>
            )}
            {meta && <span style={{ fontSize: 14, fontWeight: 600, color: '#595959' }}>{meta}</span>}
          </span>
        )}
        <span className="d" style={{ fontSize: 25, lineHeight: 1.2 }}>
          {b.title}
        </span>
        {b.sub && <span style={{ fontSize: 15, fontWeight: 600, color: '#3D3D3D' }}>{b.sub}</span>}
      </span>
      {/* 끝난 배너는 누를 수 없으니 화살표도 없다(시안). */}
      {!ended && (
        <span aria-hidden style={{ width: 40, height: 40, borderRadius: 20, background: t.arrowBg, color: t.arrowFg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronIcon />
        </span>
      )}
    </span>
  )

  let visual: ReactNode
  if (b.variant === 'products') {
    // 선반 띠 — 팩 사진 바탕보다 살짝 어두운 띠(#EBEAEC)에 darken 블렌드: 바탕 픽셀은 띠 색으로 수렴, 팩만 남는다.
    visual = (
      <span className={s.cardImg} style={{ padding: '10px 10px 14px', background: '#EBEAEC', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4 }}>
        {STORE_CARD.images.map((src) => (
          <span key={src} style={{ position: 'relative', aspectRatio: '1 / 1' }}>
            <Image src={src} alt="" fill sizes="110px" style={{ objectFit: 'contain', mixBlendMode: 'darken' }} />
          </span>
        ))}
      </span>
    )
  } else {
    visual = (
      <span style={{ position: 'relative', overflow: 'hidden', aspectRatio: b.variant === 'poster' ? '4 / 5' : '16 / 10', display: 'block' }}>
        <Image src={b.imageUrl} alt="" fill sizes="440px" className={s.cardImg} style={{ objectFit: 'cover', objectPosition: b.variant === 'poster' ? 'top' : 'center' }} />
      </span>
    )
  }

  const inner = (
    <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', ...(ended ? { filter: 'grayscale(1)', opacity: 0.6 } : null) }}>
      {t.line && <span aria-hidden style={{ height: 6, background: t.line }} />}
      {textBand}
      {visual}
    </span>
  )
  const box: React.CSSProperties = {
    position: 'relative',
    marginTop: 10,
    borderRadius: 4,
    border: `1px solid ${ended ? '#E5E5E5' : t.border}`,
    overflow: 'hidden',
    color: '#141414',
    textDecoration: 'none',
    display: 'flex',
    flexDirection: 'column',
  }

  if (ended) {
    return (
      <div aria-label={`${b.title} — 기간 종료`} style={box}>
        {inner}
        <span
          style={{
            position: 'absolute',
            left: '50%',
            top: '58%',
            transform: 'translate(-50%, -50%)',
            height: 40,
            padding: '0 18px',
            borderRadius: 4,
            background: '#141414',
            color: '#FFFFFF',
            fontSize: 15,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          기간 종료
        </span>
      </div>
    )
  }
  return (
    <a href={b.href} {...extProps(b.href)} className={`${s.card} ${s.pressable}`} style={box}>
      {inner}
    </a>
  )
}

/* ── 아이콘 (선 아이콘 — 이 화면 전용이라 여기 둔다) ── */

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  )
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M12 4C7 4 3 7.1 3 11c0 2.4 1.5 4.5 3.9 5.8L6 20l3.6-2.3c.8.2 1.6.3 2.4.3 5 0 9-3.1 9-7s-4-7-9-7z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}
