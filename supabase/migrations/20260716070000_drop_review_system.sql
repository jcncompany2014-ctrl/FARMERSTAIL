-- 리뷰 시스템 전면 폐기 (사장님 지시 2026-07-16) — 프로덕션 적용 완료
--
-- "앱과 웹에 리뷰 관련된 멘트나 기능이 있다면 다 없애. 내가 알아서 리뷰 수집해서
--  마케팅으로 쓸 수 있게 가져와서 집어넣을 테니까."
--
-- 즉 **고객이 앱/웹에서 리뷰를 쓰는 기능**을 없앤다. 마케팅용으로 보여주는 후기
-- (/reviews · /about 후기 캐러셀)는 사장님이 직접 넣으므로 그대로 둔다 — 그건 DB 가
-- 아니라 페이지에 박힌 콘텐츠라 여기서 지울 게 없다.
--
-- # 실측 — 전부 0행이라 잃을 데이터가 없다
-- reviews 0 · review_photos 0 · review_helpful 0 · product_reviews 0 ·
-- review-photos 버킷 파일 0.
--
-- # 곁가지로 확인된 것
-- `orders.review_prompted_at` 컬럼은 **애초에 DB 에 없었다.** 리뷰 요청 크론
-- (review-prompts)이 그 컬럼으로 필터·업데이트하고 있었으니 **원래도 제대로 안
-- 돌았을 것**이다(멱등 마킹이 매번 실패). 크론째 제거했다.
--
-- # 되살릴 거면
-- 마케팅 후기를 DB 로 옮길 때는 **user_id 를 담지 말 것**. 리뷰에 필요한 건 작성자
-- '이름'이지 내부 식별자가 아니다(2026-07-16 user_id 공개 유출 건 참고).
--
-- ⚠️ **사장님 액션:** `review-photos` 버킷은 SQL 로 못 지운다(storage.protect_delete
--    가 막는다 — 고아 객체로 인한 데이터 손실 방지). 파일이 0개이므로 Supabase
--    대시보드 → Storage 에서 버킷을 삭제하시면 된다. 정책은 아래에서 이미 걷어냈다.

drop table if exists public.review_helpful cascade;
drop table if exists public.review_photos cascade;
drop table if exists public.reviews cascade;
drop table if exists public.product_reviews cascade;

-- 버킷은 남지만 아무도 못 쓰게 정책을 걷어낸다(업로드 경로도 코드에서 사라졌다).
drop policy if exists "review-photos self delete" on storage.objects;
drop policy if exists "review-photos public read" on storage.objects;
drop policy if exists "review_photos_select_own_or_admin" on storage.objects;
