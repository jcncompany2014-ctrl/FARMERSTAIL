'use client'

/**
 * /design-check/dogs 의 '열린 상태' 데모 — 확인 창을 띄운 채 / 사진을 고른 채로 보여 줘 시안(D02·D03)과 비교한다.
 * 미리보기 전용. 예시라 저장·삭제를 눌러도 로그인이 없어 아무것도 바뀌지 않는다.
 */

import { useEffect, useRef, useState } from 'react'
import { useConfirm } from '@/components/v3'
import DiaryClient from '../../dogs/[id]/diary/DiaryClient'

type Entries = Parameters<typeof DiaryClient>[0]['initialEntries']

/** 삭제 확인 창(공용 useConfirm)을 바로 띄운다 — 시안 D03. */
export function ConfirmDemo() {
  const confirm = useConfirm()
  const opened = useRef(false)
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    void confirm({
      title: '이 일기를 삭제할까요?',
      body: (
        <>
          사진과 메모가 모두 사라져요.
          <br />
          삭제하면 되돌릴 수 없어요.
        </>
      ),
      confirmLabel: '삭제',
      tone: 'destructive',
    })
  }, [confirm])
  return null
}

/** 일기 쓰기 창 — 사진 두 장·메모·기분을 고른 채로(시안 D02). 사진은 공개 폴더 그림을 파일로 만들어 넣는다. */
export function DiaryWriteDemo({
  dogId,
  dogName,
  entries,
  photos,
}: {
  dogId: string
  dogName: string
  entries: Entries
  photos: string[]
}) {
  const [files, setFiles] = useState<File[] | null>(null)
  useEffect(() => {
    let alive = true
    void Promise.all(
      photos.map(async (src, i) => {
        const blob = await (await fetch(src)).blob()
        return new File([blob], `preview-${i}.jpg`, { type: blob.type || 'image/jpeg' })
      }),
    ).then((list) => {
      if (alive) setFiles(list)
    })
    return () => {
      alive = false
    }
  }, [photos])
  if (!files) return null
  return (
    <DiaryClient
      dogId={dogId}
      dogName={dogName}
      initialEntries={entries}
      previewDraft={{ files, note: '아침 산책 다녀와서 한 그릇 싹 비웠어요.', mood: 4 }}
    />
  )
}
