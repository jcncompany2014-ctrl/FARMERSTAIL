/**
 * 도장판 — 구독 결제 1회 = 도장 1개. 10칸 채우면 특별보상.
 *
 * # 왜 이 모양인가
 * 커피 도장판은 설명이 필요 없는 관용구다. **몇 칸 남았는지 한눈에** 보이는 게 전부고,
 * 그 이상 설명하면 오히려 관용구가 깨진다. 그래서 칸이 주인공.
 *
 * # 껍데기는 페이지가 준다 (2026-07-16 사장님)
 * 멤버십 허브에서 My Benefits · All Tiers 와 **같은 박스**로 보여야 한다 —
 * `bg-bg-3 rounded border-rule` + 위에 테라코타 킥커. 그래서 이 컴포넌트는 제목·킥커를
 * 스스로 갖지 않고 **박스 내용만** 그린다. 킥커는 쓰는 쪽에서 붙인다.
 * (예전엔 자체 헤더를 갖고 있었는데, 그러면 섹션마다 껍데기가 달라 보인다.)
 *
 * # 도장 이미지
 * `/logo-stamp.png` (브랜드 원형 뱃지). 만들어만 두고 어디에도 안 쓰이던 에셋이
 * 여기서 제 자리를 찾았다.
 *
 * # ⚠️ 짜치지 않게 — 도장을 뿌리지 않는다
 * 장식용 잉크 도장을 여기저기 찍었다가 "짜쳐서" 전부 걷어낸 전례가 있다(2026-07 사장님).
 * 그때와 다른 점: 이건 **장식이 아니라 기능**이다(결제한 만큼만 찍힌다). 그 선을
 * 지키려고 손맛(기울임·농도)은 **찍힌 칸에만**, 빈 칸은 조용한 원형 점선.
 *
 * # 접근성
 * 칸 10개를 각각 읽어주면 소음이다. 컨테이너에 요약을 role="img" 로 한 번만 주고
 * 개별 칸은 aria-hidden.
 */
import Image from 'next/image'
import { cardProgress, STAMP_CARD_SIZE, STAMP_REWARD_LABEL } from '@/lib/stamps'

export default function StampCard({
  stampCount,
  /** app(v3, 멤버십 허브) 톤과 web(FD, /account) 톤 — 공유 컴포넌트라 시각만 분기. */
  variant = 'web',
}: {
  stampCount: number | null | undefined
  variant?: 'web' | 'app'
}) {
  const card = cardProgress(stampCount ?? 0)
  const isApp = variant === 'app'
  const justCompleted = card.filled === 0 && card.completedCards > 0

  const a11y = justCompleted
    ? `도장판 ${card.completedCards}장 완성. ${STAMP_REWARD_LABEL}이 도착했어요.`
    : `도장 ${card.filled}개 / ${STAMP_CARD_SIZE}개. ${card.remaining}개 더 모으면 ${STAMP_REWARD_LABEL}.`

  return (
    <div
      className={isApp ? 'bg-bg-3 rounded border border-rule overflow-hidden' : ''}
      style={
        isApp
          ? undefined
          : {
              background: 'var(--paper-hi, #FFFFFF)',
              border: '1px solid var(--rule, rgba(0,0,0,0.08))',
              borderRadius: 18,
            }
      }
    >
      {/* 10칸 — 5×2. 어떤 폭에서도 가로 스크롤 없이 두 줄로 떨어진다. */}
      <div className="px-4 pt-4 pb-3.5">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <span className="text-[12px] font-bold text-text">
            {justCompleted
              ? `${STAMP_REWARD_LABEL} 도착!`
              : `${card.remaining}개 남았어요`}
          </span>
          <span className="text-[10.5px] text-muted tabular-nums shrink-0">
            {card.cardNumber}번째 판 · {card.filled}/{STAMP_CARD_SIZE}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2.5" role="img" aria-label={a11y}>
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
                      // 손도장 느낌 — 각도·농도는 **인덱스로 고정**한다(무작위 X).
                      // 렌더마다 흔들리면 산만하고 서버/클라 렌더가 어긋난다.
                      transform: `rotate(${((i * 37) % 13) - 6}deg)`,
                      opacity: 0.88 + ((i * 7) % 3) * 0.04,
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <p className="border-t border-rule px-4 py-3 text-[10.5px] text-muted leading-relaxed">
        정기배송 결제 1회마다 도장 하나가 찍혀요. 10개를 모으면 {STAMP_REWARD_LABEL}을
        드려요 · 도장은 찍힌 날부터 2년간 유효해요.
      </p>
    </div>
  )
}
