/**
 * Anthropic 모델 ID SSOT.
 *
 * R82-G4: 이전엔 6개 routes 가 모델 ID 를 hardcode → drift 위험.
 * 신규 모델 출시 시 한 곳만 바꾸면 전체 일관성 유지.
 *
 * # 가격 (2026-05 기준)
 * - claude-haiku-4-5: input $1/M, output $5/M (text + vision)
 * - claude-sonnet-4: input $3/M, output $15/M (high accuracy)
 *
 * # 사용처별 모델 추천
 * - 일반 분석/챗봇/블로그: HAIKU (가장 싸고 빠름)
 * - 의료 비전 / 정확도 critical: VISION_HIGH 또는 HAIKU + confidence fallback
 */

/** 일반 텍스트 분석 — 가장 싼 모델, 95% case 충분 */
export const MODEL_HAIKU = 'claude-haiku-4-5'

/** Vision 입력 (이미지 + 텍스트) — haiku-4-5 가 vision 지원 */
export const MODEL_VISION = 'claude-haiku-4-5'

/** 고정확 비전 fallback — 낮은 confidence 시 재시도 용 */
export const MODEL_VISION_HIGH = 'claude-sonnet-4'

/** 챗봇 multi-turn — haiku 로 통일 (이전엔 claude-3-5-haiku-20241022 였음) */
export const MODEL_CHATBOT = 'claude-haiku-4-5'

/** AI 글 초안 생성 (admin/blog/draft) */
export const MODEL_BLOG_DRAFT = 'claude-haiku-4-5'

/** Anthropic API version header */
export const ANTHROPIC_VERSION = '2023-06-01'

/** API endpoint */
export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
