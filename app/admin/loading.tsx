/**
 * /admin/** 공통 로딩 스켈레톤 (2026-07-25 사장님 "버벅임·렉" 제보 대응).
 *
 * # 왜 필요했나
 * admin 페이지 38개가 전부 `force-dynamic` 이다(운영 데이터라 캐시하면 안 됨).
 * 그런데 `loading.tsx` 가 하나도 없어서, 폰에서 메뉴를 누르면
 *   탭 → **아무 반응 없음** → (서버 렌더 완료) → 화면 전환
 * 이 되고 그 공백 동안 이전 화면이 그대로 얼어 있다. 서버가 느린 게 아니라
 * (DB 최대 878행 · Vercel 리전도 서울) **피드백이 0** 이라 렉으로 느껴진 것.
 *
 * App Router 는 이 파일 하나로 `/admin` 이하 **모든** 라우트를 Suspense 로
 * 감싸므로, 페이지별 작업 없이 전 구간이 즉시 반응하게 된다.
 *
 * # 범위
 * AdminShell(사이드바·상단바·하단탭)은 layout 이라 유지되고 본문만 이 스켈레톤으로
 * 바뀐다. 그래서 뼈대는 실제 페이지 구조(제목+설명 → 지표카드 → 표)를 그대로
 * 따라가야 전환이 튀지 않는다. admin 페이지 레이아웃을 크게 바꾸면 여기도 같이
 * 맞출 것.
 */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">불러오는 중이에요</span>

      {/* 제목 + 설명 */}
      <div className="mb-6">
        <div className="h-[22px] w-40 rounded bg-zinc-200" />
        <div className="mt-2 h-[13px] w-full max-w-md rounded bg-zinc-100" />
        <div className="mt-1.5 h-[13px] w-2/3 max-w-sm rounded bg-zinc-100" />
      </div>

      {/* 지표 카드 4종 — 대부분의 admin 페이지 상단 공통 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 rounded-lg bg-white border border-zinc-200"
          >
            <div className="h-[12px] w-16 rounded bg-zinc-100" />
            <div className="mt-2 h-7 w-20 rounded bg-zinc-200" />
            <div className="mt-2 h-[11px] w-14 rounded bg-zinc-100" />
          </div>
        ))}
      </div>

      {/* 표/리스트 */}
      <div className="rounded-lg bg-white border border-zinc-200 p-5">
        <div className="h-[13px] w-24 rounded bg-zinc-200" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-[13px] flex-1 rounded bg-zinc-100" />
              <div className="h-[13px] w-16 shrink-0 rounded bg-zinc-100" />
              <div className="h-[13px] w-12 shrink-0 rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
