-- 강아지 기록 3표의 user_id 를 고객이 못 바꾸게 (2026-10-13 점검, 규칙197).
--
-- # 왜
-- dog_medications(복약)·weight_logs(체중)·dog_vaccinations(접종)의 UPDATE 정책은 has_dog_role(dog_id, 'member')
-- 만 본다(2026-10-13 pg_policies 확인). 그런데 anon·authenticated 가 **표 전체 UPDATE** 권한을 갖고 있어
-- (relacl = arwdDxtm, 칸 단위 ACL 없음 — SELECT 로 확인) 가족 구성원이 남의 기록의 user_id 를 자기 것으로
-- 바꾸거나, 자기 기록의 user_id 를 다른 사람 id 로 바꿀 수 있었다. user_id 는 '누가 적었나'·SELECT 정책
-- (auth.uid() = user_id)·탈퇴 삭제(.eq('user_id'))가 기대는 칸이라 고객이 쓰면 안 된다.
--
-- # 어떻게
-- 표 단위 UPDATE 가 있으면 칸 단위 회수가 안 먹으므로, 표 UPDATE 를 회수하고 user_id 를 뺀 칸 목록으로
-- authenticated 에 다시 준다(anon 은 주지 않는다 — 로그인 없이 고칠 일이 없다).
-- 앱 코드 확인(grep): 이 세 표의 update 는 lib/dog-records.ts setMedicationEnabled({ enabled }) 하나뿐 — user_id 를 안 쓴다.
-- 칸 목록은 운영 칸(information_schema.columns, 2026-10-13)과 같다. 새 칸은 자동으로 막힌다(화이트리스트) —
-- 고객이 고쳐야 하는 칸이 생기면 그 마이그레이션에서 grant update (새칸) 을 명시한다.
-- 다시 실행해도 안전하다.

revoke update on table public.weight_logs from anon, authenticated;
revoke update on table public.dog_medications from anon, authenticated;
revoke update on table public.dog_vaccinations from anon, authenticated;

grant update (id, dog_id, weight, measured_at, note, created_at)
  on table public.weight_logs to authenticated;
grant update (id, dog_id, name, dose, schedule, "time", enabled, note, created_at, updated_at)
  on table public.dog_medications to authenticated;
grant update (id, dog_id, vaccine, "date", next_date, note, created_at, updated_at)
  on table public.dog_vaccinations to authenticated;

-- 자기 검증 — user_id 는 못 바꾸고, 나머지 칸은 그대로 바꿀 수 있다(칸이 빠지면 롤백).
do $$
declare
  t text;
  r record;
begin
  foreach t in array array['weight_logs', 'dog_medications', 'dog_vaccinations'] loop
    if has_column_privilege('authenticated', 'public.' || t, 'user_id', 'update')
       or has_column_privilege('anon', 'public.' || t, 'user_id', 'update') then
      raise exception '%.user_id 를 고객이 아직 바꿀 수 있다', t;
    end if;
    for r in
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name <> 'user_id'
    loop
      if not has_column_privilege('authenticated', 'public.' || t, r.column_name, 'update') then
        raise exception '%.% 칸 수정 권한이 빠졌다 — 칸 목록을 운영과 맞출 것', t, r.column_name;
      end if;
    end loop;
  end loop;
end $$;
