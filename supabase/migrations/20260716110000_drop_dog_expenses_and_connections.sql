-- dog_expenses · dog_connections DROP (2026-07-16) — 프로덕션 적용 완료
--
-- 둘 다 lib/dog-records.ts 에 함수만 있고 **부르는 화면이 0**이었다(함수도 이번에 제거).
--  · dog_expenses    — 강아지 지출 기록. 화면 미구현. 0행.
--  · dog_connections — 강아지 공유의 옛 방식. **dog_invitations + dog_members**
--    (초대 링크 방식)로 대체됨. 0행.
-- 실측: 0행 · FK 0 · DB 함수 참조 0.
--
-- 살아남은 것: dog-records.ts 의 백신(dog_vaccinations)·투약(dog_medications) 함수는
-- vaccinations/medications 화면이 실제로 쓴다.
drop table if exists public.dog_expenses cascade;
drop table if exists public.dog_connections cascade;
