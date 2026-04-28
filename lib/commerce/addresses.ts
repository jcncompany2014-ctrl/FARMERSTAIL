/**
 * 배송지(Shipping addresses) — 공용 타입 & zod 스키마.
 *
 * 쓰임새
 * ----
 *  - /mypage/addresses UI 에서 form validation
 *  - /api/addresses 라우트에서 서버측 validation (두 번 검증)
 *  - 체크아웃 화면에서 프로필 fallback 대신 이 테이블을 참조
 *
 * 스키마 메모
 * ----
 *  - recipient_name / phone / zip / address 필수
 *  - address_detail / label 은 optional — 단독주택 / 별칭 미입력 케이스
 *  - phone 은 한국 번호 대략 매칭 (국제 체류자 대응해 너무 빡빡히 막진 않음)
 *  - zip 은 5자리 숫자 (우편번호 개편 후 포맷)
 */

import { z } from 'zod'

/** DB 행 타입 — Supabase select 결과와 1:1. */
export type AddressRow = {
  id: string
  user_id: string
  label: string | null
  recipient_name: string
  phone: string
  zip: string
  address: string
  address_detail: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

/** UI 로 넘기는 카멜케이스 뷰. */
export type Address = {
  id: string
  label: string
  recipientName: string
  phone: string
  zip: string
  address: string
  addressDetail: string
  isDefault: boolean
}

export function rowToAddress(row: AddressRow): Address {
  return {
    id: row.id,
    label: row.label ?? '',
    recipientName: row.recipient_name,
    phone: row.phone,
    zip: row.zip,
    address: row.address,
    addressDetail: row.address_detail ?? '',
    isDefault: row.is_default,
  }
}

/** 한국 휴대폰/일반전화 대략 검사. 국제번호 대비 너무 빡빡히 제한하지 않음. */
const phoneRegex = /^[0-9+\-\s()]{7,20}$/

/** 5자리 숫자 우편번호. */
const zipRegex = /^\d{5}$/

/**
 * Create / Update 공용 입력 스키마.
 * id 는 URL path 로 받으니 바디에 포함하지 않는다.
 */
export const addressInputSchema = z.object({
  label: z
    .string()
    .trim()
    .max(20, '별칭은 20자 이내로 입력해 주세요.')
    .optional()
    .default(''),
  recipientName: z
    .string()
    .trim()
    .min(1, '받는 분 이름을 입력해 주세요.')
    .max(40, '이름이 너무 깁니다.'),
  phone: z
    .string()
    .trim()
    .min(7, '연락처를 입력해 주세요.')
    .max(20, '연락처가 너무 깁니다.')
    .regex(phoneRegex, '연락처 형식이 올바르지 않습니다.'),
  zip: z
    .string()
    .trim()
    .regex(zipRegex, '우편번호 5자리를 입력해 주세요.'),
  address: z
    .string()
    .trim()
    .min(1, '주소를 입력해 주세요.')
    .max(200, '주소가 너무 깁니다.'),
  addressDetail: z
    .string()
    .trim()
    .max(100, '상세 주소가 너무 깁니다.')
    .optional()
    .default(''),
  isDefault: z.boolean().optional().default(false),
})

export type AddressInput = z.infer<typeof addressInputSchema>

/** DB 삽입/업데이트 페이로드로 변환 (카멜 → 스네이크). */
export function toDbPayload(input: AddressInput, userId?: string) {
  const payload: Record<string, unknown> = {
    label: input.label?.trim() || null,
    recipient_name: input.recipientName.trim(),
    phone: input.phone.trim(),
    zip: input.zip.trim(),
    address: input.address.trim(),
    address_detail: input.addressDetail?.trim() || null,
    is_default: input.isDefault ?? false,
  }
  if (userId) payload.user_id = userId
  return payload
}
