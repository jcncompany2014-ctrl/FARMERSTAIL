/**
 * SubscriptionCard — 개별 정기배송 카드 (상태 헤더 + 결제 실패 배너 + 상품 라인 +
 * meta strip + 배송 알림 토글 + 액션 버튼들).
 *
 * 2026-07-16: '배송 주기 변경(매주/2주/4주)' 패널 제거 — 박스가 14일치 고정이라
 * 매주=음식 두 배, 4주=2주 뒤 굶음. 옛 낱개 커머스 잔재였다. 건너뛰기도 2주 하나로.
 *
 * 분할 (2026-05-27): SubscriptionsClient.tsx 의 sub.map() 내부 전체를 추출.
 * 시각 / 동작 동일. 모든 mutation handler 는 부모에서 prop 으로 받음.
 */
'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  Soup,
  Pause,
  Play,
  Bell,
  BellOff,
  AlertTriangle,
  CreditCard,
  Clock,
} from 'lucide-react'
import {
  V3,
  V3FontWeight,
  V3Radius,
} from '@/lib/design/tokens'
import { Mono, Badge } from '@/components/v3'
import type { Subscription } from '../SubscriptionsClient'
import { freshTierLabel } from '@/lib/subscription/freshTier'
import {
  STATUS_MAP,
  formatRetryAt,
} from '@/lib/v3-helpers/subscriptions'

type Props = {
  sub: Subscription
  isLoading: boolean
  onPause: (subId: string, weeks?: 1 | 2 | 4) => void
  onResume: (subId: string) => void
  onStartCancel: (subId: string) => void
  onToggleReminder: (subId: string, enabled: boolean) => void
  onChangeReminderDays: (subId: string, days: number) => void
  onReRegisterCard: (sub: Subscription) => void
}

