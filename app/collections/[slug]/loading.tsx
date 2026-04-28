import { Skeleton } from '@/components/ui/Skeleton'

export default function CollectionDetailLoading() {
  return (
    <main className="pb-12 md:pb-20" style={{ background: 'var(--bg)' }}>
      <div
        className="px-5 md:px-8 pt-4 md:pt-6 mx-auto"
        style={{ maxWidth: 1280 }}
      >
        <Skeleton className="h-3 w-44" />
      </div>

      {/* hero */}
      <div
        className="mt-3 md:mt-5 mx-auto"
        style={{ maxWidth: 1280 }}
      >
        <Skeleton className="w-full h-[280px] md:h-[480px]" rounded="lg" />
      </div>

      <section
        className="px-5 md:px-8 pt-10 md:pt-14 mx-auto"
        style={{ maxWidth: 1280 }}
      >
        <div className="flex items-baseline justify-between mb-4 md:mb-6">
          <Skeleton className="h-5 md:h-7 w-40" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[4/5] w-full" rounded="lg" />
              <div className="pt-3 space-y-1.5">
                <Skeleton className="h-2.5 w-12" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-[60%]" />
                <Skeleton className="h-4 w-[40%] mt-1" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
