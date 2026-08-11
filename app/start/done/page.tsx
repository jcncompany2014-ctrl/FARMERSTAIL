// 트랙B — 웹 가입 완료 착지 화면(사장님 결정 2026-06-16, A안 = 웹은 리드 캡처).
//
// 배경: /dogs/* 는 app-only(proxy.ts) 라 웹 가입자가 분석 종착점으로 가면
// /app-required 로 튕긴다. 그 "앱 설치 벽" 대신, 가입 직후 웹에서 매끄러운
// 핸드오프를 보여준다.
//   • 앱(PWA/Capacitor) 사용자: /start/claim·login 이 곧장 /dogs/{id}/analysis 로 보냄.
//   • 웹 사용자: 여기로 온다.
//
// ★2026-08-03 — **확인 화면으로 다시 씀** (사장님: "가입과 결제창으로 넘어가는
//   그 사이가 너무 비어있는 기분이야. 대충 읽다가 가입했는데 갑자기 금액 결제
//   창으로 넘어가버리니 그사이에 뭔가 설명이 있어야 할 거 같은데").
//
//   맞는 지적이었다. 이 화면은 "가입이 완료됐어요 → [정기배송 신청하기]" 가
//   전부였다. 설문을 대충 읽고 가입한 사람은 **자기가 뭘 사는지 모르는 채로
//   금액이 적힌 결제 화면**을 만난다. 그 사이를 채운다:
//     ① 우리 아이 박스 구성 — 실제 레시피·급여량·주기. query param 이 아니라
//        loadOrderPageData 로 **다음 화면과 같은 원천**에서 읽는다(화면마다
//        구성·금액이 달라 보이던 사고가 이 프로젝트에 여러 번 있었다).
//     ② ★결제 시점 — "지금 등록해도 돈은 안 나간다". 코드로 확인한 사실이다:
//        billing-issue 는 billing_key 저장 + next_delivery_date=다음 화요일만
//        하고, 실제 청구는 subscription-charge 크론이 그날 한다. 사장님이 말한
//        "갑자기 금액 결제 창" 불안을 정확히 없애는 문장이라 크게 앞세웠다.
//     ③ 다음 3단계 · ④ 안심 3줄 → CTA
//
//   데이터가 없거나(직접 진입·옛 링크) 처방이 아직이면 ① 없이 나머지만 그린다 —
//   틀린 구성·틀린 금액을 보여주는 것보다 설명이 조금 적은 편이 낫다.

import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, MapPin, CreditCard, Truck } from 'lucide-react'
import WebChrome from '@/components/WebChrome'
import { Section, Container, Display, Eyebrow } from '@/components/web/fd/ui'
import { loadOrderPageData } from '@/lib/subscription/orderPageData'
import { quoteBox } from '@/lib/subscription/boxQuote'
import { createClient } from '@/lib/supabase/server'
import { recipeName } from '@/lib/personalization/format'
import { nextShipDate } from '@/lib/shipping-schedule'
import { petName } from '@/lib/korean'

export const metadata: Metadata = {
  title: '가입 완료',
  robots: { index: false, follow: false },
}

/** '2026-08-04' → '8월 4일(화)'. 발송은 늘 화요일이라 요일은 고정이다. */
function shipLabel(iso: string): string {
  const parts = iso.split('-')
  return `${Number(parts[1])}월 ${Number(parts[2])}일(화)`
}

type BoxSummary = {
  recipes: string
  dailyGrams: number | null
  total: number | null
}

/**
 * 다음 화면(/account/subscribe/[dogId])과 **같은 원천**으로 박스 요약을 만든다.
 * 실패하면 null — 요약을 통째로 뺀다. 설명이 아쉬운 것보다 틀린 구성·금액을
 * 보여주는 쪽이 훨씬 나쁘다.
 */
