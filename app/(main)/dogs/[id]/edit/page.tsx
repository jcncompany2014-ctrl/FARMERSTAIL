// audit #101 — /dogs/[id]/edit server wrapper. auth + dog ownership + 초기
// dog row 전체를 server fetch. 미인증/소유 X → redirect (이전: client loading
// spinner + flash).
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditDogClient, { type EditDogInitial } from './EditDogClient'

export default async function EditDogPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: dogId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=/dogs/${dogId}/edit`)
  }

  const { data, error } = await supabase
    .from('dogs')
    .select('*')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) {
    redirect('/dogs')
  }

  // audit #79: generated DB row 와 form 의 narrow union cast.
  const row = data as unknown as {
    name: string | null
    breed: string | null
    gender: string | null
    neutered: boolean | null
    age_value: number | null
    age_unit: string | null
    weight: number | null
    activity_level: string | null
    weight_method: string | null
    activity_method: string | null
    feed_method: string | null
    weight_measured_by: string | null
    activity_period: string | null
    walk_intensity: string | null
    treat_frequency: string | null
    treat_types: string[] | null
    human_food_given: boolean | null
    photo_url: string | null
  }

  const initial: EditDogInitial = {
    id: dogId,
    user_id: user.id,
    name: row.name ?? '',
    breed: row.breed ?? '',
    gender: (row.gender ?? '') as '' | 'male' | 'female',
    neutered: row.neutered,
    age_value: row.age_value?.toString() ?? '',
    age_unit: (row.age_unit ?? 'years') as 'years' | 'months',
    weight: row.weight?.toString() ?? '',
    activity_level: (row.activity_level ?? '') as
      | ''
      | 'low'
      | 'medium'
      | 'high',
    weight_method: row.weight_method ?? 'unknown',
    activity_method: row.activity_method ?? 'unknown',
    feed_method: row.feed_method ?? 'unknown',
    weight_measured_by: row.weight_measured_by ?? 'unknown',
    activity_period: row.activity_period ?? 'unknown',
    walk_intensity: row.walk_intensity ?? 'unknown',
    treat_frequency: row.treat_frequency ?? 'unknown',
    treat_types: Array.isArray(row.treat_types) ? row.treat_types : [],
    human_food_given: row.human_food_given,
    photo_url: row.photo_url,
  }

  return <EditDogClient initial={initial} />
}
