/**
 * /design-check/dogs 예시 값 — 우리 아이·기록·등록·건강 관리 화면(묶음 2A)을 로그인 없이 시안과 나란히 본다.
 * 손님 화면이 아니다(실제 사이트에선 /design-check 자체가 404). 이름·숫자는 시안과 같은 예시(땅콩·보리).
 *
 * 클라이언트 모듈에 두면 서버 페이지가 배열 대신 참조를 받는다 — 그래서 일반 .ts 다.
 * 날짜는 오늘(KST) 기준으로 센다 — 고정 날짜면 며칠 뒤 '확인 중'·'지남'으로 바뀌어 시안과 멀어진다.
 */

import { addDaysKst, todayKstIsoDate } from '@/lib/datetime-kst'
import { buildDogInsight } from '@/lib/dog-insight'
import type { DogListItem } from '../../dogs/DogsListView'
import type {
  ActiveSubscription,
  CurrentFormula,
  Dog,
  WeightLog,
} from '../../dogs/[id]/_components/types'
import type { UpcomingBoxHints } from '../../dogs/[id]/_components/SubscriptionCard'
import type { HealthLog } from '../../dogs/[id]/health/HealthLogClient'
import type { Reminder } from '../../dogs/[id]/reminders/RemindersClient'
import type { EditDogInitial } from '../../dogs/[id]/edit/EditDogClient'
import type { MedicationRow, VaccinationRow } from '@/lib/dog-records'
import type { AiAnalysisJson } from '@/lib/nutrition/ai-prompt'

export const DOG_ID = '00000000-0000-4000-8000-000000000001'
export const DOG2_ID = '00000000-0000-4000-8000-000000000002'
export const PHOTO = '/sheltie-snow-45.jpg'

/** 화면 이름 → [제목, 시안 보드]. 목록 순서 = 점검 화면 목록 순서. */
export const SCREENS: Array<[key: string, title: string, mock: string]> = [
  ['list', '우리 아이 · 목록', 'T07-DogsList'],
  ['list-empty', '우리 아이 · 비었을 때', 'T08-DogsEmpty'],
  ['dog', '우리 아이 · 개요', 'AppDog'],
  ['dog-grace', '개요 · 첫 4주 안내 카드', '—'],
  ['dog-welcome', '등록 환영 창', 'D12-DogWelcomeSheet'],
  ['dog-weight', '체중 기록 창', 'D20-WeightSheet'],
  ['dog-delete', '삭제 확인 · 정기배송 중', 'D21-DogDeleteConfirm'],
  ['dog-delete-free', '삭제 확인 · 정기배송 없음', '—'],
  ['diary', '기록 · 일상', 'D01-RecordDiary'],
  ['diary-write', '일기 쓰기 창', 'D02-DiaryWriteSheet'],
  ['diary-delete', '일기 삭제 확인(공용 확인 창)', 'D03-DiaryDeleteConfirm'],
  ['diary-empty', '일기 · 비었을 때', 'D04-DiaryEmpty'],
  ['health', '기록 · 건강일지', 'D05-HealthLog'],
  ['health-form', '건강일지 · 오늘 기록', 'D06-HealthLogForm'],
  ['health-medical', '건강일지 · 의료 기록 추가', 'D07-MedicalRecordForm'],
  ['health-empty', '건강일지 · 첫 기록(비었을 때)', '—'],
  ['care-meds', '건강 관리 · 복약', 'D14-CareMeds'],
  ['care-med-add', '약물 추가 창', 'D15-MedAddSheet'],
  ['care-vaccines', '건강 관리 · 예방접종', 'D16-CareVaccines'],
  ['care-vaccine-add', '예방접종 추가 창', 'D17-VaccineAddSheet'],
  ['care-reminders', '건강 관리 · 리마인더', 'D18-CareReminders'],
  ['care-reminder-add', '리마인더 추가', 'D19-ReminderAddForm'],
  ['new', '강아지 등록', 'D11-DogNew'],
  ['edit', '정보 수정', 'D13-DogEdit'],
]

/** 오늘(KST) 이후 가장 가까운 화요일(오늘이 화요일이면 다음 주) — 발송일 예시. */
function nextTuesday(today: string): string {
  const d = new Date(`${today}T00:00:00Z`)
  const add = ((2 - d.getUTCDay() + 7) % 7) || 7
  return addDaysKst(today, add)
}

const TODAY = todayKstIsoDate()

// ── 목록 (T07·T08) ──
export const DOG_LIST: DogListItem[] = [
  {
    id: DOG_ID,
    name: '땅콩',
    breed: '셰틀랜드 시프도그',
    weight: 11.2,
    age_value: 3,
    age_unit: 'years',
    photo_url: PHOTO,
  },
  {
    id: DOG2_ID,
    name: '보리',
    breed: '토이푸들',
    weight: 4.2,
    age_value: 2,
    age_unit: 'years',
    photo_url: null,
  },
]

