# 마이그레이션 폴더 읽는 법 (2026-09-16)

- **이 폴더는 기록·리뷰용 정본**이다. 프로덕션 적용은 Supabase MCP `apply_migration` 으로 하고,
  같은 SQL 을 여기 파일로 함께 커밋한다. `supabase db push` 는 쓰지 않는다 — 원격 version 은
  MCP 가 부여한 적용 시각이라 파일명과 일치하지 않는다(docs/RUNBOOK.md §7).
- **기준선(baseline) 파일이 없다.** 2026-04-23 이전에 만들어진 기반 테이블(profiles·dogs·
  surveys·analyses·orders·products·weight_logs·dog_reminders 등)과 초기 원격 마이그레이션
  11건은 이 폴더에 없다. 새 환경(스테이징·로컬)을 처음부터 만들려면 먼저
  `supabase db dump --schema public,storage > supabase/schema_baseline.sql` 로 스냅샷을 뜬 뒤
  그 이후 파일만 적용한다(CLI 로그인·DB 비밀번호 필요 — 사장님 맥에서).
- `★기록용(사후 재현)` 헤더가 붙은 파일은 원문이 아니라 프로덕션 실측으로 재구성한 것이다
  (20260508 push_campaigns · 20260520 budget_tier · 20260630 drop_coupon_system ·
  20260711 reweighs/kibble/factor_breakdown · 20260725 admin_note).
- 검증용 DML 파일(20260915000100)은 본문을 비웠다 — 재실행되면 사용자에게 메일이 한 통 더 간다.
