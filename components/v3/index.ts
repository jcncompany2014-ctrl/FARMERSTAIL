/**
 * Farmer's Tail v3 primitives — barrel export.
 *
 * **앱 (PWA) 컨텍스트 전용.** v3 컴포넌트는 `data-ft-chrome="app"` wrapper
 * 안에서만 렌더되어야 v3 토큰 (paper / ink / accent / yellow ...) 이
 * 정상적으로 채워진다. 웹 (랜딩/blog/events) 페이지에서 import 하지 말 것.
 *
 * @example
 *   import { Mono, Mark, Signature, BrandWordmark, RibbonChip } from '@/components/v3'
 */

export { default as Mono } from './Mono'
export { default as Mark } from './Mark'
export { default as Signature } from './Signature'
export { default as BrandWordmark } from './BrandWordmark'
export { default as RibbonChip } from './RibbonChip'
export { default as V3Ticker } from './V3Ticker'
export { default as V3Section } from './V3Section'
export { default as Sparkline } from './Sparkline'
export { default as MiniBars } from './MiniBars'
export { default as Skeleton, SkeletonStack } from './Skeleton'
export { default as Tabs, type TabOption } from './Tabs'
