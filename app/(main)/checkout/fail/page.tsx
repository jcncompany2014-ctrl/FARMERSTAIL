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
    <div className="min-h-[70vh] px-5 pt-12 flex flex-col items-center">
      <div className="w-20 h-20 rounded-full bg-[#B83A2E] flex items-center justify-center text-4xl text-white">
        ✕
      </div>
      <h1 className="mt-6 font-['Archivo_Black'] text-2xl text-[#2A2118]">
        PAYMENT FAILED
      </h1>
      <p className="mt-2 text-sm text-[#5C4A3A]">결제가 완료되지 않았어요</p>

      <div className="mt-8 w-full p-5 rounded-2xl bg-white border border-[#EDE6D8] space-y-3">
        {orderId && (
          <div className="flex justify-between text-sm">
            <span className="text-[#8A7668]">주문번호</span>
            <span className="text-[#2A2118] font-medium">{orderId}</span>
          </div>
        )}
        {code && (
          <div className="flex justify-between text-sm">
            <span className="text-[#8A7668]">오류 코드</span>
            <span className="text-[#2A2118] font-mono text-xs">{code}</span>
          </div>
        )}
        {message && (
          <div className="text-sm text-[#5C4A3A] pt-3 border-t border-[#EDE6D8]">
            {decodeURIComponent(message)}
          </div>
        )}
      </div>

      <div className="mt-8 w-full space-y-2">
        <Link
          href="/cart"
          className="block w-full text-center py-4 rounded-full bg-[#A0452E] text-white font-semibold hover:bg-[#8A3822] transition"
        >
          장바구니로 돌아가기
        </Link>
        <Link
          href="/products"
          className="block w-full text-center py-4 rounded-full bg-white border border-[#EDE6D8] text-[#5C4A3A] font-medium hover:bg-[#F5F0E6] transition"
        >
          쇼핑 계속하기
        </Link>
      </div>
    </div>
  )
}