// ── 개요 (AppDog) ──
export const DOG: Dog = {
  id: DOG_ID,
  name: '땅콩',
  breed: '셰틀랜드 시프도그',
  gender: 'female',
  neutered: true,
  age_value: 3,
  age_unit: 'years',
  weight: 11.2,
  activity_level: 'medium',
  photo_url: PHOTO,
  created_at: '2026-02-04T09:00:00+09:00',
}

export const DOG_BORI: Dog = {
  ...DOG,
  id: DOG2_ID,
  name: '보리',
  breed: '토이푸들',
  gender: 'male',
  age_value: 2,
  weight: 4.2,
  activity_level: null,
  photo_url: null,
}

const WEIGHTS = [11.2, 11.1, 11.2, 11.2, 11.0, 11.1, 11.0, 11.1]
export const WEIGHT_LOGS: WeightLog[] = WEIGHTS.map((w, i) => ({
  id: `w${i + 1}`,
  weight: w,
  measured_at: `${addDaysKst(TODAY, -2 - i * 7)}T09:00:00+09:00`,
  note: null,
}))

export const FORMULA: CurrentFormula = {
  cycle_number: 1,
  approval_status: 'auto_applied',
  applied_from: addDaysKst(TODAY, -7),
  applied_until: null,
  formula: { lineRatios: { weight: 0.5, joint: 0.5, basic: 0, skin: 0, premium: 0 } },
  daily_kcal: 640,
  user_adjusted: false,
}

export const SUBSCRIPTIONS: Array<ActiveSubscription & UpcomingBoxHints> = [
  {
    id: 'sub-1',
    status: 'active',
    interval_weeks: 2,
    coverage_weeks: 2,
    fresh_ratio: 30,
    next_delivery_date: nextTuesday(TODAY),
    total_deliveries: 3,
    total_amount: 77800,
    billing_key: 'preview',
    billing_customer_key: 'preview',
    created_at: '2026-08-20T09:00:00+09:00',
    failed_charge_count: 0,
    requires_billing_key_renewal: false,
    subscription_items: [
      { product_name: '닭고기 화식 (120g 한 끼)', quantity: 4 },
      { product_name: '흑돼지 화식 (120g 한 끼)', quantity: 4 },
    ],
    charge_timing: null,
    has_paid_preparing_order: false,
    paid_preparing_at: null,
  },
]

export const AI_COMMENT: { analysisId: string; cached: AiAnalysisJson } = {
  analysisId: 'preview-analysis',
  cached: {
    summary:
      '지난 2주 동안 체중이 11.2kg 안팎으로 잘 유지되고 있어요. 산책이 길었던 날에도 밥을 남기지 않았어요.',
    highlights: [],
    transition: null,
    nextActions: ['다음 체중은 2주 뒤 같은 시간에 재 주세요', '산책 기록을 하루 한 번만 남겨 주세요'],
    citations: [],
    vetConsult: { recommended: false, reason: null },
  },
}

// ── 일기 (D01~D04) ──
/** 일기 한 편의 시각 — 오늘에서 days 일 전 hh:mm (KST). */
function kstAt(days: number, hhmm: string): string {
  return `${addDaysKst(TODAY, -days)}T${hhmm}:00+09:00`
}

export const DIARY_PHOTOS = ['/bowl-eating.jpg', '/serving-custom.jpg']

export const DIARY_ENTRIES = [
  {
    id: 'd1',
    photo_urls: ['/hero-dinner.jpg'],
    note: '저녁 먹기 전에 식탁 앞에서 얌전히 기다렸어요. 오늘 산책도 길게 했어요.',
    mood: 5,
    created_at: kstAt(2, '18:42'),
  },
  {
    id: 'd2',
    photo_urls: DIARY_PHOTOS,
    note: '아침 산책 다녀와서 한 그릇 싹 비웠어요.',
    mood: 4,
    created_at: kstAt(4, '08:15'),
  },
  {
    id: 'd3',
    photo_urls: [],
    note: '비가 와서 산책은 짧게 했어요. 대신 집에서 공놀이를 오래 했어요.',
    mood: 3,
    created_at: kstAt(7, '21:03'),
  },
]

