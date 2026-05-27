/**
 * /unsubscribed — 광고성 이메일 수신거부 결과 페이지.
 *
 * R87-A3 (D10): /api/marketing/unsubscribe 가 처리 후 redirect.
 * 동일 layout 으로 newsletter unsubscribe 와 marketing unsubscribe 모두 처리.
 */

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '수신거부 처리',
  robots: 'noindex',
}

const MESSAGES: Record<string, { title: string; body: string; tone: 'ok' | 'error' }> = {
  ok: {
    title: '수신거부가 완료됐어요',
    body: '앞으로 광고성 이메일을 보내지 않을게요. 거래 안내 (주문/배송/환불) 메일은 계속 보내요.',
    tone: 'ok',
  },
  unsubscribed: {
    title: '수신거부가 완료됐어요',
    body: '뉴스레터 발송을 중단했어요. 다시 받고 싶으시면 마이페이지에서 동의해 주세요.',
    tone: 'ok',
  },
  'already-unsubscribed': {
    title: '이미 수신거부된 상태예요',
    body: '추가 작업이 필요 없어요.',
    tone: 'ok',
  },
  invalid: {
    title: '링크가 유효하지 않아요',
    body: '메일이 너무 오래되었거나 손상된 링크예요. 마이페이지 → 알림에서 직접 변경하실 수 있어요.',
    tone: 'error',
  },
  error: {
    title: '잠시 처리에 문제가 있어요',
    body: '잠시 후 다시 시도하시거나 마이페이지 → 알림 설정에서 직접 변경해 주세요.',
    tone: 'error',
  },
}

export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const info = MESSAGES[status ?? 'ok'] ?? MESSAGES.ok!

  return (
    <main
      className="min-h-screen flex items-center justify-center px-5"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <section
        className="w-full max-w-md rounded-lg p-7"
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--rule)',
        }}
      >
        <h1
          className="text-[18px] font-bold mb-3"
          style={{
            color: info.tone === 'ok' ? 'var(--text)' : 'var(--sale)',
            letterSpacing: '-0.015em',
          }}
        >
          {info.title}
        </h1>
        <p
          className="text-[13.5px] leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          {info.body}
        </p>

        <div className="mt-7 flex gap-2">
          <Link
            href="/mypage/notifications"
            className="flex-1 text-center px-3 py-2.5 rounded text-[12px] font-bold"
            style={{
              background: 'var(--text)',
              color: 'var(--paper)',
              borderRadius: 4,
            }}
          >
            알림 설정으로
          </Link>
          <Link
            href="/"
            className="flex-1 text-center px-3 py-2.5 rounded text-[12px] font-bold"
            style={{
              border: '1px solid var(--rule)',
              color: 'var(--text)',
              borderRadius: 4,
            }}
          >
            홈으로
          </Link>
        </div>
      </section>
    </main>
  )
}
