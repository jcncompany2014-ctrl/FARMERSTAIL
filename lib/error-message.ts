/**
 * catch 로 잡은 것을 **고객에게 보여줄 문구**로 바꾼다 — 정본 한 곳.
 * (2026-08-05 예외 UX 감사)
 *
 * # 무슨 일이 있었나
 * 화면 14곳이 이렇게 적혀 있었다:
 *
 *     catch (e) {
 *       setErr(e instanceof Error ? e.message : '네트워크가 불안정해요...')
 *     }
 *
 * 삼항이 **뒤집혀 있다.** 이 catch 에 도달하는 건 거의 항상 fetch 실패이고
 * 그건 `TypeError` = Error 인스턴스다. 그래서 고객은 준비된 한국어 대신
 * **`Failed to fetch`(크롬) / `Load failed`(iOS 사파리)** 를 본다.
 * 정작 한국어 문구는 영영 안 뜨는 죽은 코드였다. 승인·주문취소·금액변경 동의
 * 같은 **돈 화면**이 다 포함돼 있었다.
 * (서버가 주는 친절한 한국어는 그 위 `if (!res.ok)` 분기에서 이미 처리된다.
 *  catch 가 잡는 건 네트워크 끊김·JSON 파싱 실패뿐이다.)
 *
 * # 왜 "무조건 폴백"이 아닌가
 * 일부 화면은 우리가 직접 `throw new Error('사진이 너무 커요')` 처럼 **한국어를
 * 던진다.** 그건 보여줘야 한다. 그래서 "한글이 들어 있으면 우리 것"으로 가른다 —
 * 브라우저·라이브러리 오류는 한글을 쓰지 않는다.
 */

/** 한글 음절·자모가 하나라도 있으면 우리가 만든 문구로 본다. */
const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/

/**
 * @param e catch 로 잡은 값
 * @param fallback 고객에게 보여줄 한국어 기본 문구
 * @returns 우리가 던진 한국어면 그것, 아니면 fallback
 */
export function userFacingError(e: unknown, fallback: string): string {
  if (e instanceof Error && HANGUL.test(e.message)) return e.message
  if (typeof e === 'string' && HANGUL.test(e)) return e
  return fallback
}
