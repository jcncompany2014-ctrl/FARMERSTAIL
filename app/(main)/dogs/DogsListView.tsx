/**
 * DogsListView — '우리 아이' 탭 목록 그리기(시안 T07 목록 · T08 비었을 때).
 *
 * 2026-10-09 앱 새 디자인('A 포스터'): 조회는 page.tsx(서버)가 그대로 하고, 그리는 부분만 여기로 뺐다 —
 * 점검 화면(/design-check/dogs, 미리보기 전용)이 같은 부품에 예시 값을 넣어 로그인 없이 시안과 나란히 본다.
 *
 *  · 화면 이름('우리 아이')은 윗줄(AppChrome)이 그린다 — 여기서 또 그리지 않는다(예전엔 두 번 보였다).
 *  · 아이 한 줄 = 회색 면(#F6F4F5) + 왼쪽 6px 머스타드 띠 · 사진 동그라미 60 · 이름(제목 글꼴 26) · 한 줄 정보 · 꺾쇠.
 *  · 비었을 때 = 점선 칸 안 발바닥 · "첫 아이" · 안내 · 먹색 '아이 등록하기'.
 * 훅이 없어 서버 컴포넌트로 그려진다.
 *
 * 줄 높이 — 시안은 줄 높이를 따로 안 준 글자가 글꼴 기본값(normal)이다. 앱은 전역이 1.5 라 그대로 두면
 * 칸마다 몇 px 씩 커진다 — 그래서 바깥에서 normal 로 되돌리고 시안이 정한 곳만 따로 준다.
 * 시안 카드의 min-height 88 은 content-box 기준(위아래 여백 14 를 더해 실제 116)이라 여기서도 content-box 로 둔다.
 */
import Link from 'next/link'
import Image from 'next/image'
import { V3, V3Radius } from '@/lib/design/tokens'
import { formatKg } from '@/lib/korean'
import { ChevronRightIcon, PawFillIcon } from '@/components/v3/dog/DogIcons'

export type DogListItem = {
  id: string
  name: string
  breed: string | null
  weight: number | null
  age_value: number | null
  age_unit: string | null
  photo_url: string | null
}

/** "셰틀랜드 시프도그 · 3살 · 11.2kg" — 없는 칸은 빼고 잇는다. */
function metaLine(d: DogListItem): string {
  const parts: string[] = []
  if (d.breed) parts.push(d.breed)
  if (d.age_value) parts.push(`${d.age_value}${d.age_unit === 'years' ? '살' : '개월'}`)
  if (d.weight) parts.push(formatKg(d.weight))
  return parts.join(' · ')
}

export default function DogsListView({ dogs }: { dogs: DogListItem[] }) {
  if (dogs.length === 0) {
    return (
      <div style={{ paddingBottom: 28, lineHeight: 'normal' }}>
        <section
          aria-labelledby="dogs-none-title"
          style={{
            margin: '24px 20px 0',
            padding: '36px 24px 28px',
            border: '1.5px dashed #9A9A9A',
            borderRadius: V3Radius.sm,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 10,
          }}
        >
          <span
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              background: V3.soft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PawFillIcon size={30} color={V3.ink} />
          </span>
          <span style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: V3.inkMute }}>첫 아이</span>
          <p id="dogs-none-title" style={{ margin: 0, fontSize: 21, fontWeight: 800, color: V3.ink }}>
            아직 등록된 아이가 없어요
          </p>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: V3.inkSoft }}>
            첫 번째 아이를 등록하고
            <br />
            맞춤 영양 분석을 받아볼 수 있어요
          </p>
          <Link
            href="/dogs/new"
            style={{
              marginTop: 12,
              alignSelf: 'stretch',
              height: 58,
              borderRadius: V3Radius.sm,
              background: V3.ink,
              color: '#FFFFFF',
              textDecoration: 'none',
              fontSize: 17,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            아이 등록하기
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 28, lineHeight: 'normal' }}>
      <ul
        style={{
          margin: '20px 20px 0',
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {dogs.map((dog) => {
          const meta = metaLine(dog)
          return (
            <li key={dog.id}>
              <Link
                href={`/dogs/${dog.id}`}
                aria-label={`${dog.name} 자세히 보기`}
                className="transition active:scale-[0.99]"
                style={{
                  minHeight: 88,
                  boxSizing: 'content-box',
                  padding: '14px 16px',
                  borderRadius: V3Radius.sm,
                  color: V3.ink,
                  textDecoration: 'none',
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 20px',
                  columnGap: 14,
                  alignItems: 'center',
                  background: V3.soft,
                  borderLeft: `6px solid ${V3.mustard}`,
                }}
              >
                <span
                  style={{
                    position: 'relative',
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    overflow: 'hidden',
                    background: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {dog.photo_url ? (
                    <Image src={dog.photo_url} alt="" fill sizes="60px" className="object-cover" />
                  ) : (
                    <PawFillIcon size={26} color="#9A9A9A" />
                  )}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <span
                    className="ft-poster"
                    style={{ fontSize: 26, lineHeight: 1.05, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
                  >
                    {dog.name}
                  </span>
                  {meta && <span style={{ fontSize: 15, color: V3.inkSoft }}>{meta}</span>}
                </span>
                <ChevronRightIcon size={20} color={V3.inkMute} />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
