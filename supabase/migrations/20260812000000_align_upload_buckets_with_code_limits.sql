-- 업로드 상한·형식을 코드(MAX_BYTES = 8MB, ACCEPTED MIME)와 일치시킨다.
--
-- 2026-08-12 반증감사: 라우트는 8MB 를 통과시키는데 버킷이 5MB 라, 6~8MB 사진은
-- 우리 검증을 지나 Supabase Storage 에서 거부됐다. 사장님이 실사 상품 사진을
-- 올릴 때 바로 밟는 자리(폰 사진은 5MB 를 흔히 넘는다). 또 블로그·이벤트
-- 라우트는 AVIF 를 허용하는데 해당 버킷은 AVIF 를 안 받아 같은 종류의 불일치가
-- 하나 더 있었다.
--
-- 되돌리기: file_size_limit 을 5242880 으로 되돌리면 된다(데이터 영향 없음).
-- 프로덕션 적용: 2026-08-12 (MCP apply_migration, 적용 후 실측 확인).

update storage.buckets
set file_size_limit = 8388608 -- 8MB, 코드 MAX_BYTES 와 동일
where id in ('products', 'blog-covers', 'event-images');

-- AVIF 허용 (products 는 image/* 라 이미 허용)
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'
]
where id in ('blog-covers', 'event-images');
