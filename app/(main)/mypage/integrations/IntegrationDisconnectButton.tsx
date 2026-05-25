'use client'

/**
 * IntegrationDisconnectButton — 연동 해제 client 컴포넌트.
 * POST /api/integrations/<provider>/disconnect 호출 후 router.refresh.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export default function IntegrationDisconnectButton({
  provider,
}: {
  provider: 'tractive'
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function handle() {
    if (busy) return
    setBusy(true)
    const res = await fetch(`/api/integrations/${provider}/disconnect`, {
      method: 'POST',
    })
    setBusy(false)
    if (!res.ok) {
      toast.error('해제 중 문제가 있었어요')
      return
    }
    toast.success('연동을 해제했어요')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold transition disabled:opacity-60"
      style={{
        background: 'var(--bg)',
        color: 'var(--ink)',
        border: '1px solid var(--rule)',
      }}
    >
      {busy ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <XCircle className="w-3 h-3" strokeWidth={2.4} />
      )}
      연동 해제
    </button>
  )
}
