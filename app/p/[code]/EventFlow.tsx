'use client'

/**
 * 이벤트 화면의 갈래 — 안내서(주소에 ?step 없음) ↔ 첫 질문(?step=N, 앱 첫 화면과 같은 FirstScreenFlow).
 * 안내서의 '시작'은 주소에 ?step=0 을 쌓는다 — 첫 질문의 '←'가 안내서로 돌아온다.
 * 이미 로그인한 손님은 질문 없이 이 계정에 혜택 저장(/p/코드/done)으로 간다.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import FirstScreenFlow from '@/app/start/first/FirstScreenFlow'
import InAppBrowserNotice from '@/components/web/InAppBrowserNotice'
import { APP_STORE_LINKS } from '@/lib/links'
import { formatKoMonthDay } from '@/lib/datetime-kst'
import { formatPromoCap } from '@/lib/promotions'
import type { EventPromo } from '@/lib/promotions-load'
import type { HeroDog } from '@/lib/supporters'
import { EventHero, EventSteps, Footer, Logo } from './EventParts'
import s from './event.module.css'

/** heroTag = 사진 왼쪽 아래 딱지 — 서포터즈 코드면 "○○네가 드리는 첫 박스 혜택"(page.tsx 가 정한다). */
type Props = { code: string; promo: EventPromo; signedIn: boolean; heroDog: HeroDog; heroTag: string }

export default function EventFlow(props: Props) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  )
}

function Inner({ code, promo, signedIn, heroDog, heroTag }: Props) {
  const sp = useSearchParams()
  if (promo.state !== 'open') return <EventClosed reason={promo.state === 'closed' ? promo.reason : 'error'} heroDog={heroDog} />
  if (sp.has('step') && !signedIn) return <FirstScreenFlow event={{ code, ratePct: promo.ratePct, maxDiscount: promo.maxDiscount }} />
  return <EventIntro code={code} ratePct={promo.ratePct} maxDiscount={promo.maxDiscount} endsAt={promo.endsAt} maxSignups={promo.maxSignups} signedIn={signedIn} heroDog={heroDog} heroTag={heroTag} />
}

function EventIntro({
  code,
  ratePct,
  maxDiscount,
  endsAt,
  maxSignups,
  signedIn,
  heroDog,
  heroTag,
}: {
  code: string
  ratePct: number
  maxDiscount: number | null
  endsAt: string
  maxSignups: number | null
  signedIn: boolean
  heroDog: HeroDog
  heroTag: string
}) {
  const ends = formatKoMonthDay(endsAt)
  const capText = maxDiscount ? formatPromoCap(maxDiscount) : null
  return (
    <main className={s.page}>
      <div className={s.col}>
        {/* 카톡·네이버·인스타 안 브라우저 안내 — 한 칸(.col) 맨 위 띠로(.page 는 가로 flex 라 밖에 두면 옆 칸을 먹는다, 10/19 검토). */}
        <div className={s.notice}>
          <InAppBrowserNotice />
        </div>
        <Logo />
        <EventHero dog={heroDog} tag={heroTag} />
        <h1 className={s.h1} style={{ marginTop: 18 }}>
          첫 박스
        </h1>
        <p className={s.big} aria-label={`${ratePct}퍼센트 할인`}>
          <span className={`${s.bigNum} ${s.hl}`}>{ratePct}%</span>
          <span className={s.bigUnit}>할인</span>
        </p>
        {capText && <p className={s.capNote}>최대 {capText}까지 할인</p>}
        <p className={s.lead}>국내산 고기와 채소로 만든 강아지 화식이에요. 몸무게에 맞춘 양을 2주마다 얼려서 보내드려요.</p>

        <h2 className={s.h2}>받는 순서</h2>
        <EventSteps ratePct={ratePct} capText={capText} />

        {signedIn ? (
          <Link href={`/p/${code}/done`} className={s.cta}>
            이 계정으로 혜택 받기
          </Link>
        ) : (
          <button
            type="button"
            className={s.cta}
            onClick={() => {
              const q = new URLSearchParams(window.location.search)
              q.set('step', '0')
              window.history.pushState(null, '', `?${q.toString()}`)
            }}
          >
            우리 아이 정보 넣기
          </button>
        )}
        <p className={s.terms}>
          {ends ? `${ends}까지 · ` : ''}
          {maxSignups ? `선착순 ${maxSignups}명 · ` : ''}
          {capText ? `최대 ${capText} 할인 · ` : ''}
          계정당 한 번, 앱 정기배송 첫 결제에만 적용돼요. 둘째 박스부터는 2주마다 정기결제되고, 다음 결제 전까지 앱에서 미루거나 해지할 수 있어요.
        </p>
        <Footer />
      </div>
    </main>
  )
}

function EventClosed({ reason, heroDog }: { reason: string; heroDog: HeroDog }) {
  return (
    <main className={s.page}>
      <div className={s.col}>
        <Logo />
        <EventHero dog={heroDog} tag={reason === 'not_started' ? '아직 시작 전이에요' : reason === 'error' ? '잠깐 문제가 생겼어요' : '이벤트가 끝났어요'} />
        <h1 className={s.h1} style={{ marginTop: 18 }}>
          {reason === 'not_started' ? (
            <>
              곧 열리는
              <br />
              이벤트예요
            </>
          ) : reason === 'error' ? (
            <>
              잠시 뒤에
              <br />
              다시 열어 주세요
            </>
          ) : (
            <>
              이 이벤트는
              <br />
              끝났어요
            </>
          )}
        </h1>
        <p className={s.lead}>
          {reason === 'error'
            ? '이벤트 정보를 불러오지 못했어요. 잠시 뒤에 이 QR을 다시 찍어 주세요.'
            : '찾아 주셔서 고마워요. 파머스테일 앱에서 우리 아이 몸무게에 맞춘 화식 정기배송을 시작할 수 있어요.'}
        </p>
        <div className={s.badges}>
          <a href={APP_STORE_LINKS.ios} target="_blank" rel="noopener noreferrer" className={s.badge} aria-label="App Store에서 다운로드">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/badge-appstore-ko.svg" alt="App Store에서 다운로드" width={120} height={40} />
          </a>
          <a href={APP_STORE_LINKS.android} target="_blank" rel="noopener noreferrer" className={s.badge} aria-label="Google Play에서 다운로드">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/badge-googleplay-ko.png" alt="Google Play에서 다운로드" width={134} height={52} />
          </a>
        </div>
        <Footer />
      </div>
    </main>
  )
}
