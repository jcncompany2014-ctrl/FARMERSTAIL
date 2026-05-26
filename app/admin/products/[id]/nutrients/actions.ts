'use server'

/**
 * XL-1 (#19) — products.nutrition_facts jsonb 저장 server action.
 *
 * 38 영양소 값 numeric 변환 + null 정리 후 jsonb merge.
 * admin 전용 (isAdmin 가드는 /admin layout 에서 처리).
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { NUTRIENTS } from '@/lib/nutrients-spec'

export async function saveNutrients(
  productId: string,
  values: Record<string, string>,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthorized' }
  if (!(await isAdmin(supabase, user))) {
    return { ok: false, reason: 'forbidden' }
  }

  // numeric 변환 — 빈 문자열은 null 로.
  const cleaned: Record<string, number | null> = {}
  for (const n of NUTRIENTS) {
    const raw = values[n.key]
    if (raw == null || raw.trim() === '') {
      cleaned[n.key] = null
      continue
    }
    const parsed = Number(raw)
    if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
      return { ok: false, reason: `${n.label}: 숫자가 올바르지 않습니다.` }
    }
    cleaned[n.key] = parsed
  }

  const { error } = await supabase
    .from('products')
    .update({ nutrition_facts: cleaned })
    .eq('id', productId)

  if (error) return { ok: false, reason: error.message }

  revalidatePath(`/admin/products/${productId}/nutrients`)
  revalidatePath(`/admin/products/${productId}`)
  return { ok: true }
}
