import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import EliminationDietClient from './EliminationDietClient'

export const metadata: Metadata = {
  title: 'Elimination Diet 8주 가이드 — 파머스테일',
  description:
    'Jackson 2024 기반 단계별 elimination diet 가이드. 단일 단백 8주 → 알레르겐 식별. 체크리스트 자동 진행.',
}

/**
 * /tools/elimination-diet — Round F1 (2026-05-20): F5-3 Elimination Diet
 * 8주 가이드 + 체크리스트.
 *
 * # 단계 (Jackson 2024 / Olivry 2015 가이드)
 *   Week 1-2  : 적응기 — 기존 사료 + 신규 single protein 점진 전환
 *   Week 3-7  : 단일 단백 — 신규 protein 만 (모든 간식·인간 음식 X)
 *   Week 8    : 도전 — 원래 의심 protein 재도입 → 증상 재발 확인
 *
 * # 데이터 저장
 *   체크리스트 진행은 LocalStorage (key='ft:elimination-diet') 만 사용.
 *   DB 저장 X — 사용자 부담 최소 + 푸시는 별도 cron 으로 분리 (후속).
 */
export default function EliminationDietPage() {
  return (
    <main className="pb-20 max-w-3xl mx-auto px-5 pt-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-text font-semibold mb-3"
      >
        <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
        대시보드
      </Link>

      <h1 className="font-['Archivo_Black'] text-2xl md:text-3xl text-ink">
        ELIMINATION DIET 8주
      </h1>
      <p className="text-[12.5px] md:text-[13.5px] text-muted mt-1.5 leading-relaxed">
        Jackson 2024 / Olivry 2015 가이드. 단일 단백질을 8주간 단독 급여하여
        식이 알레르겐을 식별하는 표준 프로토콜이에요.
      </p>

      {/* 경고 박스 */}
      <section className="mt-4 rounded-2xl border border-sale/40 bg-sale/5 p-4 flex items-start gap-3">
        <AlertCircle
          className="w-4 h-4 text-sale shrink-0 mt-0.5"
          strokeWidth={2}
        />
        <div className="text-[12px] text-text leading-relaxed">
          <strong>중요</strong> — 본 가이드는 보호자 셀프 케어 보조용이에요.
          심한 가려움·소화 증상이 있다면 반드시 수의사 진료 + 식이 처방
          상담을 먼저 받으세요.
        </div>
      </section>

      <EliminationDietClient />

      <p className="text-[10.5px] text-muted mt-8 text-center leading-relaxed">
        ※ 가이드 출처: Jackson HA. Diagnostic techniques: Elimination diets and
        provocation testing. Veterinary Allergy. 2024. + Olivry T et al. WAVD
        criteria. 2015.
      </p>
    </main>
  )
}
