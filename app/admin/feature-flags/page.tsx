import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import FeatureFlagsClient, {
  type FeatureFlagRow,
} from './FeatureFlagsClient'

export const dynamic = 'force-dynamic'

export default async function FeatureFlagsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const { data } = await supabase
    .from('feature_flags')
    .select('*')
    .order('key', { ascending: true })

  const rows = (data ?? []) as FeatureFlagRow[]

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-['Archivo_Black'] text-2xl text-ink">
          FEATURE FLAGS
        </h1>
        <p className="text-sm text-muted mt-1">
          Boolean on/off + A/B 테스트 variants. 코드 deploy 없이 즉시 반영
          (캐시 60s).
        </p>
      </div>

      <FeatureFlagsClient initialRows={rows} />
    </div>
  )
}
