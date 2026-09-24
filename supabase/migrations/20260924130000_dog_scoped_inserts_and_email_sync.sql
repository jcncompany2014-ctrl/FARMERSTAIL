-- 2026-09-24 출시 전 전수 점검 — 두 가지.
--
-- ① 설문·체크인·첫 박스 기록은 **본인(또는 가족 member) 강아지에만** 쓸 수 있게.
--    surveys / dog_checkins / feeding_outcomes 의 INSERT 정책이 `auth.uid() = user_id` 만
--    봐서, 로그인한 아무나 **남의 강아지 id** 로 설문·체크인을 넣을 수 있었다. dogs.id 는
--    수의사 공유 링크(fetch_vet_share, anon 호출 가능)로도 알 수 있다. 그 설문은
--    personalization-progression 크론(service_role, dog_id 로만 조회)이 다음 박스 처방과
--    알레르기 게이트에 그대로 쓴다 — 알레르기 목록을 비운 가짜 설문으로 게이트를 비키거나,
--    (dog, cycle, checkpoint) 유니크 칸을 먼저 차지해 주인의 체크인 저장을 영구히 막을 수
--    있었다. 같은 성격의 analyses·weight_logs 는 이미 has_dog_role(dog_id,'member') 를 본다 —
--    같은 규칙으로 맞춘다. UPDATE 도 dog_id 를 남의 강아지로 바꿔치지 못하게 WITH CHECK 에 넣는다.
--    적용 전 실측: 세 표 모두 "강아지 주인·가족이 아닌 user_id" 행 0건(악용 흔적 없음).
--    쓰는 경로 전수: SurveyClient(본인/가족), /api/personalization/checkin(dog_formulas 로
--    주인 확인), FirstCheckinClient·lib/feeding-outcomes(본인). 웹 퍼널 자동가입은 service_role.
--
-- ② 로그인 이메일을 바꾸면 profiles.email 도 따라가게.
--    auth.users 트리거는 가입(AFTER INSERT)뿐이었다. 모든 발송(주문·결제 실패·정기배송 안내·
--    환영)은 profiles.email 로 가서, 이메일을 바꾼 고객은 새 주소로 로그인하면서 알림은 옛
--    (죽었거나 반송 차단된) 주소로 받았다. 계정 삭제(auth soft delete)는 auth 이메일을
--    비우므로 빈 값·삭제된 계정은 건드리지 않는다. 이 트리거가 실패해도 **인증 이메일 변경
--    자체는 막지 않는다**(예외를 경고로 삼킨다) — 알림 주소 동기화보다 로그인이 우선이다.

-- ① ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "Users can insert own surveys" on public.surveys;
drop policy if exists surveys_insert_member on public.surveys;
create policy surveys_insert_member on public.surveys
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.has_dog_role(dog_id, 'member'));

drop policy if exists dog_checkins_self_insert on public.dog_checkins;
drop policy if exists dog_checkins_insert_member on public.dog_checkins;
create policy dog_checkins_insert_member on public.dog_checkins
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.has_dog_role(dog_id, 'member'));

drop policy if exists dog_checkins_self_update on public.dog_checkins;
create policy dog_checkins_self_update on public.dog_checkins
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.has_dog_role(dog_id, 'member'));

drop policy if exists feeding_outcomes_insert_own on public.feeding_outcomes;
drop policy if exists feeding_outcomes_insert_member on public.feeding_outcomes;
create policy feeding_outcomes_insert_member on public.feeding_outcomes
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.has_dog_role(dog_id, 'member'));

drop policy if exists feeding_outcomes_update_own on public.feeding_outcomes;
create policy feeding_outcomes_update_own on public.feeding_outcomes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.has_dog_role(dog_id, 'member'));

-- ② ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null
     and new.email <> ''
     and new.deleted_at is null
     and new.email is distinct from old.email then
    begin
      update public.profiles
         set email = new.email
       where id = new.id
         and deleted_at is null;
    exception when others then
      raise warning 'sync_profile_email_from_auth failed for %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_profile_email_from_auth() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email_from_auth();
