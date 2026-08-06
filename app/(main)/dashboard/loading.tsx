/**
 * /dashboard 로딩 폴백.
 *
 * # 왜 다시 그렸나 (2026-08-07 앱 화면 감사)
 * 이 스켈레톤은 **폐기된 커머스 홈**을 그리고 있었다 — "카테고리 3 그리드" +
 * `ProductGridSkeleton count={4}`(전체 상품). 그런데 실제 홈은 구독 전용 전환
 * 후 Greeting → ActiveDogCard → ThisWeek 7일 그리드 → MyDogs 로 바뀌었고
 * 상품 섹션은 2026-06-11 에 제거됐다. 스켈레톤이 사라진 레이아웃을 붙잡고
 * 있어서 로딩 → 실제 전환에서 **화면 절반이 재배치**됐다.
 *
 * 스켈레톤의 존재 이유가 layout shift 최소화이므로, 실제 섹션과 어긋난
 * 스켈레톤은 없느니만 못하다. 아래 치수는 실제 컴포넌트를 보고 맞춘 것:
 *   GreetingSection  padding 24/20/28 · kicker 8px dot · h1 24px 2줄 · 하단 카피
 *   ActiveDogCard    mx-5 카드
 *   ThisWeekSection  7칸 가로 그리드
 *   MyDogsSection    가로 스크롤 강아지 카드
 */
import { Skeleton } from '@/components/ui/Skeleton'

export default function DashboardLoading() {
  return (
    <div className="pb-8" style={{ background: 'var(--bg)' }}>
      {/* 1. Greeting hero — kicker · 24px 제목 2줄 · 하단 카피 */}
      <section style={{ padding: '24px 20px 28px' }}>
        <div className="flex items-center" style={{ gap: 8, marginBottom: 16 }}>
          <span
            aria-hidden
            className="shrink-0"
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: 'var(--terracotta)',
            }}
          />
          <Skeleton className="h-2.5 w-24" />
        </div>
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-7 w-1/2 mt-1.5" />
        <Skeleton className="h-3.5 w-4/5 mt-[18px]" />
      </section>

      {/* 2. ActiveDog 카드 */}
      <section className="px-5">
        <Skeleton className="h-[104px] w-full" rounded="lg" />
      </section>

      {/* 3. 이번 주 기록 — 7칸 그리드 */}
      <section className="px-5 mt-3">
        <Skeleton className="h-3 w-20 mb-3" />
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      </section>

      {/* 4. 내 강아지 — 가로 스크롤 카드 */}
      <section className="px-5 mt-6">
        <Skeleton className="h-3 w-16 mb-3" />
        <div className="flex gap-3 overflow-hidden">
          <Skeleton className="w-[150px] h-[190px] shrink-0" rounded="lg" />
          <Skeleton className="w-[150px] h-[190px] shrink-0" rounded="lg" />
        </div>
      </section>
    </div>
  )
}
