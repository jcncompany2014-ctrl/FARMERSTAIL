-- SECURITY DEFINER 데이터 변경 함수 락다운 — service_role 전용 (2026-07-22)
--
-- create function 은 기본으로 PUBLIC 에 EXECUTE 를 준다. fn_expire_stamps(전체 프로필
-- stamp_count 재계산)·fn_lock_completed_cards(스탬프 잠금)는 SECURITY DEFINER 라
-- anon/authenticated 가 rpc 로 호출하면 전체 재계산 DoS·남의 스탬프 조작이 된다.
-- 보안 메모리(SECURITY DEFINER + PUBLIC GRANT = 위험) 교훈대로 PUBLIC 회수, 크론·트리거가
-- 쓰는 service_role 만 남긴다. (fn_refresh_stamp_count 는 처음부터 락다운돼 있었다.)
revoke all on function public.fn_expire_stamps() from public, anon, authenticated;
revoke all on function public.fn_lock_completed_cards(uuid) from public, anon, authenticated;
grant execute on function public.fn_expire_stamps() to service_role;
grant execute on function public.fn_lock_completed_cards(uuid) to service_role;
