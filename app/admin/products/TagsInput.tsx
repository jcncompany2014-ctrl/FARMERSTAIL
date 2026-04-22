'use client'

import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'

type Props = {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

/**
 * Minimal chip input for tags. Commits on Enter or comma; backspace removes
 * the last chip when input is empty. Lowercases + trims; de-dupes.
 */
export default function TagsInput({
  value,
  onChange,
  placeholder = '태그 입력 후 Enter',
}: Props) {
  const [draft, setDraft] = useState('')

  function commit() {
    const t = draft.trim().replace(/^#/, '')
    if (!t) return
    const lower = t.toLowerCase()
    if (value.map((v) => v.toLowerCase()).includes(lower)) {
      setDraft('')
      return
    }
    onChange([...value, t])
    setDraft('')
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-lg bg-bg min-h-[38px] focus-within:ring-2 focus-within:ring-terracotta">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-rule text-[11px] font-semibold text-text"
        >
          #{tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            className="w-3.5 h-3.5 rounded-full hover:bg-sale/10 text-muted hover:text-sale flex items-center justify-center transition"
            aria-label={`${tag} 태그 제거`}
          >
            <X className="w-2.5 h-2.5" strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={commit}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[100px] bg-transparent text-xs text-ink placeholder:text-muted focus:outline-none"
      />
    </div>
  )
}
