import { useState, useRef, useEffect } from 'react'
import { sendChatMessage } from '@/api/chat.api'
import Header from '@/components/Header'
import { useAuth } from '@/context/AuthContext'

interface Message {
  id: number
  role: 'user' | 'bot'
  content: string
  matched?: boolean
  isError?: boolean
}

const DAILY_LIMIT = 7
const MAX_MESSAGE_LENGTH = 250
const withName = (name: string | null) => name ? `, ${name}` : ''
const GREETINGS = [
  (name: string | null) => `What's on your mind${withName(name)}?`,
  (name: string | null) => `How can I help${withName(name)}?`,
  (name: string | null) => `What are we figuring out today${withName(name)}?`,
  (name: string | null) => `Where should we start${withName(name)}?`,
  (name: string | null) => `What can I help you find${withName(name)}?`,
]

function getTodayKey() {
  return `hawkbot_usage_${new Date().toISOString().split('T')[0]}`
}

function getStoredUsage(): number {
  const stored = localStorage.getItem(getTodayKey())
  return stored ? parseInt(stored, 10) : 0
}

function saveUsage(count: number) {
  localStorage.setItem(getTodayKey(), String(count))
}

export default function Chatbot() {
  const { username, isAdmin } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)
  const [messagesUsed, setMessagesUsed] = useState(() => getStoredUsage())
  const [rateLimited, setRateLimited] = useState(() => !isAdmin && getStoredUsage() >= DAILY_LIMIT)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input on page load to show keyboard immediately on mobile
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || loading || rateLimited) return
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setInputError(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer`)
      return
    }
    setInputError(null)

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

      if (!isAdmin) {
        setMessagesUsed(prev => {
          const next = prev + 1
          saveUsage(next)
          if (next >= DAILY_LIMIT) setRateLimited(true)
          return next
        })
      }

      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'bot',
          content: data.response,
          matched: data.matched,
        },
      ])
    } catch (err: unknown) {
      const isRateLimit = err instanceof Error && err.message.includes('daily limit')

      if (isRateLimit) {
        setRateLimited(true)
        setMessagesUsed(DAILY_LIMIT)
        saveUsage(DAILY_LIMIT)
      }

      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'bot',
          content: isRateLimit
            ? "You've reached your daily limit of 7 messages. Come back tomorrow!"
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

  const isInputDisabled = loading || (!isAdmin && rateLimited)

  return (
    /*
     * Use 100dvh (dynamic viewport height) instead of 100vh.
     * dvh accounts for the mobile browser's UI (address bar, keyboard)
     * so the layout stays correct when the keyboard opens.
     */
    <div className="flex flex-col bg-[#FAF3E1]" style={{ height: '100dvh' }}>
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-4 flex flex-col min-h-0">
        {/* min-h-0 is required for flex children to scroll correctly */}
        <div className="flex-1 space-y-4 overflow-y-auto mb-4 min-h-0">
          {messages.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-4 text-center">
              <img
                src="/icon-192.png"
                alt=""
                aria-hidden="true"
                className="h-16 w-16 rounded-xl"
              />
              <h1 className="text-2xl sm:text-3xl font-semibold text-[#8A244B]">
                {greeting(username)}
              </h1>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[75%] flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`w-fit px-4 py-3 rounded-2xl text-sm leading-relaxed
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
                {message.role === 'bot' && !message.isError && index === messages.length - 1 && (
                  <img
                    src="/icon-192.png"
                    alt="Hawkbot"
                    className="block h-9 w-9 rounded-lg mt-2 ml-1 shadow-sm ring-1 ring-[#8A244B]/15"
                  />
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex items-end justify-start gap-2">
              <img
                src="/icon-192.png"
                alt="Hawkbot is thinking"
                className="h-9 w-9 rounded-lg shadow-sm ring-1 ring-[#8A244B]/15 animate-spin [animation-duration:1.4s] motion-reduce:animate-pulse"
              />
              <div className="bg-white border border-slate-200 shadow-sm px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1">
                <span className="w-2 h-2 bg-[#8A244B] rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-[#8A244B] rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-[#8A244B] rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {(messages.length > 0 || loading) && <div ref={bottomRef} />}
        </div>

        {/* Usage bar */}
        {!isAdmin && <div className="mb-3 bg-white/35 backdrop-blur-md border border-white/50 rounded-2xl px-3 py-2.5 shadow-sm ring-1 ring-black/5">
          <p className={`text-xs font-medium mb-1.5 ${rateLimited ? 'text-[#8A244B]' : 'text-slate-500'}`}>
            {rateLimited
              ? 'Daily limit reached — see you tomorrow!'
              : `${DAILY_LIMIT - messagesUsed} question${DAILY_LIMIT - messagesUsed !== 1 ? 's' : ''} remaining today`}
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: DAILY_LIMIT }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-1 rounded-full transition-colors duration-300"
                style={{ backgroundColor: i < messagesUsed ? '#8A244B' : '#D6C9B0' }}
              />
            ))}
          </div>
        </div>}

        {/* Input bar */}
        <div className={`flex gap-3 bg-white border rounded-2xl px-4 py-3 shadow-sm transition-colors flex-shrink-0
          ${isInputDisabled ? 'border-slate-100 opacity-60' : 'border-slate-200'}`}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              if (e.target.value.length > MAX_MESSAGE_LENGTH) {
                setInputError(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer`)
              } else {
                setInputError(null)
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={rateLimited ? 'Daily limit reached' : 'Ask about campus...'}
            disabled={isInputDisabled}
            maxLength={MAX_MESSAGE_LENGTH + 50}
            /*
             * font-size must be at least 16px on iOS to prevent
             * Safari from auto-zooming when the input is focused.
             * We use text-base (16px) here instead of text-sm (14px).
             */
            className="flex-1 text-base text-slate-700 placeholder-slate-400
                       focus:outline-none disabled:cursor-not-allowed bg-transparent"
          />
          <button
            onClick={handleSend}
            disabled={isInputDisabled || !input.trim() || !!inputError}
            className="px-4 py-1.5 bg-[#8A244B] text-white text-sm rounded-xl
                       hover:scale-105 active:scale-95 disabled:opacity-50
                       disabled:hover:scale-100 transition-all"
          >
            Send
          </button>
        </div>
        {inputError && (
          <p className="text-xs text-[#8A244B] mt-1.5 px-1">{inputError}</p>
        )}
        {!inputError && input.length > 200 && (
          <p className="text-xs text-slate-400 mt-1.5 px-1 text-right">
            {input.length}/{MAX_MESSAGE_LENGTH}
          </p>
        )}
      </main>
    </div>
  )
}
