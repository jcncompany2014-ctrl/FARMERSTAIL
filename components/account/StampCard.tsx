/**
 * 도장판 — 구독 결제 1회 = 도장 1개. 10칸 채우면 특별보상.
 *
 * # 왜 이 모양인가
 * 커피 도장판은 설명이 필요 없는 관용구다. **몇 칸 남았는지 한눈에** 보이는 게 전부고,
 * 그 이상 설명하면 오히려 관용구가 깨진다. 그래서 숫자·안내를 최소로 두고 칸이 주인공.
 *
 * # 도장 이미지
 * `/logo-stamp.png` (브랜드 원형 뱃지). 만들어만 두고 **어디에도 안 쓰이던 에셋**이
 * 여기서 제 자리를 찾았다.
 *
 * # ⚠️ 짜치지 않게 — 도장을 뿌리지 않는다
 * 이 프로젝트는 예전에 장식용 잉크 도장을 여기저기 찍었다가 "짜쳐서" 전부 걷어냈다
 * (2026-07 사장님). 그때와 다른 점: 이건 **장식이 아니라 기능**이다(누른 만큼 찍힌다).
 * 그 선을 지키려고 — 흔들림/기울임 같은 손맛은 **찍힌 칸에만**, 빈 칸은 조용한 원형
 * 점선으로 둔다. 로고를 크게 자랑하는 자리가 아니다.
 *
 * # 접근성
 * 칸 20개를 각각 읽어주면 소음이다. 컨테이너에 요약을 role="img" 로 한 번만 주고
 * 개별 칸은 aria-hidden.
 */
import Image from 'next/image'
import { cardProgress, STAMP_CARD_SIZE, STAMP_REWARD_LABEL } from '@/lib/stamps'

export default function StampCard({
  stampCount,
  /** app(v3) 톤과 web(FD) 톤 — 공유 컴포넌트라 시각만 분기. */
  variant = 'web',
}: {
  stampCount: number | null | undefined
  variant?: 'web' | 'app'
}) {
  const card = cardProgress(stampCount ?? 0)
  const isApp = variant === 'app'
  const complete = card.filled === 0 && card.completedCards > 0

  const label = complete
    ? `도장판 ${card.completedCards}장 완성. ${STAMP_REWARD_LABEL}이 도착했어요.`
    : `도장 ${card.filled}개 / ${STAMP_CARD_SIZE}개. ${card.remaining}개 더 모으면 ${STAMP_REWARD_LABEL}.`

  return (
    <div
      className="px-5 py-5"
      style={{
        background: 'var(--paper-hi, #FFFFFF)',
        border: '1px solid var(--rule, rgba(0,0,0,0.08))',
        borderRadius: isApp ? 4 : 18,
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div
            className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
            style={{ color: 'var(--muted, #706854)' }}
          >
            Stamp · {card.cardNumber}번째 판
          </div>
          <h3
            className="mt-1 text-[16px]"
            style={{ fontWeight: 800, letterSpacing: '-0.015em' }}
          >
            {complete ? `${STAMP_REWARD_LABEL} 도착!` : `${card.remaining}개 남았어요`}
          </h3>
        </div>
        <span
          className="font-mono text-[12px] tabular-nums shrink-0"
          style={{ color: 'var(--muted, #706854)' }}
        >
          {card.filled}/{STAMP_CARD_SIZE}
        </span>
      </div>

      {/* 10칸 — 5×2. 가로 스크롤 없이 어떤 폭에서도 두 줄로 떨어진다. */}
      <div
        className="mt-4 grid grid-cols-5 gap-2.5"
        role="img"
        aria-label={label}
      >
        {Array.from({ length: STAMP_CARD_SIZE }, (_, i) => {
          const stamped = i < card.filled
          return (
            <div
              key={i}
              aria-hidden
              className="relative aspect-square rounded-full grid place-items-center"
              style={{
                border: stamped
                  ? '1px solid transparent'
                  : '1.5px dashed var(--rule, rgba(0,0,0,0.14))',
                background: stamped ? 'transparent' : 'var(--paper, #FAF9F5)',
              }}
            >
              {stamped && (
                <Image
                  src="/logo-stamp.png"
                  alt=""
                  width={72}
                  height={72}
                  className="w-full h-full object-contain"
                  style={{
                    // 손도장 느낌 — 찍힌 칸만 살짝 기울이고 농도를 달리한다.
                    // 각도는 인덱스로 고정(무작위 X) — 렌더마다 흔들리면 화면이 산만하고
                    // 서버/클라 렌더가 어긋난다.
                    transform: `rotate(${((i * 37) % 13) - 6}deg)`,
                    opacity: 0.88 + ((i * 7) % 3) * 0.04,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      <p
        className="mt-3.5 text-[10.5px] leading-relaxed"
        style={{ color: 'var(--muted, #706854)' }}
      >
        정기배송 결제 1회마다 도장 하나가 찍혀요. 10개를 모으면 {STAMP_REWARD_LABEL}을
        드려요 · 도장은 찍힌 날부터 2년간 유효해요.
      </p>
    </div>
  )
}
