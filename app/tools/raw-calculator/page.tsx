import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, Scale } from 'lucide-react'
import RawCalculatorClient from './RawCalculatorClient'

export const metadata: Metadata = {
  title: 'Raw Ca:P 계산기 — 파머스테일',
  description:
    '집에서 만든 raw / 화식의 칼슘·인 비율 자동 계산. NSH (영양성 이차 상피소체 항진증) 위험 가드.',
}

/**
 * /tools/raw-calculator — Round E1 (2026-05-20): F5-1 자가 raw Ca:P 계산기.
 *
 * # 동기
 *   사용자가 자가 raw 를 자사 화식과 함께 급여할 때, Ca:P 비율이 NSH 위험
 *   범위인지 즉시 확인 가능한 도구. Krook 2010 인용 + FEDIAF 1.0~2.0 가드.
 */
export default function RawCalculatorPage() {
  return (
    <main className="pb-20 max-w-3xl mx-auto px-5 pt-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-text font-semibold mb-3"
      >
        <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
        대시보드
      </Link>

      <div className="flex items-center gap-2">
        <Scale className="w-5 h-5 text-moss" strokeWidth={2} />
        <h1 className="font-['Archivo_Black'] text-2xl md:text-3xl text-ink">
          RAW Ca:P 계산기
        </h1>
      </div>
      <p className="text-[12.5px] md:text-[13.5px] text-muted mt-1.5 leading-relaxed">
        집에서 만든 raw 식재료의 칼슘 / 인 비율을 즉시 계산해 보세요. NSH
        위험 범위면 자동 경고가 떠요.
      </p>

      <section className="mt-4 rounded-2xl border border-rule bg-bg/40 p-4">
        <p className="text-[12px] text-text leading-relaxed">
          📚 <strong>왜 Ca:P 가 중요한가?</strong> 살코기 단독 급여 시 칼슘이
          거의 없고 인만 많아 부갑상선 호르몬 항진 → 뼈에서 칼슘이 빠져
          나가요. 1년 누적 시 골다공증·골절. (Krook 1971/2010)
        </p>
        <p className="text-[11.5px] text-muted mt-2 leading-relaxed">
          FEDIAF 2024 권장: <strong>Ca:P = 1.0 ~ 2.0</strong> (성견). 자견은
          1.0 ~ 1.6 더 엄격.
        </p>
      </section>

      <RawCalculatorClient />

      <p className="text-[10.5px] text-muted mt-8 text-center leading-relaxed">
        ※ 본 계산은 USDA + 한국 식품영양성분 DB 평균치 기반의 추정값이에요.
        정확한 진단은 수의사 상담 + 자가품질검사를 권장해요.
      </p>
    </main>
  )
}
