'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Cookie, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import {
  readConsent,
  writeConsent,
  COOKIE_STORAGE_KEY,
  type CookieConsent as Consent,
} from '@/lib/cookies'

/**
 * 앱 컨텍스트(`ft_app=1` 쿠키) 감지 — 클라이언트에서 document.cookie 검사.
 * 앱 사용자에겐 별도 쿠키 동의 배너가 뜨지 않는다 — signup / 설치 단계에서
 * 약관 동의를 이미 받았다고 가정. 첫 진입 시에는 자동으로 "필수만 허용"
 * (분석/마케팅 false) 로 기록해 다음 방문에 배너가 다시 안 뜨게.
 */
function useIsAppContext(): boolean {
  const [isApp, setIsApp] = useState(false)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const cookies = document.cookie.split(';').map((c) => c.trim())
    const flag = cookies.some((c) => c.startsWith('ft_app=1'))
    // 외부 시스템(document.cookie) 의 1회 동기화 — useEffect 의 정상 사용 패턴.
    // React 19 `react-hooks/set-state-in-effect` 룰은 cascading render 를
    // 우려하지만 이 setState 는 deps=[] 라 마운트 직후 1회만 발생한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsApp(flag)
  }, [])
  return isApp
}

/**
 * "동의 변경" / "재설정" 이벤트를 subscribe 해서 현재 동의 상태를 useSyncExternalStore
 * 로 반영. SSR 타임에는 항상 null (not-decided) 이라고 가정 — 하이드레이션 후
 * readConsent() 가 실제 값을 밀어준다.
 */
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
  const [analytics, setAnalytics] = useState(true)
  const [marketing, setMarketing] = useState(true)
  const isApp = useIsAppContext()

  // 앱 컨텍스트에서 첫 진입 시 자동으로 "필수만 허용" 으로 기록해 배너 노출
  // 안 함. 이미 정해진 consent 가 있으면 그대로 유지.
  useEffect(() => {
    if (isApp && consent === null) {
      writeConsent({ analytics: false, marketing: false })
    }
  }, [isApp, consent])

  // 이미 결정했으면 렌더링 생략. 앱이면 배너 자체를 안 보여줌.
  if (consent !== null) return null
  if (isApp) return null

  function save(a: boolean, m: boolean) {
    writeConsent({ analytics: a, marketing: m })
    // store 변경은 subscribeConsent 가 감지해 consent 가 null→Consent 로 바뀌면서
    // 다음 렌더에서 자연 언마운트.
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 pt-2"
      // 비차단 배너 — dialog 가 아니라 region 이 맞는 시맨틱. dialog + modal=false
      // 조합은 스크린리더에 모호한 신호를 준다 (WAI-ARIA 저자 가이드).
      role="region"
      aria-labelledby="cookie-consent-title"
    >
      <div
        className="mx-auto max-w-lg bg-bg rounded-2xl border border-rule shadow-xl overflow-hidden"
        style={{ boxShadow: '0 12px 40px rgba(30,26,20,0.18)' }}
      >
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <Cookie
              className="w-4 h-4 text-terracotta"
              strokeWidth={2}
            />
            <span className="kicker">Cookies · 쿠키 설정</span>
          </div>
          <h2
            id="cookie-consent-title"
            className="font-serif mt-1.5 leading-tight"
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            더 나은 경험을 위해 쿠키를 사용해요
          </h2>
          <p className="text-[11.5px] text-muted mt-1.5 leading-relaxed">
            서비스 기능 유지에 필요한 쿠키는 기본 적용되고, 분석·광고 쿠키는
            동의 후에만 사용돼요. 자세한 내용은{' '}
            <Link
              href="/legal/privacy"
              target="_blank"
              className="underline underline-offset-2 font-bold text-text"
            >
              개인정보처리방침
            </Link>
            을 참고해 주세요.
          </p>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-text hover:text-terracotta transition"
          >
            세부 설정
            {expanded ? (
              <ChevronUp className="w-3 h-3" strokeWidth={2.5} />
            ) : (
              <ChevronDown className="w-3 h-3" strokeWidth={2.5} />
            )}
          </button>

          {expanded && (
            <ul className="mt-3 space-y-2.5 border-t border-rule pt-3">
              <CategoryRow
                title="필수 쿠키"
                hint="로그인·장바구니 등 기본 기능을 위한 쿠키예요. 끌 수 없어요."
                locked
                on
              />
              <CategoryRow
                title="분석 쿠키"
                hint="방문 패턴을 익명 집계해 서비스를 개선하는 데 써요. (GA4)"
                on={analytics}
                onChange={setAnalytics}
              />
              <CategoryRow
                title="광고·마케팅 쿠키"
                hint="관심사 기반 광고·리마케팅에 활용해요. (Meta Pixel 등)"
                on={marketing}
                onChange={setMarketing}
              />
            </ul>
          )}
        </div>

        <div className="px-5 pb-5 pt-2 bg-bg-2 border-t border-rule flex flex-col sm:flex-row gap-2">
          {expanded ? (
            <>
              <button
                type="button"
                onClick={() => save(false, false)}
                className="flex-1 py-2.5 rounded-full border border-rule bg-white text-text text-[12px] font-bold hover:border-text transition"
              >
                필수만 허용
              </button>
              <button
                type="button"
                onClick={() => save(analytics, marketing)}
                className="flex-1 py-2.5 rounded-full text-[12px] font-bold active:scale-[0.98] transition-all"
                style={{
                  background: 'var(--ink)',
                  color: 'var(--bg)',
                }}
              >
                선택 항목 저장
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => save(false, false)}
                className="flex-1 py-2.5 rounded-full border border-rule bg-white text-text text-[12px] font-bold hover:border-text transition inline-flex items-center justify-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                필수만
              </button>
              <button
                type="button"
                onClick={() => save(true, true)}
                className="flex-1 py-2.5 rounded-full text-[12px] font-bold active:scale-[0.98] transition-all inline-flex items-center justify-center gap-1.5"
                style={{
                  background: 'var(--ink)',
                  color: 'var(--bg)',
                }}
              >
                <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                모두 허용
              </button>
            </>
          )}
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
        className={`relative w-10 h-6 rounded-full transition shrink-0 mt-0.5 ${
          on ? 'bg-moss' : 'bg-rule'
        } disabled:opacity-60`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
            on ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
      <div className="flex-1">
        <p className="text-[12px] font-bold text-text">{title}</p>
        <p className="text-[10.5px] text-muted mt-0.5 leading-relaxed">
          {hint}
        </p>
      </div>
    </li>
  )
}
