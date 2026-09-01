-- 2026-09-01 출시 전 전수 감사 — 무동의 광고메일 경로 차단 + 폐기 버킷 정리.
--
-- ① newsletter_subscribers: anon 이 임의 이메일 + **자기가 정한 confirm_token** 을
--    직접 INSERT 할 수 있었다(정책 `newsletter public insert`, with_check 가
--    status='pending' 하나뿐). 그러면 double opt-in 이 무력화된다 —
--    공격자가 남의 이메일을 넣고 자기가 아는 토큰으로 /api/newsletter/confirm 을
--    호출해 status='confirmed' 로 만들면, 동의한 적 없는 사람에게 광고메일이 나간다
--    (lib/email/index.ts 의 발송 대상은 status='confirmed').
--    → 정보통신망법 §50(광고성 정보 수신 동의) 문제로 직결.
--
--    기능 손실 0 을 확인하고 지운다: app/api/newsletter/route.ts:56 이
--    createAdminClient()(service_role)를 만들고 :132 의 insert 가 그 클라이언트를
--    쓴다. 쿠키 클라이언트(:123)는 로그인 사용자 id 를 읽는 데만 쓴다.
--    service_role 은 RLS 를 우회하므로 이 정책이 없어도 정상 신청은 그대로 된다.
--    confirm_token 도 라우트가 서버에서 생성한다.
--
-- ② review-photos: 리뷰 기능은 2026-07-16 에 폐기했는데(20260716070000_drop_review_system)
--    공개 버킷과 업로드 정책만 남아 있었다. 아무 로그인 사용자나 우리 도메인에
--    공개 파일을 올릴 수 있는 상태다. 파일은 0개라 지워도 잃을 게 없다.

-- ── ① 뉴스레터 ───────────────────────────────────────────────────────────
drop policy if exists "newsletter public insert" on public.newsletter_subscribers;

-- 정책을 지워도 GRANT 가 남아 있으면 "정책이 없어서 막힌" 한 겹 방어다.
-- anon 은 GRANT 까지 회수해 두 겹으로 만든다.
--
-- ⚠️ authenticated 는 **회수하지 않는다.** 같은 표에 `newsletter admin all`(ALL,
--    authenticated) 정책이 있고 GRANT 는 RLS 보다 먼저 검사되므로, 여기서
--    authenticated 의 INSERT 를 회수하면 관리자 삽입 경로까지 같이 막힌다.
--    일반 로그인 사용자는 위 정책을 지운 것만으로 RLS 에서 막힌다.
revoke insert on public.newsletter_subscribers from anon;

-- ── ② 폐기된 리뷰 사진 버킷 ──────────────────────────────────────────────
drop policy if exists "review-photos self upload" on storage.objects;
update storage.buckets set public = false where id = 'review-photos';
