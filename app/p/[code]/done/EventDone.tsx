'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { clearAutosignupDraft, isDogDraftComplete, loadAutosignupDraft } from '@/lib/autosignup-draft'
import { createDogFromDraft } from '@/lib/auth/createDogFromDraft'
import { MARKETING_POLICY_VERSION } from '@/lib/consent'
import { APP_STORE_LINKS } from '@/lib/links'
import { petName } from '@/lib/korean'
import { formatPromoCap } from '@/lib/promotions'
import { EVENT_CONSENT_KEY } from '@/lib/event-consent'
import OpenExternalInChrome from '@/components/web/OpenExternalInChrome'
import { Footer, Logo } from '../EventParts'
import s from '../event.module.css'

type Props = { code: string; signedIn: boolean; pendingPct: number | null; pendingCap: number | null; provider: string | null; fresh: boolean }

/** claim_promotion 의 확정 결과 — 이 결과면 다시 해도 같다(표식을 남긴다). 망 오류·예외는 확정이 아니다(다음 진입 때 다시). */
const SETTLED = new Set(['already_claimed', 'not_first_order', 'not_found', 'inactive', 'not_started', 'ended', 'full'])

/** 한 번만 — 새로 고침(router.refresh)·뒤로 와도 저장을 두 번 하지 않게(저장 자체도 멱등이지만 동의 통지는 한 통이어야 한다). */
const doneKey = (code: string) => `ft:event-done:${code}`

