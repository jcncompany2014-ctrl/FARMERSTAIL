/**
 * SubscriptionCancelModal — 정기배송 해지 확인 modal.
 *
 * 분할 (2026-05-27): SubscriptionsClient.tsx 에서 추출. 시각 / 동작 동일.
 * R10-3b: browser confirm() 대체.
 */
'use client'

import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'
import BottomSheet from '@/components/ui/BottomSheet'

type Props = {
  cancelSubId: string | null
  actionLoading: string | null
  onClose: () => void
  onConfirm: (subId: string) => void
  /** 해지 대신 다음 배송 4주 미루기 (off-ramp — 리텐션). */
  onSkipInstead: (subId: string) => void
  /** 해지 대신 일시정지 (off-ramp — 리텐션). */
  onPauseInstead: (subId: string) => void
}

export default function SubscriptionCancelModal({
  cancelSubId,
  actionLoading,
  onClose,
  onConfirm,
  onSkipInstead,
  onPauseInstead,
}: Props) {
  const isLoading = actionLoading === cancelSubId
  return (
    <BottomSheet
      open={cancelSubId !== null}
      onClose={() => {
        if (isLoading) return
        onClose()
      }}
      title="정기배송을 해지할까요?"
      dismissOnBackdrop={!isLoading}
    >
      <BottomSheet.Body>
        해지하면 진행 중인 회차도 더 이상 배송되지 않고, 다시 신청해야 해요.
        {/* off-ramp — 해지 전에 더 가벼운 대안을 먼저 제시 (리텐션). */}
        <div
          style={{
            marginTop: 14,
            padding: '12px 14px',
            background: V3.paperHi,
            borderRadius: V3Radius.sm,
            border: `1px solid ${V3.rule}`,
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              fontWeight: V3FontWeight.bold,
              color: V3.inkMute,
              marginBottom: 10,
            }}
          >
            잠깐, 이런 방법도 있어요
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => cancelSubId && onSkipInstead(cancelSubId)}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: V3Radius.sm,
                fontSize: 11.5,
                fontWeight: V3FontWeight.bold,
                background: V3.paper,
                color: V3.sage,
                border: `1px solid ${V3.sage}`,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1,
                lineHeight: 1.3,
              }}
            >
              다음 배송만
              <br />4주 미루기
            </button>
            <button
              type="button"
              onClick={() => cancelSubId && onPauseInstead(cancelSubId)}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: V3Radius.sm,
                fontSize: 11.5,
                fontWeight: V3FontWeight.bold,
                background: V3.paper,
                color: V3.sage,
                border: `1px solid ${V3.sage}`,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1,
                lineHeight: 1.3,
              }}
            >
              잠시
              <br />일시정지
            </button>
          </div>
        </div>
      </BottomSheet.Body>
      <BottomSheet.Footer>
        {/* R-feel: 시트 바닥 풀폭 버튼. '아니요'를 크게(머무르게 유도), '해지'는
            sale red 이되 동등 폭. */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '14px 18px',
              borderRadius: V3Radius.sm,
              fontSize: 14,
              fontWeight: V3FontWeight.bold,
              background: V3.ink,
              color: V3.paperHi,
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            계속 받을게요
          </button>
          <button
            type="button"
            onClick={() => cancelSubId && onConfirm(cancelSubId)}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '14px 18px',
              borderRadius: V3Radius.sm,
              fontSize: 14,
              fontWeight: V3FontWeight.bold,
              background: V3.paperHi,
              color: V3.sale,
              border: `1px solid ${V3.sale}`,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? '해지 중…' : '해지하기'}
          </button>
        </div>
      </BottomSheet.Footer>
    </BottomSheet>
  )
}
