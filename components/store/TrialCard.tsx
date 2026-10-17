/**
 * '처음이라면 4종 체험팩' 카드(홈·후기 화면) — 먹선 상자 안에 4종 팩 사진을 작게 나란히, 아래에 이름·구성·가격.
 * 2026-10-17 사장님 "색 들어가는 데마다 위에 띠 — AI 티": 예전 카드 머리의 4색 띠를 빼고 실제 팩 사진으로 4종을 보여 준다.
 * 숫자는 상품표(lib/store/catalog TRIAL_ITEM) 하나에서 — 가격을 글자로 적지 않는다(규칙199).
 */
import Link from 'next/link'
import { RECIPE_STUDIO_IMG, RECIPE_TITLE, STORE_RECIPES, TRIAL_ITEM, TRIAL_PACK_G } from '@/lib/store/catalog'

const won = (n: number) => n.toLocaleString('ko-KR')

export default function TrialCard({ kicker = '처음이라면' }: { kicker?: string }) {
  return (
    <Link
      href="/store?tab=trial"
      style={{ border: '2px solid #141414', borderRadius: 4, padding: 14, color: '#141414', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <span aria-hidden style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
        {STORE_RECIPES.map((r) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={r} src={RECIPE_STUDIO_IMG[r]} alt="" title={RECIPE_TITLE[r]} width={160} height={160} loading="lazy" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 2, display: 'block', background: '#F6F4F5' }} />
        ))}
      </span>
      <span style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#595959' }}>{kicker}</span>
          <span className="d" style={{ fontSize: 24, lineHeight: 1.1 }}>
            {TRIAL_ITEM.name}
          </span>
          <span style={{ fontSize: 15, color: '#3D3D3D' }}>
            4종 {TRIAL_PACK_G}g씩 한 팩 · {TRIAL_ITEM.grams}g
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 2, whiteSpace: 'nowrap' }}>
          <span className="n" style={{ fontSize: 30 }}>
            {won(TRIAL_ITEM.price)}
          </span>
          <span className="d" style={{ fontSize: 17 }}>
            원
          </span>
        </span>
      </span>
    </Link>
  )
}
