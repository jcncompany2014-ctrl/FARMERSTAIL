import DogTabsNav from '@/components/dogs/DogTabsNav'

/**
 * 강아지 detail layout — 모든 sub-route 에 5개 탭 nav (개요/기록/분석/처방/구독)
 * 자동 적용. params.id 를 client component 에 전달 — usePathname 으로 active
 * 탭 결정.
 *
 * sub-route 가 11개 — analyses / analysis / approve / checkin / edit /
 * formulas / health / order / reminders / survey + 자기 자신.
 * 5개 그룹으로 묶어 사용자가 한 페이지 안에서 길 잃지 않게.
 *
 * # 액션-driven 페이지에도 탭 노출
 * approve / checkin / edit / reminders 같은 sub-route 도 탭이 같이 보임.
 * 사용자가 "지금 어느 그룹의 액션 중인지" 시각적 위치 잡을 수 있어 OK.
 */
export default async function DogLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>
  children: React.ReactNode
}) {
  const { id } = await params
  return (
    <>
      <DogTabsNav dogId={id} />
      {children}
    </>
  )
}
