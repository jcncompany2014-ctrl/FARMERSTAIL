export default function ProductsPage() {
  return (
    <main className="px-6 py-10">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-black text-[#3D2B1F] tracking-tight mb-2">
          제품
        </h1>
        <p className="text-[#8A7668] text-sm mb-8">
          파머스테일의 프리미엄 펫푸드
        </p>

        <div className="bg-white rounded-2xl border-2 border-dashed border-[#D8CCBA] p-10 text-center">
          <div className="text-5xl mb-4">🛍️</div>
          <h3 className="font-bold text-[#3D2B1F] mb-2">곧 만나요!</h3>
          <p className="text-sm text-[#8A7668]">
            제품 카탈로그가 준비 중이에요
          </p>
        </div>
      </div>
    </main>
  )
}