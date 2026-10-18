-- 2026-10-18 매거진 표지 두 장 교체(사장님 "알아서 추천대로 ㄱㄱ") — 표지 규칙(보호자 1인칭 폰 사진·손·그릇·셸티)에 맞춘다.
--
--  · '500g 한 봉 vs 앱 정기배송' — 폰 화면 그림(강아지 없음) → 바닥의 흰 보냉 상자 옆에서 그릇을 내려놓는 장면
--  · '설탕·소금 없이 만드는 수제 간식 5가지'(5월 글) — 바깥 스톡(노란 배경, 톤이 다름) → 손에 든 접시의 수제 간식·셸티
-- 이미지 캐시 1년이라 새 이름. 운영 DB 는 새 파일이 배포된 뒤 service_role 스크립트로 먼저 바꿨다 — 기록·재현용.

do $$
declare n int;
begin
  update public.blog_posts
     set cover_url = '/magazine/single-pack-vs-app-v2.webp'
   where slug = 'single-pack-vs-app-subscription'
     and cover_url in ('/magazine/single-pack-vs-app.webp', '/magazine/single-pack-vs-app-v2.webp');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'blog 500g vs 앱 표지 갱신 행 수 %', n; end if;

  update public.blog_posts
     set cover_url = '/magazine/homemade-treats.webp'
   where slug = 'homemade-dog-treats-5-no-sugar';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'blog 수제 간식 표지 갱신 행 수 %', n; end if;
end $$;
