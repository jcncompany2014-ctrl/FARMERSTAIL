import { Skeleton } from '@/components/ui/Skeleton'

export default function CollectionsLoading() {
  return (
    <main
      className="min-h-screen pb-12 md:pb-20 mx-auto"
      style={{ background: 'var(--bg)', maxWidth: 1280 }}
    >
      <div className="px-5 md:px-8 pt-4 md:pt-6">
        <Skeleton className="h-3 w-28" />
      </div>
      <section className="px-5 md:px-8 pt-4 md:pt-8 pb-6 md:pb-10 space-y-3">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-9 md:h-14 w-2/3 md:w-[420px]" />
        <Skeleton className="h-3.5 w-full md:w-[520px]" />
      </section>
      <section className="px-5 md:px-8">
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i}>
              <Skeleton
                className="w-full h-[260px] md:h-[320px]"
                rounded="lg"
              />
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
