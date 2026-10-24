/**
 * 2026-10-24 어드민 홈 '새로 들어온 것' 겹침 — 규칙323.
 *
 * 사장님 "보돌이 지금 주문해지건이 두개가 있는데 관리자 홈에서 또 겹쳐서 뜬다 좀 제대로 해줘". 보돌 보호자님이 같은 날 세 번
 * 신청(둘은 결제 전에 해지)했는데 '새 정기배송'이 해지된 둘째 신청까지 초록 줄로 그려 보돌이 두 번 보였다(해지 줄은 할인 없이
 * 정가 97,200원 · 발송일 없음).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.env.AUDIT_ROOT ?? process.cwd()
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n')
const code = (...p: string[]) => read(...p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
const load = async <T>(...p: string[]): Promise<T> => (await import(pathToFileURL(join(ROOT, ...p)).href)) as T

test("규칙323: 새로 들어온 것 — 해지된 구독은 '새 정기배송' 줄이 아니다 · 결제 전에 해지한 같은 강아지 신청은 'N건 더' 한 줄로", async () => {
  const core = await load<typeof import('./admin/new-arrivals-core.ts')>('lib', 'admin', 'new-arrivals-core.ts')
  // 운영 그대로(10/24, 보돌) — 첫 카드 등록 기록이 있는 건 둘째(해지)·셋째(진행 중).
  const USER = '75ec2aa7-dd62-4e09-8244-55af07515cd6'
  const DOG = 'dog-bodol'
  const second = { id: '64ea90b3', user_id: USER, dog_id: DOG, status: 'cancelled', last_charged_at: null, total_deliveries: 0 }
  const third = { id: 'c3e47265', user_id: USER, dog_id: DOG, status: 'active', last_charged_at: null, total_deliveries: 0 }
  const live = core.keepLiveNewSubs([second, third])
  assert.deepEqual(live.map((r) => r.id), ['c3e47265'], '해지된 신청이 새 정기배송 줄로 남는다(보돌이 두 번 보인다)')
  // 일시정지·카드 문제는 이어지는 구독 — 남는다.
  assert.equal(core.keepLiveNewSubs([{ ...third, status: 'paused' }]).length, 1, '일시정지된 새 구독이 사라진다')
  // 같은 강아지에 진행 중 둘 = 이중 결제 위험 — 합치지 않는다.
  assert.equal(core.keepLiveNewSubs([third, { ...third, id: 'dup' }]).length, 2, '진행 중인 구독 둘을 하나로 합쳐 이중 결제 위험을 가린다')

  const first = { id: '8f7483b2', user_id: USER, dog_id: DOG, last_charged_at: null, total_deliveries: 0 }
  const cancelled = [first, second]
  assert.equal(core.abandonedBeforeCount(third, cancelled), 2, '결제 전에 해지한 같은 강아지 신청 2건을 못 센다')
  // 결제된 뒤 해지(진짜 해지·재구독)는 '결제 전 해지'가 아니다 — 해지 칸·재구독 판정이 따로 말한다.
  assert.equal(core.abandonedBeforeCount(third, [{ ...first, last_charged_at: '2026-10-10T00:10:00Z', total_deliveries: 1 }]), 0)
  // 다른 강아지·다른 보호자·자기 자신은 안 센다.
  assert.equal(core.abandonedBeforeCount(third, [{ ...first, dog_id: 'dog-other' }, { ...first, user_id: 'someone' }, { ...first, id: third.id }]), 0)
  assert.equal(core.abandonedBeforeCount({ ...third, dog_id: null }, cancelled), 0, '강아지를 모르는 구독에 남의 해지를 붙인다')

  const lib = code('lib', 'admin', 'new-arrivals.ts')
  assert.match(lib, /const rows = keepLiveNewSubs\(\(subRows \?\? \[\]\) as unknown as SubRow\[\]\)/, '새 정기배송이 해지된 구독을 거르지 않는다')
  assert.match(lib, /const cancelledLite = cancelRes\.error \? null :/, "해지 목록을 못 읽었는데 'N건 더'를 0으로 단정한다(규칙1)")
  assert.match(lib, /abandonedBefore: abandonedBeforeCount\(r, cancelledLite\)/, "남은 줄에 '결제 전에 해지한 신청 N건'을 안 붙인다")
  // 금액 계산이 해지 구독을 건너뛰는 갈래는 그대로여도 되지만, 그 줄이 화면에 나가면 안 된다 — 위 거름이 먼저다.
  assert.ok(lib.indexOf('keepLiveNewSubs(') < lib.indexOf('resolveAutoDiscount({'), '해지 구독을 거르기 전에 줄을 만든다')

  const panel = code('components', 'admin', 'NewArrivalsPanel.tsx')
  assert.match(panel, /\{!!s\.abandonedBefore && \(/, "'결제 전에 해지한 신청' 한 줄이 없다")
  assert.ok(panel.includes('결제 전에 해지한 신청 {s.abandonedBefore}건이 더 있어요'), "'N건 더' 문구가 쉬운 말이 아니다")
  assert.match(code('app', 'design-check-admin', 'arrivals', 'page.tsx'), /abandonedBefore: 2,/, "점검 화면에 'N건 더' 예시가 없다")
})
