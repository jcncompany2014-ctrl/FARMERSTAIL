-- product_qna RLS 조이기 (2026-07-17) — reviews 취약점의 놓친 형제 테이블
--
-- # 문제
-- `qna public read` 정책이 `is_private = false` 행을 `anon, authenticated` 에게
-- 통째로 노출한다 → 공개 문의의 **작성자 user_id·answered_by(내부 UUID)** 가
-- 비로그인 포함 누구나 anon 키로 조회 가능. 이는 2026-07-16 reviews 에서 고친
-- 취약점(20260716040000)과 **정확히 같은 클래스**인데 형제 테이블 product_qna 가
-- 그 스윕에서 누락됐다.
--
-- # 그 공개 정책은 지금 아무에게도 필요 없다
-- product_qna 를 **읽어서 화면에 보여주는 앱 코드가 0곳**이다(account-delete·
-- account-purge cron 이 익명화 목적으로만 참조). 즉 남의 문의를 노출하는 PDP
-- Q&A UI 가 존재하지 않는다 → 공개 SELECT 가 불필요. 지금 0행이라 실피해는
-- 없으나 기능이 라이브되는 순간 즉시 유출되므로 **차기 전에 막는다**.
--
-- ⚠️ 나중에 PDP 공개 Q&A 를 노출할 거면 이 정책을 되돌리지 말 것.
--    **user_id·answered_by 를 뺀 뷰**를 만들어 그걸 공개한다(reviews 와 동일 원칙).
--    공개 Q&A 에 필요한 건 작성자 '이름'이지 내부 식별자가 아니다.
--
-- 검증(롤백 테스트): 비로그인 0 · 본인 1 · 다른 회원 0.

drop policy if exists "qna public read" on public.product_qna;
create policy "product_qna_select_own_or_admin"
  on public.product_qna
  for select
  using (
    auth.uid() = user_id
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

comment on table public.product_qna is
  '⚠️ 2026-07-17: SELECT 가 is_private=false 를 anon 에게 공개해 user_id·answered_by 가 전 세계에 노출되고 있었다(0행이라 실피해 없음, reviews 형제 취약점). 읽어서 보여주는 앱 코드가 없어 공개가 불필요했다. 공개 Q&A 가 필요해지면 user_id 를 뺀 뷰를 만들 것 — 정책을 anon 공개로 되돌리지 말 것.';
