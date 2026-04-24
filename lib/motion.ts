/**
 * Motion utility — reusable Tailwind class strings for the motion system.
 *
 * globals.css 의 `--animate-*` 토큰과 1:1 매칭. 컴포넌트에서
 * `className={clsx(motion.fadeInUp, '...')}` 식으로 쓰면 디자인이 튀지 않고
 * duration/easing 이 전체 앱에서 일관된다.
 *
 * Tailwind v4 의 `animate-*` 유틸은 `@theme inline { --animate-*: ... }` 값을
 * 기반으로 자동 생성되므로 여기 나오는 모든 class 는 별도 plugin 없이 동작.
 */

export const motion = {
  fadeIn: 'animate-fade-in',
  fadeInUp: 'animate-fade-in-up',
  fadeInDown: 'animate-fade-in-down',
  scaleIn: 'animate-scale-in',
  slideInRight: 'animate-slide-in-right',
  slideInUp: 'animate-slide-in-up',
  pulseSoft: 'animate-pulse-soft',
  shimmer: 'animate-shimmer',
} as const

/**
 * Stagger delay — 리스트 자식 n번째마다 delay-NNms 붙일 때 쓴다. Tailwind 는
 * 임의 delay 를 runtime 에 못 만들어내므로 style 인라인으로 넘기는 게 표준.
 *
 *   <li style={motionStagger(i)}>...</li>
 */
export function motionStagger(index: number, stepMs = 60): { animationDelay: string } {
  // prefers-reduced-motion 사용자는 globals.css 의 reduce 가드가 duration 을
  // 0 으로 강등하므로 delay 가 큰 숫자여도 문제 없음. 다만 너무 큰 stagger 가
  // 체감상 "줄 단위 로딩" 처럼 보이지 않도록 상한 720ms.
  const delay = Math.min(index * stepMs, 720)
  return { animationDelay: `${delay}ms` }
}

export type MotionPreset = keyof typeof motion