export default function SubscriptionCard({
  sub,
  isLoading,
  onPause,
  onResume,
  onStartCancel,
  onToggleReminder,
  onChangeReminderDays,
  onReRegisterCard,
}: Props) {
  const status = STATUS_MAP[sub.status] || STATUS_MAP.active
  const isActive = sub.status === 'active'
  const isPaused = sub.status === 'paused'
  const isCancelled = sub.status === 'cancelled'

  const needsRenewal = sub.requires_billing_key_renewal === true
  const hasFailureSignal =
    !isCancelled &&
    (needsRenewal ||
      (sub.failed_charge_count ?? 0) > 0 ||
      !!sub.next_retry_at)

  const statusToneColor =
    status.tone === 'sage'
      ? V3.sage
      : status.tone === 'yellow'
        ? V3.yellow
        : V3.inkMute

  return (
    <div
      key={sub.id}
      id={`sub-${sub.id}`}
      style={{
        background: V3.paperHi,
        border: `1px solid ${needsRenewal ? V3.sale : V3.rule}`,
        borderRadius: V3Radius.sm,
        overflow: 'hidden',
        opacity: isCancelled ? 0.55 : 1,
        transition: 'box-shadow 0.25s ease-out',
      }}
    >
      {/* Status header */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '10px 16px',
          borderBottom: `1px solid ${V3.rule}`,
          background: V3.paper,
        }}
      >
        <div className="flex items-center" style={{ gap: 8, flex: 1, minWidth: 0 }}>
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: statusToneColor,
            }}
          />
          <Mono color={status.tone} size="xxs" weight={700}>
            {status.label}
          </Mono>
          {sub.dogs && (
            <Link
              href={`/dogs/${sub.dogs.id}`}
              style={{ textDecoration: 'none' }}
            >
              <Badge tone="ink" shape="pill" size="sm" upper={false}>
                🐶 {sub.dogs.name}
              </Badge>
            </Link>
          )}
          {sub.coverage_weeks && (
            <Badge tone="ink" shape="pill" size="sm" upper={false}>
              {freshTierLabel(sub.fresh_ratio, sub.coverage_weeks)}
            </Badge>
          )}
        </div>
        {sub.next_delivery_date && (
          <Mono
            color="inkMute"
            size="xxs"
            weight={500}
            letterSpacing="0.08em"
          >
            D ·{' '}
            {new Date(sub.next_delivery_date).toLocaleDateString(
              'ko-KR',
              { month: 'long', day: 'numeric' }
            )}
          </Mono>
        )}
      </div>

      {/* Failure signal banner */}
      {hasFailureSignal && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${needsRenewal ? V3.sale : V3.yellow}`,
            background: needsRenewal
              ? 'color-mix(in srgb, ' + V3.sale + ' 8%, transparent)'
              : 'color-mix(in srgb, ' + V3.yellow + ' 12%, transparent)',
          }}
        >
          <div className="flex items-start" style={{ gap: 8 }}>
            <AlertTriangle
              size={16}
              color={needsRenewal ? V3.sale : V3.yellow}
              strokeWidth={2.2}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <div className="flex-1 min-w-0">
              <div
                style={{
                  fontSize: 12,
                  fontWeight: V3FontWeight.bold,
                  color: needsRenewal ? V3.sale : V3.ink,
                }}
              >
                {needsRenewal
                  ? '카드 정보를 다시 등록해 주세요'
                  : sub.next_retry_at
                    ? '결제가 일시 실패했어요'
                    : `결제 ${sub.failed_charge_count}회 실패`}
              </div>
              {sub.last_failed_charge_reason && (
                <div
                  style={{
                    fontSize: 10.5,
                    color: V3.inkMute,
                    marginTop: 2,
                    lineHeight: 1.4,
                  }}
                >
                  사유: {sub.last_failed_charge_reason}
                </div>
              )}
              {sub.next_retry_at && !needsRenewal && (
                <div
                  className="inline-flex items-center"
                  style={{
                    fontSize: 10.5,
                    color: V3.inkMute,
                    marginTop: 4,
                    gap: 4,
                  }}
                >
                  <Clock size={11} strokeWidth={2} />
                  {formatRetryAt(sub.next_retry_at)} 자동 재시도
                </div>
              )}
            </div>
            {(needsRenewal ||
              (sub.failed_charge_count ?? 0) >= 2) && (
              <button
                type="button"
                onClick={() => onReRegisterCard(sub)}
                disabled={isLoading}
                className="shrink-0 inline-flex items-center transition disabled:opacity-50"
                style={{
                  gap: 4,
                  padding: '6px 10px',
                  borderRadius: V3Radius.xs,
                  fontSize: 10.5,
                  fontWeight: V3FontWeight.bold,
                  color: V3.paperHi,
                  background: V3.sale,
                  border: 'none',
                }}
              >
                <CreditCard size={12} strokeWidth={2.5} />
                재등록
              </button>
            )}
          </div>
        </div>
      )}

      {/* Card body */}
      <div style={{ padding: '16px' }}>
        {sub.subscription_items.map((item, i) => (
          <div
            key={i}
            className="flex items-center"
            style={{ gap: 12, marginBottom: i < sub.subscription_items.length - 1 ? 8 : 0 }}
          >
            <div
              className="relative overflow-hidden flex-shrink-0"
              style={{
                width: 56,
                height: 56,
                borderRadius: V3Radius.xs,
                border: `1px solid ${V3.rule}`,
                background: V3.paper,
              }}
            >
              {item.product_image_url ? (
                <Image
                  src={item.product_image_url}
                  alt={item.product_name}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Soup size={20} color={V3.inkMute} strokeWidth={1.5} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="truncate"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13.5,
                  fontWeight: V3FontWeight.bold,
                  color: V3.ink,
                  letterSpacing: '-0.015em',
                }}
              >
                {item.product_name}
              </div>
              <Mono
                color="inkMute"
                size="xxs"
                weight={500}
                letterSpacing="0.04em"
                style={{ marginTop: 3, display: 'inline-block' }}
              >
                {item.unit_price.toLocaleString()}원 × {item.quantity}개
              </Mono>
            </div>
            <div className="text-right flex-shrink-0">
              <span
                className="tabular-nums"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13.5,
                  fontWeight: V3FontWeight.black,
                  color: V3.accent,
                  letterSpacing: '-0.02em',
                }}
              >
                {(item.unit_price * item.quantity).toLocaleString()}원
              </span>
            </div>
          </div>
        ))}

        {/* Meta strip */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: `1px solid ${V3.rule}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: 10.5,
          }}
        >
          <div className="flex justify-between">
            <span style={{ color: V3.inkMute }}>배송 주기</span>
            <span style={{ fontWeight: V3FontWeight.bold, color: V3.ink }}>
              2주마다
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: V3.inkMute }}>회당 결제</span>
            <span style={{ fontWeight: V3FontWeight.bold, color: V3.ink }}>
              {sub.total_amount.toLocaleString()}원
              {sub.shipping_fee === 0 && (
                <span style={{ marginLeft: 4, fontSize: 10.5, color: V3.sage }}>
                  (배송비 무료)
                </span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: V3.inkMute }}>누적 배송</span>
            <span style={{ fontWeight: V3FontWeight.bold, color: V3.ink }}>
              {sub.total_deliveries}회
            </span>
          </div>
        </div>

        {/* 배송 주기 변경 패널 제거 (2026-07-16) — 박스는 14일치 고정이라
            매주로 바꾸면 음식이 두 배로 오고 4주로 바꾸면 2주 뒤에 굶는다.
            옛 낱개 커머스 모델의 잔재. interval_weeks 는 2 하드코딩. */}

        {/* Reminder toggle */}
        {!isCancelled && (
          <div
            style={{
              marginTop: 14,
              padding: '12px 14px',
              background: V3.paper,
              borderRadius: V3Radius.sm,
              border: `1px solid ${V3.rule}`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center" style={{ gap: 8 }}>
                {sub.reminder_enabled ? (
                  <Bell size={14} color={V3.accent} strokeWidth={2} />
                ) : (
                  <BellOff size={14} color={V3.inkMute} strokeWidth={2} />
                )}
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: V3FontWeight.bold,
                    color: V3.ink,
                  }}
                >
                  배송 알림
                </span>
              </div>
              <button
                onClick={() =>
                  onToggleReminder(sub.id, !sub.reminder_enabled)
                }
                disabled={isLoading}
                className="relative inline-flex items-center disabled:opacity-50"
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: sub.reminder_enabled ? V3.sage : V3.rule,
                  border: 'none',
                  transition: 'background 160ms',
                }}
                aria-label="배송 알림 토글"
                role="switch"
                aria-checked={sub.reminder_enabled}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: sub.reminder_enabled ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    background: V3.paperHi,
                    transition: 'left 160ms',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                  }}
                />
              </button>
            </div>
            {sub.reminder_enabled && (
              <div
                className="flex items-center"
                style={{ marginTop: 8, gap: 6 }}
              >
                <Mono color="inkMute" size="xxs" weight={500}>
                  D-
                </Mono>
                {[1, 2, 3, 5].map((d) => (
                  <button
                    key={d}
                    onClick={() => onChangeReminderDays(sub.id, d)}
                    disabled={isLoading}
                    aria-pressed={sub.reminder_days_before === d}
                    style={{
                      width: 28,
                      height: 24,
                      borderRadius: V3Radius.xs,
                      fontSize: 10.5,
                      fontWeight: V3FontWeight.bold,
                      background:
                        sub.reminder_days_before === d
                          ? V3.sage
                          : V3.paperHi,
                      color:
                        sub.reminder_days_before === d
                          ? V3.paperHi
                          : V3.inkMute,
                      border:
                        sub.reminder_days_before === d
                          ? 'none'
                          : `1px solid ${V3.rule}`,
                      transition: 'all 160ms',
                    }}
                  >
                    {d}
                  </button>
                ))}
                <Mono color="inkMute" size="xxs" weight={500} style={{ marginLeft: 4 }}>
                  일 전
                </Mono>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {!isCancelled && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {isActive && (
              <>
                {/* 건너뛰기는 2주(=한 사이클)만. 1주/4주는 14일치 박스와
                    안 맞고 화요일 발송 정렬도 깨진다(2026-07-16). */}
                <button
                  onClick={() => onPause(sub.id, 2)}
                  disabled={isLoading}
                  className="w-full transition disabled:opacity-50"
                  style={{
                    padding: '8px 0',
                    borderRadius: V3Radius.xs,
                    border: `1px solid ${V3.rule}`,
                    background: V3.paper,
                    fontSize: 10.5,
                    fontWeight: V3FontWeight.bold,
                    color: V3.ink,
                  }}
                >
                  다음 배송 2주 미루기
                </button>
                <div className="flex" style={{ gap: 8 }}>
                  <button
                    onClick={() => onPause(sub.id)}
                    disabled={isLoading}
                    className="flex-1 inline-flex items-center justify-center transition disabled:opacity-50"
                    style={{
                      gap: 4,
                      padding: '10px 0',
                      borderRadius: V3Radius.sm,
                      fontSize: 10.5,
                      fontWeight: V3FontWeight.bold,
                      border: `1px solid ${V3.rule}`,
                      color: V3.inkMute,
                      background: V3.paperHi,
                    }}
                  >
                    {isLoading ? (
                      '처리 중...'
                    ) : (
                      <>
                        <Pause size={12} strokeWidth={2.5} />
                        일시정지
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => onStartCancel(sub.id)}
                    disabled={isLoading}
                    className="transition disabled:opacity-50"
                    style={{
                      padding: '10px 14px',
                      borderRadius: V3Radius.sm,
                      fontSize: 10.5,
                      fontWeight: V3FontWeight.bold,
                      border: `1px solid ${V3.rule}`,
                      color: V3.sale,
                      background: V3.paperHi,
                    }}
                  >
                    해지
                  </button>
                </div>
              </>
            )}
            {isPaused && (
              <div className="flex" style={{ gap: 8 }}>
                <button
                  onClick={() => onResume(sub.id)}
                  disabled={isLoading}
                  className="flex-1 inline-flex items-center justify-center transition disabled:opacity-50"
                  style={{
                    gap: 4,
                    padding: '10px 0',
                    borderRadius: V3Radius.sm,
                    fontSize: 10.5,
                    fontWeight: V3FontWeight.bold,
                    border: `1.5px solid ${V3.sage}`,
                    color: V3.sage,
                    background:
                      'color-mix(in srgb, ' + V3.sage + ' 10%, transparent)',
                  }}
                >
                  {isLoading ? (
                    '처리 중...'
                  ) : (
                    <>
                      <Play size={12} strokeWidth={2.5} />
                      다시 시작
                    </>
                  )}
                </button>
                <button
                  onClick={() => onStartCancel(sub.id)}
                  disabled={isLoading}
                  className="transition disabled:opacity-50"
                  style={{
                    padding: '10px 18px',
                    borderRadius: V3Radius.sm,
                    fontSize: 10.5,
                    fontWeight: V3FontWeight.bold,
                    border: `1px solid ${V3.rule}`,
                    color: V3.sale,
                    background: V3.paperHi,
                  }}
                >
                  해지
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
