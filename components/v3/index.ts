/**
 * Farmer's Tail v3 primitives — barrel export.
 *
 * **앱 (PWA) 컨텍스트 전용.** v3 컴포넌트는 `data-ft-chrome="app"` wrapper
 * 안에서만 렌더되어야 v3 토큰 (paper / ink / accent / yellow ...) 이
 * 정상적으로 채워진다. 웹 (랜딩/blog/마케팅) 페이지에서 import 하지 말 것.
 *
 * @example
 *   import { Mono, Mark, Signature, Badge } from '@/components/v3'
 */

export { default as Mono } from './Mono'
export { default as Mark } from './Mark'
export { default as Signature } from './Signature'
export { default as Sparkline } from './Sparkline'
export { default as Skeleton, SkeletonStack } from './Skeleton'
export { default as Tabs, type TabOption } from './Tabs'
export { default as Modal } from './Modal'
export { default as Select, type SelectOption } from './Select'
export {
  default as Badge,
  type BadgeTone,
  type BadgeSize,
  type BadgeShape,
} from './Badge'
export { default as Toggle } from './Toggle'
export { default as DatePicker } from './DatePicker'
export { default as Avatar } from './Avatar'
export { default as Cropper } from './Cropper'
export { default as Slider } from './Slider'
export { default as AllergyBanner } from './AllergyBanner'
export { default as StreakRewards } from './StreakRewards'
export { default as PawFab } from './PawFab'
export {
  ConfirmProvider,
  useConfirm,
  type ConfirmOptions,
  type ConfirmTone,
} from './useConfirm'
