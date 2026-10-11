import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Anton, Black_Han_Sans } from 'next/font/google'
import OpenExternalInChrome from '@/components/web/OpenExternalInChrome'
import { isAppContextServer } from '@/lib/app-context'
import { business } from '@/lib/business'
import { APP_STORE_LINKS, SMARTSTORE_URL } from '@/lib/links'
import { SUBSCRIPTION_DISCOUNT_PCT } from '@/lib/pricing'
import { RECIPE_NAME, RECIPE_STUDIO_IMG, STORE_RECIPES, type StoreRecipe } from '@/lib/store/catalog'
import s from './app-intro.module.css'

/**
 * /app — 앱 소개 전용 화면 (2026-10-09, 사장님 지시).
 *
 * 토스 일반결제 심사가 끝나기 전까지 자사몰(스토어)은 팔 수 없지만, 막아 두면 심사가 안 된다.
 * 그래서 본 사이트는 주소를 직접 치면 열리게 그대로 두고, 손님이 들어오는 인스타 링크
 * (링크 모음 /link 의 첫 버튼)만 이 화면으로 보낸다.
 * ★이 화면에는 본 사이트로 나가는 길을 두지 않는다 — 메뉴·장바구니 없음, 로고는 누르는 곳이 아니다.
 *   밖으로 나가는 건 앱스토어·구글플레이·스마트스토어·카카오 채널(전부 외부)뿐이고,
 *   사업자 정보는 글자로만 둔다. 규칙165 이 내부 링크가 끼어드는 것을 막는다(목차 같은 #이동 링크도 두지 않는다).
 *
 * 2026-10-11 다시 짬(사장님 "얼마나 줘야 할지 매번 헷갈리셨죠? 저울로 재서 나누지 말고 딱 맞춰 드린다 — 오면 해동, 급여, 끝.
 * 이게 강점이 돼야 한다 · 디자인이 미완성 느낌"): 첫 화면 = '저울은 넣어 두세요', 3단계, 그동안 vs 파머스테일, 15%, 레시피 4종,
 * 자주 묻는 것. 사실 근거 — 정기배송 품목은 아이별 '한 끼 분량' 팩(lib/personalization/subscriptionItems·boxPricing mealPortionG).
 * 닭가슴살·오리 안심 무항생제는 사장님 확인(10/11) — 흑돼지·한우에는 붙이지 않는다.
 * 앱 안에서 이 주소가 열리면(앱 링크 등) 웹 화면이 앱에 뜨지 않게 앱 홈으로 보낸다.
 */
const APP_TITLE = '파머스테일 앱'
const APP_DESCRIPTION = '얼마나 줄지 고민 끝 — 우리 아이 하루 양을 그램까지 계산해 한 끼씩 나눠 담아 2주마다 보내드려요. 받으면 녹여서 주면 끝.'
export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_DESCRIPTION,
  alternates: { canonical: '/app' },
  // 공유 카드 — 페이지가 openGraph 를 두면 루트의 것을 통째로 갈아끼우므로(얕은 병합) 이름·언어·그림도 같이 둔다.
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/app',
    title: `${APP_TITLE} | 파머스테일`,
    description: APP_DESCRIPTION,
    images: [{ url: '/og', width: 1200, height: 630, alt: '파머스테일' }],
  },
  twitter: { card: 'summary_large_image', title: `${APP_TITLE} | 파머스테일`, description: APP_DESCRIPTION, images: ['/og'] },
}

// 글꼴은 이 화면에서만 — 다른 화면에 미리 받기(preload)를 퍼뜨리지 않는다.
const poster = Black_Han_Sans({ weight: '400', subsets: ['latin'], display: 'swap', preload: false })
const num = Anton({ weight: '400', subsets: ['latin'], display: 'swap', preload: false })

/** 레시피 4종 카드의 고기 줄 — 무항생제는 닭가슴살·오리 안심만(사장님 10/11). */
const MEAT: Record<StoreRecipe, { meat: string; tag?: string }> = {
  chicken: { meat: '닭가슴살·간·염통', tag: '무항생제 닭가슴살' },
  duck: { meat: '오리 안심·간·염통', tag: '무항생제 오리 안심' },
  pork: { meat: '흑돼지 뒷다리살·간·염통' },
  beef: { meat: '한우 목심·간·염통' },
}

