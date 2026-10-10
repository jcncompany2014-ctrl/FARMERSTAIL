import AppStatusScreen from './AppStatusScreen'
import { NotFoundIcon } from './StatusIcons'

/**
 * 앱 안의 '없는 주소' 화면 — 시안 B05 (2026-10-09 'A 포스터').
 *
 * 두 곳이 같이 쓴다 — 두 벌이면 한쪽만 고쳐진다.
 *   ① app/(main)/not-found.tsx — 앱 화면 안에서 notFound() 가 불렸을 때
 *   ② app/not-found.tsx 의 앱 갈래 — 앱으로 온 요청이 어떤 라우트에도 안 맞을 때(앱 틀로 감싸서)
 *
 * 목적지는 로그인한 앱 사용자가 실제로 갈 곳(홈·우리 아이)만. 비로그인 설문 퍼널로 보내지 않는다
 * (그러면 설문을 다 해도 결과가 지워지는 순환 — 규칙53). 큰 '404' 같은 오류 번호는 보이지 않는다.
 */
export default function AppNotFoundScreen() {
  return (
    <AppStatusScreen
      icon={<NotFoundIcon />}
      title={'화면을 찾지\n못했어요'}
      body={'주소가 바뀌었거나,\n삭제된 기록일 수 있어요.'}
      primary={{ label: '홈으로 가기', href: '/dashboard' }}
      secondary={{ label: '우리 아이 목록 보기', href: '/dogs' }}
    />
  )
}
