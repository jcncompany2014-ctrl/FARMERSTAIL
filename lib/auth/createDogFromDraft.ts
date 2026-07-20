// 앱 Phase B — 익명 초안의 강아지정보로 **강아지만 생성**(설문/분석 없이).
//
// 웹 흐름(applyAutosignupDraft)은 "설문 완료 후 가입" 이라 dog+survey+analysis 를
// 한꺼번에 만든다. 앱 흐름(사장님 2026-07-20)은 "강아지정보 → 가입 → [여기서 dog
// 생성] → 앱내 설문(/dogs/[id]/survey)" 순서라, survey/analysis 는 설문이 뒤따르며
// 그때 만든다. 그래서 이 함수는 dog row 만 만든다.
//
// dog insert 필드는 applyAutosignupDraft / NewDogClient 와 동일(생일 저장 + 나이
// 파생 + 활동량 null). 멱등: 이미 dog 있으면(중복 진입/재시도) 그 id 반환.

import { createClient } from '@/lib/supabase/client'
import { isDogDraftComplete, type AutosignupDraft } from '@/lib/autosignup-draft'

export async function createDogFromDraft(
  userId: string,
  draft: AutosignupDraft,
): Promise<string | null> {
  const dog = draft.dog
  if (!isDogDraftComplete(dog)) return null
  const supabase = createClient()

  // 멱등 가드 — 이미 dog 있으면 그 id(재이관/중복 생성 방지).
  try {
    const { data: existing } = await supabase
      .from('dogs')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    if (existing?.id) return existing.id as string
  } catch {
    /* 조회 실패는 아래 insert 가 권위 — 진행 */
  }

  const nowIso = new Date().toISOString()
  const { data: inserted, error } = await supabase
    .from('dogs')
    .insert({
      user_id: userId,
      name: (dog.name || '').trim(),
      breed: dog.breed!,
      gender: dog.gender as 'male' | 'female',
      neutered: dog.neutered === true,
      birth_date: dog.birthDate!,
      // 생일 파생 나이(칼로리 알고리즘이 읽는 age_value/age_unit) — 정본과 동일.
      age_value: parseInt(dog.ageValue!, 10),
      age_unit: dog.ageUnit as 'years' | 'months',
      weight: parseFloat(dog.weight!),
      // 활동량 폼 폐지(2026-07-20) → null. 설문이 채운다.
      activity_level: null,
      weight_method: 'unknown',
      weight_measured_at: nowIso,
      activity_method: 'unknown',
      feed_method: 'unknown',
    })
    .select('id')
    .single()
  if (error || !inserted) return null
  return (inserted as { id: string }).id
}
