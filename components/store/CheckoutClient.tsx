'use client'

/**
 * 주문·결제(웹 시안 Checkout) — 누가 주문하나요(회원) · 어디로 보낼까요 · 어떻게 결제할까요(토스 결제위젯) ·
 * 마지막으로 확인해 주세요 · [○원 결제하기].
 *
 * 흐름: [결제하기] → 서버가 주문을 만든다(/api/store/orders, 금액은 서버가 상품표로 계산) → 위젯 requestPayment →
 * 토스 결제창 → successUrl(/store/order/complete)이 승인(/api/payments/confirm) → 주문 완료 화면.
 * 결제위젯 키가 없으면(토스 일반결제 심사 전, 운영) 결제 대신 '결제 준비 중' 안내 + 전화·카카오톡 주문.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { loadTossPayments, type TossPaymentsWidgets } from '@tosspayments/tosspayments-sdk'
import AddressSearch from '@/components/AddressSearch'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import AppleLoginButton from '@/components/AppleLoginButton'
import { useStoreCart } from './useStoreCart'
import { useShipDate } from './useShipDate'
import { cartSummary, type CartLine } from '@/lib/store/cart'
import { RECIPE_BAND, type StoreItemId } from '@/lib/store/catalog'
import { FREE_SHIPPING_MIN } from '@/lib/store/shipping'
import { validateRecipient } from '@/lib/store/order'
import { business } from '@/lib/business'

const won = (n: number) => n.toLocaleString('ko-KR')
const HOW = ['문 앞에 두세요', '경비실에 맡겨 주세요', '직접 받을게요'] as const
/** 결제창에 다녀온 뒤 완료 화면이 장바구니를 비울지(장바구니 주문) 말지(바로 구매) 알려고 남겨 둔다. */
export const CHECKOUT_MODE_KEY = 'ft_store_checkout_mode'

type Prefill = { name: string; phone: string; zip: string; address: string; addressDetail: string } | null

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 16, fontWeight: 800 }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 14, color: '#595959' }}>{hint}</span>}
    </label>
  )
}
const inputStyle: React.CSSProperties = {
  height: 56,
  boxSizing: 'border-box',
  borderRadius: 4,
  border: '1px solid #BDBDBD',
  padding: '0 16px',
  fontSize: 18,
  fontFamily: 'inherit',
  color: '#141414',
  background: '#FFFFFF',
  width: '100%',
}

