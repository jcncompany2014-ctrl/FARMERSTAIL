'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { isTokenBearerPath } from '@/lib/token-paths'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useIsAppContext } from '@/lib/app-context-client'
import {
  readConsent,
  writeConsent,
  COOKIE_STORAGE_KEY,
  type CookieConsent as Consent,
} from '@/lib/cookies'

/*
 * 앱 컨텍스트 판정은 `lib/app-context-client` 의 `useIsAppContext` 로 옮겼다
 * (2026-07-30). 같은 로직이 여기 사문화돼 있는 동안 결제 화면들은 판정을 아예
 * 하지 않아 **웹 사용자를 앱 전용 경로로 보냈다**(/app-required 벽).
 *
 * 이 화면에서의 쓰임: 앱 사용자에겐 쿠키 동의 배너를 띄우지 않는다 — signup /
 * 설치 단계에서 약관 동의를 이미 받았다고 가정. 첫 진입 시 자동으로 "필수만
 * 허용"(분석/마케팅 false) 으로 기록해 다음 방문에 배너가 다시 안 뜨게 한다.
 */

/**
 * "동의 변경" / "재설정" 이벤트를 subscribe 해서 현재 동의 상태를 useSyncExternalStore
 * 로 반영. SSR 타임에는 항상 null (not-decided) 이라고 가정 — 하이드레이션 후
 * readConsent() 가 실제 값을 밀어준다.
 */
const EMPTY_SUBSCRIBE = () => () => {}

function subscribeConsent(cb: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('ft-consent-change', cb)
  window.addEventListener('ft-consent-reset', cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener('ft-consent-change', cb)
    window.removeEventListener('ft-consent-reset', cb)
    window.removeEventListener('storage', cb)
  }
}

/**
 * useSyncExternalStore 는 Object.is 로 이전/다음 스냅샷을 비교한다. readConsent()
 * 는 localStorage 를 파싱해서 **매 호출마다 새 객체**를 반환하므로, 그대로 넘기면
 * 참조가 계속 달라져 "바뀐 것처럼 보이는" 상태 → 재렌더 → 재호출 → 새 객체 …
 * React 19 가 공식 경고로 잡아준다:
 *   "The result of getSnapshot should be cached to avoid an infinite loop"
 *
 * 해결: 모듈 스코프에 raw 문자열 + 파싱된 값을 쌍으로 보관. localStorage 원문이
 * 바뀌지 않았으면 **동일한 참조**를 반환. 이벤트(ft-consent-change 등)가 터져서
 * subscribe 가 React 를 재렌더시킬 때만 raw 가 달라지고 새 객체를 계산한다.
 */
let cachedRaw: string | null | undefined
let cachedValue: Consent | null = null
function getSnapshot(): Consent | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(COOKIE_STORAGE_KEY)
  if (raw === cachedRaw) return cachedValue
  cachedRaw = raw
  cachedValue = readConsent()
  return cachedValue
}
function getServerSnapshot(): Consent | null {
  return null
}

/**
 * Cookie consent 배너.
 *
 * 첫 방문에서만 한 번 노출 (localStorage 로 판단). "모두 허용 / 필수만 허용
 * / 설정" 3개 액션. "설정" 을 누르면 채널별 토글 + 각 카테고리가 뭘 의미하는지
 * 설명.
 *
 * UI 언어
 * ───────
 * landing 과 같은 editorial 톤. 카드는 하단 고정, 좁은 모바일에서 CTA 가
 * 2 row 로 떨어지지 않도록 button grid 는 상황별로 split.
 */
