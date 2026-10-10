import Link from 'next/link'
import StoreShell from '@/components/store/StoreShell'
import { APP_STORE_LINKS } from '@/lib/links'

/**
 * 웹 가입 완료 화면(그리기만) — 데이터는 page.tsx 가 읽어 넘긴다. 점검 화면(/design-check-store?s=start-done)이
 * 예시 값으로 같은 화면을 그린다(로그인한 행사 손님만 보는 혜택·추천 구성 칸을 로그인 없이 확인하려고).
 */
export type DoneBox = { recipes: string; dailyGrams: number | null; total: number | null }
export type DonePromo = { name: string; ratePct: number }

const won = (n: number) => n.toLocaleString('ko-KR')

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export default function DoneWebView({ who, box, promo }: { who: string; box: DoneBox | null; promo: DonePromo | null }) {
  return (
    <StoreShell>
      {/* 줄 높이 기본값 = 웹 시안(normal). 여러 줄 글은 각자 값을 준다. */}
      <div style={{ lineHeight: 'normal' }}>
        <section style={{ padding: '40px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <span aria-hidden style={{ width: 72, height: 72, background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <span style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#595959' }}>
            <span aria-hidden style={{ width: 8, height: 8, background: '#1D3B2F' }} />
            가입 완료
          </span>
          <h1 className="d" style={{ margin: '10px 0 0', fontSize: 38, lineHeight: 1.15 }}>
            이제 앱에서
            <br />
            이어서 해요
          </h1>
          <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>
            {who}의 정보와 추천 구성은 계정에 저장됐어요. 파머스테일 앱을 받아 같은 계정으로 로그인하면 그대로 이어서 정기배송을 시작할 수 있어요.
          </p>
        </section>

        {/* ② 행사 혜택 — 가입할 때 계정에 박힌 것, 아직 안 썼을 때만 */}
        {promo && (
          <section style={{ padding: '24px 20px 0' }}>
            <div style={{ padding: '18px 18px', border: '2px solid #141414', boxShadow: '4px 4px 0 #141414', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>{promo.name}</span>
              <strong className="d" style={{ fontSize: 24, lineHeight: 1.2, fontWeight: 400 }}>
                혜택이 계정에 저장됐어요
              </strong>
              <span style={{ fontSize: 16, lineHeight: 1.6, color: '#3D3D3D' }}>
                앱에서 처음 정기배송을 시작하면 첫 결제에서 <strong style={{ color: '#141414' }}>{promo.ratePct}% 할인</strong>돼요. 따로 입력할 건 없어요.
              </span>
            </div>
          </section>
        )}

        {/* ① 앱이 추천한 구성 — 다음에 볼 앱 화면과 같은 원천 */}
        {box && (
          <section style={{ padding: '28px 20px 0', display: 'flex', flexDirection: 'column' }}>
            <h2 className="d" style={{ margin: 0, fontSize: 26, lineHeight: 1.15 }}>
              {who}에게 맞춘 구성
            </h2>
            <dl style={{ margin: '14px 0 0', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '92px 1fr', columnGap: 8, alignItems: 'baseline' }}>
                <dt style={{ fontSize: 15, fontWeight: 700, color: '#595959' }}>레시피</dt>
                <dd style={{ margin: 0, fontSize: 18, fontWeight: 800, lineHeight: 1.4 }}>{box.recipes}</dd>
              </div>
              {box.dailyGrams ? (
                <div style={{ padding: '14px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '92px 1fr', columnGap: 8, alignItems: 'baseline' }}>
                  <dt style={{ fontSize: 15, fontWeight: 700, color: '#595959' }}>하루 양</dt>
                  <dd style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{won(box.dailyGrams)}g</dd>
                </div>
              ) : null}
              {box.total != null && (
                <div style={{ padding: '14px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '92px 1fr', columnGap: 8, alignItems: 'baseline' }}>
                  <dt style={{ fontSize: 15, fontWeight: 700, color: '#595959' }}>2주 박스</dt>
                  <dd style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    <span className="n" style={{ fontSize: 24 }}>
                      {won(box.total)}
                    </span>
                    <span className="d" style={{ fontSize: 15 }}>
                      원
                    </span>
                    <span style={{ marginLeft: 6, fontSize: 14, color: '#595959' }}>예상</span>
                  </dd>
                </div>
              )}
            </dl>
            <span style={{ marginTop: 10, fontSize: 14, lineHeight: 1.55, color: '#595959' }}>앱에서 화식 비율과 배송지를 고르면 금액이 확정돼요.</span>
          </section>
        )}

        {/* ③ 앱 받기 — 숲색 띠(앱 세계) + 공식 배지(그림은 바꾸지 않는다 — Apple·Google 가이드) */}
        <section style={{ marginTop: 32, padding: '28px 20px 32px', background: '#1D3B2F', color: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
          <h2 className="d" style={{ margin: 0, fontSize: 26, lineHeight: 1.2 }}>
            파머스테일 앱 받기
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 16, lineHeight: 1.6, color: '#C9D6CD' }}>앱을 연 뒤 같은 계정으로 로그인해 주세요.</p>
          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <a href={APP_STORE_LINKS.ios} target="_blank" rel="noopener noreferrer" aria-label="App Store에서 받기" style={{ height: 60, borderRadius: 4, background: '#0B0B0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/badge-appstore-ko.svg" alt="App Store에서 다운로드" style={{ height: 40, width: 'auto', display: 'block' }} />
            </a>
            <a href={APP_STORE_LINKS.android} target="_blank" rel="noopener noreferrer" aria-label="Google Play에서 받기" style={{ height: 60, borderRadius: 4, background: '#0B0B0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/badge-googleplay-ko.png" alt="Google Play에서 다운로드" style={{ height: 48, width: 'auto', display: 'block' }} />
            </a>
          </div>
        </section>

        <nav aria-label="더 보기" style={{ padding: '24px 20px 56px', display: 'flex', flexDirection: 'column' }}>
          <Link
            href="/app"
            style={{ minHeight: 60, borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 17, fontWeight: 800, color: '#141414', textDecoration: 'none' }}
          >
            앱이 뭘 하는지 미리 보기
            <Chevron />
          </Link>
        </nav>
      </div>
    </StoreShell>
  )
}
