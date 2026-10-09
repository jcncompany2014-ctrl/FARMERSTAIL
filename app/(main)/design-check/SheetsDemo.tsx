'use client'

/**
 * /design-check?s=sheet-* — 기록 시트를 열어 둔 채로 보여 줘 시안(캔버스 T12~T17)과 비교한다. 미리보기 전용.
 * 예시 강아지라 저장 버튼을 눌러도 기록되지 않는다(로그인·권한 없음 → 저장 실패 문구).
 */

import QuickHealthSheet from '@/components/v3/sheet/QuickHealthSheet'
import QuickWeightSheet from '@/components/v3/sheet/QuickWeightSheet'
import QuickMemoSheet from '@/components/v3/sheet/QuickMemoSheet'
import QuickPhotoSheet from '@/components/v3/sheet/QuickPhotoSheet'
import QuickWalkSheet from '@/components/v3/sheet/QuickWalkSheet'
import QuickChipSheet from '@/components/v3/sheet/QuickChipSheet'

import type { SheetKey } from './_fixtures'

const DOG = '00000000-0000-4000-8000-000000000001'
const NAME = '땅콩'
const noop = () => {}

export default function SheetsDemo({ which }: { which: SheetKey }) {
  return (
    <>
      <QuickHealthSheet open={which === 'sheet-health'} onClose={noop} dogId={DOG} dogName={NAME} />
      <QuickWeightSheet open={which === 'sheet-weight'} onClose={noop} dogId={DOG} dogName={NAME} initialKg={11.3} />
      <QuickMemoSheet open={which === 'sheet-memo'} onClose={noop} dogId={DOG} dogName={NAME} />
      <QuickPhotoSheet open={which === 'sheet-photo'} onClose={noop} dogId={DOG} dogName={NAME} />
      <QuickWalkSheet open={which === 'sheet-walk'} onClose={noop} dogId={DOG} dogName={NAME} />
      <QuickChipSheet
        open={which === 'sheet-meal'}
        onClose={noop}
        dogId={DOG}
        column="appetite"
        title={`${NAME} 오늘 밥 어땠나요?`}
        hint="해당하는 것만 누르세요 · 1초면 끝나요"
        label="식욕"
        options={[
          ['good', '좋음'],
          ['normal', '보통'],
          ['low', '적음'],
          ['none', '거부'],
        ]}
      />
    </>
  )
}
