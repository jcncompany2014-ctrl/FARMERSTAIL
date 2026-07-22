# 🌙 밤샘 자율 루프 — 오류 점검 + 옛잔재 제거 (2026-07-23 시작)

> 사장님 지시(2026-07-23 새벽): "전체적인 오류 점검 + 옛잔재 제거, 자고 일어날 때까지 진행."
> **기준선 커밋: `9325799`** (이 뒤 커밋 = 밤샘 루프 산출물).
> 2계층 session-only 크론(L1 10분 작업 · L2 5시간 체크인)이 이 파일을 읽고 1스텝씩 무한.

## ✅ 정책 (사장님 확정 2026-07-23)
- **커밋+푸시(자동배포)**: 매 GREEN 변경마다 커밋+푸시. **pre-push CI(빌드) 통과가 게이트.**
  로컬 버그는 빌드가 못 잡으니 tsc+eslint+런타임 로직을 신중히.
- **잔재 제거 = 적극적**: 참조 0(grep 확인) + **정황상 안 쓰이는 것**(구 커머스 잔재 등)까지 삭제.
  단 **되돌리기 어려운 파괴적 삭제·미사용 불확실**은 삭제 말고 `AUDIT_FINDINGS.md`에 목록.

## ⛔ 불변 (절대 수정/삭제/실행 금지)
- 결제/체크아웃 로직(`app/checkout/**`·`app/cart/**` 계산·`lib/**` pricing/refund)
- `(auth)/**` 인증(login/signup·세션·redirect)
- DB `apply_migration`/`execute_sql`(운영 DB), `components/SiteFooter.tsx` 법정정보
- app/web dispatch(`ft_app`·`AuthAwareShell`·`isAppContextServer`)
- 정직성: 가짜 후기/수치·미검증 기관보증·레시피 배합% 노출 금지

## 🔁 매 firing 프로토콜 (1발동 = 1스텝, 작게)
1. **이 파일 §로그를 먼저 읽어** 최근 회차·중복 방지 확인(락 줄 참조).
2. **1스텝 선택**: 오류 1건(tsc/eslint/런타임 버그·정보 불일치·死링크·라벨 누락) 또는
   잔재 1건(참조 0/정황 미사용 코드·라우트·플래그·import). 파일 1~3개, 5~15분.
3. **검증(필수·파이프 금지)**: `cd /c/Users/A/Desktop/projects/farmerstail-app && npx tsc --noEmit && npx eslint <touched>` GREEN. 깨지면 고쳐 GREEN.
4. **커밋+푸시**: GREEN이면 커밋+푸시(pre-push CI 통과 확인). 애매/파괴적이면 AUDIT_FINDINGS 기록만.
5. **로그**: 아래 §로그에 `회차N: <무엇> (커밋 hash)` 1줄. 절대 "다 했다"로 멈추지 말 것.

### 동시발동 락
- 시작 시 §로그 맨 위에 `🔄 [회차N · ISO시각 · 무엇]`. 끝나면 완료 로그로 교체.
- 30분 안 지난 `🔄` 락 보이면 다른 항목/읽기전용 점검으로 회피.

---
## 📋 후보 (계속 갱신 — 발굴하며 추가)
- 오류: 정보 불일치(가격·kcal·화식비율·배송)·死링크·라벨 누락(raw enum)·중복 제목(앱 헤더)
- 잔재: 구 커머스(`/products`·`/cart`·`/checkout`·`/collections`·`/best`·`/new`·`/events` — 앱 redirect)·
  폐기 기능(쿠폰·포인트·위시리스트·referral·리뷰) 잔재·import 0 컴포넌트/lib·死플래그·死라우트

## 📝 진행 로그 (최신이 위)
- 회차2: 폐기 라우트 死참조 정리 — `/mypage/reviews`·`/mypage/points` 라우트 자체가 없는데
  (glob 확인) 라이브 참조 잔존. AppChrome DEEP_TITLES `/mypage/reviews` 엔트리 + app-required
  `/mypage/reviews` 라벨 제거(표시용, 매칭 라우트 없어 안전). tsc+eslint GREEN.
  ★남은 死참조: `proxy.ts:179-180`(/mypage/reviews·/mypage/points) — app/web dispatch 인접이라
  다음에 신중히(또는 findings). `_dead_q4/`·`_dead_referral/`는 이미 앱 밖 아카이브라 무해.
- 회차1(세팅+첫스텝): 2계층 크론(L1 576eeb04 10분·L2 ff07a639 5시간) 무장. mypage/page.tsx
  헤더 주석 정보불일치 정정("5 stat counts: orders/subs/points/wishlist/coupons" → 실제는
  orders·subs 2개, 나머지 폐지). 위시리스트 잔재는 전부 주석뿐(死코드 아님) 확인.
- (여기부터 회차별 1줄)
