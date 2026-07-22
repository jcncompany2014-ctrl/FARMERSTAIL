/**
 * 신뢰성 카피 — 수의사/영양사 '사람 개입' 뉘앙스 표현을 **한 곳에서 토글**.
 *
 * 사장님 2026-07-22: 아직 실제 자문 수의사/영양사가 없다 → 의료·면허(국가자격 영양사)
 * 오해 소지가 있는 "수의영양 자문 / 수의사 전문가 / VET-DEVELOPED" 표현을 **정직한
 * 방법론 카피**("수의영양학 가이드라인 기반 · NRC·AAFCO·FEDIAF 기준")로 톤다운한다.
 * 단 나중에 실제 자문을 맡기면 **즉시 복원**할 수 있게 플래그 하나로 전 위치를 되돌린다.
 *
 * ★★ 실제 자문 수의사/영양사 계약·검수를 확보하면: 아래 `VET_ADVISOR_ACTIVE = true` 로만
 *    바꾸면 전 마케팅 표면의 강한 카피가 **한 번에 복원**된다. (다른 파일 수정 불필요.)
 *
 * # 무엇이 '사람 개입' 표현이고 무엇이 정직 방법론인가
 *  · 톤다운 대상(이 모듈이 관리): "수의영양 자문", "수의사 전문가"(nav/footer), "VET-DEVELOPED"
 *    — 면허자가 설계·검수했다는 함의. 실제 없음 → 표시광고 리스크.
 *  · 유지(정직·이 모듈 밖): "수의영양학 기준/가이드라인 기반", "NRC·AAFCO·FEDIAF 적용"(공개
 *    학문·기준을 따랐다는 사실), "수의사와 상담하세요"(사용자에게 본인 주치의 권유)는 그대로.
 */

/** ★ 실제 자문 수의사/영양사 확보 시 true 로. 전 위치 카피가 강한 버전으로 복원된다. */
export const VET_ADVISOR_ACTIVE = false

type CredCopy = {
  /** 웹 nav / footer 의 /science 링크 라벨 */
  navVetLabel: string
  navVetEn: string
  /** 홈·our-food 의 'VET-DEVELOPED' 신뢰 카드 */
  recipeKicker: string
  recipeCardTitle: string
  recipeCardBody: string
  recipeCardBodyShort: string
  /** /brand 의 RECIPE 카드 */
  brandRecipeTitle: string
  brandRecipeBody: string
  /** reviews 페이지의 수의 자문 인용 슬롯 노출 여부 */
  showVetQuoteSlot: boolean
}

// 실제 자문 확보 시(VET_ADVISOR_ACTIVE=true) 복원되는 강한 카피 = 톤다운 이전 원문.
const STRONG: CredCopy = {
  navVetLabel: '수의사 전문가',
  navVetEn: 'Vet Pros',
  recipeKicker: 'VET-DEVELOPED',
  recipeCardTitle: '수의영양 설계',
  recipeCardBody:
    '수의영양 자문으로 단백질·지방·미네랄 비율을 표준 기준에 맞춰 설계.',
  recipeCardBodyShort: '수의영양 자문으로 영양 비율을 표준 기준에.',
  brandRecipeTitle: '수의영양학 자문 레시피',
  brandRecipeBody:
    '수의영양학 자문으로 단백질·지방·미네랄 비율을 맞춰 설계. 표준 영양 기준에 맞춘 배합으로 영양 격차 없이.',
  showVetQuoteSlot: true,
}

// 현재(자문 없음) — 정직한 방법론 카피. '사람'이 아니라 '공개 가이드라인'을 따랐다는 사실.
const TONED: CredCopy = {
  navVetLabel: '영양 근거',
  navVetEn: 'Science',
  recipeKicker: 'GUIDELINE-BASED',
  recipeCardTitle: '수의영양학 기준 설계',
  recipeCardBody:
    '수의영양학 가이드라인(NRC·AAFCO·FEDIAF)에 맞춰 단백질·지방·미네랄 비율을 설계.',
  recipeCardBodyShort:
    '수의영양학 가이드라인(NRC·AAFCO·FEDIAF)에 맞춰 영양 비율을 설계.',
  brandRecipeTitle: '수의영양학 기준 레시피',
  brandRecipeBody:
    '수의영양학 가이드라인(NRC·AAFCO·FEDIAF)의 권장 비율에 맞춰 단백질·지방·미네랄을 설계. 표준 영양 기준에 맞춘 배합으로 영양 격차 없이.',
  showVetQuoteSlot: false,
}

export const cred: CredCopy = VET_ADVISOR_ACTIVE ? STRONG : TONED
