/**
 * /start 알레르기 영문 키 → 앱 설문 정본 한글 라벨 (2026-07-29 최종감사 #0).
 *
 * # 무슨 버그였나
 * /start 익명 설문은 알레르기를 v:'chicken'|'beef'|... **영문 키**로 저장하고,
 * 티저(lib/start-teaser)는 그 키로 자체 계산한다 — 티저까지는 정상.
 * 문제는 가입 이관(applyAutosignupDraft): health 는 한글로 번역하면서
 * **allergies 는 영문 키 그대로 surveys.answers 에 저장**했다.
 *
 * 그런데 알레르기 차단 게이트 전부 — v2 filterByAllergies · v3 excludeIfAllergy ·
 * compute 5.5c 누출감지 · progression cycle2+ 게이트 — 는
 * SKU_MODEL.blockingAllergies 의 **한글 라벨**('닭·칠면조' 등)과 정확 문자열
 * 비교를 한다. 즉 웹 퍼널(인스타·QR = 주 유입 경로)로 들어온 모든 고객의
 * 알레르기가 조용히 무시돼 **알레르기 성분이 배송될 수 있었다.**
 * 4종 전부 알레르기여도 상담 게이트가 안 걸리고 결제까지 통과했다.
 *
 * # 규칙
 * 라벨은 앱 설문 정본(app/(main)/dogs/[id]/survey/steps/Allergy.tsx 의
 * ALLERGY_OPTIONS)과 **글자 단위로 일치**해야 한다 — 게이트가 정확 비교라서.
 * /start 설문(StartSurvey.tsx allergy 스텝)에 단백질 키를 추가하면 여기에도
 * 추가할 것 — lib/start-allergy-labels.test.ts 가 두 목록의 정합을 고정한다.
 * 모르는 키는 버리지 않고 그대로 통과시킨다(없어지는 것보다 남는 게 안전).
 */
export const START_ALLERGY_KR: Record<string, string> = {
  chicken: '닭·칠면조',
  beef: '소고기',
  duck: '오리',
  pork: '돼지고기',
  salmon: '연어·생선',
  lamb: '양고기',
}

/** /start 영문 키 배열 → 정본 한글 라벨 배열. */
export function translateDraftAllergies(keys: string[]): string[] {
  return keys.map((k) => START_ALLERGY_KR[k] ?? k)
}
