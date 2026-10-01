-- 2026-10-01 저장된 처방 근거 문구 정리 (규칙148 · 코드 ab12c946 의 데이터 쪽).
-- 사장님: "연어라는 멘트 나오면 안 되는 거 알지? 아예 전부 안 나오게" · "오리 알러지인데 왜 오리가".
-- 코드는 새로 계산하는 처방부터 막는다(lib/personalization/reasoning-final). 이미 저장된 처방 5건을 같은 규칙으로 정리한다.
-- 레시피 비율·kcal·금액·computed_at 은 건드리지 않는다 — reasoning(근거 문구 배열)만.
--
--  · 펀치: '연어 → 오리'·'연어 비슷한 단백질 주의'(연어) · '위장 민감 · 오리 위주'·'성장기 … 오리·한우 위주'(오리 알레르기,
--          실제 박스는 흑돼지)
--  · 달: '연어·생선 차단'(연어) · '타우린이 풍부한 레시피(한우) 권장'(소고기 알레르기)
--  · 서너(사장님 테스트 값): '성장기 … 오리·한우 위주'(실제 박스 흑돼지)
--  · 시바·땅콩: '잘 먹는 고기: … 연어 …' — 목록에서 연어만 뺀다(문구는 유지)
-- 롤백 프로브(PROBE_OK 예외) 통과: 남은 연어 0, 펀치 = 오리 차단 | 닭·칠면조 차단 | 맞춤 베이스 | 간식 10% | 첫 박스 · 선호 흑돼지.
do $$
declare n int; left_salmon int;
begin
  -- 다른 DB(브랜치·마이그레이션 재생)에는 이 행들이 없다 — 그때는 아무것도 안 한다.
  if not exists (
    select 1 from public.dog_formulas
     where id in ('7f0c518f-bbb9-43ef-9af2-2ddcd7e7d805', '78af5bad-ba6a-4db3-b422-9aafb39a8bd6',
                  '39487372-b01c-4d17-811d-e0ff103bcb5e', 'c99f0929-d12b-4c06-86ad-3c30189fbea1',
                  '4de73f3b-e1dd-49f4-9d35-37ee66602e0e')
  ) then
    return;
  end if;

  update public.dog_formulas f set reasoning = (
      select coalesce(jsonb_agg(e order by ord), '[]'::jsonb)
      from jsonb_array_elements(f.reasoning) with ordinality t(e, ord)
      where not (e->>'ruleId' = any (x.drop_rules)))
  from (values
     ('7f0c518f-bbb9-43ef-9af2-2ddcd7e7d805'::uuid, array['cross-react-skin','gate-line-skin','age-puppy','gi-sensitive']),
     ('78af5bad-ba6a-4db3-b422-9aafb39a8bd6'::uuid, array['allergy-skin','chronic-cardiac']),
     ('39487372-b01c-4d17-811d-e0ff103bcb5e'::uuid, array['age-puppy'])
  ) as x(id, drop_rules)
  where f.id = x.id;
  get diagnostics n = row_count;
  if n <> 3 then raise exception '문구 삭제 대상 % 행 (3 이어야 함) — 전체 취소', n; end if;

  update public.dog_formulas f set reasoning = (
     select jsonb_agg(case when e->>'trigger' like '잘 먹는 고기:%'
                           then jsonb_set(e, '{trigger}', to_jsonb(regexp_replace(regexp_replace(e->>'trigger', ', 연어', '', 'g'), '연어, ', '', 'g')))
                           else e end order by ord)
     from jsonb_array_elements(f.reasoning) with ordinality t(e, ord))
  where f.id in ('c99f0929-d12b-4c06-86ad-3c30189fbea1', '4de73f3b-e1dd-49f4-9d35-37ee66602e0e');
  get diagnostics n = row_count;
  if n <> 2 then raise exception '선호 목록 정리 대상 % 행 (2 이어야 함) — 전체 취소', n; end if;

  select count(*) into left_salmon from public.dog_formulas where reasoning::text ~ '연어';
  if left_salmon <> 0 then raise exception '연어 문구가 % 행에 남았다 — 전체 취소', left_salmon; end if;
end $$;
