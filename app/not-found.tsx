import type { Metadata } from 'next'
import { business } from '@/lib/business'
import { Button, Eyebrow } from '@/components/web/fd/ui'

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없어요',
  robots: { index: false, follow: false },
}

/**
 * 404 — 라우트 미일치 (farm v6 = FD 톤, 2026-06-13 회차9).
 *
 * 공유 ErrorScreen(components/ui/** — 직접 수정 금지) 의존을 떼고, FD 프리미티브로
 * 자체 구성한 chrome 비의존 중앙정렬 화면. app/web 양쪽에서 동일하게 동작하도록
 * WebChrome/AppChrome 을 강제하지 않음. CTA 는 설문 퍼널(/signup), 커머스(/products)
 * 링크 제거. 큰 "404" 숫자 + 그린 eyebrow + 파인 헤드라인 + 코랄 pill.
 */
export default function NotFound() {
  return (
    <main
      className="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center"
      style={{ background: 'var(--fd-offwhite)', color: 'var(--fd-pine)' }}
    >
      <div className="w-full" style={{ maxWidth: 520 }}>
        <div
          className="font-chunky select-none"
          style={{
            fontSize: 'clamp(76px, 22vw, 140px)',
            lineHeight: 0.9,
            color: 'var(--fd-pine)',
            letterSpacing: '-0.04em',
          }}
        >
          404
        </div>

        <div className="mt-5">
          <Eyebrow>PAGE NOT FOUND</Eyebrow>
        </div>

        <h1
          className="mt-3"
          style={{
            fontSize: 'clamp(26px, 6vw, 40px)',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1.08,
            color: 'var(--fd-pine)',
          }}
        >
          길을 잃으셨나요?
        </h1>

        <p
          className="mx-auto mt-4 text-[14px] md:text-[16px]"
          style={{ maxWidth: 380, color: 'var(--fd-muted)', lineHeight: 1.7 }}
        >
          주소가 바뀌었거나 사라진 페이지일 수 있어요. 아래에서 다시 시작해 보세요.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button href="/signup" tone="coral" size="lg">
            2분 설문 시작하기
          </Button>
          <Button href="/" tone="outline" size="lg">
            홈으로
          </Button>
        </div>

        <p className="mt-7 text-[13px]" style={{ color: 'var(--fd-muted)' }}>
          다른 도움이 필요하신가요?{' '}
          <a
            href={`mailto:${business.email}`}
            className="font-bold underline underline-offset-2"
            style={{ color: 'var(--fd-coral-text)' }}
          >
            고객센터 문의
          </a>
        </p>
      </div>
    </main>
  )
}
