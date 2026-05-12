/**
 * Spinner — 앱 전역 단일 로딩 글리프.
 *
 * 패턴: border-2 terracotta + border-t-transparent + rounded-full + spin.
 * 이전엔 lucide `Loader2`, raw `<Loader2>`, 또는 텍스트 only ("로딩 중...")
 * 가 혼재했음 → 화면마다 로딩 톤이 다르게 보였음. 한 컴포넌트로 모음.
 *
 * 사용
 * ────
 *   <Spinner />              // 16px 기본 (button inline / inline 텍스트 옆)
 *   <Spinner size={28} />    // 페이지 풀 로딩 hero
 *   <Spinner size={12} />    // 칩 / 작은 버튼
 *
 * Accent
 * ──────
 * color prop 으로 strokes/border 색 변경 (예: 흰 버튼 안에 darker spinner).
 * 기본은 terracotta — brand accent.
 */
export function Spinner({
  size = 16,
  color = 'var(--terracotta)',
  className = '',
}: {
  size?: number
  color?: string
  className?: string
}) {
  return (
    <div
      className={`rounded-full animate-spin shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        border: `2px solid ${color}`,
        borderTopColor: 'transparent',
      }}
      role="status"
      aria-label="로딩 중"
    />
  )
}

export default Spinner
