import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Anton, Black_Han_Sans } from 'next/font/google'
import OpenExternalInChrome from '@/components/web/OpenExternalInChrome'
import { isAppContextServer } from '@/lib/app-context'
import { business } from '@/lib/business'
import { APP_STORE_LINKS, SMARTSTORE_URL } from '@/lib/links'
import s from './app-intro.module.css'

/**
 * /app — 앱 소개 전용 화면 (2026-10-09, 사장님 지시).
 *
 * 토스 일반결제 심사가 끝나기 전까지 자사몰(스토어)은 팔 수 없지만, 막아 두면 심사가 안 된다.
 * 그래서 본 사이트는 주소를 직접 치면 열리게 그대로 두고, 손님이 들어오는 인스타 링크
 * (링크 모음 /link 의 첫 버튼)만 이 화면으로 보낸다.
 * ★이 화면에는 본 사이트로 나가는 길을 두지 않는다 — 메뉴·장바구니 없음, 로고는 누르는 곳이 아니다.
 *   밖으로 나가는 건 앱스토어·구글플레이·스마트스토어·카카오 채널(전부 외부)뿐이고,
 *   사업자 정보는 글자로만 둔다. 규칙165 이 내부 링크가 끼어드는 것을 막는다.
 *
 * 폰 속 화면은 앱 새 디자인(A 포스터 · '밝은 안') — 사장님 "지금부터 전부 변경 들어간다"(10/9).
 * 앱 안에서 이 주소가 열리면(앱 링크 등) 웹 화면이 앱에 뜨지 않게 앱 홈으로 보낸다.
 */
export const metadata: Metadata = {
  title: '파머스테일 앱',
  description: '우리 아이 몫만큼, 2주마다 알아서. 하루 양 계산부터 기록·정기배송까지 파머스테일 앱에서 해요.',
  alternates: { canonical: '/app' },
}

// 글꼴은 이 화면에서만 — 다른 화면에 미리 받기(preload)를 퍼뜨리지 않는다.
const poster = Black_Han_Sans({ weight: '400', subsets: ['latin'], display: 'swap', preload: false })
const num = Anton({ weight: '400', subsets: ['latin'], display: 'swap', preload: false })

function Badges() {
  return (
    <div className={s.badges}>
      <a href={APP_STORE_LINKS.ios} target="_blank" rel="noreferrer" aria-label="App Store에서 다운로드" className={s.badge}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/badge-appstore-ko.svg" alt="App Store에서 다운로드" width={120} height={40} className={s.badgeApple} />
      </a>
      <a href={APP_STORE_LINKS.android} target="_blank" rel="noreferrer" aria-label="Google Play에서 다운로드" className={s.badge}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/badge-googleplay-ko.png" alt="Google Play에서 다운로드" width={134} height={52} className={s.badgeGoogle} />
      </a>
    </div>
  )
}

function Check() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D4A24C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export default async function AppIntroPage() {
  if (await isAppContextServer()) redirect('/dashboard')

  return (
    <main className={s.page}>
      <OpenExternalInChrome />
      <div className={s.col}>
        <header className={s.header}>
          <Image src="/logo-ink.png" alt="파머스테일" width={111} height={19} priority />
        </header>

        <section className={s.hero}>
          <span className={s.kicker}>
            <span className={s.kickerDot} aria-hidden="true" />
            파머스테일 앱
          </span>
          <h1 className={`${s.heroTitle} ${poster.className}`}>
            우리 아이 몫만큼,
            <br />
            <em>2주마다</em> 알아서
          </h1>
          <p className={s.heroBody}>
            몸무게·나이·체형으로 하루 양을 그램까지 계산하고, <strong>딱 그만큼을 2주마다 보내드려요.</strong> 기록이
            쌓이면 다음 양도 다시 맞춰요.
          </p>
          <Badges />
        </section>

        <section className={s.dark}>
          <span className={s.darkKicker}>앱 정기배송</span>
          <span className={`${s.bigNum} ${num.className}`}>15%</span>
          <strong className={`${s.darkTitle} ${poster.className}`}>정가에서 15% 할인돼요</strong>
          <ul className={s.checks}>
            <li>
              <Check />
              몸무게·나이·체형으로 하루 양을 그램까지
            </li>
            <li>
              <Check />두 가지 레시피를 섞어 2주마다
            </li>
            <li>
              <Check />
              체중 기록과 도장판
            </li>
          </ul>
          <div className={s.phoneStage}>
            <span className={s.phoneBig}>
              <Image src="/app-intro/home.webp" alt="앱 홈 화면 예시" width={780} height={1688} sizes="214px" />
            </span>
            <span className={s.chip}>
              <span className={s.chipLabel}>오늘 화식</span>
              <span className={`${s.chipValue} ${num.className}`}>120g</span>
            </span>
          </div>
        </section>

        <section className={s.section}>
          <h2 className={`${s.h2} ${poster.className}`}>앱에서 할 수 있는 것</h2>
          <div className={s.phones}>
            <figure className={s.figure}>
              <span className={s.phoneSmall}>
                <Image src="/app-intro/weight.webp" alt="체중 기록 화면 예시" width={780} height={1688} sizes="170px" />
              </span>
              <figcaption>
                <div className={s.figTitle}>체중이 바뀌면 양도</div>
                <div className={s.figSub}>기록하면 다음 양에 반영돼요</div>
              </figcaption>
            </figure>
            <figure className={s.figure}>
              <span className={s.phoneSmall}>
                <Image src="/app-intro/subscription.webp" alt="정기배송 화면 예시" width={780} height={1688} sizes="170px" />
              </span>
              <figcaption>
                <div className={s.figTitle}>2주마다 그만큼만</div>
                <div className={s.figSub}>미루기도 앱에서 해요</div>
              </figcaption>
            </figure>
          </div>
          <p className={s.note}>화면은 예시예요.</p>
        </section>

        <div className={s.stampCard}>
          <span>
            <strong className={`${s.stampTitle} ${poster.className}`}>도장판</strong>
            <span className={s.stampBody} style={{ display: 'block' }}>
              정기배송 결제 한 번에 도장 하나. 10칸을 채우면 보상을 드려요.
            </span>
          </span>
          <Image src="/logo-stamp.png" alt="" aria-hidden="true" width={96} height={96} className={s.stampImg} />
        </div>

        <section className={s.final}>
          <h2 className={`${s.h2} ${poster.className}`}>앱에서 시작해요</h2>
          <p className={s.finalBody}>설문부터 정기배송까지 앱 하나로 해요.</p>
          <Badges />
          <a href={SMARTSTORE_URL} target="_blank" rel="noreferrer" data-ext="1" className={s.storeCard}>
            <span>
              <span className={s.storeCardTitle}>앱 설치가 어려우세요?</span>
              <span className={s.storeCardSub}>스마트스토어에서 한 봉씩 살 수 있어요</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
          {business.kakaoChannelUrl && (
            <a href={business.kakaoChannelUrl} target="_blank" rel="noreferrer" data-ext="1" className={s.kakao}>
              카카오톡으로 물어보기
            </a>
          )}
        </section>

        <footer className={s.footer}>
          <p className={s.footerName}>{business.companyName}</p>
          <p>대표 {business.ceo} · 사업자등록번호 {business.businessNumber}</p>
          <p>통신판매업 {business.mailOrderNumber}</p>
          <p>{business.address}</p>
          <p>
            고객센터 {business.phone} · {business.email}
          </p>
          <p>© 2026 {business.brandName}</p>
        </footer>
      </div>
    </main>
  )
}
