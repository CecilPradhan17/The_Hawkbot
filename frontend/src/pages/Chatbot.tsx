import { useState, useRef, useEffect } from 'react'
import { reportOutdatedKnowledge, sendChatMessage, type ChatSource } from '@/api/chat.api'
import Header from '@/components/Header'
import { useAuth } from '@/context/AuthContext'
import AskQuestionModal from '@/components/posts/AskQuestionModal'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  DAILY_CHAT_LIMIT,
  MAX_CHAT_MESSAGE_LENGTH,
  getRandomChatGreeting,
  getStoredChatUsage,
  saveChatUsage,
} from '@/utils/chatSession'
import { getTimeAgo } from '@/utils/timeAgo'

interface Message {
  id: number
  role: 'user' | 'bot'
  content: string
  matched?: boolean
  isError?: boolean
  draftQuestion?: string
  postedToHawkwall?: boolean
  knowledgeIds?: number[]
  sources?: ChatSource[]
  outdatedState?: 'sending' | 'reported' | 'error'
}

interface QuestionDraft {
  messageId: number
  content: string
}

const chatStorageKey = (userId: number) => `hawkbot-chat-messages:${userId}`

function loadChatMessages(userId: number | null): Message[] {
  if (userId === null) return []
  try {
    const stored = sessionStorage.getItem(chatStorageKey(userId))
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((message): message is Message => {
      if (!message || typeof message !== 'object') return false
      const candidate = message as Partial<Message>
      return typeof candidate.id === 'number'
        && (candidate.role === 'user' || candidate.role === 'bot')
        && typeof candidate.content === 'string'
    })
  } catch {
    return []
  }
}

function saveChatMessages(userId: number | null, messages: Message[]) {
  if (userId === null) return
  try {
    const stableMessages = messages.map(message => message.outdatedState === 'sending'
      ? { ...message, outdatedState: undefined }
      : message)
    sessionStorage.setItem(chatStorageKey(userId), JSON.stringify(stableMessages))
  } catch {
    // Storage can be unavailable in private browsing or when its quota is exhausted.
  }
}

