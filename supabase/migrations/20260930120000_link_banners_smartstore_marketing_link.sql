-- /link 스마트스토어 배너 주소 → 사장님이 준 네이버 마케팅 링크(2026-09-30).
-- NaPm 은 네이버 쪽 유입 집계값이라 통째로 둔다. 코드 폴백(lib/links.ts SMARTSTORE_URL)과 같은 값.
-- 예전 기본 주소 그대로인 배너만 바꾼다(어드민에서 따로 고친 주소는 건드리지 않음).
update public.link_banners
set href = 'https://smartstore.naver.com/farmerstail?NaPm=ct%3D1k3pc0air%7Cci%3Dshopn%7Ctr%3Dmktlnk%7Chk%3Da8be6386e76ece0ea39773e5ef80b98b699a375f%7Ctrx%3Dundefined',
    updated_at = now()
where href in ('https://smartstore.naver.com/farmerstail', 'https://smartstore.naver.com/farmerstail/');
