-- 미입증 시드 농가 숨김 (사장님 확정 2026-07-22 "아직 아님 → 숨김", 감사 #55)
--
-- 시드 마이그레이션(20260425000008 · 20260601000002)이 넣은 농가 6곳(평창 한우 1++/HACCP ·
-- 완도 수산 · 구좌 무농약 · 괴산 유기농 · 이천 작업장 HACCP준비 · CJ대한통운)은 실제 계약·인증이
-- 아직 아니라 프로덕션 노출 시 허위표시 위험. is_published=false 로 숨긴다. /partners 페이지는
-- 자동으로 "함께할 농가를 찾습니다" 정직 비전 섹션으로 폴백한다(코드 FALLBACK_PARTNERS 는 이미
-- 빈 배열). 실제 계약·인증 확보 시 /admin/partners 에서 재게시하면 복원된다. (fresh migrate 시
-- 이 마이그레이션이 두 시드 뒤에 실행돼 최종 상태 = 전부 숨김.)
update public.partners set is_published = false where is_published = true;
