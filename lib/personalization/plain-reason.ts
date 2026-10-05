/**
 * 추천 근거(reasoning)를 **고객 화면에 보일 말**로 바꾼다 — 2026-10-06 10차 점검 E.
 *
 * firstBox·nextBox 의 trigger·action 은 어드민 설문 기록(/admin/surveys)과 엔진 디버깅을 위해 임상 표기
 * (puppy · BCS 7/9 · IRIS Stage · DCM · MMVD · CDS · EPI · Cushing's · IBD …)와 문헌 인용을 그대로 담는다.
 * 그런데 분석 화면 '이렇게 추천했어요'(BoxMixCard)와 승인 화면이 이 원문을 그대로 그려 고객에게
 * "12개월 미만 puppy", "6개월 체중 감소 + BCS 정상"이 실제로 나가고 있었다(DB 확인). 사장님 규칙: 전문용어·영문 금지.
 *
 * 저장값(dog_formulas.reasoning)은 이미 쌓여 있으므로 **표시할 때** 바꾼다 — 엔진 문자열을 고치면 새 기록만 고쳐진다.
 *  · plainTrigger: 알려진 표기를 쉬운 말로 바꾼다(여러 번 불러도 같은 결과).
 *  · isPlainCustomerText: 바꾼 뒤에도 영문 약어·연도(문헌 인용)·DM 표기가 남았는지 — 남았으면 화면이 그 줄을 그리지 않는다.
 */

const TRIGGER_REWRITES: ReadonlyArray<readonly [RegExp, string]> = [
  [/대형견 puppy/g, '대형견 아기 강아지'],
  [/\bpuppy\b/gi, '아기 강아지'],
  [/BCS (\d)\/9 \(([^)]+)\)/g, '체형: $2'],
  [/BCS 정상/g, '체형 정상'],
  [/BCS 과체중/g, '체형 과체중'],
  [/BCS 6\+/g, '통통한 체형'],
  [/IRIS Stage (\d)/g, '$1단계'],
  [/ — 심한 azotemia/g, ' — 신장 수치가 많이 높음'],
  [/입력값 (\S+) 비정상 — Stage 1-4 만 유효, 보수적 처방/g, '단계 확인 필요 — 조심스럽게 구성'],
  [/stage 미진단 — 보수적/g, '단계 모름 — 조심스럽게 구성'],
  [/심장병 \/ DCM 진단/g, '심장병 진단'],
  [/MMVD 진단/g, '심장 판막 질환 진단'],
  [/EPI \(외분비 췌장 부전\)/g, '소화 효소 부족(외분비 췌장 부전)'],
  [/인지저하증 \(CDS\)/g, '노령 인지 저하'],
  [/Cushing's \(부신피질항진증\)/g, '쿠싱(부신피질항진증)'],
  [/염증성 장질환 \(IBD\)/g, '염증성 장질환'],
  [/IBD \+ 위장 적응/g, '염증성 장질환 + 위장 적응'],
  [/\bIVDD\b/g, '디스크'],
  [/\bCKD\b/g, '신장질환'],
  [/활동량 high/g, '활동량 많음'],
  [/활동량 low/g, '활동량 적음'],
  [/케어 목표 = /g, '케어 목표: '],
  [/변 #\d+ /g, '변 '],
]

/**
 * 급성·중증 췌장염 하드 게이트 안내 — 분석 화면·주문 화면이 그린다. 옛 저장 문구에는 지방 기준·화식 최저지방의
 * **정확한 %**가 들어 있었다(사장님 규칙: 성분 % 노출 금지). 저장값과 무관하게 이 문구를 쓴다.
 */
export const PANCREATITIS_GATE_COPY =
  '이 아이에게는 화식 급여를 권하지 않아요 — 급성·중증 췌장염은 지방이 아주 적은 수의사 처방식이 필요한데, 저희 화식은 지방이 가장 적은 구성으로도 그 기준에 닿지 못해요. 꼭 수의사 처방식(저지방 식이요법)으로 급여해 주세요.'

export function plainTrigger(s: string): string {
  let out = s
  for (const [re, to] of TRIGGER_REWRITES) out = out.replace(re, to)
  return out
}

/** 고객에게 그대로 보여도 되는 말인가 — 영문 두 글자 이상·네 자리 연도(문헌 인용)·밑줄 식별자가 없을 것. */
export function isPlainCustomerText(s: string): boolean {
  // 숫자 뒤 단위(25kg · 300kcal)는 고객도 쓰는 말이라 영문 검사에서 뺀다.
  const t = s.replace(/(\d)\s*(?:kcal|kg)\b/g, '$1')
  return !/[A-Za-z]{2,}/.test(t) && !/\b(?:19|20)\d{2}\b/.test(t) && !/_/.test(t)
}
