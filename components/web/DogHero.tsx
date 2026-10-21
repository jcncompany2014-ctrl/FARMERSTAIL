/**
 * 맨 위 아이 사진 칸 — 이벤트 화면(/p/코드)과 서포터즈 링크 모음(/link/코드)이 같이 쓴다(2026-10-19 시안 A '사진 + 머스터드').
 * 가로 사진은 칸을 꽉 채우고, 세로 사진·영상은 같은 그림을 흐리게 깔고 가운데 통째로 둔다(보호자가 얹은 글이 잘리지 않게).
 * 오른쪽 위 이름표(먹색 칸, 이름은 노랑) · 왼쪽 아래 흰 이름표(tag, 선택).
 */
import Image from 'next/image'
import type { HeroDog } from '@/lib/supporters'
import HeroVideo from './HeroVideo'
import s from './dog-hero.module.css'

export default function DogHero({ dog, tag, className }: { dog: HeroDog; tag?: string; className?: string }) {
  const m = dog.media
  return (
    <div className={className ? `${s.hero} ${className}` : s.hero}>
      {m.kind === 'photo' && m.fit === 'cover' ? (
        <Image src={m.src} alt={dog.alt} fill sizes="(max-width: 480px) 100vw, 480px" priority className={s.cover} style={{ objectPosition: m.position ?? 'center' }} />
      ) : (
        <>
          <Image src={m.kind === 'video' ? m.poster : m.src} alt="" aria-hidden fill sizes="160px" className={s.backdrop} />
          <span className={s.portrait} style={{ aspectRatio: `${m.w} / ${m.h}` }}>
            {m.kind === 'video' ? (
              <HeroVideo src={m.src} poster={m.poster} label={dog.alt} className={s.media} />
            ) : (
              <Image src={m.src} alt={dog.alt} fill sizes="260px" priority className={s.media} />
            )}
          </span>
        </>
      )}
      {/* 이름만 — 견종은 넣지 않는다(사장님 10/19 "라벨에 견종은 빼"). */}
      <span className={s.name}>{dog.name}</span>
      {/* 세로 사진·영상엔 아래 이름표를 얹지 않는다 — 보호자가 얹은 글(피카 '깨-끗')을 가린다. */}
      {tag && m.kind === 'photo' && m.fit === 'cover' && <span className={s.tag}>{tag}</span>}
    </div>
  )
}
