import Link from 'next/link'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{
  code?: string
  message?: string
  orderId?: string
}>

export default async function CheckoutFailPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { code, message, orderId } = await searchParams

  return (
    <main className="pb-8">
      <section className="px-5 pt-10 flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-[#B83A2E] flex items-center justify-center text-white text-3xl font-black shadow-[0_6px_20px_rgba(184,58,46,0.3)]">
          ✕
        </div>
        <h1 className="mt-5 text-xl font-black text-[#3D2B1F] tracking-tight">
          결제가 완료되지 않았어요
        </h1>
        <p className="mt-1 text-[12px] text-[#8A7668]">
          다시 시도하시거나 장바구니로 돌아가 확인해 주세요
        </p>
      </section>

      {(orderId || code || message) && (
        <section className="px-5 mt-7">
          <div className="bg-white rounded-xl border border-[#EDE6D8] px-5 py-5 space-y-3">
            {orderId && (
              <div className="flex justify-between items-center text-[12px]">
                <span className="text-[#8A7668]">주문번호</span>
                <span className="text-[#3D2B1F] font-bold font-mono">
                  {orderId}
                </span>
              </div>
            )}
            {code && (
              <div className="flex justify-between items-center text-[12px]">
                <span className="text-[#8A7668]">오류 코드</span>
                <span className="text-[#3D2B1F] font-mono text-[11px]">
                  {code}
                </span>
              </div>
            )}
            {message && (
              <div className="text-[12px] text-[#5C4A3A] pt-3 border-t border-[#EDE6D8] leading-relaxed">
                {decodeURIComponent(message)}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="px-5 mt-6 space-y-2">
        <Link
          href="/cart"
          className="block w-full text-center py-4 rounded-xl bg-[#A0452E] text-white text-[14px] font-black active:scale-[0.98] transition"
        >
          장바구니로 돌아가기
        </Link>
        <Link
          href="/products"
          className="block w-full text-center py-4 rounded-xl bg-white border border-[#EDE6D8] text-[13px] font-bold text-[#5C4A3A] active:scale-[0.98] transition"
        >
          쇼핑 계속하기
        </Link>
      </section>
    </main>
  )
}
