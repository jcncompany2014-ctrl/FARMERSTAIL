/**
 * Farmer's Tail — zod 한국어 error map 설치.
 *
 * # 배경
 * zod v4는 `z.config({ localeError })`로 기본 에러 메시지 언어를 바꿀 수 있고
 * 공식 패키지에 `zod/v4/locales/ko`가 들어 있다. 앱 전체에서 zod 에러가 한 번
 * 파싱될 때 한글로 나와야 폼/서버 모두 일관된 UX를 가진다.
 *
 * # 사용법
 * 앱 부트 한 번만 import되면 된다. 클라이언트/서버 양쪽에서 zod 스키마가
 * parse되기 전에 평가돼야 하므로, 이 모듈은 **module-level side effect**로
 * z.config를 호출한다. import된 순간 설치됨.
 *
 *   import '@/lib/forms/zod-ko' // side-effect: ko errormap 설치
 *
 * 루트 `app/layout.tsx`와 서버 route handler의 최상단 `lib/env.ts` import
 * 체인에 포함시키는 게 가장 안전한데, Next가 `app/layout.tsx` import를 모든
 * 요청 진입점에서 평가하므로 실제로는 layout에 한 번만 얹어도 충분하다.
 *
 * # 노트
 * - zod v4의 `localeError`는 `customError`보다 우선순위가 낮아서 스키마 쪽
 *   `.refine({ message })` 같은 명시적 메시지는 그대로 이긴다.
 * - `z.coerce.number().min(1)` 같은 케이스에선 ko locale이 "1 이상" 형태의
 *   메시지를 생성해 준다. 커스텀 override 필요한 자리만 `.message(...)`로.
 */
import { z } from 'zod'
import { ko } from 'zod/v4/locales'

// `ko()`는 이미 `{ localeError: ... }` 형태의 config fragment를 반환한다.
// 따라서 `z.config(ko())`가 올바른 사용법 — 한 번 더 감싸면 타입 에러 남.
// 여러 번 import 돼도 config는 가장 마지막 호출이 이기므로 멱등하다.
z.config(ko())
