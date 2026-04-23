/**
 * Farmer's Tail — ErrorScreen 공통 레이아웃.
 *
 * 404 / 500 / route-segment error / maintenance / forbidden 등 "뭔가 안 되는
 * 상태"에서 공통으로 쓰는 editorial error 레이아웃. 톤:
 *   - 에러를 적대적으로 표현하지 않는다. 작은 아이콘 + kicker + 본문.
 *   - 사용자가 막다른 길에서 이탈하지 않도록 CTA를 2~3개까지 노출.
 *   - 오류 digest(있다면)를 monospace로 보여주고 "복사" 버튼 제공 —
 *     고객센터 문의 시 이 ID로 Sentry를 바로 조회할 수 있다.
 *
 * 코드·카피는 page별(`not-found.tsx`, `error.tsx`)로 thin wrapper가
 * 담당하고, 공통 껍데기만 여기에 둔다.
 *
 * # 사용
 *
 *   <ErrorScreen
 *     code="404"
 *     kicker="Wandering · 길을 잃으셨어요"
 *     title="찾으시는 페이지가 없어요"
 *     description="주소가 잘못됐거나 페이지가 옮겨졌을 수 있어요."
 *     icon={<Compass className="w-6 h-6" strokeWidth={2} />}
 *     primary={{ label: '홈으로', href: '/' }}
 *     secondary={{ label: '제품 둘러보기', href: '/products' }}
 *   />
 */
'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/ui/cn'

export interface ErrorScreenAction {
  label: string
  href?: string
  onClick?: () => void
}

export interface ErrorScreenProps {
  /** 큰 "404" / "500" numeral. undefined면 숨김. */
  code?: string
  /** 상단 mono 스타일 섹션 라벨 — kicker 그대로 사용. */
  kicker?: ReactNode
  /** h1 제목 */
  title: ReactNode
  /** 본문 설명 — 한두 줄 */
  description?: ReactNode
  /** 상단 원형 아이콘. sale/terracotta/moss 중 테마 픽. */
  icon?: ReactNode
  /** 아이콘 배경 톤. 기본 terracotta. */
  tone?: 'terracotta' | 'sale' | 'moss' | 'gold'
  /** primary CTA */
  primary?: ErrorScreenAction
  /** secondary CTA */
  secondary?: ErrorScreenAction
  /** Sentry digest 같은 trace id. 있으면 mono + copy 버튼. */
  traceId?: string
  /** 하단에 덧붙일 자유 콘텐츠 (ex. 고객센터 링크) */
  footer?: ReactNode
  className?: string
}

const toneClass: Record<NonNullable<ErrorScreenProps['tone']>, string> = {
  terracotta: 'bg-terracotta/10 text-terracotta',
  sale: 'bg-sale/10 text-sale',
  moss: 'bg-moss/15 text-moss',
  gold: 'bg-gold/20 text-[#8B6F2A]',
}

export function ErrorScreen({
  code,
  kicker,
  title,
  description,
  icon,
  tone = 'terracotta',
  primary,
  secondary,
  traceId,
  footer,
  className,
}: ErrorScreenProps) {
  return (
    <main
      className={cn(
        'min-h-[100dvh] bg-bg grain grain-soft',
        'flex flex-col items-center justify-center px-6 py-12',
        className
      )}
    >
      {/* Big code numeral — 에디토리얼 감성. code 없으면 숨김. */}
      {code && (
        <div
          aria-hidden
          className="text-[96px] leading-none font-black tracking-tight text-ink/10 select-none tnum"
        >
          {code}
        </div>
      )}

      {/* 원형 아이콘 — code 위에 살짝 겹치듯 올려 입체감. */}
      {icon && (
        <div
          className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center',
            'ring-1 ring-rule-2',
            code ? '-mt-6' : '',
            toneClass[tone]
          )}
        >
          {icon}
        </div>
      )}

      {kicker && (
        <div className="mt-5 kicker kicker-muted text-center break-keep">
          {kicker}
        </div>
      )}

      <h1 className="mt-2 text-[22px] font-black text-text tracking-tight text-center break-keep">
        {title}
      </h1>

      {description && (
        <p className="mt-2 text-[13px] text-muted text-center leading-relaxed max-w-xs break-keep">
          {description}
        </p>
      )}

      {traceId && <TraceIdBlock id={traceId} />}

      {(primary || secondary) && (
        <div className="mt-8 w-full max-w-xs flex flex-col gap-2">
          {primary && <ActionButton action={primary} variant="primary" />}
          {secondary && (
            <ActionButton action={secondary} variant="secondary" />
          )}
        </div>
      )}

      {footer && (
        <div className="mt-6 text-[12px] text-muted text-center break-keep">
          {footer}
        </div>
      )}
    </main>
  )
}

function ActionButton({
  action,
  variant,
}: {
  action: ErrorScreenAction
  variant: 'primary' | 'secondary'
}) {
  if (action.href) {
    return (
      <Button asChild variant={variant} size="lg" fullWidth>
        <Link href={action.href}>{action.label}</Link>
      </Button>
    )
  }
  return (
    <Button
      variant={variant}
      size="lg"
      fullWidth
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  )
}

/**
 * Trace ID 표시 + 복사. 지원팀이 가장 많이 받는 "오류가 떴어요" 메시지에서
 * 사용자가 이 값을 읽는 것보다 복사-붙여넣기가 정확해서 버튼 제공.
 */
function TraceIdBlock({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      // 시각적 피드백 초단기 유지 — ARIA live region 없이 버튼 아이콘만 변경.
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 클립보드 권한이 없으면 조용히 무시 — 사용자가 직접 드래그 복사 가능.
    }
  }
  return (
    <div className="mt-3 inline-flex items-center gap-1.5 text-[10.5px] font-mono text-muted">
      <span>오류 ID · {id}</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? '복사됨' : '오류 ID 복사'}
        className={cn(
          'inline-flex items-center justify-center w-5 h-5 rounded',
          'hover:bg-black/5 transition-colors',
          copied && 'text-moss'
        )}
      >
        {copied ? (
          <Check className="w-3 h-3" strokeWidth={2.5} aria-hidden />
        ) : (
          <Copy className="w-3 h-3" strokeWidth={2} aria-hidden />
        )}
      </button>
    </div>
  )
}
