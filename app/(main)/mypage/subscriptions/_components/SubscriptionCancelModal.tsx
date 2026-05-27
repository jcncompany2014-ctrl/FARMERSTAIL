/**
 * SubscriptionCancelModal — 정기배송 해지 확인 modal.
 *
 * 분할 (2026-05-27): SubscriptionsClient.tsx 에서 추출. 시각 / 동작 동일.
 * R10-3b: browser confirm() 대체.
 */
'use client'

import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'
import { Modal } from '@/components/v3'

type Props = {
  cancelSubId: string | null
  actionLoading: string | null
  onClose: () => void
  onConfirm: (subId: string) => void
}

export default function SubscriptionCancelModal({
  cancelSubId,
  actionLoading,
  onClose,
  onConfirm,
}: Props) {
  const isLoading = actionLoading === cancelSubId
  return (
    <Modal
      open={cancelSubId !== null}
      onClose={() => {
        if (isLoading) return
        onClose()
      }}
      title="정기배송을 해지할까요?"
      dismissOnBackdrop={!isLoading}
      showClose={!isLoading}
    >
      <Modal.Body>
        해지 후에는 다시 신청해야 해요. 진행 중인 회차도 더 이상 배송되지 않아요.
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          style={{
            padding: '10px 18px',
            borderRadius: V3Radius.sm,
            fontSize: 12.5,
            fontWeight: V3FontWeight.bold,
            background: V3.paperHi,
            color: V3.inkMute,
            border: `1px solid ${V3.rule}`,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          아니요
        </button>
        <button
          type="button"
          onClick={() => cancelSubId && onConfirm(cancelSubId)}
          disabled={isLoading}
          style={{
            padding: '10px 18px',
            borderRadius: V3Radius.sm,
            fontSize: 12.5,
            fontWeight: V3FontWeight.bold,
            background: V3.sale,
            color: V3.paperHi,
            border: 'none',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? '해지 중…' : '해지하기'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}
