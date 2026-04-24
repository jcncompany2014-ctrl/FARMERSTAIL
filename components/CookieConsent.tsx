'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Cookie, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import {
  readConsent,
  writeConsent,
  type CookieConsent as Consent,
} from '@/lib/cookies'

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
function getSnapshot(): Consent | null {
  return readConsent()
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

  // 이미 결정했으면 렌더링 생략 (SSR 에서는 항상 null 이라 배너 하이드레이션 됨).
  if (consent !== null) return null

  function save(a: boolean, m: boolean) {
    writeConsent({ analytics: a, marketing: m })
    // store 변경은 subscribeConsent 가 감지해 consent 가 null→Consent 로 바뀌면서
    // 다음 렌더에서 자연 언마운트.
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 pt-2"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
    >
      <div
        className="mx-auto max-w-lg bg-white rounded-2xl border border-rule shadow-xl overflow-hidden"
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
