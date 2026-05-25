/**
 * Dog records DB helpers (R15-B).
 *
 * R14 에서 localStorage 기반으로 시작한 vaccinations / medications / expenses
 * 와 신규 activity_logs / dog_connections 의 Supabase 호출을 정리.
 *
 * lib/supabase/types.ts 가 너무 커서 (90KB+) MCP 재생성이 cost 가 높아, 새 5개
 * 테이블 row 타입을 여기서 직접 선언. types.ts 의 자동 재생성 없이도
 * 타입 안전.
 *
 * 호출 예:
 *   const recs = await listVaccinations(supabase, dogId)
 *   await upsertVaccination(supabase, { ... })
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// Row 타입
// ─────────────────────────────────────────────────────────────

export interface VaccinationRow {
  id: string
  dog_id: string
  user_id: string
  vaccine: string
  date: string // yyyy-mm-dd
  next_date: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export interface MedicationRow {
  id: string
  dog_id: string
  user_id: string
  name: string
  dose: string | null
  schedule: 'daily' | 'weekly' | 'asneeded'
  time: string | null
  enabled: boolean
  note: string | null
  created_at: string
  updated_at: string
}

export interface ExpenseRow {
  id: string
  dog_id: string
  user_id: string
  category: 'food' | 'vet' | 'snack' | 'supplies' | 'etc'
  amount: number
  date: string
  memo: string | null
  created_at: string
}

export interface ActivityLogRow {
  id: string
  dog_id: string
  user_id: string
  activity_type:
    | 'meal'
    | 'walk'
    | 'poop'
    | 'play'
    | 'sleep'
    | 'water'
    | 'other'
  occurred_at: string
  duration_min: number | null
  amount: number | null
  unit: string | null
  note: string | null
  created_at: string
}

export interface DogConnectionRow {
  id: string
  requester_dog_id: string
  requester_user_id: string
  receiver_dog_id: string
  receiver_user_id: string
  status: 'pending' | 'accepted' | 'blocked'
  context: string | null
  created_at: string
  accepted_at: string | null
}

// supabase-js v2 의 from(): types.ts 에 없는 테이블은 `any` 로 우회.
// 타입 안전성은 우리가 명시한 Row 타입으로 보장.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, 'public', any>

// ─────────────────────────────────────────────────────────────
// Vaccinations
// ─────────────────────────────────────────────────────────────

export async function listVaccinations(
  supabase: AnyClient,
  dogId: string,
): Promise<VaccinationRow[]> {
  const { data, error } = await supabase
    .from('dog_vaccinations')
    .select('*')
    .eq('dog_id', dogId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []) as VaccinationRow[]
}

export async function insertVaccination(
  supabase: AnyClient,
  row: Pick<VaccinationRow, 'dog_id' | 'user_id' | 'vaccine' | 'date'> &
    Partial<Pick<VaccinationRow, 'next_date' | 'note'>>,
): Promise<VaccinationRow> {
  const { data, error } = await supabase
    .from('dog_vaccinations')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data as VaccinationRow
}

export async function deleteVaccination(
  supabase: AnyClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('dog_vaccinations').delete().eq('id', id)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────
// Medications
// ─────────────────────────────────────────────────────────────

export async function listMedications(
  supabase: AnyClient,
  dogId: string,
): Promise<MedicationRow[]> {
  const { data, error } = await supabase
    .from('dog_medications')
    .select('*')
    .eq('dog_id', dogId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as MedicationRow[]
}

export async function insertMedication(
  supabase: AnyClient,
  row: Pick<MedicationRow, 'dog_id' | 'user_id' | 'name' | 'schedule'> &
    Partial<
      Pick<MedicationRow, 'dose' | 'time' | 'enabled' | 'note'>
    >,
): Promise<MedicationRow> {
  const { data, error } = await supabase
    .from('dog_medications')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data as MedicationRow
}

export async function setMedicationEnabled(
  supabase: AnyClient,
  id: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('dog_medications')
    .update({ enabled })
    .eq('id', id)
  if (error) throw error
}

export async function deleteMedication(
  supabase: AnyClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('dog_medications').delete().eq('id', id)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────
// Expenses
// ─────────────────────────────────────────────────────────────

export async function listExpenses(
  supabase: AnyClient,
  dogId: string,
  limit = 100,
): Promise<ExpenseRow[]> {
  const { data, error } = await supabase
    .from('dog_expenses')
    .select('*')
    .eq('dog_id', dogId)
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as ExpenseRow[]
}

export async function insertExpense(
  supabase: AnyClient,
  row: Pick<
    ExpenseRow,
    'dog_id' | 'user_id' | 'category' | 'amount' | 'date'
  > &
    Partial<Pick<ExpenseRow, 'memo'>>,
): Promise<ExpenseRow> {
  const { data, error } = await supabase
    .from('dog_expenses')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data as ExpenseRow
}

export async function deleteExpense(
  supabase: AnyClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('dog_expenses').delete().eq('id', id)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────
// Activity logs (QuickLog 용 — B18)
// ─────────────────────────────────────────────────────────────

export async function listRecentActivities(
  supabase: AnyClient,
  dogId: string,
  limit = 50,
): Promise<ActivityLogRow[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('dog_id', dogId)
    .order('occurred_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as ActivityLogRow[]
}

export async function insertActivity(
  supabase: AnyClient,
  row: Pick<ActivityLogRow, 'dog_id' | 'user_id' | 'activity_type'> &
    Partial<
      Pick<
        ActivityLogRow,
        'occurred_at' | 'duration_min' | 'amount' | 'unit' | 'note'
      >
    >,
): Promise<ActivityLogRow> {
  const { data, error } = await supabase
    .from('activity_logs')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data as ActivityLogRow
}

// ─────────────────────────────────────────────────────────────
// Dog connections (견 친구 시스템 — B15)
// ─────────────────────────────────────────────────────────────

/**
 * 두 견 UUID 정렬 — requester_dog_id < receiver_dog_id 보장.
 * DB constraint 가 같은 룰이라 입력 전 정렬 필수.
 */
export function sortDogPair(
  a: { dog_id: string; user_id: string },
  b: { dog_id: string; user_id: string },
): {
  requester: { dog_id: string; user_id: string }
  receiver: { dog_id: string; user_id: string }
} {
  if (a.dog_id < b.dog_id) {
    return { requester: a, receiver: b }
  }
  return { requester: b, receiver: a }
}

export async function listConnections(
  supabase: AnyClient,
  userId: string,
): Promise<DogConnectionRow[]> {
  const { data, error } = await supabase
    .from('dog_connections')
    .select('*')
    .or(`requester_user_id.eq.${userId},receiver_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DogConnectionRow[]
}

export async function requestConnection(
  supabase: AnyClient,
  args: {
    fromDog: { dog_id: string; user_id: string }
    toDog: { dog_id: string; user_id: string }
    context?: string
  },
): Promise<DogConnectionRow> {
  const { requester, receiver } = sortDogPair(args.fromDog, args.toDog)
  const { data, error } = await supabase
    .from('dog_connections')
    .insert({
      requester_dog_id: requester.dog_id,
      requester_user_id: requester.user_id,
      receiver_dog_id: receiver.dog_id,
      receiver_user_id: receiver.user_id,
      status: 'pending',
      context: args.context ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as DogConnectionRow
}

export async function acceptConnection(
  supabase: AnyClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('dog_connections')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
