/**
 * DogPawMark — 강아지 사진 placeholder 등에 쓰는 발바닥 마크.
 *
 * 사장님 제공 벡터(dog-paw-svgrepo)로 통일. lucide `PawPrint`(아웃라인) 대신
 * 채워진(fill) 실루엣 발자국 — 사진 없는 카드의 placeholder, 빈 상태 일러스트
 * 등에서 공통으로 사용한다.
 *
 * 사용:
 *   <DogPawMark size={36} color={V3.inkMute} />        // size/color prop
 *   <DogPawMark className="w-5 h-5 text-muted" />       // Tailwind (fill=currentColor)
 */

interface DogPawMarkProps {
  /** px 크기 (정사각). className 으로 w-/h- 줄 땐 생략 가능. */
  size?: number
  /** fill 색. 기본 currentColor — text-* 클래스로도 제어 가능. */
  color?: string
  className?: string
  style?: React.CSSProperties
  /** lucide 아이콘 자리에 drop-in 으로 꽂힐 때의 호환용 — fill 마크라 무시됨. */
  strokeWidth?: number
}

export default function DogPawMark({
  size = 24,
  color = 'currentColor',
  className,
  style,
}: DogPawMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill={color}
      className={className}
      style={style}
      aria-hidden
    >
      <path d="M191.4,164.127c29.081-9.964,44.587-41.618,34.622-70.699c-9.952-29.072-41.6-44.592-70.686-34.626c-29.082,9.956-44.588,41.608-34.632,70.69C130.665,158.582,162.314,174.075,191.4,164.127z" />
      <path d="M102.394,250.767v0.01c16.706-25.815,9.316-60.286-16.484-76.986c-25.81-16.691-60.273-9.316-76.978,16.489v0.01c-16.695,25.805-9.306,60.268,16.495,76.958C51.236,283.957,85.694,276.573,102.394,250.767z" />
      <path d="M320.6,164.127c29.086,9.948,60.734-5.545,70.695-34.636c9.956-29.081-5.55-60.734-34.631-70.69c-29.086-9.966-60.734,5.555-70.686,34.626C276.013,122.509,291.519,154.163,320.6,164.127z" />
      <path d="M256,191.489c-87.976,0-185.048,121.816-156.946,208.493c27.132,83.684,111.901,49.195,156.946,49.195c45.045,0,129.813,34.489,156.945-49.195C441.048,313.305,343.976,191.489,256,191.489z" />
      <path d="M503.068,190.289v-0.01c-16.705-25.805-51.166-33.18-76.976-16.489c-25.801,16.7-33.19,51.171-16.486,76.986v-0.01c16.7,25.806,51.158,33.19,76.968,16.481C512.374,250.557,519.764,216.095,503.068,190.289z" />
    </svg>
  )
}
