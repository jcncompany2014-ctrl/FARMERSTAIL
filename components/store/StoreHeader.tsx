'use client'

/**
 * 웹 가게 머리줄(웹 시안 Main·Product·Cart·Checkout 의 header). 높이 56 · 아래 1px 선 · 위에 붙는다.
 *  - home: ☰ 메뉴 · 가운데 로고 · 장바구니(개수)
 *  - back: ← 뒤로 · 가운데 로고 · 장바구니(개수)        — 상품 상세
 *  - title: ← 뒤로 · 가운데 화면 이름(장바구니·주문·결제) — 장바구니·주문
 * 웹에서만 그린다(앱은 단품을 안 판다 — 상점 경로는 앱에서 열리면 앱 홈으로 보낸다).
 */
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useStoreCart } from './useStoreCart'
import StoreMenu from './StoreMenu'

export type StoreHeaderProps =
  | { variant?: 'home' }
  | { variant: 'back'; backHref?: string }
  | { variant: 'title'; title: string; backHref?: string }

const ICON = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  back: <path d="M15 5l-7 7 7 7" />,
}

function CartButton({ withLabel = false }: { withLabel?: boolean }) {
  const { count } = useStoreCart()
  return (
    <Link
      href="/store/cart"
      aria-label={count > 0 ? `장바구니, 상품 ${count}개` : '장바구니'}
      style={{
        justifySelf: 'end',
        position: 'relative',
        width: withLabel ? 'auto' : 48,
        height: 48,
        gap: 8,
        padding: withLabel ? '0 18px 0 4px' : 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#141414',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z" />
        <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      </svg>
      {withLabel && <span style={{ fontSize: 16, fontWeight: 700 }}>장바구니</span>}
      {count > 0 && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 4,
            right: 2,
            minWidth: 20,
            height: 20,
            boxSizing: 'border-box',
            padding: '0 5px',
            borderRadius: 10,
            background: '#141414',
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

/** PC 가로 메뉴 — 폰 ☰ 메뉴(StoreMenu)의 주요 줄과 같은 곳. */
const PC_NAV: ReadonlyArray<readonly [href: string, label: string]> = [
  ['/store', '스토어'],
  ['/reviews', '후기'],
  ['/blog', '매거진'],
  ['/our-food', '우리 음식'],
  ['/brand', '브랜드 이야기'],
  ['/faq', '자주 묻는 질문'],
  ['/app', '앱 정기배송'],
]

export default function StoreHeader(props: StoreHeaderProps) {
  const router = useRouter()
  const pathname = usePathname() ?? '/'
  const [menuOpen, setMenuOpen] = useState(false)
  const variant = props.variant ?? 'home'
  const backHref = 'backHref' in props ? props.backHref : undefined

  const goBack = () => {
    // 바깥(검색·인스타)에서 바로 들어와 이전 화면이 없으면 홈으로.
    if (backHref) router.push(backHref)
    else if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/')
  }

  const iconButton = (label: string, onClick: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, background: 'transparent', color: '#141414', cursor: 'pointer' }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {icon}
      </svg>
    </button>
  )

  return (
    <>
      {/* PC(폭 1024 이상) — 로고 · 가로 메뉴 · 장바구니(store.css .fts-hd-pc). 폰 머리줄(.fts-hd-m)은 PC 에서 숨는다. */}
      <header className="fts-hd-pc">
        <Link href="/" aria-label="파머스테일 홈" style={{ display: 'flex', alignItems: 'center', height: 48, flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ink.png" alt="파머스테일" width={140} height={24} style={{ height: 24, width: 'auto', display: 'block' }} />
        </Link>
        <nav aria-label="주요 메뉴">
          {PC_NAV.map(([href, label]) => (
            <Link key={href} href={href} aria-current={pathname === href || (href !== '/' && pathname.startsWith(`${href}/`)) ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <CartButton withLabel />
      </header>
      {variant === 'title' && 'title' in props && (
        <div className="fts-pc-only">
          <h1 className="d" style={{ margin: 0, maxWidth: 480, marginInline: 'auto', padding: '28px 20px 0', fontSize: 32, lineHeight: 1.1, boxSizing: 'border-box' }}>
            {props.title}
          </h1>
        </div>
      )}
      <header
        className="fts-hd-m"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          height: 56,
          boxSizing: 'border-box',
          padding: '0 6px',
          display: 'grid',
          gridTemplateColumns: '56px 1fr 56px',
          alignItems: 'center',
          background: '#FFFFFF',
          borderBottom: '1px solid #E5E5E5',
        }}
      >
        {variant === 'home' ? iconButton('메뉴', () => setMenuOpen(true), ICON.menu) : iconButton('뒤로', goBack, ICON.back)}
        {variant === 'title' && 'title' in props ? (
          <h1 className="d" style={{ margin: 0, justifySelf: 'center', fontSize: 20, lineHeight: 1 }}>
            {props.title}
          </h1>
        ) : (
          <Link href="/" aria-label="파머스테일 홈" style={{ justifySelf: 'center', display: 'flex', alignItems: 'center', height: 48 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-ink.png" alt="파머스테일" width={111} height={19} style={{ height: 19, width: 'auto', display: 'block' }} />
          </Link>
        )}
        {variant === 'title' ? <span aria-hidden /> : <CartButton />}
      </header>
      {variant === 'home' && <StoreMenu open={menuOpen} onClose={() => setMenuOpen(false)} />}
    </>
  )
}