export default function CookieConsent() {
  const consent = useSyncExternalStore(
    subscribeConsent,
    getSnapshot,
    getServerSnapshot,
  )
  const [expanded, setExpanded] = useState(false)
  // ★선택 항목은 꺼진 상태에서 시작한다(2026-09-26) — '세부 설정'을 열고 그대로 저장하면
  //   분석·광고에 동의한 것으로 기록됐다. 선택 동의의 기본값을 동의로 두지 않는다.
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const isApp = useIsAppContext()
  const pathname = usePathname()
  // Hydration mismatch 방지 — server 는 항상 banner 렌더 (consent=null), client 는
  // localStorage 에 따라 다를 수 있음. has-mounted 패턴으로 server 단계에선 절대
  // 렌더 안 함 → SSR/첫 hydration 100% 일치.
  // useSyncExternalStore 사용 — setState-in-effect 룰 회피.
  const mounted = useSyncExternalStore<boolean>(
    EMPTY_SUBSCRIBE,
    () => true,
    () => false,
  )

  // 앱 컨텍스트에서 첫 진입 시 자동으로 "필수만 허용" 으로 기록해 배너 노출
  // 안 함. 이미 정해진 consent 가 있으면 그대로 유지.
  useEffect(() => {
    if (isApp && consent === null) {
      writeConsent({ analytics: false, marketing: false })
    }
  }, [isApp, consent])

  // SSR / 첫 hydration tick 까지는 NULL 반환 — 서버/클라이언트 100% 일치.
  if (!mounted) return null
  // /link(인스타 프로필용 원장짜리)는 배너 제외 — 동의 없음 = 분석 거부 유지라
  // 법적으로 안전하고(Consent Mode 기본 denied), 자사몰로 넘어오는 첫 화면
  // (/start)에서 정상 노출된다. (사장님 2026-09-24)
  if (pathname === '/link') return null
  // 수의사 공유·사진 요청 토큰 페이지 — 동의 뒤 분석 도구가 주소(=열람권)를 복제하지 않게 배너 자체를 안 띄운다
  // (동의 없음 = 분석 거부 유지, 2026-09-26 점검 8차). AnalyticsScripts 도 같은 경로에서 꺼진다.
  if (isTokenBearerPath(pathname)) return null
  // 이미 결정했으면 렌더링 생략. 앱이면 배너 자체를 안 보여줌.
  if (consent !== null) return null
  if (isApp) return null

  function save(a: boolean, m: boolean) {
    writeConsent({ analytics: a, marketing: m })
    // store 변경은 subscribeConsent 가 감지해 consent 가 null→Consent 로 바뀌면서
    // 다음 렌더에서 자연 언마운트.
  }

  // ★2026-10-10 웹 리뉴얼('A 포스터' 웹): 흰 바탕 · 먹색 2px 테두리 · 모서리 4 · 영어 머리말(Cookies) 없음.
  //   동의 저장 동작(writeConsent)·세부 설정 항목은 그대로다. 앱에서는 위에서 이미 null.
  // ★2026-10-14 점검(규칙233) — 작은 폰에서 화면 40%를 덮고(360×640 에서 높이 279), 본문 글꼴이 늦게 도착해 바뀔 때
  //   줄이 바뀌며 높이가 279→257 로 줄어 그 자체가 화면 밀림(CLS)의 첫 원인이었다(/login·/signup·/faq 0.10~0.18).
  //   그래서 높이가 글꼴과 무관하게 정해지게 짰다: 안내 문구는 그대로 세 줄(각 줄이 따로 한 줄 — 줄 높이 20px 고정),
  //   단추는 한 줄(높이 44 — 세부 설정은 너비 고정, 필수만·모두 허용은 남은 폭을 같은 너비로). 문구·선택지(필수만 = 분석·광고 거부, 세부 설정의
  //   선택 항목은 꺼진 채 시작)·저장 동작은 그대로다. 세부 설정을 열면(손님이 누른 것 — 밀림에 안 센다) 항목이 사이에 펼쳐진다.
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] px-3 pt-2"
      // 하단 safe-area — iOS 홈 인디케이터가 수락/거부 버튼을 가리지 않게(2026-07-17).
      style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      // 비차단 배너 — dialog 가 아니라 region 이 맞는 시맨틱. dialog + modal=false
      // 조합은 스크린리더에 모호한 신호를 준다 (WAI-ARIA 저자 가이드).
      role="region"
      aria-labelledby="cookie-consent-title"
    >
      <div
        style={{ maxWidth: 456, margin: '0 auto', background: '#FFFFFF', border: '2px solid #141414', borderRadius: 4, boxShadow: '0 8px 28px rgba(20,20,20,0.18)', color: '#141414', letterSpacing: '-0.02em', wordBreak: 'keep-all' }}
      >
        {/* 세 줄 — 줄마다 따로 블록(한 줄)이라 글꼴이 바뀌어도 줄 수·높이가 그대로다. 가장 긴 줄(셋째)도 폭 320 폰에서
            한 줄에 들어가게 좁은 화면은 13px. */}
        <div className="text-[14px] max-[339px]:text-[13px]" style={{ padding: '12px 14px 0', lineHeight: '20px', color: '#3D3D3D' }}>
          <div>
            <h2 id="cookie-consent-title" style={{ display: 'inline', margin: 0, fontSize: 'inherit', lineHeight: 'inherit', fontWeight: 800, color: '#141414' }}>
              쿠키를 써요.
            </h2>{' '}
            꼭 필요한 쿠키는 늘 쓰고,
          </div>
          <div>분석·광고 쿠키는 동의하셔야만 써요.</div>
          <div>
            자세한 내용은{' '}
            <Link href="/legal/privacy" target="_blank" style={{ fontWeight: 700, color: '#141414', textDecoration: 'underline' }}>
              개인정보처리방침
            </Link>
            에 있어요.
          </div>
        </div>
        {expanded && (
          <ul style={{ margin: '10px 14px 0', padding: '12px 0 0', listStyle: 'none', borderTop: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CategoryRow title="필수 쿠키" hint="로그인·주문 같은 기본 기능에 써요. 끌 수 없어요." locked on />
            <CategoryRow title="분석 쿠키" hint="방문 흐름을 이름 없이 모아 사이트를 고치는 데 써요. (GA4)" on={analytics} onChange={setAnalytics} />
            <CategoryRow title="광고·마케팅 쿠키" hint="관심사에 맞는 광고에 써요. (Meta Pixel 등)" on={marketing} onChange={setMarketing} />
          </ul>
        )}
        <div style={{ padding: '10px 14px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            style={{ width: 84, height: 44, flexShrink: 0, padding: 0, border: 0, background: 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-start', gap: 4, fontSize: 14, fontWeight: 700, color: '#141414', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >
            세부 설정
            {expanded ? <ChevronUp className="w-3.5 h-3.5" strokeWidth={2.5} /> : <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.5} />}
          </button>
          {/* 거부(필수만)와 허용은 같은 너비 — 한쪽을 작게 만들지 않는다. 너비는 카드 폭으로만 정해져 글꼴과 무관하다. */}
          <button
            type="button"
            onClick={() => save(false, false)}
            className="text-[15px] max-[339px]:text-[14px]"
            style={{ flex: '1 1 0', minWidth: 0, height: 44, padding: 0, borderRadius: 4, border: '1.5px solid #141414', background: '#FFFFFF', color: '#141414', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >
            필수만
          </button>
          <button
            type="button"
            onClick={() => (expanded ? save(analytics, marketing) : save(true, true))}
            className="text-[15px] max-[339px]:text-[14px]"
            style={{ flex: '1 1 0', minWidth: 0, height: 44, padding: 0, borderRadius: 4, border: 0, background: '#141414', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >
            {expanded ? '고른 것 저장' : '모두 허용'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CategoryRow({
  title,
  hint,
  on,
  onChange,
  locked,
}: {
  title: string
  hint: string
  on: boolean
  onChange?: (next: boolean) => void
  locked?: boolean
}) {
  return (
    <li className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => !locked && onChange?.(!on)}
        disabled={locked}
        role="switch"
        aria-checked={on}
        aria-label={title}
        className={`relative w-10 h-6 rounded-full transition shrink-0 mt-0.5 ${on ? 'bg-[#141414]' : 'bg-[#BDBDBD]'} disabled:opacity-60`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
            on ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
      <div className="flex-1">
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{title}</p>
        <p style={{ margin: '2px 0 0', fontSize: 13, lineHeight: 1.55, color: '#595959' }}>{hint}</p>
      </div>
    </li>
  )
}
