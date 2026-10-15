-- 흑돼지 레시피 메인 부위 정정: 뒷다리살 → 안심 (사장님 2026-10-15, 규칙285).
--
-- # 왜
-- 2026-08-25 에 '안심 → 뒷다리살'로 바꿨다는 기록을 따라 코드 정본·상품 설명·배합 기록·매거진 글이 '흑돼지 뒷다리살'이었다.
-- 사장님 확인(10/15): 실제 부위는 안심이다. 화면 문구는 코드(lib/recipe-ingredients 등)에서, 여기서는 DB 에 적힌 글자만 고친다.
--  · products(pork-joint) — 원재료(ingredients, 배합 비율 숫자는 그대로 — 이름만)·설명 칸들
--  · blog_posts(protein-allergy-elimination-diet-8-weeks) — 본문 속 '흑돼지 화식 — 흑돼지 뒷다리살·…' 한 줄
-- 다른 글의 '뒷다리'(강아지 다리 이야기 — BCS·중독 음식 글)는 건드리지 않는다: '흑돼지 뒷다리살' 글자만 바꾼다.

update public.products
   -- ingredients 는 text 칸이다(jsonb 아님 — 운영 information_schema 로 확인, 2026-10-15 첫 적용이 형 변환에서 실패했다).
   set ingredients = replace(ingredients, '흑돼지 뒷다리살', '흑돼지 안심'),
       description = replace(description, '흑돼지 뒷다리살', '흑돼지 안심'),
       short_description = replace(short_description, '흑돼지 뒷다리살', '흑돼지 안심'),
       meta_description = replace(meta_description, '흑돼지 뒷다리살', '흑돼지 안심')
 where slug = 'pork-joint';

update public.blog_posts
   set content = replace(content, '흑돼지 뒷다리살', '흑돼지 안심'),
       excerpt = replace(excerpt, '흑돼지 뒷다리살', '흑돼지 안심'),
       title = replace(title, '흑돼지 뒷다리살', '흑돼지 안심')
 where slug = 'protein-allergy-elimination-diet-8-weeks';

-- 자기 검증 — 두 행에 '뒷다리살'이 남지 않았고, 흑돼지 상품 원재료에 '흑돼지 안심'이 있다.
do $$
begin
  if exists (
    select 1 from public.products
    where slug = 'pork-joint'
      and (coalesce(ingredients, '') || coalesce(description, '') || coalesce(short_description, '') || coalesce(meta_description, '')) like '%뒷다리살%'
  ) then
    raise exception '흑돼지 상품에 뒷다리살이 남아 있다';
  end if;
  if not exists (select 1 from public.products where slug = 'pork-joint' and ingredients like '%흑돼지 안심%') then
    raise exception '흑돼지 상품 원재료에 흑돼지 안심이 없다(바꿀 글자를 못 찾았다)';
  end if;
  if exists (
    select 1 from public.blog_posts
    where slug = 'protein-allergy-elimination-diet-8-weeks'
      and (coalesce(content, '') || coalesce(excerpt, '') || coalesce(title, '')) like '%뒷다리살%'
  ) then
    raise exception '알레르기 글에 뒷다리살이 남아 있다';
  end if;
end $$;
