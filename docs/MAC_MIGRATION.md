# 맥 이사 안내서 (Windows → macOS)

> 2026-08-17 작성. 목적: iOS 앱 빌드(App Store)는 Xcode 가 필요해 macOS 에서만
> 가능하다. 이 문서는 "윈도우 PC 에만 있고 git 에 없는 것"의 전수 목록과
> 맥 셋업 순서다. 실측 기준: 이 시점 저장소는 클린(빌드 드리프트 sw.js 1개뿐),
> 서명 키 파일(.p8/.keystore)은 아직 어디에도 없다 — 맥에서 처음 만든다.

## 0. 요약 — 옮길 것

> ★2026-08-26 정정. 원래 이 절은 "옮길 것은 단 두 가지"였는데 **틀렸다.**
> **안드로이드 서명 키(.jks)가 빠져 있었다** — `android/.gitignore` 가 `*.jks` 와
> `keystore.properties` 를 막으므로 `git clone` 으로 오지 않는다. 맥 전체와 Vercel 을
> 뒤져 확인: 맥에는 없고 **윈도우 PC 에만 있다.** 이 문서를 믿고 윈도우를 정리하면
> 안드로이드 앱을 **다시는 업데이트할 수 없게 된다**(Play App Signing 이 켜져 있으면
> 구글에 업로드 키 재설정을 요청할 수는 있으나 심사·지연이 따른다).
> 작성 당시 `ios/`·`android/` 가 없던 상태라 놓친 것으로 보인다 — 지금은 둘 다 있다.

| 무엇 | 어떻게 |
|---|---|
| **`farmerstail-release.jks`(★저장소 최상위 — android/ 아님) + `android/keystore.properties`** | **git 에 없다. AirDrop/USB 로 직접 옮긴다.** 잃어버리면 안드로이드 업데이트 서명이 불가능하다 — 옮긴 뒤에도 1Password 등에 **별도 백업**할 것. 맥에서 안드로이드 릴리즈를 굽지 않을 거라면 최소한 백업만이라도 반드시. |
| **`android/app/google-services.json`** (FCM) | git 에 없다. **없어도 빌드는 성공하고 푸시만 조용히 죽는다** — `android/app/build.gradle` 이 try/catch 로 감싸 `logger.info` 한 줄만 남긴다. 맥에서 안드로이드 릴리즈를 구우면 **푸시 없는 APK 가 스토어에 올라간다.** 옮기거나, Firebase 콘솔에서 다시 받는다. |
| `.env.local` (26개 키) | **전송하지 말고 Vercel 에서 다시 받는 것을 권장** — 맥에서 `npx vercel login` → `npx vercel link` → `npx vercel env pull .env.local`. 받은 뒤 키 이름을 아래 목록과 대조해 빠진 것만 수동 보충. 수동으로 옮겨야 하면 **AirDrop/USB 만** — 카톡·메일 금지 |
| Claude Code 메모리 | `C:\Users\A\.claude\projects\C--Users-A-Desktop-projects\memory\` 폴더. 맥에서 프로젝트 폴더로 Claude Code 를 **한 번 실행**하면 `~/.claude/projects/<새-경로-슬러그>/` 가 생긴다 — 그 안에 memory 폴더 내용을 복사 (경로 기반 슬러그라 자동 이전이 안 된다) |

그 외 전부(코드 · android/ · supabase/migrations/ · docs/ · 이 파일)는 `git clone` 으로 온다.

## 1. .env.local 키 이름 대조표 (값은 이 문서에 절대 적지 않는다)

ANTHROPIC_API_KEY · NEXT_PUBLIC_BUSINESS_* (9개) · NEXT_PUBLIC_GA_ID ·
NEXT_PUBLIC_META_PIXEL_ID · NEXT_PUBLIC_SENTRY_DSN · NEXT_PUBLIC_SITE_URL ·
NEXT_PUBLIC_SUPABASE_ANON_KEY · NEXT_PUBLIC_SUPABASE_URL ·
NEXT_PUBLIC_TOSS_CLIENT_KEY · NEXT_PUBLIC_VAPID_PUBLIC_KEY ·
SENTRY_AUTH_TOKEN · SENTRY_ORG · SENTRY_PROJECT ·
SUPABASE_SERVICE_ROLE_KEY · TOSS_SECRET_KEY ·
VAPID_PRIVATE_KEY · VAPID_SUBJECT · VERCEL_OIDC_TOKEN(자동 생성 — 옮길 필요 없음)

## 2. 맥 셋업 순서 (위에서부터 차례로)

```bash
# ① 기본 도구
xcode-select --install                  # Command Line Tools (git 포함)
# App Store 에서 Xcode 설치 + 한 번 실행해 라이선스 동의

# ② Node 24 (package.json engines: ">=24")
brew install fnm && fnm install 24 && fnm default 24
node --version                          # v24.x 확인