const FAQ: { q: string; a: string }[] = [
  { q: '한 끼 양은 어떻게 정해요?', a: '몸무게·나이·중성화·체형·활동량으로 하루에 필요한 열량을 계산하고, 레시피마다 열량에 맞춰 그램으로 바꿔 한 끼씩 나눠 담아요.' },
  { q: '체중이 바뀌면요?', a: '앱에 체중을 기록하면 다음 양에 반영돼요. 그래서 따로 다시 계산할 필요가 없어요.' },
  { q: '언제 보내 주나요?', a: '2주마다 화요일에 얼린 채로 보내드려요. 받으면 바로 냉동실에 넣고, 먹이기 전날 냉장실로 옮겨 녹여 주세요.' },
  { q: '미루거나 그만둘 수 있나요?', a: '네. 다음 결제 전까지 앱에서 미루거나 그만둘 수 있어요. 약정도 위약금도 없어요.' },
]

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

/** 소제목 — 매거진과 같은 결(회색 Anton 번호 + 포스터 글꼴 제목 + 위 굵은 선). */
function SecHead({ n, children, dark = false }: { n: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={dark ? `${s.secHead} ${s.secHeadDark}` : s.secHead}>
      <span className={`${s.secNum} ${num.className}`}>{n}</span>
      <h2 className={`${s.h2} ${poster.className}`}>{children}</h2>
    </div>
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

        {/* ── 첫 화면 — 저울은 넣어 두세요 ── */}
        <section className={s.hero}>
          <p className={s.heroAsk}>
            화식, 얼마나 줘야 할지
            <br />
            매번 헷갈리셨죠?
          </p>
          <h1 className={`${s.heroTitle} ${poster.className}`}>
            저울은 이제
            <br />
            <em>넣어 두세요</em>
          </h1>
          <p className={s.heroBody}>
            우리 아이 하루 양을 그램까지 계산해 <strong>한 끼 양씩 나눠 담아</strong> 2주마다 보내드려요. 받으면 녹여서 그릇에 담으면 끝.
          </p>
          <Badges />
        </section>

        <div className={s.heroPhoto}>
          <Image src="/bowl-eating.jpg" alt="그릇에 담긴 화식을 먹는 셸티" fill priority sizes="(max-width: 460px) 100vw, 460px" style={{ objectFit: 'cover' }} />
          <span className={s.portionChip}>
            <span className={s.portionLabel}>오늘 한 끼</span>
            <span className={`${s.portionValue} ${num.className}`}>165g</span>
            <span className={s.portionSub}>재지 않아도 딱 그만큼</span>
          </span>
        </div>

        {/* ── 01 이렇게 끝나요 ── */}
        <section className={s.section}>
          <SecHead n="01">이렇게 끝나요</SecHead>
          <ol className={s.steps}>
            <li className={s.step}>
              <span className={`${s.stepNum} ${num.className}`}>1</span>
              <div className={s.stepBody}>
                <strong className={s.stepTitle}>앱에 우리 아이를 알려 주세요</strong>
                <span className={s.stepText}>몸무게·나이·중성화·체형·활동량을 넣으면 하루 양을 그램까지 계산해요.</span>
                <span className={s.stepPhone}>
                  <Image src="/app-intro/home.webp" alt="앱 홈 화면 예시 — 오늘 줄 화식 양" width={780} height={1688} sizes="180px" />
                </span>
              </div>
            </li>
            <li className={s.step}>
              <span className={`${s.stepNum} ${num.className}`}>2</span>
              <div className={s.stepBody}>
                <strong className={s.stepTitle}>한 끼 양씩 나눠 담아 보내드려요</strong>
                <span className={s.stepText}>계산한 양 그대로 팩마다 나눠 담아, 2주마다 얼린 채로 보내드려요.</span>
                <span className={s.stepPhoto}>
                  <Image src="/pouch-freezer-43.jpg" alt="레시피 팩과 그릇에 담긴 화식" fill sizes="(max-width: 460px) calc(100vw - 92px), 368px" style={{ objectFit: 'cover' }} />
                </span>
              </div>
            </li>
            <li className={s.step}>
              <span className={`${s.stepNum} ${num.className}`}>3</span>
              <div className={s.stepBody}>
                <strong className={s.stepTitle}>녹여서 주면 끝</strong>
                <span className={s.stepText}>전날 냉장실로 옮겨 녹이고, 그대로 그릇에 담아요. 저울도 계량컵도 필요 없어요.</span>
                <span className={s.stepPhoto}>
                  <Image src="/magazine/first-fresh-food.webp" alt="보호자가 내민 화식 그릇을 올려다보는 셸티" fill sizes="(max-width: 460px) calc(100vw - 92px), 368px" style={{ objectFit: 'cover' }} />
                </span>
              </div>
            </li>
          </ol>
        </section>

        {/* ── 02 그동안 vs 파머스테일 ── */}
        <section className={s.compare}>
          <SecHead n="02" dark>
            저울 앞에서
            <br />
            보내던 시간
          </SecHead>
          <div className={s.cmpGrid}>
            <div className={s.cmpBefore}>
              <span className={s.cmpLabel}>그동안</span>
              <ul>
                <li>봉지를 뜯고</li>
                <li>저울에 올려 재고</li>
                <li>하루 양을 계산하고</li>
                <li>나눠 담고, 남은 건 다시 보관</li>
              </ul>
            </div>
            <div className={s.cmpAfter}>
              <span className={s.cmpLabel}>파머스테일</span>
              <ul className={poster.className}>
                <li>녹이고</li>
                <li>담으면</li>
                <li className={s.cmpEnd}>끝</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── 03 앱 정기배송 15% ── */}
        <section className={s.dark}>
          <span className={s.darkKicker}>앱 정기배송</span>
          <span className={`${s.bigNum} ${num.className}`}>{SUBSCRIPTION_DISCOUNT_PCT}%</span>
          <strong className={`${s.darkTitle} ${poster.className}`}>정가에서 {SUBSCRIPTION_DISCOUNT_PCT}% 할인돼요</strong>
          <ul className={s.checks}>
            <li>
              <Check />
              체중을 기록하면 다음 양도 다시 맞춰요
            </li>
            <li>
              <Check />
              다음 결제 전까지 미루거나 그만둘 수 있어요
            </li>
            <li>
              <Check />
              약정도 위약금도 없어요
            </li>
          </ul>
        </section>

        {/* ── 04 레시피 4종 ── */}
        <section className={s.section}>
          <SecHead n="03">레시피 4종</SecHead>
          <p className={s.secBody}>모두 국내산 고기를 수비드로 익혀, 얼린 채로 보내드려요.</p>
          <div className={s.recipes}>
            {STORE_RECIPES.map((r) => (
              <div key={r} className={s.recipe}>
                <span className={s.recipeImg}>
                  <Image src={RECIPE_STUDIO_IMG[r]} alt={`${RECIPE_NAME[r]} 화식 팩`} fill sizes="(max-width: 460px) 45vw, 210px" style={{ objectFit: 'cover' }} />
                  {MEAT[r].tag && <span className={s.recipeTag}>{MEAT[r].tag}</span>}
                </span>
                <strong className={`${s.recipeName} ${poster.className}`}>{RECIPE_NAME[r]}</strong>
                <span className={s.recipeMeat}>{MEAT[r].meat}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 05 앱에서 할 수 있는 것 ── */}
        <section className={s.section}>
          <SecHead n="04">앱에서 할 수 있는 것</SecHead>
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
                <Image src="/app-intro/subscription.webp" alt="정기배송 관리 화면 예시" width={780} height={1688} sizes="170px" />
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

        {/* ── 06 자주 묻는 것 ── */}
        <section className={s.section}>
          <SecHead n="05">자주 묻는 것</SecHead>
          <div className={s.faq}>
            {FAQ.map((f) => (
              <details key={f.q} className={s.qa}>
                <summary>
                  <span className={`${s.q} ${num.className}`} aria-hidden="true">
                    Q
                  </span>
                  <span className={s.qText}>{f.q}</span>
                  <span className={s.qIcon} aria-hidden="true" />
                </summary>
                <p className={s.a}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={s.final}>
          <h2 className={`${s.finalTitle} ${poster.className}`}>
            오늘부터
            <br />
            저울 없이
          </h2>
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