export default function EventDone({ code, signedIn, pendingPct, pendingCap, provider, fresh }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<'working' | 'done'>(signedIn ? 'working' : 'done')
  const [dogName, setDogName] = useState('')
  // 이번에 저장한 할인율(claim 결과) — 서버 새로 고침이 오기 전에도 맞는 글을 보여 준다. 서버 값이 오면 그쪽이 정본.
  const [claimedPct, setClaimedPct] = useState<number | null>(null)
  const [dogMade, setDogMade] = useState(false)
  const [refreshing, startRefresh] = useTransition()
  const ran = useRef(false)

  useEffect(() => {
    if (!signedIn || ran.current) return
    ran.current = true
    ;(async () => {
      let already = false
      try {
        already = window.sessionStorage.getItem(doneKey(code)) === '1'
      } catch {
        /* 저장소를 못 쓰면 매번 한다(멱등) */
      }
      const draft = loadAutosignupDraft()
      if (draft?.dog?.name) setDogName(draft.dog.name.trim())
      if (already) {
        setPhase('done')
        return
      }
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setPhase('done')
        return
      }
      // ① 혜택 — 이 화면의 코드로 바로(초안의 코드는 '먼저 들어간 것'이라 옛 링크 코드일 수 있다). 계정당 1회·첫 주문은 서버가 강제.
      let settled = false
      try {
        const { data, error } = (await (supabase as unknown as { rpc: (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }).rpc('claim_promotion', { p_code: code }))
        const row = Array.isArray(data) ? (data[0] as { ok?: boolean; reason?: string; rate?: number } | undefined) : undefined
        if (!error && row?.ok) {
          settled = true
          const pct = Math.round(Number(row.rate) * 100)
          if (pct > 0) setClaimedPct(pct)
        } else if (!error && row?.reason && SETTLED.has(row.reason)) {
          settled = true
        }
      } catch {
        /* 못 받으면 아래 서버가 '저장된 혜택 없음'으로 정직하게 말한다 — 표식을 안 남겨 다음 진입 때 다시 */
      }
      // ② 강아지만 — 설문은 앱에서(답하지 않은 기본값으로 분석을 만들지 않는다).
      if (draft && isDogDraftComplete(draft.dog)) {
        try {
          const dogId = await createDogFromDraft(user.id, draft)
          if (dogId) {
            clearAutosignupDraft()
            setDogMade(true)
          }
        } catch {
          /* 강아지를 못 만들면 앱에서 다시 묻는다(/dogs/new) — 가입·혜택은 그대로 */
        }
      }
      // ③ 광고 수신 동의(선택) — 서버 함수로만 쓴다(규칙219). 실제로 저장된 채널만 처리결과를 알린다(정보통신망법 §50⑦).
      let wantConsent = false
      try {
        wantConsent = window.localStorage.getItem(EVENT_CONSENT_KEY) === '1'
      } catch {
        /* 없음 */
      }
      if (wantConsent) {
        const saved: Array<'email' | 'sms'> = []
        for (const channel of ['email', 'sms'] as const) {
          const { error } = await supabase.rpc('set_marketing_consent', {
            p_channel: channel,
            p_granted: true,
            p_policy_version: MARKETING_POLICY_VERSION,
            p_source: 'signup',
          })
          if (!error) saved.push(channel)
        }
        if (saved.length > 0) {
          void fetch('/api/consent/unsubscribe-ack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channels: saved, granted: true }),
            keepalive: true,
          }).catch(() => {})
        }
        // 원한 채널이 다 저장됐을 때만 지운다 — 일부라도 실패하면 남겨 다음 진입 때 다시(고른 동의가 말없이 사라지지 않게).
        if (saved.length === 2) {
          try {
            window.localStorage.removeItem(EVENT_CONSENT_KEY)
          } catch {
            /* 없음 */
          }
        } else {
          settled = false
        }
      }
      if (settled) {
        try {
          window.sessionStorage.setItem(doneKey(code), '1')
        } catch {
          /* 없음 */
        }
      }
      setPhase('done')
      // 서버가 계정에 저장된 혜택을 다시 읽는다 — 끝날 때까지 '저장하고 있어요'를 유지(옛 값으로 '실패' 글이 잠깐 보이지 않게).
      startRefresh(() => router.refresh())
    })()
  }, [signedIn, code, router])

  const who = dogName ? petName(dogName) : '우리 아이'
  // 앱 로그인 화면의 실제 단추 글자 그대로(components/KakaoLoginButton·AppleLoginButton). 이메일 계정은 이메일로.
  const loginWith = provider === 'apple' ? 'Apple 로 시작하기' : provider === 'kakao' ? '카카오로 시작하기' : null
  const pct = pendingPct ?? claimedPct
  // 최대 할인 금액 — 서버가 다시 읽은 값만(이번 저장 결과엔 상한이 없다). 모르면 말하지 않는다.
  const capText = pendingPct != null && pendingCap ? formatPromoCap(pendingCap) : null
  const busy = phase === 'working' || refreshing

  if (!signedIn) {
    return (
      <main className={s.page}>
        <div className={s.col}>
          <Logo />
          <p className={s.kicker}>
            <i aria-hidden />
            가입이 아직 안 끝났어요
          </p>
          <h1 className={s.h1} style={{ marginTop: 14 }}>
            처음 화면에서
            <br />
            다시 해 주세요
          </h1>
          <p className={s.lead}>카카오·Apple 화면에서 돌아오지 못했어요. 넣어 주신 정보는 이 폰에 남아 있어요.</p>
          <Link href={`/p/${code}?step=6`} className={s.cta}>
            가입 다시 하기
          </Link>
          <Footer />
        </div>
      </main>
    )
  }

  return (
    <main className={s.page}>
      <OpenExternalInChrome />
      <div className={s.col}>
        <Logo />
        <span className={s.check} aria-hidden>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <p className={s.kicker} style={{ marginTop: 20 }}>
          <i aria-hidden />
          {fresh ? '가입 완료' : '이 계정으로 진행해요'}
        </p>
        <h1 className={s.h1}>
          이제 앱에서
          <br />
          마저 하면 돼요
        </h1>

        {busy ? (
          <p className={s.working}>
            <span className={s.spin} aria-hidden />
            혜택을 계정에 저장하고 있어요…
          </p>
        ) : pct ? (
          <div className={s.promoCard}>
            <span className={s.promoTag}>계정에 저장된 혜택</span>
            <p className={s.promoLine}>
              <span className={s.promoText}>첫 박스</span>
              <span className={`${s.promoNum} ${s.hl}`}>{pct}%</span>
              <span className={s.promoText}>할인</span>
            </p>
            <p className={s.promoSub}>
              {capText ? `할인은 최대 ${capText}까지예요. ` : ''}앱에서 정기배송을 시작하면 첫 결제에 자동으로 들어가요. 이 화면은 닫아도 괜찮아요.
            </p>
          </div>
        ) : (
          <div className={s.promoCard}>
            <span className={s.promoTag}>이벤트 혜택</span>
            <p className={s.muted} style={{ marginTop: 8 }}>
              이 계정에는 혜택을 저장하지 못했어요. 이미 혜택을 받았거나 결제한 적이 있는 계정이면 받을 수 없어요. 궁금하면 카카오톡 채널로
              물어봐 주세요.
            </p>
          </div>
        )}

        <section className={s.guideStep}>
          <div className={s.guideHead}>
            <span className={s.stepNum} aria-hidden>
              1
            </span>
            <h2 className={s.guideTitle}>파머스테일 앱 받기</h2>
          </div>
          <div className={s.badges}>
            <a href={APP_STORE_LINKS.ios} target="_blank" rel="noopener noreferrer" className={s.badge} aria-label="App Store에서 다운로드" data-ext="1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/badge-appstore-ko.svg" alt="App Store에서 다운로드" width={120} height={40} />
            </a>
            <a href={APP_STORE_LINKS.android} target="_blank" rel="noopener noreferrer" className={s.badge} aria-label="Google Play에서 다운로드" data-ext="1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/badge-googleplay-ko.png" alt="Google Play에서 다운로드" width={134} height={52} />
            </a>
          </div>
        </section>

        <section className={s.guideStep}>
          <div className={s.guideHead}>
            <span className={s.stepNum} aria-hidden>
              2
            </span>
            <h2 className={s.guideTitle}>첫 화면에서 로그인 누르기</h2>
          </div>
          <p className={s.guideText}>
            앱을 열면 아래 화면이 떠요. 이름은 적지 말고, 맨 아래 <b>‘이미 계정이 있어요 · 로그인’</b>을 눌러 주세요.
          </p>
          <div className={s.shot}>
            <Image src="/event/app-first-login.webp" alt="앱 첫 화면 — '우리 아이 이름이 뭐예요?' 아래 '이미 계정이 있어요 · 로그인'" width={780} height={1688} />
            <span className={s.ring} aria-hidden />
            <span className={s.ringLabel} aria-hidden>
              여기를 눌러요
            </span>
          </div>
        </section>

        <section className={s.guideStep}>
          <div className={s.guideHead}>
            <span className={s.stepNum} aria-hidden>
              3
            </span>
            <h2 className={s.guideTitle}>가입한 방법 그대로 로그인</h2>
          </div>
          <p className={s.guideText}>
            {loginWith ? (
              <>
                로그인 화면에서 <b>‘{loginWith}’</b>를 눌러 주세요.
              </>
            ) : (
              <>로그인 화면에서 가입할 때 쓴 이메일과 비밀번호로 로그인해 주세요.</>
            )}{' '}
            {dogMade ? `방금 가입한 계정이라 ${who} 정보가 그대로 있어요.` : '이 화면과 같은 계정으로 들어가야 혜택이 이어져요.'}
          </p>
        </section>

        <section className={s.guideStep}>
          <div className={s.guideHead}>
            <span className={s.stepNum} aria-hidden>
              4
            </span>
            <h2 className={s.guideTitle}>남은 설문 2분</h2>
          </div>
          <p className={s.guideText}>
            {dogMade ? `로그인하면 바로 ${who} 설문으로 이어져요.` : '앱에서 우리 아이를 등록하고 설문을 하면 돼요.'} 설문을 마치고 정기배송을 시작하면
            {pct ? ` 첫 결제가 ${pct}% 할인돼요${capText ? `(최대 ${capText})` : ''}.` : ' 바로 첫 박스를 받을 수 있어요.'}
          </p>
        </section>

        <Footer />
      </div>
    </main>
  )
}
