'use client'

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-6 py-12">
      <div className="text-center max-w-sm md:max-w-xl">
        <div className="text-6xl md:text-8xl mb-6 md:mb-8" aria-hidden="true">📡</div>
        <h1
          // R28: font-serif → font-sans (v3 app 톤. Service Worker 가 PWA 에서만 보여줌)
          className="font-sans text-[24px] md:text-[40px] lg:text-[48px] font-black text-text mb-3 md:mb-5"
          style={{ letterSpacing: '-0.025em', lineHeight: 1.25 }}
        >
          오프라인 상태예요
        </h1>
        <p className="text-[13px] md:text-[16px] text-muted leading-relaxed mb-6 md:mb-9">
          인터넷 연결이 끊어진 것 같아요.
          <br />
          Wi-Fi나 모바일 데이터를 확인해 주세요.
        </p>
        <button
          onClick={() => window.location.reload()}
          // R28: neo-brutal (검정 border + 3px shadow) → 카트 sticky CTA grammar (그라데이션 shadow)
          className="px-6 md:px-9 py-3 md:py-4 rounded-full font-bold text-sm md:text-[15px] text-white active:scale-[0.98] transition"
          style={{
            background: 'var(--terracotta)',
            border: '1px solid rgba(178, 58, 26, 0.6)',
            boxShadow:
              '0 8px 22px -6px rgba(220, 83, 42, 0.48), 0 2px 8px rgba(220, 83, 42, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
          }}
        >
          다시 시도하기
        </button>
      </div>
    </main>
  )
}