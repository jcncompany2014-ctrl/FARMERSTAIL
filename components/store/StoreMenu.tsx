'use client'

/**
 * 웹 가게 메뉴(웹 시안 Menu) — ☰ 를 누르면 화면 전체로 뜬다.
 * 로그인 안 했으면 카카오 로그인 카드, 했으면 주문 조회 바로가기. 레시피 4종(사진·가격) · 체험팩 · 앱 정기배송 ·
 * 주문 조회 · 보관·해동 · 자주 묻는 질문 · 브랜드 이야기 · 전화·카카오톡.
 * 회원만 주문받는다(사장님 10/10) — 시안의 '비회원 주문 조회' 줄은 뺐다.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import AppleLoginButton from '@/components/AppleLoginButton'
import { business } from '@/lib/business'
import {
  RECIPE_BAND,
  RECIPE_PRODUCT_NAME,
  RECIPE_STUDIO_IMG,
  STORE_RECIPES,
  TRIAL_ITEM,
  storeItem,
} from '@/lib/store/catalog'
import { SUBSCRIPTION_DISCOUNT_PCT } from '@/lib/pricing'

const won = (n: number) => n.toLocaleString('ko-KR')

function Row({ href, children, right }: { href: string; children: React.ReactNode; right?: string }) {
  return (
    <Link
      href={href}
      style={{
        minHeight: 64,
        borderBottom: '1px solid #E5E5E5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 19,
        fontWeight: 800,
        color: '#141414',
        textDecoration: 'none',
      }}
    >
      {children}
      {right && <span style={{ fontSize: 16, fontWeight: 700, color: '#595959', whiteSpace: 'nowrap' }}>{right}</span>}
    </Link>
  )
}

export default function StoreMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  // 열릴 때만 로그인 여부를 본다(쿠키 세션 — 네트워크 없이). 화면을 정적으로 두려고 서버에서 보지 않는다.
  useEffect(() => {
    if (!open) return
    let alive = true
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (alive) setSignedIn(!!data.session)
      })
      .catch(() => {
        if (alive) setSignedIn(false)
      })
    return () => {
      alive = false
    }
  }, [open])

  // 열려 있는 동안 뒤 화면이 스크롤되지 않게 + Esc 로 닫기.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  // 메뉴 안 링크로 화면이 바뀌면 닫는다.
  useEffect(() => {
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="메뉴"
      className="fts"
      style={{ position: 'fixed', inset: 0, zIndex: 60, overflowY: 'auto', background: '#FFFFFF', minHeight: 0 }}
    >
      <div className="fts-col" style={{ padding: '0 20px 40px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="d" style={{ fontSize: 22 }}>
            메뉴
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ height: 48, display: 'flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent', fontSize: 17, fontWeight: 700, color: '#141414', cursor: 'pointer', padding: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            닫기
          </button>
        </div>

        {signedIn === false && (
          <section style={{ marginTop: 8, padding: '18px 16px', background: '#F6F4F5', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>로그인하면 주문과 배송을 한눈에 볼 수 있어요</p>
            <KakaoLoginButton next={pathname || '/'} look="app" />
            {/* 애플 기기에서만 보인다(버튼이 스스로 가린다) — 카카오가 있는 가입 화면엔 애플도(규칙108). */}
            <AppleLoginButton next={pathname || '/'} look="app" />
          </section>
        )}
        {signedIn && (
          <Link
            href="/mypage/orders"
            style={{ marginTop: 8, height: 56, borderRadius: 4, border: '1.5px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: '#141414', textDecoration: 'none' }}
          >
            내 주문·배송 보기
          </Link>
        )}

        <nav aria-label="레시피" style={{ marginTop: 28, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#595959', marginBottom: 4 }}>레시피</span>
          {STORE_RECIPES.map((r) => (
            <Link
              key={r}
              href={`/store/${r}`}
              style={{ minHeight: 68, borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', gap: 14, color: '#141414', textDecoration: 'none' }}
            >
              <span style={{ position: 'relative', width: 48, height: 48, borderRadius: 4, overflow: 'hidden', background: '#F6F4F5', flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={RECIPE_STUDIO_IMG[r]} alt="" width={48} height={48} style={{ width: 48, height: 48, objectFit: 'cover', display: 'block' }} />
                <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 4, background: RECIPE_BAND[r] }} />
              </span>
              <span className="d" style={{ flex: 1, fontSize: 19 }}>
                {RECIPE_PRODUCT_NAME[r]}
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 1, whiteSpace: 'nowrap' }}>
                <span className="n" style={{ fontSize: 19 }}>
                  {won(storeItem(`${r}-500g`).price)}
                </span>
                <span className="d" style={{ fontSize: 13 }}>
                  원
                </span>
              </span>
            </Link>
          ))}
        </nav>

        <nav aria-label="주요 메뉴" style={{ marginTop: 16, display: 'flex', flexDirection: 'column' }}>
          <Row href="/store?tab=trial" right={`${won(TRIAL_ITEM.price)}원`}>
            4종 체험팩
          </Row>
          <Row href="/app" right={`${SUBSCRIPTION_DISCOUNT_PCT}% 할인`}>
            앱 정기배송
          </Row>
          <Row href="/mypage/orders">주문 조회</Row>
          <Row href="/faq">자주 묻는 질문</Row>
          <Row href="/brand">브랜드 이야기</Row>
        </nav>

        <div style={{ marginTop: 28, padding: '20px 16px', background: '#141414', color: '#FFFFFF', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 15, color: '#BDBDBD' }}>전화나 카카오톡으로도 주문을 도와드려요</span>
          <a href={`tel:${business.phone.replace(/[^\d+]/g, '')}`} className="n" style={{ fontSize: 30, color: '#FFFFFF', textDecoration: 'none' }}>
            {business.phone}
          </a>
          {business.kakaoChannelUrl && (
            <a
              href={business.kakaoChannelUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: 8, height: 56, borderRadius: 4, background: '#FEE500', color: '#191919', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 17, fontWeight: 700, textDecoration: 'none' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 4C7 4 3 7.1 3 11c0 2.4 1.5 4.5 3.9 5.8L6 20l3.6-2.3c.8.2 1.6.3 2.4.3 5 0 9-3.1 9-7s-4-7-9-7z" />
              </svg>
              카카오톡으로 물어보기
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
