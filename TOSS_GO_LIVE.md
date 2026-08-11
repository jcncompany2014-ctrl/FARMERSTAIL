# Toss 운영 전환 — 이 순서대로 (2026-08-11 갱신)

> 상태: **✅ 심사 통과** (2026-08-11 확인). 빌링 = **카드 전용**(토스 확정 —
> 계좌이체·간편결제 미지원, 토스페이 제거됨 `2ed499d`). Vercel Pro ✅.
> go-live 6각도 감사 + 수정 9건 배포 완료(`4e1b7be` — 환불 멱등키 한글 버그 포함).
> 아래만 끝내면 실결제 ON.

## 0. 키 찾는 곳 — ★"API 개별 연동 키" 섹션만

토스 개발자센터 → API 키 → **라이브** 탭 → **"API 개별 연동 키"**
(MID `bill_farme2odr`, 자동결제(빌링) 태그) 아래 두 개:

| 토스 화면 | 접두사 | → Vercel 변수 |
|---|---|---|
| 클라이언트 키 | `live_ck_` | `NEXT_PUBLIC_TOSS_CLIENT_KEY` |
| 시크릿 키 (보기→복사) | `live_sk_` | `TOSS_SECRET_KEY` |

- ⛔ **"결제위젯 연동 키"(`live_gck_`/`live_gsk_`) 아님** — 우리는 위젯 안 씀.
  `g` 붙은 키를 넣으면 결제창이 안 열린다.
- ⛔ 보안 키·머트 키 무시. **재발급 버튼 절대 누르지 말 것**(키가 바뀐다).

## 1. Vercel 환경변수 — Production 에만 라이브, Preview 는 테스트 유지

Vercel → farmerstail → Settings → Environment Variables

1. `TOSS_SECRET_KEY` Edit → **Production 만 체크** → `live_sk_...` →
   **Sensitive 체크** → Save.
2. Add 로 같은 이름 하나 더 → `test_sk_...` → **Preview + Development** → Sensitive → Save.
3. `NEXT_PUBLIC_TOSS_CLIENT_KEY` 도 같은 방식(Production=`live_ck_`,
   Preview/Dev=`test_ck_`). 공개키라 Sensitive 불필요.
4. ★저장 후 **반드시 재배포** (Deployments → 최신 → Redeploy).
   NEXT_PUBLIC_ 은 빌드에 박혀서 재배포 없이는 옛 키 그대로다.

> 왜 나누나: Preview 에 라이브키가 있으면 미리보기에서 테스트하다 **진짜 돈**이
> 나간다(lib/payments/key-mode.ts 상단 주석의 사고 유형 ③).

## 2. Toss 콘솔(상점관리자) 설정 — 키와 별개, 빼먹으면 정기결제 전부 실패

- **정기결제(빌링) 사용 신청/활성화** ← 최우선. 문의: ☎ 1544-7772.
- **웹훅 URL 등록**: `https://www.farmerstail.kr/api/payments/webhook`
  (★www 포함 — apex 는 307 리다이렉트라 웹훅이 유실될 수 있다)
- **billingAuth 성공/실패 URL**:
  - 성공: `https://www.farmerstail.kr/subscribe/billing-success`
  - 실패: `https://www.farmerstail.kr/subscribe/billing-fail`
- **환불/취소 권한 활성** 확인.

## 3. 전환 후 검증 (순서대로, 전부)

1. `https://www.farmerstail.kr/admin` 최상단 배너 → **✅ "실결제 모드예요"**.
   - ⚠️ "테스트 모드" = 키가 test 이거나 재배포 안 됨. 🚨 "짝이 안 맞아요" = 한쪽만 교체됨.
2. `https://www.farmerstail.kr/api/health` → `toss: true`.
3. ★**토스 개발자센터 → 웹훅 → 테스트 발송** → 응답 200 확인.
   - 실패(403/타임아웃)면 Vercel Firewall/봇차단이 웹훅을 막는 것 —
     `/api/payments/webhook` 경로 bypass 예외를 넣어야 한다(개발자에게).
4. **소액 실결제 1건** — 본인 계정으로 설문→주문→본인 카드 등록.
   토스 상점관리자에 거래 표시 + admin 주문내역 생성 확인.
5. ★**환불 1건** — 방금 결제를 admin 에서 취소/환불. 카드사 취소 확인.
   (2026-08-11 환불 멱등키 버그를 고친 경로의 실전 확인 — 반드시 밟을 것)
6. (빌링 사이클) 다음 청구 크론(KST 09:10)이 정상 도는지 다음날 admin/cron-health 확인.

## 4. 검증 끝난 뒤 정리

- 테스트 구독·주문(전부 ian020529@* 계정, 2026-08-11 기준 9건) 일괄 정리 — 개발자에게.
- 실사 상품 사진 교체(사장님) → 판매 개시.

## 나중에 (출시 후, 판매 안 막음)

- 웹 푸시 VAPID 3종 등록(현재 알림이 메일로만 감) · Resend 도메인 인증(SPF/DKIM) 확인
- `ANTHROPIC_DAILY_CALL_CAP` 등록(AI 비용 상한) · 카카오 이메일 동의항목 ON
- 앱스토어 출시(iOS/Android 체크리스트 별도 문서)
