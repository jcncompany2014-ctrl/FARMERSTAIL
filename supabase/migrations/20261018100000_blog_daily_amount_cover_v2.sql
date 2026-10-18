-- 2026-10-18 매거진 '화식 하루 양, 이렇게 정해요' 표지 교체(사장님 "ㄱ").
--
-- 옛 표지(/magazine/fresh-food-daily-amount.webp)는 폰 화면 그림이라 PC 3열 카드(약 400px)에서 흐렸고, 표지 규칙
-- (보호자 1인칭 폰 사진 · 손 · 그릇 · 강아지 — 메모리 사진 톤 정본)에도 맞지 않았다. 새 표지 = 손에 든 그릇(조금만) · 바닥의
-- 주방 저울 · 올려다보는 셸티. 이미지 캐시가 1년이라(next.config minimumCacheTTL) 같은 이름에 덮어쓰지 않고 새 이름(-v2)으로.
-- 운영 DB 는 새 파일이 배포된 뒤 service_role 스크립트로 먼저 바꿨다 — 기록·재현용. 못 찾으면 실패시킨다.

do $$
declare n int;
begin
  update public.blog_posts
     set cover_url = '/magazine/fresh-food-daily-amount-v2.webp'
   where slug = 'dog-fresh-food-daily-amount'
     and cover_url in ('/magazine/fresh-food-daily-amount.webp', '/magazine/fresh-food-daily-amount-v2.webp');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'blog 하루 양 표지 갱신 행 수 %', n; end if;
end $$;
