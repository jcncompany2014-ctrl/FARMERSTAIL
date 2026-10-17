/**
 * 등록성분량 표 — 가게 상품 상세(상품 정보)와 레시피 QR 화면이 같이 쓴다. 정본 = lib/store/registered.
 * 훅이 없어 서버·클라이언트 어디서든 그린다.
 */
import { REGISTERED_ANALYSIS, registeredValue } from '@/lib/store/registered'
import type { StoreRecipe } from '@/lib/store/catalog'

export default function RegisteredTable({ recipe }: { recipe: StoreRecipe }) {
  const rows = REGISTERED_ANALYSIS[recipe]
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 16 }}>
        <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>등록성분량</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} style={{ borderBottom: '1px solid #E5E5E5' }}>
              <th scope="row" style={{ padding: '12px 0', textAlign: 'left', fontWeight: 600, color: '#3D3D3D' }}>
                {r.name}
              </th>
              <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 800, color: '#141414', whiteSpace: 'nowrap' }}>{registeredValue(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.6, color: '#595959' }}>
        사료관리법에 따라 등록한 성분량이에요. 수분을 포함한 그대로의 비율이에요.
      </p>
    </div>
  )
}
