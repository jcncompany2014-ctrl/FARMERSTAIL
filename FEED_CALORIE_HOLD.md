# ✅ 해제 완료 — 급여량 칼로리 상수 확정 반영 (2026-07-11)

**상태: 해제·반영 완료.** 사장님이 동업자와 단가 확정 후 최종 kcal 확정값을 지시
(2026-07-11): **닭·돼지 115, 오리·소 120 kcal/100g** (연어는 게이트드 SKU — 미확정 유지).

## 반영 내역 (코드 + DB 동시)
- `lib/personalization/skuModel.ts` — SSOT profile.kcalPer100g 4종 교체 (구 130/150/140/160)
- `lib/personalization/v3/catalog.ts` — BASE_SKUS kcal 4종 + claim 카피(닭 "최저 kcal 돼지와 동률",
  소 "최고 열량 160" 서사 → 지방 28.7%DM 최다 중심으로 교정)
- `lib/web-recipes.ts` — 웹 표기 kcal 4종 교체 (구 설계 168/190/177/206)
- `lib/mix-feeding.ts` — calculateMix 기본 1.9 → **1.175** (4종 평균 117.5)
- `lib/personalization/lines.ts` — dailyGramsFromMix fallback 1.45 → 1.175, 주석 갱신
- `lib/sku-nutrition-matrix.ts`·`lib/recipe-detail.ts` — "최저 130kcal"·"4종 중 가장 낮은
  열량대" 카피 교정 (닭·돼지 동률이라 단정 제거, 지방 중심 서사)
- 테스트 5개 갱신 (skuModel 정합·engine 그램 산식·간식 보정) — **1233 전부 그린**
- **DB `algorithm_food_lines`** kcal_per_100g 갱신 (weight/joint=115, basic/premium=120) —
  오버라이드가 코드보다 우선이라 필수였음

## 해제 체크리스트 결과
1. ✅ 활동계수 이중적용 없음 — MER은 nutrition.ts에서 1회(RER×FEDIAF 계수), calculateMix는 분배만
2. ✅ 상수 교체 — SKU별 확정값 + 박스 가중평균(dailyGramsFromMix) 구조 유지
3. ⏳ **가격 재산정 — 진행 중.** `lib/feeding-plan.ts:49` `HWASIK_KRW_PER_100G = 6500` 아직
   잠정값. 급여량이 ~1.6배로 정직해졌으므로 표시 일일비용도 그만큼 상승 — 확정 단가 대기
4. ✅ 카피 — kcal 서열 서사 교정 완료 (위)

## 검증 근거
- 5kg 평균활동 견 MER≈368kcal → full 화식 오리(1.2) = 307g/일 ≈ v3.1 급여표 320g(구 117 기준) 정합
- 닭 단독 400kcal → 348g (구 308g, +13%p 급여량 정상화)
