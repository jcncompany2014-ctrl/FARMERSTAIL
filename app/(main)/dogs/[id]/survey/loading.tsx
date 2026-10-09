/**
 * /dogs/[id]/survey 로딩 폴백 (audit #108).
 *
 * survey 는 2053줄 단일 client component 라 hydration 부담 큼. 진입 직후
 * 첫 step (체중·BCS) 영역 placeholder.
 *
 * 2026-10-09 앱 새 디자인('A 포스터'): 설문 새 틀과 같은 자리(빛 바탕 · 위 줄 자리 · 흰 카드)에 첫 질문 모양의
 * 뼈대(머리말 · 두 줄 제목 · 설명 · 사진 칸 2×2 · '다음' 자리)를 그린다 — 다 불러왔을 때 덜컹 안 움직이게.
 * 이 파일은 SurveyClient 보다 먼저 뜰 수 있어 틀 CSS 를 직접 불러온다.
 */
import { Skeleton } from '@/components/ui/Skeleton'
import './survey.css'

export default function SurveyLoading() {
  return (
    <div className="s-frame">
      <div className="s-glow s-glow-a" aria-hidden="true" />
      <div className="s-glow s-glow-b" aria-hidden="true" />
      <div className="s-top" />
      <section className="s-card">
        <div className="s-scrollwrap">
          <div className="s-scroll">
            <Skeleton className="h-4 w-28" rounded="sm" announce />
            <Skeleton className="h-8 w-3/4 mt-3" rounded="sm" />
            <Skeleton className="h-8 w-2/3 mt-2" rounded="sm" />
            <Skeleton className="h-4 w-1/2 mt-3" rounded="sm" />
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[157px]" rounded="lg" />
              ))}
            </div>
          </div>
        </div>
        <div className="s-cta">
          <Skeleton className="h-[60px] w-full" rounded="full" />
        </div>
      </section>
      <div className="s-below" />
    </div>
  )
}
