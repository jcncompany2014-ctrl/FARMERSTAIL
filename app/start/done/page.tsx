'use client'

// 트랙B — 웹 가입 완료 착지 화면(사장님 결정 2026-06-16, A안 = 웹은 리드 캡처).
//
// 배경: /dogs/* 는 app-only(proxy.ts:172) 라 웹 가입자가 분석 종착점으로 가면
// /app-required 로 튕긴다. 그 "앱 설치 벽" 대신, 가입 직후 웹에서 매끄러운
// "가입 완료 → 정밀 분석은 앱에서" 핸드오프를 보여준다.
//   • 앱(PWA/Capacitor) 사용자: /start/claim·login 이 곧장 /dogs/{id}/analysis 로 보냄.
//   • 웹 사용자: 여기로 와서 완료 안내 + 앱 유도.
//
// ★2026-07-31 — 전제가 바뀌었다(사장님: "웹에서도 제품 구독 정도는 되어야 한다").
//   `/account/subscribe/[dogId]` 신설로 **웹에서 신청이 끝까지 이어진다.**
//   그런데 이 화면은 여전히 "정밀 분석과 맞춤 레시피는 앱에서" 로 끝나고 링크가
//   `/login` 하나뿐이었다 — 설문을 마친 사람이 **결제로 갈 길이 없었다**
//   (사장님 제보: "추천레시피가 결제로 안 이어져").
//   이제 신청 CTA 가 주인공이고, 앱 안내는 보조로 내린다.

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check } from 'lucide-react'
import WebChrome from '@/components/WebChrome'
import { Section, Container, Display, Eyebrow } from '@/components/web/fd/ui'

function DoneInner() {
  const params = useSearchParams()
  const name = (params.get('name') || '').trim() || '우리 아이'
  // claim 이 넘겨준 강아지 id — 있으면 곧바로 신청 화면으로 보낸다.
  // 없으면(옛 링크·직접 진입) 우리 아이 목록으로 — 거기서도 신청할 수 있다.
  const dogId = (params.get('dog') || '').trim()

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
                가입이 완료됐어요!
              </Display>
              <p
                className="pt-4 text-[14.5px] md:text-[16px] mx-auto"
                style={{ maxWidth: 440, lineHeight: 1.7, color: 'var(--fd-muted)' }}
              >
                <b style={{ color: 'var(--fd-pine)' }}>{name}</b> 맞춤 식단이 준비됐어요.
                바로 정기배송을 시작할 수 있어요.
              </p>

              {/* ★ 신청 CTA — 이 화면의 주인공 (2026-07-31).
                  예전엔 링크가 /login 하나뿐이라 설문을 마친 사람이 결제로 갈 길이
                  없었다. 웹 신청 화면이 생겼으니 곧장 보낸다. */}
              <div className="pt-7">
                <Link
                  href={dogId ? `/account/subscribe/${dogId}` : '/account/dogs'}
                  className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-[14px] font-bold transition hover:brightness-[0.94] active:scale-[0.98]"
                  style={{ background: 'var(--fd-coral)', color: '#FFFFFF' }}
                >
                  정기배송 신청하기
                </Link>
                <p
                  className="pt-3 text-[12.5px]"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  38개 영양소 정밀 분석·일일 케어는 앱에서 이어져요.
                </p>
              </div>

              {/* 스토어 배지 — **스토어 등재 전까지 내보내지 않는다**(2026-08-02).
                  여기 있던 PhotoSlot 2 개는 src 가 없어서 "App Store 배지",
                  "Google Play 배지" 라고 적힌 검은 빈 상자로 보였다. 아직 스토어에
                  올라가지 않은 앱을 "곧 나와요"도 아니고 미완성 UI 로 알리는 꼴.
                  등재되면 실제 배지 이미지 + 스토어 링크로 되살린다. */}

              <p className="pt-6 text-[12.5px]" style={{ color: 'var(--fd-muted)' }}>
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

export default function StartDonePage() {
  return (
    <Suspense fallback={null}>
      <DoneInner />
    </Suspense>
  )
}
