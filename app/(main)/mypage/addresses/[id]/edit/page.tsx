import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AddressForm from '../../AddressForm'
import { rowToAddress, type AddressRow } from '@/lib/commerce/addresses'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '배송지 수정',
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ id: string }> }

export default async function EditAddressPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/mypage/addresses/${id}/edit`)

  const { data: row } = await supabase
    .from('addresses')
    .select(
      'id, user_id, label, recipient_name, phone, zip, address, address_detail, is_default, created_at, updated_at',
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!row) notFound()

  const initial = rowToAddress(row as AddressRow)
  return <AddressForm mode="edit" initial={initial} />
}