export default function CheckoutClient({
  signedIn,
  displayName,
  email,
  prefill,
  buy,
  clientKey,
  customerKey,
}: {
  signedIn: boolean
  displayName: string | null
  email: string | null
  prefill: Prefill
  buy: { id: StoreItemId; qty: number } | null
  clientKey: string | null
  customerKey: string | null
}) {
  const cart = useStoreCart()
  const ship = useShipDate()
  const lines: CartLine[] = buy ? [{ id: buy.id, qty: buy.qty }] : cart.lines
  const s = cartSummary(lines)

  const [name, setName] = useState(prefill?.name ?? '')
  const [phone, setPhone] = useState(prefill?.phone ?? '')
  const [zip, setZip] = useState(prefill?.zip ?? '')
  const [address, setAddress] = useState(prefill?.address ?? '')
  const [detail, setDetail] = useState(prefill?.addressDetail ?? '')
  const [how, setHow] = useState<(typeof HOW)[number]>(HOW[0])
  const [doorOpen, setDoorOpen] = useState(false)
  const [door, setDoor] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [widgetReady, setWidgetReady] = useState(false)
  const [widgetError, setWidgetError] = useState('')
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null)

  const nextHref = `/store/checkout${buy ? `?buy=${buy.id}&qty=${buy.qty}` : ''}`
  const canPay = signedIn && !!clientKey && !!customerKey && s.total > 0

  // 결제위젯 — **한 번만** 만든다(토스: 결제수단 위젯은 한 화면에 하나 — 두 번 그리면 오류). 개발 모드는 화면 준비 코드를
  // 두 번 돌리므로(StrictMode) 시작 여부를 ref 로 막는다. 금액이 바뀌면 아래 effect 가 금액만 다시 넣는다.
  const widgetStarted = useRef(false)
  useEffect(() => {
    if (!canPay || widgetStarted.current) return
    widgetStarted.current = true
    ;(async () => {
      try {
        const toss = await loadTossPayments(clientKey!)
        const widgets = toss.widgets({ customerKey: customerKey! })
        await widgets.setAmount({ currency: 'KRW', value: s.total })
        await Promise.all([
          widgets.renderPaymentMethods({ selector: '#ft-payment-method', variantKey: 'DEFAULT' }),
          widgets.renderAgreement({ selector: '#ft-payment-agreement', variantKey: 'AGREEMENT' }),
        ])
        widgetsRef.current = widgets
        setWidgetReady(true)
      } catch (e) {
        setWidgetError('결제창을 불러오지 못했어요. 새로고침하거나 잠시 후 다시 시도해 주세요.')
        console.error('[store] 결제위젯 실패', e)
      }
    })()
    // 금액 변경은 아래 effect 가 맡는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPay, clientKey, customerKey])

  useEffect(() => {
    if (widgetsRef.current && s.total > 0) void widgetsRef.current.setAmount({ currency: 'KRW', value: s.total }).catch(() => {})
  }, [s.total])

  async function pay() {
    setError('')
    const memo = `${how}${door.trim() ? ` · 공동현관 ${door.trim()}` : ''}`
    const rec = validateRecipient({ name, phone, zip, address, addressDetail: detail, memo })
    if (!rec.ok) {
      setError(rec.message)
      return
    }
    if (!agreed) {
      setError('주문 내용 확인에 동의해 주세요')
      return
    }
    const widgets = widgetsRef.current
    if (!widgets) {
      setError('결제창이 아직 준비되지 않았어요')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/store/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines, recipient: rec.value }),
      })
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        message?: string
        orderId?: string
        amount?: number
        orderName?: string
        customerName?: string
        customerEmail?: string | null
        customerMobilePhone?: string
      } | null
      if (!res.ok || !data?.ok || !data.orderId || !data.amount) {
        setError(data?.message ?? '주문을 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
        setBusy(false)
        return
      }
      // 서버가 계산한 금액이 정본 — 화면 금액과 다르면(상품표가 바뀐 순간 등) 서버 값으로 결제창을 연다.
      if (data.amount !== s.total) await widgets.setAmount({ currency: 'KRW', value: data.amount })
      try {
        window.sessionStorage.setItem(CHECKOUT_MODE_KEY, buy ? 'buy' : 'cart')
      } catch {
        /* 무시 — 완료 화면이 장바구니를 못 비울 뿐 */
      }
      await widgets.requestPayment({
        orderId: data.orderId,
        orderName: data.orderName ?? '파머스테일 화식',
        successUrl: `${window.location.origin}/store/order/complete`,
        failUrl: `${window.location.origin}/store/order/fail`,
        customerEmail: data.customerEmail ?? email ?? undefined,
        customerName: data.customerName,
        customerMobilePhone: data.customerMobilePhone,
      })
    } catch (e) {
      const code = (e as { code?: string })?.code
      // 결제창을 닫은 것은 오류가 아니다 — 그대로 둔다(만든 주문은 30분 뒤 저절로 정리된다).
      if (code !== 'USER_CANCEL') setError((e as { message?: string })?.message ?? '결제를 시작하지 못했어요')
      setBusy(false)
    }
  }

  if (s.lines.length === 0) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <strong className="d" style={{ fontSize: 24 }}>
          주문할 상품이 없어요
        </strong>
        <Link href="/store" style={{ height: 56, padding: '0 28px', borderRadius: 4, background: '#141414', color: '#FFFFFF', display: 'flex', alignItems: 'center', fontSize: 17, fontWeight: 800, textDecoration: 'none' }}>
          레시피 고르러 가기
        </Link>
      </div>
    )
  }

  const section: React.CSSProperties = { padding: '28px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 24 }}>
      {/* 누가 주문하나요 */}
      <section aria-labelledby="who-title" style={section}>
        <h2 id="who-title" className="d" style={{ margin: 0, fontSize: 26 }}>
          누가 주문하나요?
        </h2>
        {signedIn ? (
          <p style={{ margin: 0, padding: '14px 16px', background: '#F6F4F5', borderRadius: 4, fontSize: 16, lineHeight: 1.6 }}>
            <strong>{displayName ? `${displayName}님` : '보호자님'}</strong> 계정으로 주문해요. 나중에 앱에서도 이 주문이 그대로 보여요.
          </p>
        ) : (
          <div style={{ padding: '16px', background: '#F6F4F5', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6 }}>
              카카오로 1초 만에 가입하고 주문해요. 같은 계정이라 <strong>앱에서도 이 주문이 그대로</strong> 보여요.
            </p>
            <KakaoLoginButton next={nextHref} look="app" label="카카오로 주문하기" />
            {/* 애플 기기에서만 보인다(버튼이 스스로 가린다) — 카카오가 있는 가입 화면엔 애플도(규칙108). */}
            <AppleLoginButton next={nextHref} look="app" />
            <Link href={`/login?next=${encodeURIComponent(nextHref)}`} style={{ alignSelf: 'center', height: 44, display: 'flex', alignItems: 'center', fontSize: 15, fontWeight: 700, color: '#141414' }}>
              이메일로 로그인
            </Link>
          </div>
        )}
      </section>

      {/* 어디로 보낼까요 */}
      <section aria-labelledby="where-title" style={{ ...section, opacity: signedIn ? 1 : 0.45, pointerEvents: signedIn ? 'auto' : 'none' }}>
        <h2 id="where-title" className="d" style={{ margin: 0, fontSize: 26 }}>
          어디로 보낼까요?
        </h2>
        <Field label="받는 분">
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" style={inputStyle} />
        </Field>
        <Field label="휴대폰 번호" hint="배송 기사님이 연락할 때만 써요">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="numeric" autoComplete="tel" placeholder="010-0000-0000" style={inputStyle} />
        </Field>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>주소</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
            <span style={{ ...inputStyle, display: 'flex', alignItems: 'center', background: '#F6F4F5', color: zip ? '#141414' : '#9A9A9A' }}>{zip || '우편번호'}</span>
            <div style={{ width: 172 }}>
              <AddressSearch
                variant="app"
                buttonText="우편번호 찾기"
                onComplete={(a) => {
                  setZip(a.zip)
                  setAddress(a.buildingName ? `${a.address} (${a.buildingName})` : a.address)
                }}
              />
            </div>
          </div>
          {address && <span style={{ ...inputStyle, height: 'auto', minHeight: 56, padding: '14px 16px', background: '#F6F4F5', lineHeight: 1.5, display: 'block' }}>{address}</span>}
          <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="상세 주소 (동·호수)" autoComplete="address-line2" style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span id="how-label" style={{ fontSize: 16, fontWeight: 800 }}>
            받는 방법
          </span>
          <div role="radiogroup" aria-labelledby="how-label" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {HOW.map((h) => {
              const on = h === how
              return (
                <button
                  key={h}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setHow(h)}
                  style={{ height: 48, padding: '0 14px', borderRadius: 4, border: '1.5px solid #141414', background: on ? '#141414' : '#FFFFFF', color: on ? '#FFFFFF' : '#141414', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
                >
                  {h}
                </button>
              )
            })}
          </div>
          <span style={{ fontSize: 14, color: '#595959' }}>냉동 상자가 밖에서 오래 기다리지 않게 알려 주세요</span>
        </div>
        {doorOpen ? (
          <Field label="공동현관 출입 방법 (선택)">
            <input value={door} onChange={(e) => setDoor(e.target.value)} placeholder="예: 공동현관 비밀번호" maxLength={60} style={inputStyle} />
          </Field>
        ) : (
          <button type="button" onClick={() => setDoorOpen(true)} style={{ alignSelf: 'flex-start', height: 44, border: 0, background: 'transparent', padding: 0, fontSize: 16, fontWeight: 700, textDecoration: 'underline', color: '#141414', cursor: 'pointer' }}>
            ＋ 공동현관 출입 방법 적기 (선택)
          </button>
        )}
      </section>

      {/* 어떻게 결제할까요 */}
      <section aria-labelledby="pay-title" style={section}>
        <h2 id="pay-title" className="d" style={{ margin: 0, fontSize: 26 }}>
          어떻게 결제할까요?
        </h2>
        {!clientKey ? (
          <div style={{ padding: '16px', border: '2px solid #141414', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <strong style={{ fontSize: 17 }}>온라인 결제를 준비하고 있어요</strong>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: '#3D3D3D' }}>
              곧 카드·간편결제로 바로 살 수 있어요. 지금은 전화({business.phone})나 카카오톡으로 주문을 도와드려요.
            </p>
            {business.kakaoChannelUrl && (
              <a href={business.kakaoChannelUrl} target="_blank" rel="noopener noreferrer" style={{ marginTop: 4, height: 52, borderRadius: 4, background: '#FEE500', color: '#191919', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>
                카카오톡으로 주문하기
              </a>
            )}
          </div>
        ) : !signedIn ? (
          <p style={{ margin: 0, fontSize: 15, color: '#595959' }}>로그인하면 결제 방법을 고를 수 있어요.</p>
        ) : (
          <>
            <div id="ft-payment-method" style={{ margin: '0 -16px', minHeight: widgetReady ? 0 : 120 }} />
            {!widgetReady && !widgetError && <span style={{ fontSize: 14, color: '#595959' }}>결제 방법을 불러오는 중이에요…</span>}
            {widgetError && <span style={{ fontSize: 15, color: '#C63D2A' }}>{widgetError}</span>}
            <span style={{ fontSize: 14, color: '#595959' }}>🔒 결제는 토스페이먼츠가 안전하게 처리해요</span>
          </>
        )}
      </section>

      {/* 마지막으로 확인 */}
      <section aria-labelledby="check-title" style={section}>
        <h2 id="check-title" className="d" style={{ margin: 0, fontSize: 26 }}>
          마지막으로 확인해 주세요
        </h2>
        <div style={{ border: '2px solid #141414', boxShadow: '4px 4px 0 #141414', borderRadius: 4, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {s.lines.map((l) => (
              <li key={l.item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16 }}>
                <span aria-hidden style={{ width: 12, height: 12, flexShrink: 0, background: l.item.recipe ? RECIPE_BAND[l.item.recipe] : '#141414' }} />
                <span style={{ flex: 1 }}>
                  {l.item.name} × {l.qty}
                </span>
                <span style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{won(l.lineTotal)}원</span>
              </li>
            ))}
          </ul>
          <dl style={{ margin: 0, borderTop: '1px solid #E5E5E5', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
              <dt style={{ color: '#595959' }}>출고</dt>
              <dd style={{ margin: 0, fontWeight: 800 }}>{ship ? ship.label : '화·목 출고'}</dd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
              <dt style={{ color: '#595959' }}>배송비</dt>
              <dd style={{ margin: 0 }}>
                {won(s.shippingFee)}원 {s.shippingFee === 0 && <span style={{ color: '#595959' }}>({FREE_SHIPPING_MIN / 10_000}만 원 이상)</span>}
              </dd>
            </div>
            <div style={{ marginTop: 6, paddingTop: 10, borderTop: '2px solid #141414', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <dt style={{ fontSize: 17, fontWeight: 800 }}>결제할 금액</dt>
              <dd style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span className="n" style={{ fontSize: 34 }}>
                  {won(s.total)}
                </span>
                <span className="d" style={{ fontSize: 18 }}>
                  원
                </span>
              </dd>
            </div>
          </dl>
        </div>
        {canPay && <div id="ft-payment-agreement" style={{ margin: '0 -16px' }} />}
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: 26, height: 26, accentColor: '#141414' }} />
          주문 내용을 확인했고 결제에 동의해요
        </label>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#595959' }}>
          받은 날부터 7일 안, 뜯지 않은 상품은 환불돼요. 상품에 문제가 있으면 사진 한 장이면 돼요.{' '}
          <Link href="/legal/terms" style={{ color: '#141414', fontWeight: 700 }}>
            이용약관
          </Link>{' '}
          ·{' '}
          <Link href="/legal/privacy" style={{ color: '#141414', fontWeight: 700 }}>
            개인정보처리방침
          </Link>{' '}
          ·{' '}
          <Link href="/legal/refund" style={{ color: '#141414', fontWeight: 700 }}>
            환불정책
          </Link>
        </p>
        {error && (
          <p role="alert" style={{ margin: 0, padding: '12px 14px', background: '#FDECEA', color: '#8A1F11', borderRadius: 4, fontSize: 15, fontWeight: 700 }}>
            {error}
          </p>
        )}
      </section>

      <div style={{ position: 'sticky', bottom: 0, zIndex: 20, marginTop: 20, padding: '10px 16px calc(12px + env(safe-area-inset-bottom))', background: '#FFFFFF', borderTop: '1px solid #E5E5E5' }}>
        <button
          type="button"
          onClick={pay}
          disabled={!canPay || !widgetReady || busy}
          style={{
            width: '100%',
            height: 60,
            borderRadius: 4,
            border: 0,
            background: canPay && widgetReady && agreed && !busy ? '#141414' : '#E5E5E5',
            color: canPay && widgetReady && agreed && !busy ? '#FFFFFF' : '#595959',
            fontSize: 18,
            fontWeight: 800,
            cursor: canPay && widgetReady && !busy ? 'pointer' : 'default',
          }}
        >
          {!signedIn
            ? '로그인하면 주문할 수 있어요'
            : !clientKey
              ? '온라인 결제 준비 중이에요'
              : busy
                ? '결제창을 여는 중…'
                : agreed
                  ? `${won(s.total)}원 결제하기`
                  : '위 내용에 동의하면 결제할 수 있어요'}
        </button>
      </div>
    </div>
  )
}
