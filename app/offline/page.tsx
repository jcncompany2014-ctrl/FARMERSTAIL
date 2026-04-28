'use client'

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-6 py-12">
      <div className="text-center max-w-sm md:max-w-xl">
        <div className="text-6xl md:text-8xl mb-6 md:mb-8">📡</div>
        <h1
          className="font-serif text-[24px] md:text-[40px] lg:text-[48px] font-black text-text mb-3 md:mb-5"
          style={{ letterSpacing: '-0.025em', lineHeight: 1.15 }}
        >
          오프라인 상태에요
        </h1>
        <p className="text-[13px] md:text-[16px] text-muted leading-relaxed mb-6 md:mb-9">
          인터넷 연결이 끊어진 것 같아요.
          <br />
          Wi-Fi나 모바일 데이터를 확인해 주세요.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 md:px-9 py-3 md:py-4 rounded-xl font-bold text-sm md:text-[15px] bg-terracotta text-white border-2 border-[#2A2118] shadow-[3px_3px_0_#2A2118] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
        >
          다시 시도하기
        </button>
      </div>
    </main>
  )
}