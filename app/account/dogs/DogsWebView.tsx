/**
 * DogsWebView — /account/dogs 의 **웹** 화면(웹 시안 WEB-A21, 2026-10-10 웹 리뉴얼). 새 웹 가게 틀.
 *
 * 웹은 읽기 전용 간략 목록(사진·이름·견종·나이) — 케어·기록·분석은 앱. 조회·구독 판정(정본 subscriptionState)은
 * page.tsx 가 하고 여기는 그리기만 한다.
 *  · 정기배송 중인 아이 = '정기배송 관리'(/account/subscriptions — 웹으로 가입했던 고객의 관리 화면은 유지, 기획서 §2).
 *  · 아직 없는 아이 = '정기배송은 앱에서'(/app) — 웹 정기배송 신청은 앱으로 옮겼다(기획서 D1).
 *  · 구독 조회가 실패했으면(null) 링크를 안 그린다 — 구독 중인 아이에게 신청을 권하면 중복 신청이 된다(규칙1).
 */

import Image from 'next/image'
import Link from 'next/link'
import StoreShell from '@/components/store/StoreShell'

export type DogsWebItem = { id: string; name: string; photoUrl: string | null; meta: string }

export default function DogsWebView({ dogs, subscribedDogIds }: { dogs: DogsWebItem[]; subscribedDogIds: Set<string> | null }) {
  return (
    <StoreShell>
      <section style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <Link
          href="/account"
          style={{ alignSelf: 'flex-start', minHeight: 48, marginLeft: -6, paddingRight: 8, display: 'flex', alignItems: 'center', gap: 2, fontSize: 16, fontWeight: 700, color: '#3D3D3D', textDecoration: 'none' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
          내 계정
        </Link>
        <h1 className="d" style={{ margin: '4px 0 0', fontSize: 36, lineHeight: 1.1 }}>
          함께하는 아이들
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 18, lineHeight: 1.6, color: '#3D3D3D' }}>
          {dogs.length > 0 ? `${dogs.length}마리 · 자세한 케어와 기록은 앱에서 도와드려요` : '아직 등록한 아이가 없어요. 등록은 앱에서 할 수 있어요.'}
        </p>
      </section>

      {dogs.length > 0 ? (
        <section aria-label="우리 아이 목록" style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dogs.map((d) => {
            const subscribed = subscribedDogIds?.has(d.id) ?? false
            return (
              <article
                key={d.id}
                style={{ padding: 16, borderRadius: 4, border: '2px solid #141414', display: 'grid', gridTemplateColumns: '80px 1fr', columnGap: 16, alignItems: 'center' }}
              >
                {d.photoUrl ? (
                  <Image src={d.photoUrl} alt={d.name} width={80} height={80} style={{ width: 80, height: 80, borderRadius: 40, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <span aria-hidden style={{ width: 80, height: 80, borderRadius: 40, background: '#F6F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="7" cy="9" r="1.8" />
                      <circle cx="12" cy="6.5" r="1.8" />
                      <circle cx="17" cy="9" r="1.8" />
                      <path d="M12 12c-3 0-5.5 3-5.5 5.2 0 1.6 1.3 2.3 2.8 2.3 1.2 0 1.8-.6 2.7-.6s1.5.6 2.7.6c1.5 0 2.8-.7 2.8-2.3C17.5 15 15 12 12 12z" />
                    </svg>
                  </span>
                )}
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <span className="d" style={{ fontSize: 26, lineHeight: 1.1, overflowWrap: 'anywhere' }}>
                    {d.name}
                  </span>
                  <span style={{ fontSize: 16, color: '#595959' }}>{d.meta}</span>
                  {subscribedDogIds !== null && (
                    <Link
                      href={subscribed ? '/account/subscriptions' : '/app'}
                      style={{ alignSelf: 'flex-start', minHeight: 44, display: 'flex', alignItems: 'center', gap: 2, fontSize: 16, fontWeight: 800, color: '#141414' }}
                    >
                      {subscribed ? '정기배송 관리' : '정기배송은 앱에서'}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </Link>
                  )}
                </span>
              </article>
            )
          })}
        </section>
      ) : null}

      <section style={{ padding: '28px 20px 64px' }}>
        <Link
          href={dogs.length > 0 ? '/app-required' : '/app-required?from=%2Fdogs%2Fnew'}
          style={{
            minHeight: 72,
            boxSizing: 'border-box',
            padding: '14px 16px',
            borderRadius: 4,
            background: '#1D3B2F',
            color: '#FFFFFF',
            display: 'grid',
            gridTemplateColumns: '26px 1fr 18px',
            columnGap: 12,
            alignItems: 'center',
            textDecoration: 'none',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A9C4B2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
            <path d="M10.5 18.5h3" />
          </svg>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 17, fontWeight: 800 }}>{dogs.length > 0 ? '일일 케어·체중·분석은 앱에서' : '앱에서 우리 아이 등록하기'}</span>
            <span style={{ fontSize: 15, color: '#C9D6CD' }}>기록, 산책, 영양 분석을 더 빠르게</span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      </section>
    </StoreShell>
  )
}
