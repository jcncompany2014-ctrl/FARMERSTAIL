-- 체중 기록 날짜(weight_logs.measured_at) 기본값을 한국 날짜로 (2026-10-13 점검, 규칙194).
--
-- # 왜
-- 운영 기본값은 CURRENT_DATE 다(2026-10-13 SELECT 로 확인: column_default = 'CURRENT_DATE', 칸 형 date).
-- DB 시간대는 UTC 라 한국 아침 0~9시에 잰 체중이 **전날** 날짜로 찍혔다 — 기록 화면·체중 그래프·
-- '마지막 기록 N일 전'·체중 알림 크론이 하루씩 어긋난다.
-- 앱의 저장 두 곳(DogDetailClient·QuickWeightSheet)은 이제 한국 날짜를 직접 넣는다. 이 기본값은
-- 값을 안 넣는 다른 경로(옛 앱 빌드·관리자 SQL 등)를 위한 안전망이다.
--
-- 다시 실행해도 안전하다(같은 기본값을 다시 넣을 뿐). 이미 저장된 행은 바꾸지 않는다.

alter table public.weight_logs
  alter column measured_at set default ((now() at time zone 'Asia/Seoul')::date);

-- 자기 검증 — 기본값이 한국 날짜 식인지.
do $$
declare
  v_default text;
begin
  select column_default into v_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'weight_logs' and column_name = 'measured_at';
  if v_default is null or v_default not ilike '%Asia/Seoul%' then
    raise exception 'weight_logs.measured_at 기본값이 한국 날짜가 아니다: %', v_default;
  end if;
end $$;
