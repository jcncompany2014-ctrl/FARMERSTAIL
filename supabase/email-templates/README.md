# Supabase Auth 이메일 템플릿 (한국어)

Supabase Auth 가 보내는 시스템 메일 (회원가입 confirmation, 비밀번호 재설정,
이메일 변경, 매직 링크) 의 한국어 템플릿. 운영 절차는 다음과 같다:

1. Supabase Dashboard → Authentication → Email Templates 진입.
2. 각 템플릿마다 이 폴더의 `.html` 파일 내용을 복붙.
3. Subject 도 동일 폴더의 동명 `.txt` 파일에서 복붙.

## 이 HTML 은 손으로 고치지 않는다 (2026-10-14)

`.html` 4개는 다른 메일과 같은 공용 틀(`lib/email/layout.ts` 의 `renderLayout`, 'A 포스터' 디자인)로
**만들어지는** 파일이다. 문구는 `lib/email/templates/auth.ts`, 모양은 `lib/email/layout.ts` 에 있다.
고친 뒤 다시 만들고, 바뀐 파일을 대시보드에 다시 붙여 넣는다:

```
node --experimental-strip-types scripts/build-email-auth-templates.ts
```

규칙225(`lib/audit-rules-1014-email.test.ts`)가 파일과 공용 틀의 결과가 같은지 본다 — 틀을 바꾸고
파일을 다시 안 만들면 빨간불이다.

## Variables

Supabase 가 자동 치환하는 변수:

- `{{ .ConfirmationURL }}` — 인증 완료 / 비밀번호 재설정 링크
- `{{ .Token }}` — OTP 6자리 (이메일 OTP 사용 시)
- `{{ .TokenHash }}` — magic link 용 hash
- `{{ .Email }}` — 수신자 이메일
- `{{ .SiteURL }}` — Authentication 설정에 등록된 site URL

링크 안의 `&` 는 HTML 규칙대로 `&amp;` 로 적힌다 — 메일 앱이 `&` 로 읽으므로 실제 주소는 같다.

## 디자인 원칙

- 거래성 이메일 톤 — "(광고)" 표기 X (정보통신망법 §50 제외 조항).
- 답장 가능: 발신자 이메일은 customer-support 별칭으로 (Settings → SMTP).
- 모양은 다른 모든 메일과 같다: 흰 바탕 · 먹색 #141414 글자 · 머스터드 #D4A24C 포인트 · 굵은 시스템 글꼴 제목 ·
  먹색 버튼 · 먹색 바닥 띠(사업자 정보 — `lib/business` 정본). 로고는 흰 바탕을 구운
  `https://www.farmerstail.kr/email/logo-ink-white.png`(다크 모드에서 안 사라진다) — **사이트 배포 뒤에** 붙여 넣는다.
- 만료 안내: 모든 링크는 **1시간** 후 만료 명시. (Supabase 는 이메일 OTP
  만료를 단일 설정 MAILER_OTP_EXP 로 confirmation·recovery·magic-link 에
  공유하므로 템플릿 문구가 서로 달라선 안 된다 — 2026-08-19 감사: confirm-signup
  이 24시간이라 적어 reset/magic 의 1시간과 모순이었다.)
  2026-10-14 사장님 "링크 만료 시간 통일" — change-email 의 "24시간 후 만료"도 1시간으로 맞췄다(4종 모두 1시간).

## 운영 메모

Supabase 무료 SMTP 는 일일 발송 30통 한도. 운영 트래픽 늘면 Resend / Postmark
custom SMTP 로 전환 (이미 코드 측은 lib/email 이 Resend 사용 중).