// ── 건강일지 (D05~D07) ── 최근 7일: 기록 5일 · 활동 4일 · 정상 변 4일 · 저조 1일(시안과 같은 숫자).
export const HEALTH_LOGS: HealthLog[] = [
  {
    id: 'h1',
    logged_at: TODAY,
    poop_quality: 'good',
    poop_count: 2,
    activity_level: 'normal',
    mood: 'happy',
    appetite: 'good',
    note: '저녁 산책 40분. 간식은 조금만 줬어요.',
    created_at: kstAt(0, '20:10'),
  },
  {
    id: 'h2',
    logged_at: addDaysKst(TODAY, -1),
    poop_quality: 'good',
    poop_count: null,
    activity_level: 'high',
    mood: 'happy',
    appetite: null,
    note: null,
    created_at: kstAt(1, '20:10'),
  },
  {
    id: 'h3',
    logged_at: addDaysKst(TODAY, -2),
    poop_quality: 'loose',
    poop_count: null,
    activity_level: null,
    mood: 'tired',
    appetite: 'normal',
    note: null,
    created_at: kstAt(2, '20:10'),
  },
  {
    id: 'h4',
    logged_at: addDaysKst(TODAY, -4),
    poop_quality: 'good',
    poop_count: null,
    activity_level: 'normal',
    mood: null,
    appetite: null,
    note: null,
    created_at: kstAt(4, '20:10'),
  },
  {
    id: 'h5',
    logged_at: addDaysKst(TODAY, -5),
    poop_quality: 'good',
    poop_count: null,
    activity_level: 'normal',
    mood: null,
    appetite: 'good',
    note: null,
    created_at: kstAt(5, '20:10'),
  },
]

export const MEDICAL_PREVIEW = {
  diagnosis: ['외이염'],
  meds: [{ name: '귀 세정제', dosage: '1회분', frequency: '하루 2번' }],
  weightKg: '11.2',
  vetNotes: '2주 뒤에 다시 보기로 했어요.',
}

// ── 건강 관리 (D14~D19) ──
const REC_BASE = { dog_id: DOG_ID, user_id: 'preview', created_at: '2026-09-01T09:00:00+09:00', updated_at: '2026-09-01T09:00:00+09:00' }

export const MEDICATIONS: MedicationRow[] = [
  { ...REC_BASE, id: 'm1', name: '피부 연고', schedule: 'daily', dose: '얇게 한 번', time: '21:00', enabled: true, note: '앞발 발가락 사이' },
  { ...REC_BASE, id: 'm2', name: '구충제', schedule: 'asneeded', dose: '1정', time: null, enabled: false, note: null },
]

/** 다음 일정이 오늘 이후가 되게 — 'YYYY-MM-DD' 를 오늘 기준 연도로 맞춘다(지나면 다음 해). */
function upcomingDate(mmdd: string, yearsAhead = 0): string {
  const y = Number(TODAY.slice(0, 4))
  const iso = `${y + yearsAhead}-${mmdd}`
  return iso > TODAY ? iso : `${y + yearsAhead + 1}-${mmdd}`
}

export const VACCINATIONS: VaccinationRow[] = [
  { ...REC_BASE, id: 'v1', vaccine: 'DHPPL', date: '2026-03-12', next_date: upcomingDate('03-12'), note: null },
  { ...REC_BASE, id: 'v2', vaccine: 'KennelCough', date: '2026-03-12', next_date: null, note: null },
  { ...REC_BASE, id: 'v3', vaccine: 'Rabies', date: '2025-11-20', next_date: upcomingDate('11-20'), note: '동네 동물병원, 이상반응 없음' },
]

const REM_BASE = { notes: null, last_done_date: null, enabled: true, created_at: '2026-09-01T09:00:00+09:00' }
export const REMINDERS: Reminder[] = [
  {
    ...REM_BASE,
    id: 'r1',
    type: 'grooming',
    title: '목욕·발톱 관리',
    next_date: addDaysKst(TODAY, 3),
    recur_interval_days: 30,
    last_done_date: addDaysKst(TODAY, -27),
  },
  {
    ...REM_BASE,
    id: 'r2',
    type: 'medication',
    title: '심장사상충 예방약',
    notes: '밥 먹고 바로 한 알',
    next_date: addDaysKst(TODAY, 25),
    recur_interval_days: 30,
    last_done_date: addDaysKst(TODAY, -5),
  },
  {
    ...REM_BASE,
    id: 'r3',
    type: 'checkup',
    title: '1년차 건강검진',
    next_date: addDaysKst(TODAY, 69),
    recur_interval_days: null,
    enabled: false,
  },
]

// ── 정보 수정 (D13) ──
export const EDIT_INITIAL: EditDogInitial = {
  id: DOG_ID,
  user_id: 'preview',
  name: '땅콩',
  breed: '셰틀랜드 시프도그',
  gender: 'female',
  neutered: true,
  birth_date: '2023-06-14',
  weight: '11.2',
  activity_level: 'medium',
  weight_method: 'unknown',
  activity_method: 'unknown',
  feed_method: 'unknown',
  weight_measured_by: 'unknown',
  activity_period: 'unknown',
  walk_intensity: 'unknown',
  treat_frequency: 'unknown',
  treat_types: [],
  human_food_given: null,
  photo_url: PHOTO,
}

export const INSIGHT = buildDogInsight({
  dogName: '땅콩',
  weightLogs: WEIGHT_LOGS.slice(0, 4).map((l) => ({ measured_at: l.measured_at, weight: l.weight })),
  lastSurveyAt: null,
  bcs: null,
})
