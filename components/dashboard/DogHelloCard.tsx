import { PawPrint as DogIcon } from 'lucide-react'

/**
 * DogHelloCard — emotional 페르소나 전용 dashboard 헤더 카드 (A-29, A-37).
 *
 * 데이터·점수보다 견의 사진과 이름을 메인으로 — 감성 케어 타입의 보호자
 * 에게 "내가 잘 키우고 있구나" 느끼게 함.
 */
export default function DogHelloCard({
  dogName,
  photoUrl,
}: {
  dogName: string | null
  photoUrl: string | null
}) {
  return (
    <section className="px-5 mt-3">
      <div
        className="rounded px-5 py-4 flex items-center gap-4"
        style={{
          background: 'color-mix(in srgb, var(--terracotta) 6%, white)',
          border:
            '1px solid color-mix(in srgb, var(--terracotta) 22%, transparent)',
        }}
      >
        <div
          className="shrink-0 w-14 h-14 rounded-full overflow-hidden border-2"
          style={{ borderColor: 'var(--terracotta)' }}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={dogName ? `${dogName} 사진` : '강아지 사진'}
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className="w-full h-full flex items-center justify-center"
              style={{ background: 'var(--bg)', color: 'var(--terracotta)' }}
            >
              <DogIcon className="w-7 h-7" strokeWidth={1.6} />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="kicker" style={{ color: 'var(--terracotta)' }}>
            오늘의 가족
          </span>
          <p
            className="font-sans mt-1 leading-tight"
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            {dogName ? `${dogName}와 함께해요` : '오늘도 함께해요'}
          </p>
        </div>
      </div>
    </section>
  )
}
