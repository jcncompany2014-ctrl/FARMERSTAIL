/**
 * 내부 계정(사장님·시험 계정) 판정 — **정본 하나** (2026-10-14 어드민 B3, 규칙251).
 *
 * # 왜
 * 어드민 홈의 매출·구독 지표에 사장님 시험 구독(3af1665b — 2주마다 32,700원 결제)이 고객과 똑같이 들어가, '정기배송 7건'
 * 중 진짜 고객은 6명(전부 서포터즈)인데 매출·월 예상·해지율이 그 한 건에 끌려다녔다.
 *
 * # 무엇으로 가르나 — 조사(운영 DB SELECT, 2026-10-14)
 *  · profiles.role: 26명 전부 'customer' — 못 쓴다(사장님 계정도 customer).
 *  · 이메일 도메인: 사장님 계정은 kakao.com(카카오 가입) — 고객 3명도 kakao.com. 못 쓴다.
 *  · **auth app_metadata.role = 'admin'**: 딱 1명 = 시험 구독의 주인(f64d1e3f…). 서버만 바꿀 수 있는 값이라(고객이 스스로
 *    올릴 수 없다 — lib/auth/admin, R101-C) 가장 안전하다. DB 함수 admin_user_ids()(service_role 전용)가 같은 판정이다.
 *  · 그 밖의 시험·가족 계정은 아래 명시 목록에 적는다(코드 리뷰를 거쳐 늘린다).
 * 지표에서는 늘 뺀다. 발송·환불·결제 실패 같은 처리 대기는 그대로 센다(시험 박스도 실제로 나간다).
 *
 * # 목록 화면(2026-10-24 규칙313)
 * 주문·정기배송 목록에서도 **기본으로 숨긴다** — 사장님 "푸린네 저거 가짜계정인데 계속 주문 화면에 뜨고 … 내 계정 푸린이
 * 구독도 내가 일부러 미루기해 놨는데 왜 뜨는지 모르겠다". 화면마다 '시험 계정 N건 숨김 · 보기'를 두고, 보일 땐 '시험' 딱지를 단다.
 */

/**
 * 관리자 계정이 아닌 내부(시험·가족) 계정 id — 명시 목록.
 *  · 4cc34360… '푸린네'(강아지 푸린·보리) — 사장님이 가게 결제를 시험하는 가짜 계정(2026-10-24 사장님 확인).
 */
export const INTERNAL_ACCOUNT_IDS: readonly string[] = ['4cc34360-5b93-4f6a-825c-85c2ca9529a6']

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type InternalAccounts =
  | { ok: true; ids: ReadonlySet<string> }
  | { ok: false; error: string; ids: ReadonlySet<string> }

type RpcClient = {
  rpc: (fn: 'admin_user_ids') => PromiseLike<{ data: unknown; error: { message: string } | null }>
}

/**
 * 내부 계정 id 모음 = 관리자(app_metadata.role='admin', admin_user_ids) ∪ 명시 목록.
 * service_role 클라이언트로 부른다(admin_user_ids 는 service_role 전용). 조회가 실패하면 ok:false 와 함께 명시 목록만 돌려준다 —
 * 화면은 '내부 계정을 못 뺐어요'를 보여 준다(조용히 섞인 숫자를 맞는 숫자처럼 보이지 않는다, 규칙1).
 */
export async function loadInternalUserIds(db: unknown): Promise<InternalAccounts> {
  const ids = new Set<string>(INTERNAL_ACCOUNT_IDS.filter((x) => UUID_RE.test(x)).map((x) => x.toLowerCase()))
  try {
    const { data, error } = await (db as RpcClient).rpc('admin_user_ids')
    if (error) return { ok: false, error: error.message, ids }
    for (const r of (Array.isArray(data) ? data : []) as Array<{ id?: unknown }>) {
      if (typeof r?.id === 'string' && UUID_RE.test(r.id)) ids.add(r.id.toLowerCase())
    }
    return { ok: true, ids }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), ids }
  }
}

export function isInternalUser(userId: string | null | undefined, ids: ReadonlySet<string>): boolean {
  return !!userId && ids.has(userId.toLowerCase())
}

/**
 * PostgREST 필터 한 줄 — 내부 계정의 행을 뺀다. user_id 가 비어 있는 행(탈퇴로 익명화된 주문 등)은 남긴다
 * (`not.in` 만 쓰면 NULL 이 같이 빠져 매출이 줄어든다). 내부 계정이 없으면 null(필터를 걸지 않는다).
 * id 는 uuid 모양만 넣는다(문자열 보간 — 다른 글자가 끼면 필터가 깨진다).
 */
export function excludeInternalFilter(ids: ReadonlySet<string>, column = 'user_id'): string | null {
  const list = [...ids].filter((x) => UUID_RE.test(x))
  if (list.length === 0) return null
  return `${column}.is.null,${column}.not.in.(${list.join(',')})`
}

/** 행 목록에서 내부 계정 행을 뺀다(이미 읽은 행에 쓴다 — 쿼리 필터와 같은 판정). */
export function withoutInternal<T extends { user_id?: string | null }>(rows: readonly T[], ids: ReadonlySet<string>): T[] {
  return rows.filter((r) => !isInternalUser(r.user_id ?? null, ids))
}
