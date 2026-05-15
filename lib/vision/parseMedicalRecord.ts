/**
 * Claude Vision 으로 진료 영수증 / 처방전 이미지에서 구조화된 정보 추출.
 *
 * # 흐름
 *  1) 클라이언트가 이미지 file 선택 → base64 encoded data url 로 변환
 *  2) POST /api/health/ocr 로 전송
 *  3) 이 함수가 Anthropic /v1/messages 호출 (vision 입력)
 *  4) JSON 응답 파싱 → MedicalRecordExtract 반환
 *  5) 호출처 (UI) 가 사용자에게 보여주고 "맞아요? 적용할까요?" 확인 후
 *     dogs / health_records 에 반영
 *
 * # 안전 — 자동 DB 반영 금지
 * OCR 결과를 바로 dogs.chronic_conditions 같은 컬럼에 쓰지 않는다.
 * Vision 추출은 신뢰도가 낮을 수 있고, 사용자가 직접 확인하지 않은 변경은
 * voice-guidelines §6 (첫 4주 보호) 와 §4 (부정 정보 점진 공개) 정책 위반.
 * 호출처에서 미리보기 화면 → confirm → 별도 endpoint 호출.
 *
 * # 모델
 * claude-3-5-sonnet-20241022 — vision 지원, 한글 의무 텍스트 인식 OK.
 * haiku 는 vision OCR 정확도가 떨어져 sonnet 채택. 단가는 호출당 ~5원 추정.
 */

export type MedicalRecordExtract = {
  /** 진료/내원 날짜 (YYYY-MM-DD). 불명 시 null. */
  visitDate: string | null
  /** 진료서에 기재된 체중 kg. 불명 시 null. */
  weightKg: number | null
  /** 진단명 (한글). 빈 배열 가능. */
  diagnosis: string[]
  /** 처방 약 — 이름 / 용량 / 빈도. 빈 배열 가능. */
  medications: Array<{
    name: string
    dosage: string | null
    frequency: string | null
  }>
  /** 자유 텍스트 notes — "수술 후 1주 검진" 같은 메모. */
  vetNotes: string | null
  /**
   * Claude 가 self-rate 한 추출 신뢰도 0~1.
   * 0.5 미만이면 UI 가 "사진이 잘 안 읽혀요. 다시 찍어보실래요?" 처리.
   */
  confidence: number
}

export type OcrResult =
  | { ok: true; data: MedicalRecordExtract }
  | { ok: false; code: string; message: string }

const SYSTEM_PROMPT = `당신은 한국 동물병원 진료서 / 처방전 / 영수증 이미지를
구조화된 JSON 으로 변환하는 OCR 도우미입니다.

규칙:
- 이미지가 진료 관련 문서가 아니면 confidence 0 으로 응답하세요.
- 진단명은 한글 그대로. 영문 약자가 있으면 한글 + (영문) 형식.
- 처방 약은 이름 + 용량 + 복용 빈도 분리. 불명 항목은 null.
- 체중은 숫자만 (kg). "5.2kg" → 5.2. 단위 없으면 null.
- 모르겠는 항목은 null / 빈 배열. 추측 금지.
- 응답은 반드시 단일 JSON 객체. 주석/설명/마크다운 코드블록 금지.

JSON 스키마:
{
  "visitDate": "YYYY-MM-DD" 또는 null,
  "weightKg": 숫자 또는 null,
  "diagnosis": ["진단명1", "진단명2"],
  "medications": [
    { "name": "약 이름", "dosage": "1회 용량", "frequency": "1일 N회" }
  ],
  "vetNotes": "메모" 또는 null,
  "confidence": 0~1 사이 숫자
}`

type AnthropicVisionResponse = {
  content?: Array<{ type: string; text?: string }>
  error?: { type?: string; message?: string }
}

/**
 * 이미지 base64 → Claude Vision → 구조화된 추출.
 *
 * @param imageDataUrl `data:image/jpeg;base64,...` 형식. 다른 mime 도 OK.
 *                     순수 base64 (data: prefix 없음) 도 허용 — 자동 감지.
 */
export async function parseMedicalRecord(
  imageDataUrl: string,
  apiKey: string,
): Promise<OcrResult> {
  // data url 분해 — Anthropic vision 은 base64 + media_type 분리 요구
  let mediaType: string
  let base64Data: string
  const m = /^data:([^;]+);base64,(.*)$/.exec(imageDataUrl)
  if (m) {
    mediaType = m[1]
    base64Data = m[2]
  } else {
    // mime 모르면 png 로 가정 (Anthropic 도 fallback). 실패하면 error 응답.
    mediaType = 'image/jpeg'
    base64Data = imageDataUrl
  }

  if (!base64Data) {
    return { ok: false, code: 'INVALID_IMAGE', message: '이미지가 비어있어요' }
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: '이 문서를 JSON 으로 추출해주세요.',
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as AnthropicVisionResponse
      return {
        ok: false,
        code: err.error?.type ?? 'AI_ERROR',
        message: err.error?.message ?? 'OCR 호출에 실패했어요',
      }
    }

    const data = (await res.json()) as AnthropicVisionResponse
    const raw = data.content?.find((c) => c.type === 'text')?.text?.trim() ?? ''
    if (!raw) {
      return {
        ok: false,
        code: 'EMPTY_RESPONSE',
        message: 'AI 응답이 비어있어요',
      }
    }

    const parsed = parseJsonSafe(raw)
    if (!parsed) {
      return {
        ok: false,
        code: 'INVALID_JSON',
        message: '결과를 해석하지 못했어요',
      }
    }

    return { ok: true, data: normalize(parsed) }
  } catch (err) {
    return {
      ok: false,
      code: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : '네트워크 오류',
    }
  }
}

/** Claude 가 가끔 ```json ... ``` 으로 감싸기도 해서 fence 제거 후 파싱. */
function parseJsonSafe(text: string): unknown {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }
  try {
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

/**
 * 모델 응답을 MedicalRecordExtract 로 normalize.
 * 누락/오타 필드는 안전한 default 로 채워넣어 호출처가 항상 같은 shape
 * 으로 다룰 수 있게.
 */
export function normalize(raw: unknown): MedicalRecordExtract {
  const r = (raw ?? {}) as Record<string, unknown>
  const meds = Array.isArray(r.medications) ? r.medications : []
  const diagnosis = Array.isArray(r.diagnosis)
    ? r.diagnosis.filter((d): d is string => typeof d === 'string')
    : []
  return {
    visitDate: typeof r.visitDate === 'string' ? r.visitDate : null,
    // audit #27: OCR 이 "5.2g" 를 "5.2" 로 또는 "52" (kg 단위 누락) 로 추출 시
    // null 처리. 0.1~150kg 합리적 범위 외는 신뢰 불가.
    weightKg:
      typeof r.weightKg === 'number' &&
      Number.isFinite(r.weightKg) &&
      r.weightKg >= 0.1 &&
      r.weightKg <= 150
        ? r.weightKg
        : null,
    diagnosis,
    medications: meds
      .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
      .map((m) => ({
        name: typeof m.name === 'string' ? m.name : '',
        dosage: typeof m.dosage === 'string' ? m.dosage : null,
        frequency: typeof m.frequency === 'string' ? m.frequency : null,
      }))
      .filter((m) => m.name.length > 0),
    vetNotes: typeof r.vetNotes === 'string' ? r.vetNotes : null,
    confidence:
      typeof r.confidence === 'number' && Number.isFinite(r.confidence)
        ? Math.max(0, Math.min(1, r.confidence))
        : 0,
  }
}
