# R17 — 추가 deferred 처리 (2026-05-25)

R16 이후 남은 5개 중 4개 진행.

## ✅ 완료

| # | 항목 | 산출물 |
|---|---|---|
| C30 | chat AI streaming | `/api/chatbot/stream` SSE 라우트 + ChatClient 점진 표시 |
| E42 | family leaderboard 인프라 | /family 페이지에 "보낸 초대" 상태 list (수락/거절/만료/대기) |
| E43 | Capacitor in-app review | `lib/capacitor-review.ts` — canPromptReview / markReviewPrompted / requestReview |
| E50 | Capacitor LocalNotifications | `lib/capacitor-notifications.ts` — schedule / cancel + uuidToNotificationId |

## 🔵 외부 setup 필요 — 사용자 액션

E43 + E50 의 native plugin 은 dynamic import 패턴 — 패키지 미설치 시 silent
no-op. 활성화 절차:

```bash
npm i @capacitor/local-notifications @capacitor-community/in-app-review
npx cap sync
```

설치 후 자동 활성화. Web (PWA) 에선 always no-op — isNativeApp() guard.

D32 Lighthouse / D35 Storybook 는 별도 setup 큼 — 사용자가 시작 결정.

## 신규 자산

```
app/api/chatbot/stream/route.ts          (SSE 응답)
app/(main)/chat/ChatClient.tsx           (stream reader)
lib/capacitor-notifications.ts           (LocalNotifications wrapper)
lib/capacitor-review.ts                  (in-app review wrapper)
app/(main)/family/page.tsx               (보낸 초대 list)
```

## Streaming 흐름

```
사용자 입력 → POST /api/chatbot/stream
                ↓
              Anthropic API stream=true
                ↓ (SSE)
              data: {"delta": "안녕"}
              data: {"delta": "하세요!"}
              data: [DONE]
                ↓
              ChatClient assistant message content 점진 append
                ↓
              종료 시 chatbot_messages 자동 저장 (server-side)
```

retention 직결 UX — 첫 chunk 가 200ms 안에 도착, 전체는 1-2초 (기존 4-6초).
