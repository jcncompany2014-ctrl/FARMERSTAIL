# Supabase Auth 이메일 템플릿 (한국어)

Supabase Auth 가 보내는 시스템 메일 (회원가입 confirmation, 비밀번호 재설정,
매직 링크) 의 한국어 템플릿. 운영 절차는 다음과 같다:

1. Supabase Dashboard → Authentication → Email Templates 진입.
2. 각 템플릿마다 이 폴더의 `.html` 파일 내용을 복붙.
3. Subject 도 동일 폴더의 동명 `.txt` 파일에서 복붙.

## Variables

Supabase 가 자동 치환하는 변수:

- `{{ .ConfirmationURL }}` — 인증 완료 / 비밀번호 재설정 링크
- `{{ .Token }}` — OTP 6자리 (이메일 OTP 사용 시)
- `{{ .TokenHash }}` — magic link 용 hash
- `{{ .Email }}` — 수신자 이메일
- `{{ .SiteURL }}` — Authentication 설정에 등록된 site URL

## 디자인 원칙

- 거래성 이메일 톤 — "(광고)" 표기 X (정보통신망법 §50 제외 조항).
- 답장 가능: 발신자 이메일은 customer-support 별칭으로 (Settings → SMTP).
- 모바일 친화: 단일 컬럼, 폰트 sans-serif, 본문 14px+.
- 브랜드: terracotta (#C66B3D) accent, ink (#1E1A14) 본문.
- 만료 안내: 모든 confirmation 링크는 24h 후 만료 명시.

## 운영 메모

Supabase 무료 SMTP 는 일일 발송 30통 한도. 운영 트래픽 늘면 Resend / Postmark
custom SMTP 로 전환 (이미 코드 측은 lib/email 이 Resend 사용 중).
