/**
 * 첫 박스 체크인 — 사장님이 봐야 하는 답인가(순수 함수 · 앱 화면·서버 동작·어드민 할 일·고객 화면이 같은 판정) (2026-10-15, 규칙270).
 *
 * # 왜
 * 10/16 11시에 서포터즈 6명에게 '첫 박스 한 주 어땠나요?'가 처음 나간다. 그런데 '잘 안 먹어요'라고 답해도 그 답(feeding_outcomes)을
 * 읽는 어드민 화면이 응답률 숫자 하나뿐이었고, 손님에겐 '다음 박스에 반영할게요'라고 약속했다 — 지킬 장치가 없는 약속이었다.
 * 이제 '잘 안 먹어요'(그리고 메모를 남긴 '조금 가렸어요')는 경보함·이번 주 할 일·고객 화면에 뜨고, 손님 문구는 지킬 수 있는 말로 바꿨다.
 *
 * 순수 모듈 — 브라우저(앱 화면)·서버·node 테스트 어디서 불러도 된다(import 없음).
 */

export type CheckinPalatability = 'great' | 'ok' | 'poor'

/** 어드민 '이번 주 할 일'이 보여 주는 기간 — 응답한 날부터 이만큼(다음 조리 두 번을 넘기는 길이). */
export const FIRST_CHECKIN_TODO_DAYS = 14

export const FIRST_CHECKIN_LABEL: Record<CheckinPalatability, string> = {
  great: '잘 먹어요',
  ok: '조금 가렸어요',
  poor: '잘 안 먹어요',
}

export function isCheckinPalatability(v: unknown): v is CheckinPalatability {
  return v === 'great' || v === 'ok' || v === 'poor'
}

/**
 * 사장님이 봐야 하나 — 'poor' 는 늘, 'ok' 는 메모가 있을 때만('조금 가렸어요'만으로는 흔한 적응기라 시끄럽지 않게).
 * 'great' 는 메모가 있어도 아니다(좋은 소식 — 고객 화면에는 그대로 보인다).
 */
export function firstCheckinNeedsOwner(palatability: unknown, comment: string | null | undefined): 'poor' | 'note' | null {
  if (palatability === 'poor') return 'poor'
  if (palatability === 'ok' && typeof comment === 'string' && comment.trim().length > 0) return 'note'
  return null
}

/** 경보함 종류 — 이름은 lib/admin/alert-kinds 의 목록과 같아야 한다(규칙247 이 대조). */
export function firstCheckinAlertOf(
  palatability: unknown,
  comment: string | null | undefined,
): { kind: 'feeding.first_checkin_poor' | 'feeding.first_checkin_note'; level: 'error' | 'warning' } | null {
  const need = firstCheckinNeedsOwner(palatability, comment)
  if (need === 'poor') return { kind: 'feeding.first_checkin_poor', level: 'error' }
  if (need === 'note') return { kind: 'feeding.first_checkin_note', level: 'warning' }
  return null
}

/** 메모 짧게 — 한 줄(줄바꿈·연속 공백을 한 칸으로)·최대 max 글자. 비면 ''. */
export function shortCheckinMemo(comment: string | null | undefined, max = 40): string {
  if (typeof comment !== 'string') return ''
  const one = comment.replace(/\s+/g, ' ').trim()
  if (!one) return ''
  return one.length > max ? `${one.slice(0, max)}…` : one
}

/** 어드민 한 줄 — '땅콩 · 잘 안 먹어요 · "메모"'. */
export function firstCheckinLine(dogName: string, palatability: CheckinPalatability, comment: string | null | undefined): string {
  const memo = shortCheckinMemo(comment)
  return `${dogName} · ${FIRST_CHECKIN_LABEL[palatability]}${memo ? ` · "${memo}"` : ''}`
}

/**
 * 손님에게 보내고 난 뒤 짧은 알림 — **지킬 수 있는 약속만**. '다음 박스에 반영'은 장치가 없어 지킬 수 없었다.
 * 사장님이 직접 읽는 것은 사실이다(경보함·할 일·고객 화면에 뜬다).
 */
export function firstCheckinThanks(palatability: CheckinPalatability): string {
  if (palatability === 'great') return '알려 주셔서 고마워요.'
  return '고마워요. 사장님이 직접 읽고, 필요하면 연락드릴게요.'
}