# ③ 저장소
git clone https://github.com/jcncompany2014-ctrl/FARMERSTAIL.git farmerstail-app
cd farmerstail-app
npm install
npm run install:hooks                   # pre-commit/pre-push 훅 (필수 — 새 클론마다)

# ④ 환경변수 (위 0 절)
npx vercel login && npx vercel link && npx vercel env pull .env.local

# ⑤ 이사 완료 판정 — 이 두 개가 초록이면 끝
npm run verify                          # eslint + tsc + 테스트 + audit
npx next build                          # 프로덕션 빌드
```

## 3. iOS 플랫폼 생성 (맥에서만 가능 — 이사의 진짜 목적)

```bash
sudo gem install cocoapods              # 또는 brew install cocoapods
npx cap add ios                         # ios/ 폴더 최초 생성 → git 에 커밋
npx cap sync ios
npx cap open ios                        # Xcode 열림
```

- **Apple Developer Program 가입(연 $99)** 이 서명·APNs·TestFlight 전부의 선행
  조건 — 사장님 계정으로 가입한다.
- 인증서·프로비저닝은 Xcode "Automatically manage signing" 으로 시작한다.
- APNs Auth Key(.p8)는 developer.apple.com 에서 발급 → **Vercel 환경변수**
  (APNS_TEAM_ID / APNS_KEY_ID / APNS_PRIVATE_KEY / APNS_BUNDLE_ID)로 넣는다.
  lib/push/native.ts 가 읽는 이름들이다. 파일 자체를 repo 에 넣지 않는다.
- ⚠️ 미결 항목(감사에서 유예): capacitor.config 의 allowNavigation 에
  토스·Supabase 도메인이 없다 — 네이티브 앱에서 결제창이 막힐 수 있다.
  iOS 실기기에서 카드 등록 흐름을 처음 테스트할 때 함께 확인·수정할 것.

## 4. OS 차이로 놀랄 수 있는 것들

- **줄바꿈**: 윈도우에서 커밋된 파일은 LF 로 저장돼 있다(git 이 정리). 맥에선
  CRLF 경고 자체가 사라진다 — 정상.
- **셸**: 이 저장소의 스크립트는 전부 node(.mjs)와 npm 이라 OS 무관.
- **대소문자**: macOS 기본 파일시스템은 대소문자 구분 안 함(윈도우와 같음) —
  import 경로 문제 없음.
- **.claude/launch.json** 의 dev/prod 프리뷰 설정도 그대로 동작한다.

## 5. 윈도우 PC 는 언제까지 들고 있나

이사 완료 판정(2-⑤)이 초록이 되기 전까지는 윈도우 쪽을 지우지 않는다.
판정 후에도 `.env.local` 은 안전하게 파기(휴지통 X — 파일 완전 삭제)하고,
`C:\Users\A\Desktop\toss-ppt`(토스 심사 자료) 등 개인 파일만 따로 백업한다.

> ★2026-08-26 추가 — **판정이 초록이어도 아직 지우면 안 되는 것이 있다.**
> `npm run verify` + `next build` 는 **웹 빌드**만 본다. 안드로이드 서명 키처럼
> git 에 없고 빌드에도 안 쓰이는 파일은 **판정이 초록이어도 여전히 윈도우에만
> 있다.** 실제로 이사 당일 맥에 키스토어가 없는 채로 "이사 완료" 판정이 났다.
> 윈도우를 정리하기 전 체크리스트:
> - [x] `farmerstail-release.jks` 를 맥으로 옮기고 백업했다 — 2026-09-01 완료.
>       ★실제 위치는 **저장소 최상위**다(keystore.properties 의 storeFile=../).
>       ★최상위는 android/.gitignore 밖이라 **무시가 안 되고 있었다** — 루트
>       .gitignore 에 *.jks 추가로 봉인(공개 저장소라 add -A 한 번이면 유출이었다).
>       ★형식은 이름과 달리 JKS 가 아니라 **PKCS12** 다(요즘 keytool 기본값).
>       비밀번호·지문까지 검증: 스토어 등록 지문과 **일치** 확인.
> - [x] `android/keystore.properties` 도 함께 옮겼다 — 2026-09-01 완료
> - [x] `android/app/google-services.json` 옮김 — 2026-09-01 완료(패키지명 대조 확인)
> - [x] Claude Code 메모리 폴더를 옮겼다(위 0절) — 2026-08-25 완료
> - [x] 무시 규칙 전수 훑음(2026-09-01) — 캐시류 빼고 남는 후보는 둘뿐:
>       `*.pem`(프로젝트 폴더에 있으면 같이 옮길 것 — 보통은 없음),
>       `.claude-design/`(디자인 핸드오프 번들 — 필요하면 옮기고 아니면 버려도 됨).
>       나머지(.env·키·google-services)는 위에서 전부 처리됨.
>
> **맥에서 안드로이드를 빌드하기 전까지는** 위 세 파일이 없어도 아무 증상이 없다.
> 그래서 "이사 완료" 판정이 이 구멍을 못 잡는다 — 판정은 웹 빌드만 본다.
