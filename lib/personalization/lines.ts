/**
 * 5종 화식 라인 정의.
 *
 * 알고리즘 / UI 양쪽이 참조하는 SSOT. 새 라인 추가 시 여기와 firstBox.ts
 * 의 케어 목표 매핑만 손보면 됨. 실제 SKU (분량별 포장) 는 admin 이 별도로
 * products 테이블에 만들고, UI 가 line → SKU 조회.
 *
 * kcalPer100g 는 화식 5종 영양분석 보고서 v2 (2026-04) 의 이론값 평균.
 * 실제 batch 별 ±10% 변동 가능 — 박스 분량 산정 시 안전 마진 포함.
 */
import type { FoodLineMeta } from './types.ts'

/**
 * 라인별 영양 단면 (proteinPctDM, fatPctDM) 은 v2 batch 분석 평균.
 * 실제 batch 별 ±5% 변동 — 임상 룰 (췌장염 fat ceiling, IRIS CKD 단백질
 * 평가) 은 quantize 전에 합산해 안전 마진으로 간주.
 *
 * crossReactWith 는 한쪽이 알레르기일 때 다른 쪽도 위험 가능을 보호자에게
 * 알리는 chip — 차단은 안 함 (false positive 비용 큼).
 */
export const FOOD_LINE_META: Record<FoodLineMeta['line'], FoodLineMeta> = {
  basic: {
    line: 'basic',
    name: 'Basic',
    subtitle: '닭 · 균형식',
    mainProtein: 'chicken',
    blockingAllergies: ['닭·칠면조'],
    // 닭/칠면조 알레르기견의 ~30-50% 는 오리 cross-react 가능 (avian
    // livetin/parvalbumin 공유). 차단은 안 하되 chip 으로 알림.
    crossReactWith: [],
    benefit: '균형 잡힌 기본식, 모든 단계 적합',
    kcalPer100g: 215,
    proteinPctDM: 26,
    fatPctDM: 12,
    color: 'var(--terracotta)',
  },
  weight: {
    line: 'weight',
    name: 'Weight',
    subtitle: '오리 · 체중관리',
    mainProtein: 'duck',
    // 오리는 노블 프로틴 — 닭 알레르기 견의 옵션. 다만 오리 알레르기도 드물게
    // 보고됨. 사용자가 명시적으로 오리 표기하면 차단.
    blockingAllergies: [],
    crossReactWith: ['닭·칠면조'],
    benefit: '저칼로리 + 단호박, BCS 6+ 권장',
    kcalPer100g: 175,
    proteinPctDM: 28,
    fatPctDM: 8,
    color: 'var(--moss)',
  },
  skin: {
    line: 'skin',
    name: 'Skin',
    subtitle: '연어 · 피부·털',
    mainProtein: 'salmon',
    blockingAllergies: ['연어·생선'],
    // 연어 알레르기 ↔ 다른 어류 (참치/정어리) cross-react ~70-80% (Kuehn 2018).
    // chip 으로 "다른 어류 토퍼 주의" 알림.
    crossReactWith: [],
    benefit: '오메가-3 자체 공급, 피모 윤기',
    kcalPer100g: 225,
    proteinPctDM: 26,
    fatPctDM: 16,
    color: 'var(--gold)',
  },
  premium: {
    line: 'premium',
    name: 'Premium',
    subtitle: '소 · 활력·근육',
    mainProtein: 'beef',
    blockingAllergies: ['소고기'],
    // 소/양 BSA 부분 cross — 양고기 알레르기견은 소도 주의 (반대도).
    crossReactWith: ['양고기'],
    benefit: '헴 철분 + 아연, 활동량 많은 견',
    kcalPer100g: 195,
    proteinPctDM: 30,
    fatPctDM: 15,
    color: '#9B5B5B',
  },
  joint: {
    line: 'joint',
    name: 'Joint',
    subtitle: '돼지 · 관절·시니어',
    mainProtein: 'pork',
    blockingAllergies: ['돼지고기'],
    crossReactWith: [],
    benefit: 'B1·콜린 풍부, 인지·관절 케어',
    kcalPer100g: 200,
    proteinPctDM: 24,
    fatPctDM: 18,
    color: '#C97F8E',
  },
}

/** 모든 라인 — iteration 순서 안정. */
export const ALL_LINES: FoodLineMeta['line'][] = [
  'basic',
  'weight',
  'skin',
  'premium',
  'joint',
]

/** preferred_proteins (survey) → FoodLine 매핑.
 * 알고리즘이 "닭 좋아함" → Basic 가산점 같은 결정에 사용. */
export const PROTEIN_TO_LINE: Record<string, FoodLineMeta['line']> = {
  chicken: 'basic',
  duck: 'weight',
  salmon: 'skin',
  beef: 'premium',
  pork: 'joint',
}
