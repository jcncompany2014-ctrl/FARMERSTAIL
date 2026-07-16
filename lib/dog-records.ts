/**
 * Dog records DB helpers (R15-B).
 *
 * R14 에서 localStorage 기반으로 시작한 vaccinations / medications / expenses
 * 의 Supabase 호출을 정리(백신·투약). 지출·활동·연결은 폐지(2026-07-16).
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
