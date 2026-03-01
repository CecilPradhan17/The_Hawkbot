import { useEffect, useState, useCallback } from 'react'

const WAKE_SECONDS = 60

interface ServerWakeModalProps {
  isWaking: boolean
}

interface Joke {
  setup: string
  punchline: string
}

const FALLBACK_JOKES: Joke[] = [
  { setup: "Why did the server go to sleep?", punchline: "Because it was on Render's free tier! 😴" },
  { setup: "Why do programmers prefer dark mode?", punchline: "Because light attracts bugs!" },
  { setup: "Why did the developer go broke?", punchline: "Because they used too many free tiers!" },
]

export default function ServerWakeModal({ isWaking }: ServerWakeModalProps) {
  const [seconds, setSeconds] = useState(WAKE_SECONDS)
  const [timedOut, setTimedOut] = useState(false)
  const [joke, setJoke] = useState<Joke | null>(null)
  const [jokeLoading, setJokeLoading] = useState(true)

  const fetchJoke = useCallback(async () => {
    setJokeLoading(true)
    try {
      const res = await fetch('https://official-joke-api.appspot.com/random_joke')
      const data = await res.json()
      setJoke({ setup: data.setup, punchline: data.punchline })
    } catch {
      const fallback = FALLBACK_JOKES[Math.floor(Math.random() * FALLBACK_JOKES.length)]
      setJoke(fallback)
    } finally {
      setJokeLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isWaking) {
      setSeconds(WAKE_SECONDS)
      setTimedOut(false)
      setJoke(null)
      setJokeLoading(true)
      return
    }

    fetchJoke()

    setSeconds(WAKE_SECONDS)
    setTimedOut(false)

    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          setTimedOut(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isWaking, fetchJoke])

  if (!isWaking) return null

  const progress = ((WAKE_SECONDS - seconds) / WAKE_SECONDS) * 100

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#FAF3E1] rounded-2xl p-8 max-w-md w-full shadow-2xl">

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-[#8A244B] mb-3">
            Cecil is broke!
          </h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Since I can't afford the premium plan for the server, it goes to sleep after
            inactivity and needs ~60 secs to wake up again. However here are some cool
            jokes to pass the time:
          </p>
        </div>

        {/* Progress bar + counter */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-400">Waking up...</span>
            <span className={`text-sm font-bold tabular-nums ${
              timedOut ? 'text-red-500' : seconds <= 10 ? 'text-yellow-600' : 'text-[#8A244B]'
            }`}>
              {timedOut ? 'Taking longer than expected...' : `${seconds}s`}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-1000 ease-linear ${
                timedOut ? 'bg-red-400' : 'bg-[#8A244B]'
              }`}
              style={{ width: `${timedOut ? 100 : progress}%` }}
            />
          </div>
        </div>

        {/* Timed out error state */}
        {timedOut ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
            <p className="text-red-700 font-medium mb-1">
              This is taking longer than expected.
            </p>
            <p className="text-red-500 text-sm mb-4">
              There might be a separate issue — it's not just the server sleeping.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-500 text-white rounded-lg
                         hover:scale-105 active:scale-95 transition-all text-sm font-medium"
            >
              Reload the page
            </button>
          </div>
        ) : (
          <>
            {/* Joke card */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 mb-4 min-h-[100px]">
              {jokeLoading ? (
                <div className="flex gap-1 justify-center items-center h-16">
                  <span className="w-2 h-2 bg-[#8A244B] rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-[#8A244B] rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-[#8A244B] rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              ) : joke ? (
                <>
                  <p className="text-slate-700 font-medium mb-3">{joke.setup}</p>
                  <p className="text-[#8A244B] font-semibold">{joke.punchline}</p>
                </>
              ) : null}
            </div>

            {/* New joke button */}
            <button
              onClick={fetchJoke}
              disabled={jokeLoading}
              className="w-full px-4 py-2 bg-[#8A244B] text-white rounded-lg
                         hover:scale-105 active:scale-95 disabled:opacity-50
                         disabled:hover:scale-100 transition-all text-sm font-medium"
            >
              {jokeLoading ? 'Loading...' : 'New Joke 🎤'}
            </button>

            {/* Auto dismiss note */}
            <p className="text-center text-xs text-slate-400 mt-4">
              This will dismiss automatically once the server is ready 🦅
            </p>
          </>
        )}
      </div>
    </div>
  )
}