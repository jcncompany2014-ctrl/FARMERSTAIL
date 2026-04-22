import type { Metadata } from 'next'
import Link from 'next/link'
import { Compass } from 'lucide-react'

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없어요',
  robots: { index: false, follow: false },
}

/**
 * 404. 브랜드 팔레트에 맞춘 한글 카피. 자주 찾는 경로를 CTA로 노출해
 * 사용자가 막다른 길에서 이탈하지 않게 한다.
 */
export default function NotFound() {
  return (
    <main className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center px-6 py-12">
      <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center text-terracotta">
        <Compass className="w-8 h-8" strokeWidth={2} />
      </div>

      <div className="mt-6 text-[10px] font-semibold text-muted uppercase tracking-[0.3em]">
        404 · Not Found
      </div>
      <h1 className="mt-2 font-serif text-[22px] font-black text-text tracking-tight text-center">
        페이지를 찾을 수 없어요
      </h1>
      <p className="mt-2 text-[12px] text-muted text-center leading-relaxed max-w-xs">
        주소가 잘못되었거나, 페이지가 삭제되었을 수 있어요.
      </p>

      <div className="mt-8 w-full max-w-xs space-y-2">
        <Link
          href="/"
          className="block w-full text-center py-3.5 rounded-xl bg-terracotta text-white text-[13px] font-black active:scale-[0.98] transition"
        >
          홈으로
        </Link>
        <Link
          href="/products"
          className="block w-full text-center py-3.5 rounded-xl bg-white border border-rule text-[13px] font-bold text-[#5C4A3A] active:scale-[0.98] transition"
        >
          제품 둘러보기
        </Link>
      </div>
    </main>
  )
}
