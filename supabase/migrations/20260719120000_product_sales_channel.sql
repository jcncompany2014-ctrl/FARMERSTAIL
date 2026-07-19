-- 상품 판매 채널 분리 (2026-07-19 사장님).
--
-- 자사몰/앱은 구독식 화식 팩만 팔지만, 토퍼·간식·체험팩 등은 스마트스토어·
-- 쿠팡 같은 외부 채널에서 판매 예정. 지금은 is_active 하나로만 갈라져
-- "숨김" 목록에 뒤섞여 있어 admin 에서 구분 관리가 불가능했다.
--
--   · own      = 자사몰 구독 (화식 4종 — LINE_TO_SLUG 대상)
--   · external = 외부 채널 전용 (스마트스토어·쿠팡 등 — 자사몰 미노출)
--
-- 고객측 노출은 slug 화이트리스트(LINE_TO_SLUG·TOPPER_TO_SLUG) 기반이라
-- external 상품이 자사몰에 새어나갈 경로는 애초에 없음 — 이 컬럼은 admin
-- 관리 분리가 목적. (라벨 PDF·재고 등 admin 기능은 채널 무관 공용.)

alter table public.products
  add column if not exists sales_channel text not null default 'own'
  check (sales_channel in ('own', 'external'));

comment on column public.products.sales_channel is
  '판매 채널: own=자사몰 구독(화식), external=외부 채널 전용(스마트스토어·쿠팡 등)';

-- 기존 데이터 매핑 — 화식(구독 SKU 4종)만 자사몰, 나머지(토퍼·간식·체험팩)는
-- 외부 채널. (2026-07-19 실데이터: 화식 4 · 토퍼 4 · 간식 2 · 체험팩 1)
update public.products
  set sales_channel = case
    when category = '화식' then 'own'
    else 'external'
  end;
