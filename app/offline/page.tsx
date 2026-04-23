'use client'

export default function OfflinePage() {
  return (
    <main className="phone-frame min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-6">📡</div>
        <h1 className="text-2xl font-black text-text tracking-tight mb-3">
          오프라인 상태에요
        </h1>
        <p className="text-sm text-muted leading-relaxed mb-6">
          인터넷 연결이 끊어진 것 같아요.
          <br />
          Wi-Fi나 모바일 데이터를 확인해 주세요.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-xl font-bold text-sm bg-terracotta text-white border-2 border-[#2A2118] shadow-[3px_3px_0_#2A2118] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
        >
          다시 시도하기
        </button>
      </div>
    </main>
  )
}