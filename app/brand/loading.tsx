import { Skeleton } from '@/components/ui/Skeleton'

export default function BrandLoading() {
  return (
    <main className="pb-16 md:pb-28" style={{ background: 'var(--bg)' }}>
      <div
        className="px-5 md:px-8 pt-4 md:pt-6 mx-auto"
        style={{ maxWidth: 1280 }}
      >
        <Skeleton className="h-3 w-28" />
      </div>

      {/* hero */}
      <section
        className="px-5 md:px-12 pt-8 md:pt-20 pb-12 md:pb-24 mx-auto"
        style={{ maxWidth: 1280 }}
      >
        <Skeleton className="h-3 w-44 md:w-56 mb-6" />
        <Skeleton className="h-12 md:h-24 w-3/4" />
        <Skeleton className="h-12 md:h-24 w-2/3 mt-2" />
        <Skeleton className="h-3.5 w-full md:w-[640px] mt-8 md:mt-12" />
        <Skeleton className="h-3.5 w-[80%] md:w-[600px] mt-2" />

        {/* chapter index */}
        <div className="mt-10 md:mt-16 grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] md:h-[88px] w-full" rounded="md" />
          ))}
        </div>
      </section>

      {/* chapters body */}
      {Array.from({ length: 3 }).map((_, ci) => (
        <section
          key={ci}
          className="mx-auto px-5 md:px-12 mt-14 md:mt-24 md:grid md:grid-cols-[180px_1fr] md:gap-12"
          style={{ maxWidth: 1280 }}
        >
          <div className="space-y-2 mb-4 md:mb-0">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-7 md:h-10 w-3/4" />
            <Skeleton className="h-3.5 w-full max-w-3xl" />
            <Skeleton className="h-3.5 w-[90%] max-w-3xl" />
            <Skeleton className="h-3.5 w-[70%] max-w-3xl" />
          </div>
        </section>
      ))}
    </main>
  )
}
