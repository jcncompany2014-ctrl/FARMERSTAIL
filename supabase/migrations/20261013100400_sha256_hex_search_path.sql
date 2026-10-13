-- sha256_hex 가 digest() 를 못 찾던 것 고치기 (2026-10-13 점검, 규칙197).
--
-- # 왜
-- 운영 정의(2026-10-13 SELECT):
--   sha256_hex(input text) … SET search_path TO 'public', 'pg_catalog'
--   본문: select encode(digest(lower(trim(coalesce(input, ''))), 'sha256'), 'hex')
-- digest() 는 pgcrypto 함수이고 pgcrypto 는 extensions 스키마에 있다(pg_extension 실측: extnamespace = extensions).
-- 20260512000000 이 search_path 를 public, pg_catalog 로 고정하면서 extensions 가 빠져, 이 함수는 부를 때마다
-- "function digest(text, unknown) does not exist" 로 실패했다. 탈퇴 라우트는 오류를 안 보고 넘어가서
-- account_deletions.email_hash 가 **전부 비어** 있었다(운영 1/1 건 null) — '같은 사람 재가입 확인'이 안 됐다.
--
-- # 어떻게
-- 본문은 그대로 두고 search_path 에 extensions 를 넣는다. 다시 실행해도 안전하다.

alter function public.sha256_hex(text) set search_path = public, extensions, pg_catalog;

-- 자기 검증 — 실제로 해시가 나온다(알려진 값: sha256('') ).
do $$
begin
  if public.sha256_hex('') <> 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' then
    raise exception 'sha256_hex 결과가 틀리다';
  end if;
end $$;