async function loadBoxSummary(dogId: string): Promise<BoxSummary | null> {
  if (!dogId) return null
  try {
    const data = await loadOrderPageData(dogId, {})
    if (!data.ok || !data.formula) return null

    const supabase = await createClient()
    const quote = await quoteBox(supabase, {
      // 아직 구독 행이 없다. quoteBox 는 이 값을 품목행을 만들 때만 쓰고
      // 여기선 total 만 읽는다 — 저장하지 않는다.
      subscriptionId: 'preview',
      formula: {
        lineRatios: data.formula.lineRatios,
        toppers: data.formula.toppers,
      },
      dailyKcal: data.formula.dailyKcal,
      freshRatio: data.initialFresh,
    })

    return {
      recipes: recipeName(data.formula),
      dailyGrams: data.formula.dailyGrams ?? null,
      total: quote?.total ?? null,
    }
  } catch {
    return null
  }
}

const STEPS = [
  { Icon: MapPin, t: '배송지 확인', d: '받으실 주소와 연락처를 확인해요.' },
  {
    Icon: CreditCard,
    t: '결제수단 등록',
    d: '결제할 카드를 등록해요. 등록만 하고 결제는 아직이에요.',
  },
  { Icon: Truck, t: '첫 배송', d: '' }, // 실제 날짜는 아래에서 채운다
] as const

