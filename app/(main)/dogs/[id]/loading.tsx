/**
 * /dogs/[id] 강아지 상세 로딩 폴백 (audit #108).
 *
 * 2026-08-07: 실제 화면(DogDetailClient)은 96px 원형 사진이 **중앙 정렬**된
 * 카드인데 스켈레톤은 좌측 아바타 + 우측 텍스트 **가로 배치**였다 —
 * 로딩에서 실제로 넘어갈 때 헤더가 통째로 옮겨 앉았다.
 */
import { Skeleton } from '@/components/ui/Skeleton'

export default function DogDetailLoading() {
  return (
    <div className="pb-8" style={{ background: 'var(--bg)' }}>
      <section className="px-5 pt-6">
        {/* 실제와 같은 카드 — bg-3 + rule 보더 + px-6 py-8 중앙 정렬 */}
        <div className="bg-bg-3 rounded border border-rule px-6 py-8 flex flex-col items-center">
          <Skeleton className="w-24 h-24" rounded="full" />
          <Skeleton className="h-2.5 w-16 mt-4" />
          <Skeleton className="h-8 w-32 mt-2" />
          <Skeleton className="h-3 w-40 mt-2" />
        </div>
      </section>
      <section className="px-5 mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded" />
        ))}
      </section>
    </div>
  )
}
