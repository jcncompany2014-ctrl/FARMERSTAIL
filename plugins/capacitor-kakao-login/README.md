# @farmerstail/capacitor-kakao-login (벤더링본)

카카오톡 **앱 전환 로그인** 플러그인. `@hanhokim/capacitor-kakao-login@8.0.0` 을
저장소 안으로 가져와 **SPM 으로 빌드되도록 고친 것**이다.

## 왜 npm 의존이 아니라 벤더링인가

원본의 `Package.swift` 로는 **빌드가 되지 않는다.** 두 가지가 빠져 있었다:

1. **카카오 SDK 의존성 누락** — `podspec` 에는 `KakaoSDKAuth/User/Common` 이
   선언돼 있는데 `Package.swift` 에는 없다. 소스는 `import KakaoSDKUser` 를 하므로
   SPM 경로에서는 컴파일 자체가 불가능하다(작성자가 CocoaPods 로만 테스트한 듯).
2. **product 이름 불일치** — Capacitor 는 npm 패키지명을 카멜케이스로 바꿔
   참조하는데(`@farmerstail/capacitor-kakao-login` → `FarmerstailCapacitorKakaoLogin`)
   원본은 다른 이름을 선언해 의존성 해석이 실패한다.

우리 iOS 프로젝트는 **CocoaPods 없이 SPM** 으로 만들어졌으므로(맥 이사 때 sudo 불가로
CocoaPods 설치를 포기, `docs/MAC_MIGRATION.md` 참조) 이 둘을 고치지 않으면 쓸 수 없다.

부수적으로, 로그인 경로에 들어가는 코드를 남의 npm 버전 갱신에 맡기지 않게 된다.

## 원본에서 바꾼 것

- `Package.swift` — 새로 작성(카카오 SDK 의존성 추가 + product 이름 정렬)
- `package.json` — 이름을 `@farmerstail/…` 로, `private: true`,
  불필요한 `@types/lodash` 의존 제거
- `ios/Tests/` 삭제(플러그인 템플릿의 빈 테스트)
- **Swift/JS 소스는 손대지 않았다** — 원본 그대로다.

## 알아둘 함정

- `prompt()` 는 **로그인 완료 전에 즉시 resolve** 한다. 결과는 `callback` 이벤트로
  따로 온다 → `lib/auth/kakaoNative.ts` 가 리스너를 먼저 걸고 promise 로 감싼다.
- `id_token` 이 없으면 **빈 문자열**을 준다(`oauthToken.idToken ?? ""`). 빈 값 가드
  없이 넘기면 "로그인은 됐는데 세션이 안 생기는" 조용한 실패가 된다.
- 앱 쪽 배선: `capacitor.config.ts` 의 `CapacitorKakaoLogin.app_key`,
  `Info.plist` 의 URL scheme·`LSApplicationQueriesSchemes`,
  `AppDelegate.swift` 의 `AuthApi.isKakaoTalkLoginUrl` 처리 — 셋 다 있어야 한다.

## 업데이트 방법

원본에 고칠 만한 변경이 생기면 `npm pack @hanhokim/capacitor-kakao-login@<버전>` 으로
받아 `ios/Sources` 와 `dist` 만 교체하고, **`Package.swift` 는 이 파일을 유지**한다
(원본 것으로 덮으면 위 두 문제가 되돌아온다).
