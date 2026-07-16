-- analyses UPDATE 정책 누락 수정 (2026-07-16) — 프로덕션 적용 완료.
-- 증상: AI 코멘트(structured_analysis)가 저장되지 않아 분석/개요를 다시 볼 때마다
--       매번 새로 생성돼 내용이 바뀜(사장님 "또 들어갔는데 내용이 바꼈다"). 비용도 샘.
-- 원인: analyses 에 SELECT/INSERT/DELETE 정책만 있고 UPDATE 정책이 없어,
--       route(/api/analysis/structured) 의 structured_analysis 캐시 write(UPDATE)가
--       RLS 로 0행 처리(무오류 실패) → 캐시가 영원히 비어 매번 재생성.
-- 수정: 소유자 본인 행만 UPDATE 허용. WITH CHECK 로 user_id 재지정 차단.
--       (owner 는 이미 INSERT/DELETE 권한이 있어 UPDATE 추가는 권한 등급 확장 아님.)
create policy "Users can update own analyses"
on public.analyses
for update
to public
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