export default async function StartDonePage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; dog?: string }>
}) {
  const sp = await searchParams
  const rawName = (sp.name || '').trim()
  const dogId = (sp.dog || '').trim()
  const box = await loadBoxSummary(dogId)

  // 이름 조사는 정본 헬퍼로(받침 있으면 '이'). 없으면 '우리 아이'.
  const who = rawName ? petName(rawName) : '우리 아이'
  const ship = shipLabel(nextShipDate())

  return (
    <WebChrome>
      <main>
        <Section bg="offwhite" pad="lg">
          <Container size="sm">
            <div className="text-center">
              <span
                className="inline-flex items-center justify-center rounded-full"
                style={{ width: 56, height: 56, background: 'var(--fd-green)' }}
              >
                <Check className="w-7 h-7" strokeWidth={2.6} color="#FFFFFF" />
              </span>
              <div className="pt-5">
                <Eyebrow>Welcome · 가입 완료</Eyebrow>
              </div>
              <Display as="h1" size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
                {who}의 첫 박스가
                <br />
                준비됐어요
              </Display>
            </div>

            {/* ① 무엇을 사는지 */}
            {box && (
              <div
                className="mt-8 text-left"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--fd-line)',
                  borderRadius: 12,
                  padding: '20px 22px',
                }}
              >
                <p
                  className="text-[11px]"
                  style={{
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    color: 'var(--fd-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  우리 아이 맞춤 구성
                </p>
                <p className="pt-2 text-[19px]" style={{ fontWeight: 800, color: 'var(--fd-pine)' }}>
                  {box.recipes}
                </p>
                <p className="pt-1.5 text-[13.5px]" style={{ color: 'var(--fd-muted)' }}>
                  {box.dailyGrams ? `하루 ${box.dailyGrams.toLocaleString()}g · ` : ''}
                  2주에 한 번 배송
                </p>
                {box.total != null && (
                  <div
                    className="mt-4 pt-4 flex items-baseline justify-between"
                    style={{ borderTop: '1px solid var(--fd-line)' }}
                  >
                    <span
                      className="text-[13px]"
                      style={{ color: 'var(--fd-muted)', fontWeight: 700 }}
                    >
                      2주 박스 예상 금액
                    </span>
                    <span
                      className="text-[20px]"
                      style={{
                        fontWeight: 800,
                        color: 'var(--fd-pine)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {box.total.toLocaleString()}원
                    </span>
                  </div>
                )}
                <p className="pt-2 text-[12px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.6 }}>
                  다음 화면에서 화식 비율과 배송지를 확인하면 금액이 확정돼요.
                </p>
              </div>
            )}

            {/* ② ★결제 시점 */}
            <div
              className="mt-4 text-left"
              style={{ background: 'var(--fd-pine)', borderRadius: 12, padding: '20px 22px' }}
            >
              <p className="text-[15.5px]" style={{ fontWeight: 800, color: 'var(--fd-gold)' }}>
                지금 바로 결제되지 않아요
              </p>
              <p
                className="pt-2 text-[13.5px]"
                style={{ color: 'rgba(255,255,255,0.92)', lineHeight: 1.65 }}
              >
                다음 화면에서 결제수단을 등록하시는데, <b>그때 돈이 빠져나가지 않아요.</b>{' '}
                실제 결제는 첫 배송일인 <b>{ship}</b>에 이뤄져요.
              </p>
            </div>

            {/* ③ 다음 순서 */}
            <div className="mt-8">
              <p
                className="text-[11px] text-center"
                style={{
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: 'var(--fd-muted)',
                  textTransform: 'uppercase',
                }}
              >
                다음 순서로 진행돼요
              </p>
              <ol className="pt-4 grid gap-3">
                {STEPS.map((s, i) => {
                  const Icon = s.Icon
                  const desc = i === 2 ? `${ship}에 문 앞으로 보내드려요.` : s.d
                  return (
                    <li
                      key={s.t}
                      className="flex items-start gap-3 text-left"
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid var(--fd-line)',
                        borderRadius: 10,
                        padding: '14px 16px',
                      }}
                    >
                      <span
                        className="inline-flex shrink-0 items-center justify-center rounded-full"
                        style={{ width: 34, height: 34, background: 'var(--fd-cream)' }}
                      >
                        <Icon size={17} strokeWidth={2.2} color="var(--fd-green)" />
                      </span>
                      <span className="flex-1">
                        <span
                          className="block text-[14.5px]"
                          style={{ fontWeight: 800, color: 'var(--fd-pine)' }}
                        >
                          {s.t}
                        </span>
                        <span
                          className="block pt-0.5 text-[12.5px]"
                          style={{ color: 'var(--fd-muted)', lineHeight: 1.55 }}
                        >
                          {desc}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>

            {/* ④ 안심 — 전부 코드로 확인한 사실만 */}
            <ul className="mt-6 grid gap-2">
              {[
                '다음 결제 전까지 해지할 수 있어요.',
                '첫 박스가 미개봉이면 받은 날부터 7일 안에 환불돼요.',
                '배송비는 구독료에 포함이에요.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-left">
                  <Check
                    size={15}
                    strokeWidth={2.8}
                    color="var(--fd-green)"
                    className="shrink-0"
                    style={{ marginTop: 2 }}
                    aria-hidden
                  />
                  <span
                    className="text-[13px]"
                    style={{ color: 'var(--fd-muted)', lineHeight: 1.55 }}
                  >
                    {t}
                  </span>
                </li>
              ))}
            </ul>

            <div className="pt-8 text-center">
              <Link
                href={dogId ? `/account/subscribe/${dogId}` : '/account/dogs'}
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-[14px] font-bold transition hover:brightness-[0.94] active:scale-[0.98]"
                style={{ background: 'var(--fd-coral)', color: '#FFFFFF' }}
              >
                배송지 입력하고 시작하기
              </Link>
              <p className="pt-3 text-[12.5px]" style={{ color: 'var(--fd-muted)' }}>
                38개 영양소 정밀 분석·일일 케어는 앱에서 이어져요.
              </p>
              <p className="pt-5 text-[12.5px]" style={{ color: 'var(--fd-muted)' }}>
                이미 앱이 있다면{' '}
                <Link
                  href="/login"
                  className="font-bold underline underline-offset-2"
                  style={{ color: 'var(--fd-coral-text)' }}
                >
                  앱에서 로그인
                </Link>
                해 주세요.
              </p>
            </div>
          </Container>
        </Section>
      </main>
    </WebChrome>
  )
}
