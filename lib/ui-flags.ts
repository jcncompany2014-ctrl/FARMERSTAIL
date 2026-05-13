/**
 * UI 부담 control flag — 초기 단계 단순 모드 / 출시 후 풀모드 토글.
 *
 * # 배경
 * 사용자가 처음 진입할 때 발명 기능 / 측정 도구 / OCR / 사진 부탁 등
 * 부가 옵션이 모두 보이면 정보 과다로 부담. 초기 단계엔 default OFF →
 * 핵심 흐름만 노출.
 *
 * # 환경변수
 *  NEXT_PUBLIC_SHOW_ADVANCED_INPUTS=on  → 측정 도구 / 상세 입력 UI
 *  NEXT_PUBLIC_SHOW_PHOTO_REQUEST=on    → 친구 사진 부탁 카드
 *  NEXT_PUBLIC_SHOW_OCR=on              → 진료 OCR
 *  NEXT_PUBLIC_SHOW_PHOTO_TIPS=on       → DogPhotoPicker 안내 + 촬영 팁
 *
 * default 모두 OFF. Vercel env 에서 'on' 설정 + redeploy 로 활성화.
 *
 * # 분리 이유 — INVENTION 과 다른 axis
 * INVENTION flag = PCT 출원 알고리즘 가드.
 * UI flag       = 사용자 부담 control.
 * 같은 기능도 두 flag 다 통과해야 동작.
 */

export type AdvancedUiFeature =
  | 'advanced_inputs' // 측정 도구 select + 상세 입력 폼
  | 'photo_request' // 친구 사진 부탁 카드
  | 'ocr' // 진료 영수증 OCR
  | 'photo_tips' // DogPhotoPicker 의 Lightbulb 안내 + 촬영 팁

export function isAdvancedUiEnabled(feature: AdvancedUiFeature): boolean {
  switch (feature) {
    case 'advanced_inputs':
      return process.env.NEXT_PUBLIC_SHOW_ADVANCED_INPUTS === 'on'
    case 'photo_request':
      return process.env.NEXT_PUBLIC_SHOW_PHOTO_REQUEST === 'on'
    case 'ocr':
      return process.env.NEXT_PUBLIC_SHOW_OCR === 'on'
    case 'photo_tips':
      return process.env.NEXT_PUBLIC_SHOW_PHOTO_TIPS === 'on'
  }
}