function BotMessageContent({ content, sources = [] }: { content: string; sources?: ChatSource[] }) {
  if (sources.length) {
    return (
      <>
        {content}
        <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-2 text-xs text-slate-500">
          <span>Sources:</span>
          {sources.map(source => source.type === 'hawkwall' ? (
            <div key={`${source.url}-${source.postId ?? ''}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-600">
              <p className="font-medium text-slate-700">{source.title}</p>
              {source.excerpt && source.excerpt !== source.title && (
                <p className="mt-1 line-clamp-2">{source.excerpt}</p>
              )}
              <div className="mt-2 flex items-center justify-between gap-3">
                <span>
                  {source.approvalCount ?? 0} community approvals
                  {source.createdAt ? ` · ${getTimeAgo(source.createdAt)}` : ''}
                </span>
                {Number.isInteger(Number(source.postId)) && Number(source.postId) > 0 ? (
                  <Link
                    to={`/sources/hawkwall/${source.postId}`}
                    className="font-semibold text-[#1B5E8A] underline underline-offset-2 hover:text-[#164d72]"
                  >
                    See source
                  </Link>
                ) : (
                  <span className="font-medium text-slate-400">Discussion unavailable</span>
                )}
              </div>
            </div>
          ) : (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-fit font-medium text-[#1B5E8A] underline underline-offset-2 hover:text-[#164d72]"
            >
              {source.title}
            </a>
          ))}
        </div>
      </>
    )
  }
  const marker = '\n\nSource:'
  const sourceIndex = content.lastIndexOf(marker)
  if (sourceIndex === -1) return <>{content}</>

  const source = content.slice(sourceIndex + marker.length).trim()
  const sourceIsUrl = /^https:\/\/[^\s]+$/.test(source)

  return (
    <>
      {content.slice(0, sourceIndex)}
      <p className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-500">
        Source:{' '}
        {sourceIsUrl ? (
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#1B5E8A] underline underline-offset-2 hover:text-[#164d72]"
          >
            View the official ULM Dining menu
          </a>
        ) : source}
      </p>
    </>
  )
}

export default function Chatbot() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userId, username, isAdmin } = useAuth()
  const initialMessage = typeof (location.state as { initialMessage?: unknown } | null)?.initialMessage === 'string'
    ? (location.state as { initialMessage: string }).initialMessage
    : ''
  const [messages, setMessages] = useState<Message[]>(() => loadChatMessages(userId))
  const [greeting] = useState(() => getRandomChatGreeting(username))
  const [input, setInput] = useState(initialMessage)
  const [loading, setLoading] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)
  const [messagesUsed, setMessagesUsed] = useState(() => getStoredChatUsage())
  const [rateLimited, setRateLimited] = useState(() => !isAdmin && getStoredChatUsage() >= DAILY_CHAT_LIMIT)
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const initialMessagePending = useRef(Boolean(initialMessage))

  // Auto-focus input on page load to show keyboard immediately on mobile
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    saveChatMessages(userId, messages)
  }, [messages, userId])

  useEffect(() => {
    if (!initialMessagePending.current) return
    initialMessagePending.current = false
    navigate('/chat', { replace: true, state: null })
    formRef.current?.requestSubmit()
  }, [navigate])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || loading || rateLimited) return
    if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) {
      setInputError(`Message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or fewer`)
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
          saveChatUsage(next)
          if (next >= DAILY_CHAT_LIMIT) setRateLimited(true)
          return next
        })
      }

      const botMessageId = Date.now() + 1
      setMessages(prev => [
        ...prev,
        {
          id: botMessageId,
          role: 'bot',
          content: data.response,
          matched: data.matched,
          draftQuestion: data.matched ? undefined : trimmed,
          knowledgeIds: data.knowledgeIds,
          sources: data.sources,
        },
      ])
    } catch (err: unknown) {
      const isRateLimit = err instanceof Error && err.message.includes('daily limit')

      if (isRateLimit) {
        setRateLimited(true)
        setMessagesUsed(DAILY_CHAT_LIMIT)
        saveChatUsage(DAILY_CHAT_LIMIT)
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

  const isInputDisabled = loading || (!isAdmin && rateLimited)

  const handleOutdated = async (message: Message) => {
    if (!message.knowledgeIds?.length || message.outdatedState === 'sending') return
    setMessages(previous => previous.map(item => item.id === message.id ? { ...item, outdatedState: 'sending' } : item))
    try {
      await reportOutdatedKnowledge(message.knowledgeIds)
      setMessages(previous => previous.map(item => item.id === message.id ? { ...item, outdatedState: 'reported' } : item))
    } catch {
      setMessages(previous => previous.map(item => item.id === message.id ? { ...item, outdatedState: 'error' } : item))
    }
  }

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
                {greeting}
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
                  className={`w-fit whitespace-pre-wrap px-4 py-3 rounded-2xl text-sm leading-relaxed
                    ${message.role === 'user'
                      ? 'bg-[#8A244B] text-white rounded-br-sm'
                      : message.isError
                        ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                        : 'bg-white text-slate-700 shadow-sm border border-slate-200 rounded-bl-sm'
                    }`}
                >
                  {message.role === 'bot' ? <BotMessageContent content={message.content} sources={message.sources} /> : message.content}
                  {message.role === 'bot' && message.matched === false && !message.isError && (
                    <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                      {message.postedToHawkwall ? (
                        <p className="text-xs font-semibold text-emerald-700">✓ Posted to Hawkwall</p>
                      ) : (
                        <button
                          onClick={() => message.draftQuestion && setQuestionDraft({ messageId: message.id, content: message.draftQuestion })}
                          className="rounded-lg bg-[#1B5E8A] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#164d72] active:scale-95"
                        >
                          Post Question on HawkWall
                        </button>
                      )}
                    </div>
                  )}
                  {message.role === 'bot' && message.matched && message.knowledgeIds?.length ? (
                    <div className="mt-3 flex justify-end border-t border-slate-100 pt-2">
                      {message.outdatedState === 'reported' ? (
                        <span className="text-xs font-medium text-slate-500">Thanks — reported for review</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleOutdated(message)}
                          disabled={message.outdatedState === 'sending'}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50"
                        >
                          {message.outdatedState === 'sending' ? 'Reporting…' : message.outdatedState === 'error' ? 'Try reporting again' : 'Outdated?'}
                        </button>
                      )}
                    </div>
                  ) : null}
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
                src="/animated-h-logo.svg"
                alt="Hawkbot is thinking"
                className="h-9 w-9 rounded-lg shadow-sm ring-1 ring-[#8A244B]/15"
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
              : `${DAILY_CHAT_LIMIT - messagesUsed} question${DAILY_CHAT_LIMIT - messagesUsed !== 1 ? 's' : ''} remaining today`}
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: DAILY_CHAT_LIMIT }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-1 rounded-full transition-colors duration-300"
                style={{ backgroundColor: i < messagesUsed ? '#8A244B' : '#D6C9B0' }}
              />
            ))}
          </div>
        </div>}

        {/* Input bar */}
        <form ref={formRef} onSubmit={event => { event.preventDefault(); void handleSend() }} className={`flex gap-3 bg-white border rounded-2xl px-4 py-3 shadow-sm transition-colors flex-shrink-0
          ${isInputDisabled ? 'border-slate-100 opacity-60' : 'border-slate-200'}`}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              if (e.target.value.length > MAX_CHAT_MESSAGE_LENGTH) {
                setInputError(`Message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or fewer`)
              } else {
                setInputError(null)
              }
            }}
            placeholder={rateLimited ? 'Daily limit reached' : 'Ask about campus...'}
            disabled={isInputDisabled}
            maxLength={MAX_CHAT_MESSAGE_LENGTH + 50}
            /*
             * font-size must be at least 16px on iOS to prevent
             * Safari from auto-zooming when the input is focused.
             * We use text-base (16px) here instead of text-sm (14px).
             */
            className="flex-1 text-base text-slate-700 placeholder-slate-400
                       focus:outline-none disabled:cursor-not-allowed bg-transparent"
          />
          <button
            type="submit"
            disabled={isInputDisabled || !input.trim() || !!inputError}
            className="px-4 py-1.5 bg-[#8A244B] text-white text-sm rounded-xl
                       hover:scale-105 active:scale-95 disabled:opacity-50
                       disabled:hover:scale-100 transition-all"
          >
            Send
          </button>
        </form>
        {inputError && (
          <p className="text-xs text-[#8A244B] mt-1.5 px-1">{inputError}</p>
        )}
        {!inputError && input.length > 200 && (
          <p className="text-xs text-slate-400 mt-1.5 px-1 text-right">
            {input.length}/{MAX_CHAT_MESSAGE_LENGTH}
          </p>
        )}
      </main>

      {questionDraft && (
        <AskQuestionModal
          initialContent={questionDraft.content}
          fromChatbot
          onClose={() => setQuestionDraft(null)}
          onPostCreated={() => {
            setMessages(previous => previous.map(message =>
              message.id === questionDraft.messageId
                ? { ...message, postedToHawkwall: true }
                : message
            ))
            navigate('/posts')
          }}
        />
      )}
    </div>
  )
}
