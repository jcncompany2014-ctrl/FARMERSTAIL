'use client'

import { useEffect } from 'react'
import { RotateCw } from 'lucide-react'
import * as Sentry from '@sentry/nextjs'
import AppStatusScreen from '@/components/v3/system/AppStatusScreen'
import { AlertMarkIcon } from '@/components/v3/system/StatusIcons'

/**
 * (main) 그룹 전용 error boundary.
 *
 * 이 그룹은 AppChrome 으로 감싸진 모바일 앱 영역 (dashboard / dogs / mypage / etc).
 * 루트 error.tsx 로 떨어지면 phone-frame 사라지고 풀폭 데스크톱 layout 으로 보여
 * UX 가 어그러짐. 여기에 자체 error UI 를 두어 chrome 톤 유지.
 *
 * Sentry — 다른 segment 와 동일하게 명시 captureException + segment 태그.
 * Sentry SDK 의 자동 React Error Boundary 가 활성화돼 있어도 안전망으로 한
 * 번 더 호출 (자동 후킹 실패 시 알림 누락 방지, 다른 error.tsx 와 동일 패턴).
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 시안 B03) — 공용 상태 화면(components/v3/system/AppStatusScreen)
 * 으로 그린다. 예전 화면 아래의 'ref: 오류 번호' 줄은 뺐다(결정: 오류 화면에 문제 코드를 보이지 않는다 —
 * 고객이 읽을 수 없는 숫자다). 오류는 위 Sentry 호출과 서버 쪽 onRequestError 로 그대로 전달된다.
 * '다시 시도하기' = retry(서버에서 다시 불러옴 — reset 은 같은 오류를 다시 그린다, 규칙125).
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { segment: 'main' },
    })
  }, [error])

  return (
    <AppStatusScreen
      icon={<AlertMarkIcon />}
      title="문제가 생겼어요"
      body={'잠시 후 다시 시도해 주세요.\n계속 안 되면 ‘홈으로’를 눌러\n처음부터 다시 해 보세요.'}
      primary={{
        label: '다시 시도하기',
        icon: <RotateCw size={20} strokeWidth={2.4} aria-hidden />,
        onClick: retry,
      }}
      secondary={{ label: '홈으로', href: '/dashboard' }}
    />
  )
}
