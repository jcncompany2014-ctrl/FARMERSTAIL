# 전면 코드 감사 원장 — 2026-07-03

사장님 지시: "모든 부분 코드적으로 점검, 세세한 것까지 빠짐없이, 조금이라도 이상하면 전부 기록. 재량으로 고칠 건 고치고 버릴 건 버려라."

규칙: 발견 즉시 이 원장에 기록. 수정 시 배치별 `tsc/eslint/tests` 검증 후 커밋. 결제·인증·DB DDL은 신중(명백한 것만, 검증 필수).

표기: 🔴 실버그(수정) · 🟠 이상함(수정 or 결정필요) · 🟡 기록만(무해/사장님 결정) · 🟢 점검함(클린)

---

## 배치 1 — 최근 변경 자가 리뷰 + 정합성 크로스체크

- 🔴 **checkout/fail "결제 다시 시도하기" → /checkout 오링크 (수정)**: 어제 잔재 정리에서 내가 /cart→/checkout 으로 바꿨으나 /checkout 자체가 `redirect('/start')` 라 실패 사용자가 설문으로 떨어짐. 도달 경로 조사: /checkout/fail 은 checkout/success confirm 에러 redirect 전용(+휴면 인터랙티브 체크아웃), 카드등록 실패는 별도 /subscribe/billing-fail. → 주 CTA "주문 내역 확인하기"(/mypage/orders) 로 정정.
- 🟢 vercel.json 크론 등록 28 ↔ app/api/cron 라우트 28 — 양방향 일치 (cart-recovery·restock-alerts 제거 후 재검증).
- 🟢 **내부 링크 무결성 전수**: 라우트 150개 대비 정적 href 데드링크 **0** (일회용 스크립트 대조, 동적 세그먼트 매칭 포함).
- 🟢 **이미지 참조 ↔ public 실재**: 누락 1건 = Avatar docstring 예시(/dog.jpg, 비렌더) — 무해.
- 🟠 **SEO 구조화 데이터에 폐지 경로 (수정)**: ① 루트 layout 전 페이지에 나가던 WebSite JSON-LD 의 SearchAction 이 폐지된 `/products?q=` 를 target — 제거(구글도 2024-10 사이트링크 검색박스 종료). ② `buildProductJsonLd` 는 호출처 0 죽은 export + offer.url 이 `/products/[slug]` — 삭제(테스트 동반 정리). 구독 상품 LD 필요 시 /subscribe 기준 재설계.
- 🟢 휴리스틱: console.log **0** · TODO/FIXME/HACK **0** · @ts-ignore/expect-error **1**(테스트 의도) · `_dead_q4`/`_dead_referral` 소스 참조 **0**.
- 🟢 폐지 경로 라이브 링크: href 로 /products·/cart 등을 가리키는 실코드 0 (docstring 예시 2건뿐 — Button.tsx·Avatar.tsx, 비렌더 무해).
