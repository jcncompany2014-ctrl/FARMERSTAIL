/**
 * 아직 설문을 한 번도 안 한 계정의 첫 강아지 — 앱에 로그인한 뒤 홈 대신 설문으로 보낼지 정한다(2026-10-19 약국 봉투 이벤트).
 *
 * 이벤트 화면(/p/코드)은 웹에서 강아지 기본 정보만 받고 가입시킨다(강아지만 만든다 — createDogFromDraft).
 * 손님은 앱을 깔고 '이미 계정이 있어요 · 로그인'으로 들어오는데, 예전엔 로그인 뒤 늘 홈(/dashboard)으로 갔다.
 * 홈은 설문 여부를 보지 않아 설문까지 탭 4~5번이 걸렸다 — 안내서가 약속한 '남은 설문 2분'으로 바로 보낸다.
 *
 * 기준: 계정의 강아지 중 **설문을 한 마리라도 마쳤으면 해당 없음**(기존 회원 — 설문 없는 둘째 강아지가 있어도 로그인마다
 * 그 설문으로 끌고 가지 않는다, 10/19 검토). 설문이 하나도 없으면 가장 먼저 만든 강아지.
 * 조회가 하나라도 실패하면 null — 모르면 원래대로 홈으로 보낸다(틀린 화면으로 끌고 가지 않는다, 규칙1).
 */

type Reader = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, v: string) => {
        order: (col: string, o: { ascending: boolean }) => PromiseLike<{ data: unknown; error: unknown }>
      }
      in: (col: string, v: string[]) => PromiseLike<{ data: unknown; error: unknown }>
    }
  }
}

export async function firstDogWithoutSurvey(supabase: unknown, userId: string): Promise<string | null> {
  try {
    const db = supabase as Reader
    const dogs = await db.from('dogs').select('id, created_at').eq('user_id', userId).order('created_at', { ascending: true })
    if (dogs.error || !Array.isArray(dogs.data) || dogs.data.length === 0) return null
    const ids = (dogs.data as Array<{ id: string }>).map((d) => d.id)
    const surveys = await db.from('surveys').select('dog_id').in('dog_id', ids)
    if (surveys.error || !Array.isArray(surveys.data)) return null
    if (surveys.data.length > 0) return null
    return ids[0] ?? null
  } catch {
    return null
  }
}
