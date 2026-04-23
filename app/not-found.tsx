import type { Metadata } from 'next'
import { Compass } from 'lucide-react'
import { ErrorScreen } from '@/components/ui/ErrorScreen'
import { business } from '@/lib/business'

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없어요',
  robots: { index: false, follow: false },
}

/**
 * 404 — 라우트 미일치.
 *
 * ErrorScreen 공통 레이아웃 사용. 카피는 "막힌 길"이 아니라 "길을 잃었어요"
 * 톤으로, 사용자가 다음 행동을 찾기 쉽게 홈/제품 CTA + 고객센터 링크.
 */
export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      kicker="Wandering · 길을 잃으셨어요"
      title="찾으시는 페이지가 없어요"
      description="주소가 잘못되었거나, 페이지가 옮겨졌을 수 있어요."
      icon={<Compass className="w-6 h-6" strokeWidth={2} aria-hidden />}
      tone="terracotta"
      primary={{ label: '홈으로', href: '/' }}
      secondary={{ label: '제품 둘러보기', href: '/products' }}
      footer={
        <>
          다른 도움이 필요하신가요?{' '}
          <a
            href={`mailto:${business.email}`}
            className="font-bold underline underline-offset-2 text-terracotta"
          >
            고객센터 문의
          </a>
        </>
      }
    />
  )
}
