-- 리뷰 RLS 조이기 (2026-07-16) — 프로덕션 적용 완료
-- DB 실제 버전: 20260716063xxx
--
-- # 문제
-- `reviews select all` 정책이 `USING (true)` + 대상 `public` 이라 **비로그인 포함 누구나
-- reviews 전 행을 읽을 수 있었다.** reviews 에는 `user_id`·`dog_id`·`order_item_id` 가
-- 들어 있다 → 리뷰 하나로 **작성자의 내부 식별자와 강아지 식별자가 노출**된다.
-- (같은 날 고친 dashboard_user_snapshot 취약점과 엮이면 user_id → 프로필 전체였다.)
--
-- # 그런데 그 공개 정책이 **아무에게도 필요 없다**
-- reviews 를 읽는 곳 4곳이 전부 `eq('user_id', user.id)` — 본인 것만 본다:
--   · /mypage/reviews  · /mypage/delete(개수)  · /api/privacy/export  · 주문상세(작성여부)
-- `/reviews` 페이지는 supabase 를 **auth.getUser() 로만** 쓰고 후기 카드 9개는 하드코딩이다.
-- 즉 **남의 리뷰를 보여주는 화면이 존재하지 않는다.**
--
-- 지금 0행이라 실피해는 없다. **차면 늦으므로 지금 막는다**(review-photos 버킷과 같은 논리).
--
-- ⚠️ 나중에 리뷰를 공개 노출할 거면 이 정책을 `USING (true)` 로 **되돌리지 말 것.**
--    **user_id 를 뺀 뷰**를 만들어 그걸 공개한다. 리뷰에 필요한 건 작성자 '이름'이지
--    내부 식별자가 아니다.
--
-- 검증(롤백 테스트): 비로그인 0 · 본인 1 · 다른 회원 0.

drop policy if exists "reviews select all" on public.reviews;
create policy "reviews_select_own_or_admin" on public.reviews
  for select using (auth.uid() = user_id or public.is_admin());

-- 딸린 테이블도 같은 이유로 (둘 다 0행 · 코드 참조 0 — reviews.image_urls 로 대체된 듯)
drop policy if exists "review_photos select all" on public.review_photos;
create policy "review_photos_select_own_or_admin" on public.review_photos
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.reviews r
      where r.id = review_photos.review_id and r.user_id = auth.uid()
    )
  );

drop policy if exists "review_helpful select all" on public.review_helpful;
create policy "review_helpful_select_own_or_admin" on public.review_helpful
  for select using (auth.uid() = user_id or public.is_admin());

comment on table public.reviews is
  '⚠️ 2026-07-16: SELECT 가 USING(true)/public 이라 user_id·dog_id 가 전 세계에 공개되고 있었다(0행이라 실피해 없음). 읽는 곳은 전부 본인 것만이라 공개가 불필요했다. 공개 노출이 필요해지면 user_id 를 뺀 뷰를 만들 것 — 정책을 true 로 되돌리지 말 것.';
