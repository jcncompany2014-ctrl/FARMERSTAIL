/**
 * v3 홈 화면 sections barrel export.
 *
 * **AppChrome (data-ft-chrome="app") 안에서만 사용.** 웹 (랜딩/blog/events)
 * 에서 import 하지 말 것.
 */

export { default as GreetingSection } from './GreetingSection'
export { default as ActiveDogCard } from './ActiveDogCard'
export { default as TodayCard } from './TodayCard'
export { default as ThisWeekSection } from './ThisWeekSection'
export { default as MyDogsSection } from './MyDogsSection'
export { default as ForTodaySection } from './ForTodaySection'
export { default as JournalSection } from './JournalSection'
export { default as DeliveryStripCard } from './DeliveryStripCard'
export { default as FarmToTailSection } from './FarmToTailSection'
export { default as EmptyHomeNoDogs } from './EmptyHomeNoDogs'

export type { DayStatus, WeekDay, QuickAction } from './ThisWeekSection'
export type { DogCardData } from './MyDogsSection'
export type {
  ForTodayProduct,
  ForTodayDelivery,
  ForTodayBonus,
} from './ForTodaySection'
export type { JournalEntry } from './JournalSection'
