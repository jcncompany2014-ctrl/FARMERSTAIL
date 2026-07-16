-- 등급 사다리 재정의 (사장님 확정 2026-07-16) — 프로덕션 적용 완료
--
--   씨앗 10 · 새싹 20 · 꽃 30 · 열매 40 · 나무 50
--   **스탬프 10개 미만 = 등급 없음(NULL)**
--
-- # 왜 0~9 에 등급을 안 주나 (사장님 지시)
-- 아무것도 안 한 사람에게 등급을 주면 등급이 싸구려가 된다. 멤버십 칸을 비워 두고
-- "스탬프를 채워 멤버십을 시작해보세요" 로 유도한다.
--
-- # 혜택도 나무 하나만
-- 할인은 **나무(50개) 매 주문 10%** 하나뿐. 첫주문 50% · 꽃 반기 25% · 열매 분기 20% ·
-- 생일 20% 는 전부 폐기(lib/discount.ts). 등급 기준을 스탬프로 통일한 것과 같은 취지 —
-- 로열티 서사를 하나로. 이벤트용 50% 는 등급과 무관한 별도 프로모션으로 뺀다.
--
-- ⚠️ lib/tiers.ts 의 TIERS[].threshold 와 **같은 사다리여야 한다.**
--    lib/stamps.test.ts 가 앱 쪽을 박제한다.

-- 1) tier 가 NULL 을 가질 수 있게 (등급 없음)
alter table public.profiles alter column tier drop not null;
alter table public.profiles alter column tier drop default;

comment on column public.profiles.tier is
  '회원 등급. **NULL = 아직 등급 없음**(스탬프 10개 미만, 2026-07-16). 기준은 stamp_count — 누적금액이 아니다.';

-- 2) 사다리 교체
create or replace function public.fn_compute_tier(stamp_count bigint)
returns text
language sql
immutable
set search_path to 'public', 'pg_catalog'
as $function$
  SELECT CASE
    WHEN stamp_count >= 50 THEN 'mate'    -- 나무 · 스탬프 카드 5장
    WHEN stamp_count >= 40 THEN 'fruit'   -- 열매 · 4장
    WHEN stamp_count >= 30 THEN 'bloom'   -- 꽃   · 3장
    WHEN stamp_count >= 20 THEN 'sprout'  -- 새싹 · 2장
    WHEN stamp_count >= 10 THEN 'seed'    -- 씨앗 · 1장 = 멤버십 시작
    ELSE NULL                             -- 10개 미만 = 등급 없음
  END
$function$;

-- 3) 동기화 트리거 — NULL 전이를 잡게 IS DISTINCT FROM 으로.
--    (기존 `new_tier <> coalesce(old.tier,'')` 는 NULL 로 **내려가는** 전이를 못 잡았다.)
create or replace function public.tg_profiles_sync_tier()
returns trigger
language plpgsql
set search_path to 'public', 'pg_catalog'
as $function$
declare
  new_tier text;
begin
  new_tier := public.fn_compute_tier(new.stamp_count);
  if new_tier is distinct from old.tier then
    new.tier := new_tier;
    new.tier_updated_at := now();
  end if;
  return new;
end;
$function$;

-- 4) 기존 회원 정정
update public.profiles
   set tier = public.fn_compute_tier(stamp_count),
       tier_updated_at = now()
 where tier is distinct from public.fn_compute_tier(stamp_count);

-- 검증(실측): fn_compute_tier 0→NULL · 9→NULL · 10→seed · 19→seed · 20→sprout ·
--             30→bloom · 40→fruit · 50→mate. 전 회원(6명, 스탬프 0) → 등급 없음.
