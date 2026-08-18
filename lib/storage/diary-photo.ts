/**
 * dog-diary-photos 스토리지 경로 헬퍼.
 *
 * # 왜 (2026-08-19 5라운드 감사)
 * 사진 일기는 업로드 직후 **1년짜리 signed URL** 을 DB(dog_diary.photo_urls)에
 * 박제하고 있었다. dog-diary-photos 버킷은 private 이라 signed URL 없이는 못
 * 여는데, 그 URL 이 만료되면(1년 뒤) **저장된 모든 일기 사진이 통째로 깨진다** —
 * 재서명 경로가 없기 때문이다. 체크인 사진(CheckinClient)은 올바른 패턴을 쓴다:
 * DB 에는 **경로만** 저장하고 조회할 때마다 짧은 signed URL 을 재발급한다.
 *
 * 이 헬퍼는 저장값에서 항상 **스토리지 경로**를 얻는다:
 *  · 신규 저장값 = 경로 그대로.
 *  · 레거시 저장값 = 1년 signed URL → 그 안의 경로를 추출(읽기 경로가 옛 행도
 *    재서명할 수 있게). 마이그레이션 없이 옛/새 행이 함께 동작한다.
 */
const BUCKET_MARKER = '/dog-diary-photos/'

export function diaryPhotoPath(stored: string): string {
  if (!stored) return stored
  // 신규: http 로 시작하지 않으면 이미 경로다.
  if (!stored.startsWith('http')) return stored
  // 레거시: signed URL 에서 버킷 마커 뒤 ~ 쿼리스트링 앞을 경로로 추출.
  const i = stored.indexOf(BUCKET_MARKER)
  if (i === -1) return stored
  const rest = stored.slice(i + BUCKET_MARKER.length)
  const q = rest.indexOf('?')
  return q === -1 ? rest : rest.slice(0, q)
}
