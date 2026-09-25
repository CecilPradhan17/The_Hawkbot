import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  DAILY_CHAT_LIMIT,
  MAX_CHAT_MESSAGE_LENGTH,
  getRandomChatGreeting,
  getStoredChatUsage,
} from '@/utils/chatSession'

export default function HawkwallChatPrompt() {
  const navigate = useNavigate()
  const { username, isAdmin } = useAuth()
  const [greeting] = useState(() => getRandomChatGreeting(username))
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const rateLimited = !isAdmin && getStoredChatUsage() >= DAILY_CHAT_LIMIT

  const submitQuestion = () => {
    const question = input.trim()
    if (!question || rateLimited) return
    if (question.length > MAX_CHAT_MESSAGE_LENGTH) {
      setInputError(`Message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or fewer`)
      return
    }
    navigate('/chat', { state: { initialMessage: question } })
  }

  return (
    <section className="mb-6 rounded-2xl border border-[#8A244B]/20 bg-white px-4 py-5 shadow-sm sm:px-6">
      <div className="flex flex-col items-center text-center">
        <img
          src="/icon-192.png"
          alt=""
          aria-hidden="true"
          className="h-14 w-14 rounded-xl shadow-sm ring-1 ring-[#8A244B]/15"
        />
        <h1 className="mt-3 text-xl font-semibold text-[#8A244B] sm:text-2xl">
          {greeting}
        </h1>
      </div>

      <div className={`mt-4 flex items-end gap-3 rounded-2xl border px-4 py-3 transition-colors
        ${rateLimited ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200 bg-white'}`}
      >
        <textarea
          value={input}
          onChange={event => {
            setInput(event.target.value)
            setInputError(event.target.value.length > MAX_CHAT_MESSAGE_LENGTH
              ? `Message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or fewer`
              : null)
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submitQuestion()
            }
          }}
          rows={2}
          maxLength={MAX_CHAT_MESSAGE_LENGTH + 50}
          placeholder={rateLimited ? 'Daily limit reached' : 'Ask about campus...'}
          disabled={rateLimited}
          aria-label="Ask Hawkbot"
          className="min-h-12 flex-1 resize-none bg-transparent text-base text-slate-700 placeholder-slate-400 focus:outline-none disabled:cursor-not-allowed"
        />
        <button
          onClick={submitQuestion}
          disabled={rateLimited || !input.trim() || Boolean(inputError)}
          className="rounded-xl bg-[#8A244B] px-4 py-2 text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
        >
          Send
        </button>
      </div>
      {inputError && <p className="mt-1.5 px-1 text-xs text-[#8A244B]">{inputError}</p>}
      {!inputError && input.length > 200 && (
        <p className="mt-1.5 px-1 text-right text-xs text-slate-400">
          {input.length}/{MAX_CHAT_MESSAGE_LENGTH}
        </p>
      )}
    </section>
  )
}
