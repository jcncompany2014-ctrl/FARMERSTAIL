-- 배송지(Shipping Addresses) 관리.
--
-- 쓰임새
-- ----
-- 기존에는 profiles 테이블에 (zip, address, address_detail) 를 단일 필드로
-- 붙여 "대표 배송지 1건" 만 저장했다. 반려동물용품 구매 패턴상 유저가 여러
-- 배송지(집, 회사, 부모님 댁 등) 를 전환해서 쓰는 일이 잦아, 다건 저장 +
-- 기본값 지정 + 체크아웃에서 골라 쓰는 구조가 필요.
--
-- 설계
-- ----
--  · id 는 uuid, user_id 로 auth.users 참조 + ON DELETE CASCADE.
--    탈퇴 시 /api/account/delete 가 auth.users 행을 지우면 따라서 사라진다.
--  · label 은 "집", "회사" 같은 별칭. optional (빈 문자열 허용).
--  · recipient_name / phone 은 필수 — 기본 프로필 이름·연락처와 다른 수령인
--    을 지정하는 경우를 위해 주소 단위로 저장.
--  · zip + address 필수, address_detail 은 optional (단독주택 등 동/호수 없음 케이스).
--  · is_default — 유저별로 단 하나만 true. partial unique index 로 enforce.
--  · 기본값 지정 로직은 트리거에서 처리: 새 default 가 들어오면 기존
--    default 는 자동 false 로 내린다. 앱 단에서 경쟁 상태가 생겨도 DB 에서
--    수렴하도록.
--  · 첫 주소로 등록되는 건 자동 default 가 되도록 트리거에서 처리.
--
-- 보안
-- ----
--  · RLS — user_id = auth.uid() 만 SELECT/INSERT/UPDATE/DELETE.
--  · 관리자 접근은 별도 서비스 키 경로로만 (JWT 의 app_metadata.admin=true
--    조회는 이 테이블에선 필요 없음 — 배송지는 순전히 유저 자산).

BEGIN;

CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text,                                       -- "집" / "회사" 등 별칭. 빈 값 가능.
  recipient_name text NOT NULL,
  phone text NOT NULL,
  zip text NOT NULL,
  address text NOT NULL,                            -- 도로명/지번 주소 본체
  address_detail text,                              -- 동·호수·상세
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- user 당 default 한 행만. partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_default_per_user
  ON public.addresses (user_id)
  WHERE is_default = true;

-- user_id 조회 가속.
CREATE INDEX IF NOT EXISTS addresses_user_id_idx
  ON public.addresses (user_id);

-- updated_at 자동 갱신.
DROP TRIGGER IF EXISTS addresses_set_updated_at ON public.addresses;
CREATE TRIGGER addresses_set_updated_at
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- default 토글 트리거: 새 행이 default=true 로 들어오거나 update 로 true 가
-- 되면, 같은 유저의 기존 default 행을 false 로 내린다.
-- 또한 해당 유저가 아직 default 를 가진 주소가 하나도 없다면 insert 시
-- 자동으로 is_default=true 로 설정한다 (첫 주소는 자동 기본값).
CREATE OR REPLACE FUNCTION public.addresses_manage_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT 시점
  IF TG_OP = 'INSERT' THEN
    -- 아직 default 가 없다면 첫 행을 자동 default 로.
    IF NOT EXISTS (
      SELECT 1 FROM public.addresses
      WHERE user_id = NEW.user_id AND is_default = true
    ) THEN
      NEW.is_default := true;
    END IF;
  END IF;

  -- 본 행이 default=true 가 되었을 때 같은 user 의 다른 default 를 해제.
  IF NEW.is_default = true THEN
    UPDATE public.addresses
       SET is_default = false
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS addresses_manage_default_ins ON public.addresses;
CREATE TRIGGER addresses_manage_default_ins
  BEFORE INSERT ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.addresses_manage_default();

DROP TRIGGER IF EXISTS addresses_manage_default_upd ON public.addresses;
CREATE TRIGGER addresses_manage_default_upd
  AFTER UPDATE OF is_default ON public.addresses
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.addresses_manage_default();

-- RLS.
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS addresses_self_select ON public.addresses;
CREATE POLICY addresses_self_select ON public.addresses
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS addresses_self_insert ON public.addresses;
CREATE POLICY addresses_self_insert ON public.addresses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS addresses_self_update ON public.addresses;
CREATE POLICY addresses_self_update ON public.addresses
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS addresses_self_delete ON public.addresses;
CREATE POLICY addresses_self_delete ON public.addresses
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.addresses IS
  '유저 배송지. 다건 저장, 기본값 1개. RLS: 본인만.';
COMMENT ON COLUMN public.addresses.label IS
  '별칭 ("집", "회사"). 사용자 편의용. 빈 값 허용.';
COMMENT ON COLUMN public.addresses.is_default IS
  '기본 배송지 여부. user 당 최대 1. 트리거가 정합성 유지.';

COMMIT;
