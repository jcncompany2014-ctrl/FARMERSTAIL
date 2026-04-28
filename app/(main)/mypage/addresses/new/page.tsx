import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AddressForm from '../AddressForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '배송지 추가',
  robots: { index: false, follow: false },
}

export default async function NewAddressPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/addresses/new')

  return <AddressForm mode="create" />
}
