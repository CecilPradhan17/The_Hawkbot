import { useState, useRef, useEffect } from 'react'
import { sendChatMessage } from '@/api/chat.api'
import Header from '@/components/Header'

interface Message {
  id: number
  role: 'user' | 'bot'
  content: string
  matched?: boolean
  isError?: boolean
}

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'bot',
      content: "Hi! I'm Hawkbot 🦅 Ask me anything about campus — I'll do my best to help based on verified student knowledge.",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || loading || rateLimited) return

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: trimmed,
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const data = await sendChatMessage({ message: trimmed })

      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'bot',
          content: data.response,
          matched: data.matched,
        },
      ])
    } catch (err: any) {
      const isRateLimit = err?.message?.includes('daily limit')

      if (isRateLimit) setRateLimited(true)

      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'bot',
          content: isRateLimit
            ? "You've reached your daily limit of 10 messages. Come back tomorrow! 🦅"
            : 'Something went wrong. Please try again.',
          isError: true,
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend()
  }

  const isInputDisabled = loading || rateLimited

  return (
    <div className="min-h-screen bg-[#FAF3E1] flex flex-col">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 flex flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto mb-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                  ${message.role === 'user'
                    ? 'bg-[#8A244B] text-white rounded-br-sm'
                    : message.isError
                      ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                      : 'bg-white text-slate-700 shadow-sm border border-slate-200 rounded-bl-sm'
                  }`}
              >
                {message.content}
                {message.role === 'bot' && message.matched === false && !message.isError && (
                  <p className="text-xs mt-2 text-slate-400 italic">
                    No verified match found
                  </p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 shadow-sm px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1">
                <span className="w-2 h-2 bg-[#8A244B] rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-[#8A244B] rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-[#8A244B] rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {rateLimited && (
          <div className="mb-3 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700 text-center">
            Daily limit reached — you can send 10 messages per day. See you tomorrow!
          </div>
        )}

        <div className={`flex gap-3 bg-white border rounded-2xl px-4 py-3 shadow-sm transition-colors
          ${isInputDisabled ? 'border-slate-100 opacity-60' : 'border-slate-200'}`}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={rateLimited ? 'Daily limit reached' : 'Ask about campus...'}
            disabled={isInputDisabled}
            className="flex-1 text-sm text-slate-700 placeholder-slate-400
                       focus:outline-none disabled:cursor-not-allowed bg-transparent"
          />
          <button
            onClick={handleSend}
            disabled={isInputDisabled || !input.trim()}
            className="px-4 py-1.5 bg-[#8A244B] text-white text-sm rounded-xl
                       hover:scale-105 disabled:opacity-50 disabled:hover:scale-100
                       transition-all"
          >
            Send
          </button>
        </div>
      </main>
    </div>
  )
}