-- /link 스마트스토어 리뷰 이벤트 배너의 "제품당 선착순 10개" 조건 문구 제거(사장님 2026-09-30).
-- 조건 칸이 비면 배지 옆 회색 글자가 표시되지 않는다(app/link/page.tsx meta).
update public.link_banners
set condition = '',
    updated_at = now()
where condition like '%선착순%'
  and href like 'https://smartstore.naver.com/%';
