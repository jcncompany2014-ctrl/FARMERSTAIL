'use client'

/**
 * /design-check/analysis?s=chat-* — AI 영양 상담 화면(ChatView)에 예시 대화·오류를 넣어 그린다. 미리보기 전용.
 * 실제 화면과 같은 머리·주의 상자(ChatParts)를 쓴다. 보내기·지우기는 동작하지 않는다(예시).
 */

import { useState } from 'react'
import { ChatView, type Message } from '../../chat/ChatClient'
import { ChatCaution, ChatHero } from '../../chat/ChatParts'
import { FX_DOG_ID } from './_fixtures_more'

const DOGS = [
  { id: FX_DOG_ID, name: '땅콩', photoUrl: '/sheltie-snow-45.jpg' },
  { id: '00000000-0000-4000-8000-000000000002', name: '보리', photoUrl: null },
]

const TALK: Message[] = [
  { role: 'user', content: '땅콩이가 요즘 아침밥을 조금 남겨요. 괜찮을까요?' },
  {
    role: 'assistant',
    content:
      '가끔 남기는 건 흔한 일이에요. 기운과 변 상태가 평소와 같다면 크게 걱정하지 않아도 돼요.\n\n• 하루 양은 그대로 두고, 아침을 조금 줄여 저녁에 나눠 주세요\n• 밥 주기 전 간식은 잠시 쉬어 보세요\n\n이틀 넘게 거의 먹지 않거나 토하거나 설사를 하면 동물병원에 꼭 가 주세요.',
  },
]

const ERRORS: Record<string, string> = {
  'chat-limit': '오늘은 더 이상 요청할 수 없어요. 내일 다시 시도해 주세요.',
  'chat-fail': '지금은 답변을 드리지 못했어요. 잠시 후 다시 시도해 주세요.',
}

export default function ChatDemo({ which }: { which: string }) {
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState(FX_DOG_ID)
  const empty = which === 'chat-empty'
  return (
    <div style={{ paddingBottom: 28, lineHeight: 'normal' }}>
      <ChatHero />
      <ChatView
        dogs={DOGS}
        selectedDogId={selected}
        onSelectDog={setSelected}
        messages={empty ? [] : TALK}
        historyLoading={false}
        loading={false}
        error={ERRORS[which] ?? null}
        nudge={
          empty
            ? { reason: 'first_chat', message: '안녕하세요. 영양 도우미예요. 땅콩이에 대해 어떤 게 가장 궁금하세요?' }
            : null
        }
        onDismissNudge={() => {}}
        onUseNudgePrompt={setInput}
        input={input}
        onInputChange={setInput}
        onSend={() => {}}
        onClearHistory={() => {}}
      />
      <ChatCaution />
    </div>
  )
}
